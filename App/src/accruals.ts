import type { AccrualCode, AccrualDirection, AppData, JournalLine } from './types';
import { nextGliFor, addJournal, resolveFormulaAccount, externalAccountFor } from './engine';
import type { EventMessage } from './engine';

// YYYYMM arithmetic
export function periodAdd(period: string, months: number): string {
  const y = Number(period.slice(0, 4));
  const m = Number(period.slice(4)) - 1 + months;
  const year = y + Math.floor(m / 12);
  const month = ((m % 12) + 12) % 12 + 1;
  return `${year}${String(month).padStart(2, '0')}`;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Straight-line spread of a total over N months; the last period absorbs rounding
// so the parts always sum back exactly to the total.
export function straightLineSchedule(total: number, months: number, startPeriod: string):
  { period: string; amount: number }[] {
  const n = Math.max(1, months);
  const per = round2(total / n);
  const lines: { period: string; amount: number }[] = [];
  let allocated = 0;
  for (let i = 0; i < n; i++) {
    const amount = i === n - 1 ? round2(total - allocated) : per;
    allocated = round2(allocated + amount);
    lines.push({ period: periodAdd(startPeriod, i), amount });
  }
  return lines;
}

// The initial deferral booking at creation: the whole total parks on the balance sheet.
// Cost   (insurance):  Dr deferral / Cr counter
// Income (unearned):   Dr counter  / Cr deferral
export function deferralLines(
  code: AccrualCode,
  amount: number,
  accountDescription: (accountCode: string) => string,
  ctx: { agreement: string; agreementLine: number | null; currency: string },
): JournalLine[] {
  const isCost = code.direction === 'Cost';
  const deferralDebit = isCost;
  const mk = (line: number, account: string, debit: number, credit: number): JournalLine => ({
    line, pseudoAccount: account, description: accountDescription(account),
    agreement: ctx.agreement, agreementLine: ctx.agreementLine, invoice: '', refNo: '',
    debit, credit, ledger: 'Local Legal', currency: ctx.currency, formula: `ACR-${code.code}`,
    externalAccountString: '', amountType: 'Accrual deferral', conditionValue: code.name,
  });
  return [
    mk(1, code.deferralAccount, deferralDebit ? amount : 0, deferralDebit ? 0 : amount),
    mk(2, code.counterAccount, deferralDebit ? 0 : amount, deferralDebit ? amount : 0),
  ];
}

// One period's recognition booking: release a slice from the balance to the P&L.
// Cost:   Dr recognition / Cr deferral
// Income: Dr deferral     / Cr recognition
export function recognitionLine(
  code: AccrualCode,
  direction: AccrualDirection,
  amount: number,
  side: 'recognition' | 'deferral',
): { account: string; debit: number; credit: number } {
  const isCost = direction === 'Cost';
  // recognition side is debit for cost, credit for income
  const recognitionIsDebit = isCost;
  if (side === 'recognition') {
    return { account: code.recognitionAccount, debit: recognitionIsDebit ? amount : 0, credit: recognitionIsDebit ? 0 : amount };
  }
  return { account: code.deferralAccount, debit: recognitionIsDebit ? 0 : amount, credit: recognitionIsDebit ? amount : 0 };
}

// The description of a pseudo account for an entity (falls back to the code).
function pseudoDescOf(d: AppData, ownerCode: string, code: string): string {
  return d.pseudoAccounts.find(p => p.entityCode === ownerCode && p.pseudo === code)?.description ?? code;
}

// Create the runtime accrual (item + full recognition schedule) inside a draft. The caller
// is responsible for booking the deferral GLI (via deferralLines) and passing its number as
// sourceGli. Returns the new item id. Shared by manual creation and message-driven creation.
export function appendAccrualItem(
  d: AppData,
  ownerCode: string,
  code: AccrualCode,
  ctx: {
    agreement: string; agreementLine: number | null; amount: number; startPeriod: string; currency: string;
    sourceGli: number | null; conditionInputs?: Record<number, string>; months?: number;
    messageContext?: { portfolio?: string; product?: string; customer?: string; supplier?: string; accountValues?: Record<string, string> };
  },
): number {
  // Spread length comes per accrual (the message / agreement term); the code's months is only the
  // default — so one "Insurance" code serves 6-, 12- and 36-month agreements.
  const months = ctx.months && ctx.months > 0 ? ctx.months : code.months;
  const schedule = straightLineSchedule(ctx.amount, months, ctx.startPeriod);
  const itemId = Math.max(0, ...d.accrualItems.map(i => i.id)) + 1;
  d.accrualItems.push({
    id: itemId, entityCode: ownerCode, accrualCodeId: code.id,
    accrualCode: code.code, accrualName: code.name,
    agreement: ctx.agreement, agreementLine: ctx.agreementLine,
    totalAmount: ctx.amount, currency: ctx.currency,
    startPeriod: ctx.startPeriod, endPeriod: schedule[schedule.length - 1].period,
    amountAccrued: 0, amountRemaining: ctx.amount, status: 'Active',
    createdDate: new Date().toISOString().slice(0, 10), sourceGli: ctx.sourceGli,
    conditionInputs: ctx.conditionInputs ?? {},
    messageContext: ctx.messageContext,
  });
  let lineId = Math.max(0, ...d.accrualScheduleLines.map(l => l.id));
  for (const s of schedule) {
    lineId += 1;
    d.accrualScheduleLines.push({
      id: lineId, accrualItemId: itemId, period: s.period,
      plannedAmount: s.amount, recognizedAmount: 0, recognizedGli: null, status: 'Pending',
    });
  }
  return itemId;
}

// Read-only summary of what a recognition run for `period` would book. Compute this BEFORE
// calling update() so the banner is reliable under React StrictMode double-invocation.
export function planAccrualRecognition(data: AppData, ownerCode: string, period: string): { count: number; total: number } {
  let count = 0;
  let total = 0;
  for (const item of data.accrualItems) {
    if (item.entityCode !== ownerCode || item.status !== 'Active') continue;
    const due = data.accrualScheduleLines.filter(
      l => l.accrualItemId === item.id && l.status === 'Pending' && l.period <= period,
    );
    if (due.length === 0) continue;
    count += 1;
    total = round2(total + round2(due.reduce((s, l) => s + l.plannedAmount, 0)));
  }
  return { count, total };
}

// Recognise every accrual slice due up to and including `period`: book one Monthly Booking
// GLI journal (Dr P&L / Cr balance for costs), mark the schedule lines, and advance each
// item's accrued/remaining/status. Mutates the draft; safe to call from any run trigger.
// `source` labels who ran it (e.g. 'End of month' or 'Monthly accrual run').
export function recognizeAccruals(
  d: AppData,
  entityId: number,
  ownerCode: string,
  period: string,
  source: string,
): { count: number; total: number } {
  const entity = d.legalEntities.find(e => e.id === entityId);
  const gli = entity ? nextGliFor(d, entity) : Math.max(0, ...d.journals.map(j => j.gliNumber)) + 1;
  const journalLines: JournalLine[] = [];
  let lineNo = 0;
  let count = 0;
  let total = 0;

  for (const item of d.accrualItems) {
    if (item.entityCode !== ownerCode || item.status !== 'Active') continue;
    const code = d.accrualCodes.find(c => c.id === item.accrualCodeId);
    if (!code) continue;
    const due = d.accrualScheduleLines.filter(
      l => l.accrualItemId === item.id && l.status === 'Pending' && l.period <= period,
    );
    if (due.length === 0) continue;
    const amount = round2(due.reduce((s, l) => s + l.plannedAmount, 0));

    // Recognition (P&L) account: routed through the code's recognition formula + its conditions
    // (e.g. a different account per Accounting Type), resolved with the item's snapshotted inputs.
    // Falls back to the code's fixed recognitionAccount when no formula / no condition matches.
    const isCost = code.direction === 'Cost';
    let recAccount = code.recognitionAccount;
    if (code.recognitionFormulaId != null) {
      const formula = d.formulas.find(f => f.id === code.recognitionFormulaId);
      if (formula) {
        const resolved = resolveFormulaAccount(d, ownerCode, formula, isCost ? 'D' : 'C', item.conditionInputs ?? {});
        if (resolved) recAccount = resolved;
      }
    }
    const rec = { account: recAccount, debit: isCost ? amount : 0, credit: isCost ? 0 : amount };
    const def = recognitionLine(code, code.direction, amount, 'deferral');
    // Rebuild the message context from the item's snapshot so the recognition lines carry the same
    // external account string (dimensions) and customer/supplier the deferral did.
    const mc = item.messageContext;
    const recMsg: EventMessage = {
      legalEntityId: entityId, accountingClassId: 0, accountingEventId: 0,
      bookingDate: `${period.slice(0, 4)}-${period.slice(4)}-01`,
      agreement: item.agreement, agreementLine: item.agreementLine != null ? String(item.agreementLine) : '',
      portfolio: mc?.portfolio ?? '', invoice: '', product: mc?.product, customer: mc?.customer, supplier: mc?.supplier,
      conditionInputs: item.conditionInputs ?? {}, amounts: {}, accountValues: mc?.accountValues,
    };
    for (const l of [rec, def]) {
      lineNo += 1;
      const pseudo = d.pseudoAccounts.find(p => p.entityCode === ownerCode && p.pseudo === l.account);
      journalLines.push({
        line: lineNo, pseudoAccount: l.account, description: pseudoDescOf(d, ownerCode, l.account),
        agreement: item.agreement, agreementLine: item.agreementLine, invoice: '', refNo: '',
        customer: mc?.customer, supplier: mc?.supplier,
        debit: l.debit, credit: l.credit, ledger: 'Local Legal', currency: item.currency,
        formula: `ACR-${code.code}`, externalAccountString: entity ? externalAccountFor(d, entity, pseudo, recMsg) : '',
        amountType: 'Accrual recognition', conditionValue: `${item.accrualCode} ${period}`,
      });
    }
    for (const line of due) {
      line.status = 'Recognized';
      line.recognizedAmount = line.plannedAmount;
      line.recognizedGli = gli;
    }
    item.amountAccrued = round2(item.amountAccrued + amount);
    item.amountRemaining = round2(item.totalAmount - item.amountAccrued);
    if (item.amountRemaining <= 0.004) item.status = 'Completed';
    count += 1;
    total = round2(total + amount);
  }

  if (journalLines.length > 0) {
    addJournal(d, {
      gliNumber: gli, gliPrefix: entity?.gliPrefix, legalEntityId: entityId, accountingEvent: 'Monthly Booking',
      lines: journalLines, lineCount: journalLines.length,
      bookingDate: `${period.slice(0, 4)}-${period.slice(4)}-01`,
      createDate: new Date().toISOString().slice(0, 10), exportDate: null,
      difference: false, createdBy: source,
    }, { source });
    if (entity) { entity.gliNumberSerie = gli; entity.nextGli = gli + 1; }
  }
  return { count, total };
}

// One accrual-carrying amount line on a message: an amount type, an optional Amount Code, and
// the amount. The Amount Code is only needed to pick the accrual code when the amount type maps
// to several (e.g. a generic Tax line that could be property tax or vehicle tax).
export interface MessageAccrualLine {
  amountTypeId: number;
  amountCode?: string | null;
  amount: number;
  months?: number; // spread length from the sender (agreement term); falls back to the code's default
}

export interface ResolvedMessageAccrual {
  code: AccrualCode;
  amountTypeId: number;
  amountTypeName: string;
  amountCode: string | null;
  amount: number;
  months?: number;
}

// Resolve each accrual line to its accrual code. A line matches a code that triggers on its
// amount type; when several codes share the amount type, the line's Amount Code selects one.
// Lines matching no code (or ambiguous with no/*wrong* Amount Code) are skipped.
export function resolveMessageAccruals(
  data: AppData,
  ownerCode: string,
  lines: MessageAccrualLine[],
): ResolvedMessageAccrual[] {
  const out: ResolvedMessageAccrual[] = [];
  for (const line of lines) {
    if (!line.amount) continue;
    const candidates = data.accrualCodes.filter(
      c => c.entityCode === ownerCode && c.triggerAmountTypeId === line.amountTypeId,
    );
    if (candidates.length === 0) continue;
    const code = candidates.length === 1 && !line.amountCode
      ? candidates[0]
      : candidates.find(c => c.code.toLowerCase() === (line.amountCode ?? '').toLowerCase());
    if (!code) continue;
    const at = data.amountTypes.find(a => a.id === line.amountTypeId);
    out.push({
      code, amountTypeId: line.amountTypeId, amountTypeName: at?.name ?? '',
      amountCode: line.amountCode ?? null, amount: line.amount, months: line.months,
    });
  }
  return out;
}
