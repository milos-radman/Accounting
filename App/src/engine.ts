import type { AccountingEvent, AppData, Condition, ExtAccountPart, Formula, Journal, JournalLine, LegalEntity, PendingMessage, PseudoAccount } from './types';

// The booking engine: takes an event message (as another domain would send it)
// and resolves accounting rules -> formulas -> conditions -> pseudo accounts
// into journal lines, mirroring the flow in the specification.

export interface EventMessage {
  // Correlation id the sending domain stamps on the message; echoed on the outbound Journal
  // posted event so the sender can match the confirmation to what it sent.
  messageId?: string;
  legalEntityId: number;
  accountingClassId: number;
  accountingEventId: number;
  bookingDate: string; // the event date — the day the event was run/occurred
  // The agreement/line date used when the event's basis is Calculation Date (e.g. the agreement
  // line start date). The effective booking date is derived from these + the event's setting.
  calculationDate?: string;
  period?: string; // accounting period (YYYYMM), derived from the message date (not typed in)
  invoicingPeriod?: number; // billing period the event relates to — a number, e.g. which installment
  agreement: string;
  agreementLine: string;
  portfolio: string;
  invoice: string;
  referenceNumber?: string; // external reference — our unique id for a supplier invoice
  paymentId?: string; // unique id of this payment (AR/AP payment messages)
  // Reversal-only: the reference to the ORIGINAL booking being reversed (e.g. the debit invoice
  // number we are crediting, or the payment id we are undoing). Interpreted per reverseMatchBy.
  reversalReference?: string;
  product?: string;
  customer?: string;
  supplier?: string;
  // Transaction currency of the message and its rate to the entity's base currency. Default:
  // the entity base currency at rate 1. Amounts are in this currency; the base value is
  // amount × currencyRate. Stored on each journal line so it can later be revalued.
  currency?: string;
  currencyRate?: number;
  // message attribute values keyed by ConditionValue id (7=Accounting Type, 17=Term Reason, 18=Amount Code, ...)
  conditionInputs: Record<number, string>;
  // amounts keyed by AmountType id (for single-value types)
  amounts: Record<number, number>;
  // For amount types that allow multiple amount codes (e.g. Added Cost): one entry per code.
  // Each is booked separately, its account resolved with that code fed into the conditions.
  amountCodeLines?: { amountTypeId: number; amountCode: string; amount: number }[];
  // Generic dimension bag: values for accounting-dimension sources that don't come from a
  // fixed header field, keyed by the ExtAccountValue name (e.g. 'Asset Number', 'Reg. Number',
  // 'Supplier identity', 'Cost Center', 'Tax Code'). Sourced from the contract/asset/supplier
  // domains. The sender supplies whatever it has; the entity's configured parts decide what is
  // actually used, so a supplier invoice with no agreement/line still resolves its dimensions.
  accountValues?: Record<string, string>;
}

export interface SimLine {
  ruleId: number;
  ledger: string;
  formulaCode: string;
  formulaName: string;
  amountType: string;
  debitCredit: 'D' | 'C';
  amount: number;
  account: string | null; // resolved pseudo account
  accountDescription: string;
  trace: string; // how the account was resolved
  externalAccount: string; // external account string per the entity's accounting dimensions
  amountCode?: string; // the amount code this line was booked under (multi-code amount types)
}

/// Builds the external account string from the entity's accounting dimensions:
/// with a separator the values are joined; without one each dimension is
/// padded/truncated to its fixed number of positions.
export function buildExternalAccountString(
  parts: ExtAccountPart[],
  separator: string,
  valueFor: (sourceName: string, extAccountValueId: number) => string,
): string {
  const values = [...parts]
    .sort((a, b) => a.partNumber - b.partNumber)
    .map(p => {
      const raw = valueFor(p.name, p.extAccountValueId);
      if (separator) return raw;
      return raw.padEnd(Math.max(1, p.length), ' ').slice(0, Math.max(1, p.length));
    });
  return values.join(separator);
}

// ConditionValue ids of message attributes usable as dimension sources
const PRODUCT_CONDITION_VALUE = 8;
const AMOUNT_CODE_CONDITION_VALUE = 18;

// The accounting dimensions actually written for a pseudo account, in partNumber order.
// PseudoAccountExtParts store only opt-outs; required dimensions and missing rows are in use.
export function inUseParts(data: AppData, entity: LegalEntity, account: PseudoAccount | undefined): ExtAccountPart[] {
  const inUse = (partId: number, required: boolean): boolean => {
    if (required || !account) return true;
    const row = data.pseudoAccountExtParts.find(
      x => x.entityCode === entity.ownerCode && x.pseudoAccountId === account.id && x.extAccountPartId === partId,
    );
    return row ? row.inUse : true;
  };
  return data.extAccountParts
    .filter(p => p.legalEntityId === entity.id)
    .filter(p => inUse(p.id, p.required))
    .sort((a, b) => a.partNumber - b.partNumber);
}

export function externalAccountFor(
  data: AppData,
  entity: LegalEntity,
  account: PseudoAccount | undefined,
  msg: EventMessage,
): string {
  const parts = inUseParts(data, entity, account);
  if (parts.length === 0) return account?.extPseudo ?? '';
  const orgUnit = data.organizationUnits.find(o => o.legalEntityId === entity.id);
  const currencyCode = data.currencies.find(c => c.id === entity.baseCurrencyId)?.code ?? 'EUR';

  // Values for the named message envelope fields (source === 'Message'). In this prototype
  // the tenant/OU are the selected entity, so they are derived here; the rest are read from
  // the message the sending domain composed.
  const messageFieldValues: Record<string, string> = {
    'Company/Tenant': String(entity.id).padStart(3, '0'),
    'Organization Unit': orgUnit ? String(orgUnit.id).padStart(4, '0') : '',
    'Portfolio': msg.portfolio ?? '',
    'Product': msg.product ?? msg.conditionInputs[PRODUCT_CONDITION_VALUE] ?? '',
    'Agreement Number': msg.agreement ?? '',
    'Agreement Line': msg.agreementLine ?? '',
    'Customer identity': msg.customer ?? '',
    'Supplier identity': msg.supplier ?? '',
    'Currency Code': currencyCode,
  };

  // Each dimension's value is resolved by its configured source, not a hard-coded rule:
  // PseudoAccount → the account; Message → a named envelope field; AccountValuesList → the bag.
  return buildExternalAccountString(parts, entity.dimensionSeparator ?? '', (name, partValueId) => {
    const def = data.extAccountValues.find(v => v.id === partValueId) ?? data.extAccountValues.find(v => v.name === name);
    const source = def?.source ?? 'AccountValuesList';
    if (source === 'PseudoAccount') return account?.extPseudo ?? '';
    if (source === 'Message') return messageFieldValues[def?.messageField ?? name] ?? '';
    return msg.accountValues?.[name] ?? '';
  });
}

export function ledgerIdsFor(data: AppData, entityId: number, accountingClassId: number): number[] {
  const lac = data.legalAccountingClasses.find(
    c => c.legalEntityId === entityId && c.accountingClassId === accountingClassId,
  );
  if (!lac) return [];
  return data.legalAccountingLedgers.filter(l => l.legalAccountingClassId === lac.id).map(l => l.id);
}

export function eventsWithRules(data: AppData, entity: LegalEntity, accountingClassId: number): number[] {
  const ledgers = ledgerIdsFor(data, entity.id, accountingClassId);
  const ids = data.accountingRules
    .filter(r => r.entityCode === entity.ownerCode && ledgers.includes(r.legalAccountingLedgerId))
    .map(r => r.accountingEventId);
  return [...new Set(ids)];
}

export function formulasFor(data: AppData, entity: LegalEntity, accountingClassId: number, eventId: number): Formula[] {
  const ledgers = ledgerIdsFor(data, entity.id, accountingClassId);
  const formulaIds = new Set(
    data.accountingRules
      .filter(r => r.entityCode === entity.ownerCode && ledgers.includes(r.legalAccountingLedgerId) && r.accountingEventId === eventId)
      .map(r => r.formulaId),
  );
  return data.formulas.filter(f => formulaIds.has(f.id));
}

// Distinct condition-value ids used by the given formulas, with their pickable values. Each option
// carries the CODE (what the message sends / a condition matches) and a LABEL "code — description"
// built from the configured allowed values. Values used in conditions but not configured still show
// (by code), so nothing is lost.
export function conditionInputsNeeded(data: AppData, formulas: Formula[]): { conditionValueId: number; name: string; options: { code: string; label: string }[] }[] {
  const fcIds = new Set(formulas.map(f => f.formulaConditionId).filter((x): x is number => x != null));
  const rows = data.conditions.filter(c => fcIds.has(c.formulaConditionId));
  const byCv = new Map<number, Set<string>>();
  for (const row of rows) {
    if (row.conditionValueId == null || !row.value) continue;
    if (!byCv.has(row.conditionValueId)) byCv.set(row.conditionValueId, new Set());
    byCv.get(row.conditionValueId)!.add(row.value);
  }
  const configured = data.conditionValueOptions ?? [];
  return [...byCv.entries()].map(([cvId, values]) => {
    const opts = configured.filter(o => o.conditionValueId === cvId);
    const descOf = (code: string) => opts.find(o => o.code === code)?.description;
    const codes = [...new Set([...values, ...opts.map(o => o.code)])];
    return {
      conditionValueId: cvId,
      name: data.conditionValues.find(v => v.id === cvId)?.name ?? `Condition ${cvId}`,
      options: codes.map(code => ({ code, label: descOf(code) ? `${code} — ${descOf(code)}` : code })),
    };
  });
}

function matches(row: Condition, inputs: Record<number, string>): boolean {
  if (row.conditionValueId == null || !row.value) return false;
  const input = inputs[row.conditionValueId];
  return input != null && input.trim().toLowerCase() === row.value.trim().toLowerCase();
}

// Walk condition rows to resolve an account. A row without any account is a *filter* (guard);
// the account rows that follow it must match the filter as well as their own value. Filters are
// grouped structurally: a filter row that follows an account row opens a NEW group and resets the
// active filters (so e.g. "Accounting Type = DL … Accounting Type = MG …" are independent blocks);
// consecutive filter rows accumulate and must all hold (AND) within the same group.
function resolveConditionAccount(
  rows: Condition[],
  side: 'D' | 'C',
  inputs: Record<number, string>,
): { pseudoAccountId: number; trace: string } | null {
  let guards: { ok: boolean; label: string }[] = [];
  let prevWasAccount = false;
  for (const row of rows) {
    const hasAccounts = row.debitPseudoAccountId != null || row.creditPseudoAccountId != null;
    const rowMatches = matches(row, inputs);
    if (!hasAccounts) {
      if (prevWasAccount) guards = []; // a filter after a result starts a new group
      guards.push({ ok: rowMatches, label: `${row.value}` });
      prevWasAccount = false;
      continue;
    }
    prevWasAccount = true;
    const acctId = side === 'D' ? row.debitPseudoAccountId : row.creditPseudoAccountId;
    if (acctId == null) continue;
    if (rowMatches && guards.every(g => g.ok)) {
      const guardText = guards.length ? guards.map(g => g.label).join(' & ') + ' & ' : '';
      return { pseudoAccountId: acctId, trace: `condition ${guardText}${row.value}` };
    }
  }
  return null;
}

// Resolve a single account for a formula given condition inputs: use the condition-matched account
// if the formula has conditions and one matches, otherwise the formula's fixed side account.
// Returns the pseudo-account NUMBER for the given entity (or null when nothing resolves). Used by
// accrual recognition to route the P&L account by Accounting Type (etc.) through a formula.
export function resolveFormulaAccount(
  data: AppData,
  entityOwnerCode: string,
  formula: Formula,
  side: 'D' | 'C',
  inputs: Record<number, string>,
): string | null {
  const condRows = formula.formulaConditionId == null
    ? []
    : data.conditions.filter(c => c.formulaConditionId === formula.formulaConditionId);
  if (condRows.length > 0) {
    const hit = resolveConditionAccount(condRows, side, inputs);
    if (hit) {
      const p = data.pseudoAccounts.find(pa => pa.entityCode === entityOwnerCode && pa.id === hit.pseudoAccountId);
      return p?.pseudo ?? String(hit.pseudoAccountId);
    }
  }
  const direct = side === 'D' ? formula.debitAccount : formula.creditAccount;
  return direct ?? null;
}

export function simulateMessage(data: AppData, msg: EventMessage): SimLine[] {
  const entity = data.legalEntities.find(e => e.id === msg.legalEntityId);
  if (!entity) return [];
  const ledgers = ledgerIdsFor(data, msg.legalEntityId, msg.accountingClassId);

  const rules = data.accountingRules.filter(
    r => r.entityCode === entity.ownerCode
      && ledgers.includes(r.legalAccountingLedgerId)
      && r.accountingEventId === msg.accountingEventId,
  );

  const ledgerName = (legalAccountingLedgerId: number) => {
    const lal = data.legalAccountingLedgers.find(l => l.id === legalAccountingLedgerId);
    return data.ledgers.find(l => l.id === lal?.ledgerId)?.description ?? '';
  };
  const pseudoById = (id: number) => data.pseudoAccounts.find(p => p.entityCode === entity.ownerCode && p.id === id);
  const pseudoByCode = (code: string) => data.pseudoAccounts.find(p => p.entityCode === entity.ownerCode && p.pseudo === code);

  const lines: SimLine[] = [];
  for (const rule of rules) {
    const formula = data.formulas.find(f => f.id === rule.formulaId);
    if (!formula || formula.amountTypeId == null) continue;
    const amountType = data.amountTypes.find(a => a.id === formula.amountTypeId);
    const condRows = formula.formulaConditionId == null
      ? []
      : data.conditions.filter(c => c.formulaConditionId === formula.formulaConditionId);

    // Resolve the account for this rule side given a set of condition inputs.
    const resolveAccount = (inputs: Record<number, string>): { account: string | null; trace: string } => {
      if (condRows.length > 0) {
        const hit = resolveConditionAccount(condRows, rule.debitCredit, inputs);
        if (hit) return { account: pseudoById(hit.pseudoAccountId)?.pseudo ?? String(hit.pseudoAccountId), trace: hit.trace };
      }
      const direct = rule.debitCredit === 'D' ? formula.debitAccount : formula.creditAccount;
      if (direct) return { account: direct, trace: condRows.length > 0 ? 'default account (no condition matched)' : 'formula account' };
      return { account: null, trace: '' };
    };

    const push = (amount: number, inputs: Record<number, string>, amountCode?: string) => {
      const { account, trace } = resolveAccount(inputs);
      if (!account) return;
      const pseudo = pseudoByCode(account);
      lines.push({
        ruleId: rule.id, ledger: ledgerName(rule.legalAccountingLedgerId),
        formulaCode: formula.name.split(' ')[0], formulaName: formula.name,
        amountType: amountType?.name ?? '', debitCredit: rule.debitCredit, amount, account,
        accountDescription: pseudo?.description ?? formula.description, trace,
        externalAccount: externalAccountFor(data, entity, pseudo, msg), amountCode,
      });
    };

    // Multi-code amount types (e.g. Added Cost): book each code line separately with its own
    // amount code fed into the conditions, so each code lands on its configured account.
    const coded = msg.amountCodeLines?.filter(l => l.amountTypeId === formula.amountTypeId) ?? [];
    if (coded.length > 0) {
      for (const cl of coded) {
        if (!cl.amount) continue;
        push(cl.amount, { ...msg.conditionInputs, [AMOUNT_CODE_CONDITION_VALUE]: cl.amountCode }, cl.amountCode);
      }
    } else {
      const amount = msg.amounts[formula.amountTypeId] ?? 0;
      if (amount) push(amount, msg.conditionInputs, msg.conditionInputs[AMOUNT_CODE_CONDITION_VALUE] || undefined);
    }
  }
  return lines;
}

// Suggested demo amounts per amount type (editable in the form)
export const defaultAmounts: Record<number, number> = {
  30: 12500,    // Fixed Asset Value
  31: 0,        // Residual Value
  32: 500,      // Deposit
  33: 14640,    // Total Plan Rent (= amortization + interest)
  34: 12500,    // Total Plan Amortization
  35: 2140,     // Total Plan Interest
  36: 1210.25,  // Total Amount
  37: 830,      // Amortization
  38: 145,      // Interest
  39: 125,      // Added Cost
  40: 210,      // Tax
  41: 0.25,     // Rounding
  42: 875,      // Rent
  43: 875,      // Rent - Primary
  44: 500,      // On'account - Customer
  45: 500,      // On'account - Agreement
  46: 250,      // Unallocated Amount
  47: 9800,     // Settlement Value
  48: 4200,     // Remaining Current Rent
  49: 6300,     // Remaining Non Current Rent
  50: 640,      // Remaining Current Interest
  51: 480,      // Remaining Non Current Interest
  52: 1500,     // Purchase Option Amount
  53: 350,      // Profit
  54: 0,        // Loss
  55: 1000,     // Invoice Net Amount
  56: 118,      // Monthly Interest (Primary)
  57: 9500,     // Present Value on Basic Price
  58: 410,      // Monthly Depreciation
  59: 118,      // Monthly Interest income
};

// The booking date stored in Accounting, per the accounting event's basis:
//   Event Date (1): the day the event ran (msg.bookingDate).
//   Calculation Date (0): the agreement/line date (msg.calculationDate) — used as-is, even in a
//     closed period. Accounting always stores the real date; the closed-period adjustment is an
//     export-time concern (see exportBookingDate), not a booking-time one.
export function resolveBookingDate(data: AppData, msg: EventMessage): { date: string; basis: 'Event' | 'Calculation'; reason: string } {
  const event = data.accountingEvents.find(e => e.id === msg.accountingEventId);
  const eventDate = msg.bookingDate; // the run date
  if (!event || event.bookingDate !== 0) {
    return { date: eventDate, basis: 'Event', reason: 'event date (day the event ran)' };
  }
  const calcDate = msg.calculationDate || eventDate;
  return { date: calcDate, basis: 'Calculation', reason: `agreement / calculation date ${calcDate}` };
}

// First day of the entity's current (first open) period.
export function firstDayOfCurrentPeriod(openPeriod: string): string {
  return `${openPeriod.slice(0, 4)}-${openPeriod.slice(4)}-01`;
}

// The booking date used when the journal is exported to the general ledger. A historical date in
// a closed period cannot be exported — it is bumped to the first day of the current (first open)
// period. The journal stored in Accounting keeps its real booking date; only the export changes.
export function exportBookingDate(entity: LegalEntity, bookingDate: string): string {
  const firstDay = firstDayOfCurrentPeriod(entity.openPeriod);
  return bookingDate < firstDay ? firstDay : bookingDate;
}

// GLI numbers run as a per-legal-entity series. gliNumberSerie holds the latest GLI number used
// on that entity; a new journal takes the next one. Any number already present among existing
// journals is skipped so GLI stays globally unique (the app routes journals by GLI number).
export function nextGliFor(d: AppData, entity: LegalEntity): number {
  const used = new Set(d.journals.map(j => j.gliNumber));
  let next = entity.gliNumberSerie + 1;
  while (used.has(next)) next++;
  return next;
}

// The financial year a booking date falls in, given the entity's fiscal year start month (1-12).
// Labelled by the calendar year the financial year starts in.
export function fiscalYearOf(bookingDate: string, startMonth = 1): number {
  const y = Number(bookingDate.slice(0, 4));
  const m = Number(bookingDate.slice(5, 7));
  return m >= startMonth ? y : y - 1;
}

export function fiscalYearLabel(fy: number, startMonth = 1): string {
  return startMonth === 1 ? String(fy) : `${fy}/${String(fy + 1).slice(2)}`;
}

// Display label for a GLI: the journal's stamped prefix + its number (e.g. "2026/124857").
export function gliLabel(j: { gliPrefix?: string; gliNumber: number }): string {
  return `${j.gliPrefix ?? ''}${j.gliNumber}`;
}

// Allocate the next GLI for the entity and advance its series. Call inside a draft mutation.
export function takeGliFor(d: AppData, entity: LegalEntity): number {
  const gli = nextGliFor(d, entity);
  entity.gliNumberSerie = gli;
  entity.nextGli = gli + 1;
  return gli;
}

// Bring an entity's gliNumberSerie up to the latest GLI number actually used on it (used at load
// so the series reflects existing journals rather than a stale seed value).
export function reconcileGliSerie(entity: LegalEntity, journals: Journal[]): void {
  const entityMax = Math.max(0, ...journals.filter(j => j.legalEntityId === entity.id).map(j => j.gliNumber));
  entity.gliNumberSerie = Math.max(entity.gliNumberSerie, entityMax);
  entity.nextGli = entity.gliNumberSerie + 1;
}

// ---- Reversal by reference (generic mirror) ----
// A reversal event carries one Reversal Reference; the event's reverseMatchBy says how to find the
// original booking. We never re-derive from formulas — we mirror the original lines, flipping D/C.

export interface ReversalTarget { journal: Journal; lines: JournalLine[]; }
export interface ReversalRef { reference?: string; agreement?: string; agreementLine?: string; period?: string; invoice?: string; correlationId?: string; }

// ---- Outbound "Journal posted" event (outbox) ----
// Publish an outbound domain event summarising a journal, for other domains to correlate against.
export function publishJournalPosted(
  d: AppData, journal: Journal,
  opts: { correlationId?: string; status?: 'Posted' | 'AcceptedPending' | 'Rejected'; source?: string } = {},
): void {
  const entity = d.legalEntities.find(e => e.id === journal.legalEntityId);
  const lines = journal.lines;
  const distinct = <T,>(xs: T[]) => [...new Set(xs.filter(Boolean as unknown as (v: T) => boolean))];
  const r2 = (n: number) => Math.round(n * 100) / 100;
  d.journalEvents.unshift({
    id: Math.max(0, ...d.journalEvents.map(e => e.id)) + 1,
    publishedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
    legalEntityId: journal.legalEntityId, entityCode: entity?.ownerCode ?? '',
    correlationId: opts.correlationId, accountingEvent: journal.accountingEvent,
    status: opts.status ?? 'Posted', journalNumber: journal.gliNumber, gliPrefix: journal.gliPrefix,
    reversesGli: journal.reversesGli, bookingDate: journal.bookingDate,
    agreement: distinct(lines.map(l => l.agreement)).join(', '),
    agreementLines: distinct(lines.map(l => l.agreementLine)).filter((x): x is number => x != null),
    invoices: distinct(lines.map(l => l.invoice)),
    references: distinct([...lines.map(l => l.refNo), ...lines.map(l => l.paymentId ?? '')]),
    lineCount: journal.lineCount,
    totalDebit: r2(lines.reduce((s, l) => s + l.debit, 0)),
    totalCredit: r2(lines.reduce((s, l) => s + l.credit, 0)),
    difference: journal.difference, source: opts.source ?? journal.createdBy,
  });
}

// Add a journal to the ledger AND publish its outbound event — the single choke point every
// journal-creating flow should use, so a "Journal posted" event is emitted exactly once per journal.
export function addJournal(
  d: AppData, journal: Journal,
  opts: { correlationId?: string; status?: 'Posted' | 'AcceptedPending' | 'Rejected'; source?: string } = {},
): void {
  d.journals.unshift(journal);
  publishJournalPosted(d, journal, opts);
}

// Find the original booking(s) a reversal targets: the journals (of the reversed event) whose
// not-yet-reversed lines match the reference / dimensions per the event's rule.
export function findReversalOriginals(d: AppData, entityId: number, event: AccountingEvent, ref: ReversalRef): ReversalTarget[] {
  const matchBy = event.reverseMatchBy;
  if (!matchBy) return [];
  const originalName = event.originalEventId != null ? d.accountingEvents.find(e => e.id === event.originalEventId)?.name : undefined;
  const reference = (ref.reference ?? '').trim();
  const line = ref.agreementLine != null && ref.agreementLine !== '' ? Number(ref.agreementLine) : null;
  const out: ReversalTarget[] = [];
  for (const j of d.journals) {
    if (j.legalEntityId !== entityId) continue;
    if (originalName && j.accountingEvent !== originalName) continue; // only reverse the intended original event
    const avail = j.lines.filter(l => !l.reversed);
    if (avail.length === 0) continue;
    let sel: JournalLine[] = [];
    if (matchBy === 'InvoiceNumber') { if (!reference) continue; sel = avail.filter(l => l.invoice === reference); }
    else if (matchBy === 'ReferenceNumber') { if (!reference) continue; sel = avail.filter(l => l.refNo === reference); }
    else if (matchBy === 'PaymentId') { if (!reference) continue; sel = avail.filter(l => l.paymentId === reference); }
    else if (matchBy === 'AgreementLine') { sel = avail.filter(l => l.agreement === ref.agreement && (l.agreementLine ?? null) === line); }
    else { sel = avail.filter(l => l.agreement === ref.agreement && (l.agreementLine ?? null) === line && (l.period ?? '') === (ref.period ?? '')); }
    if (sel.length) out.push({ journal: j, lines: sel });
  }
  return out;
}

// Mirror one target into a reversal journal (flip D/C), stamp reversesGli/reversesLine, and mark
// the original lines reversed. Returns the new GLI. Shared by the message path and the credit UI.
export function mirrorReversalJournal(
  d: AppData, entity: LegalEntity, eventName: string, target: ReversalTarget,
  opts: { invoice?: string; refNo?: string; createdBy: string; bookingDate?: string; correlationId?: string },
): number {
  const gli = takeGliFor(d, entity);
  const lines: JournalLine[] = target.lines.map((l, i) => ({
    ...l, line: i + 1, debit: l.credit, credit: l.debit,
    // Keep the original invoice / reference / payment id on the mirror (spread), unless overridden
    // (e.g. a credit note gets its own new invoice number).
    invoice: opts.invoice ?? l.invoice, refNo: opts.refNo ?? l.refNo,
    reversed: true, reversesLine: l.line,
  }));
  for (const l of target.lines) l.reversed = true; // flag the originals as reversed
  const today = new Date().toISOString().slice(0, 10);
  addJournal(d, {
    gliNumber: gli, gliPrefix: entity.gliPrefix, legalEntityId: entity.id, accountingEvent: eventName,
    lines, lineCount: lines.length, bookingDate: opts.bookingDate ?? today, createDate: today,
    exportDate: null, difference: false, createdBy: opts.createdBy, reversesGli: target.journal.gliNumber,
  }, { correlationId: opts.correlationId, source: opts.createdBy });
  return gli;
}

// Book a reversal message: find the original(s) and mirror each into its own reversal journal.
export function reverseByMessage(d: AppData, entityId: number, event: AccountingEvent, ref: ReversalRef, source: string): { gliList: number[]; reversedLines: number } {
  const entity = d.legalEntities.find(e => e.id === entityId);
  if (!entity) return { gliList: [], reversedLines: 0 };
  const gliList: number[] = [];
  let reversedLines = 0;
  for (const t of findReversalOriginals(d, entityId, event, ref)) {
    gliList.push(mirrorReversalJournal(d, entity, event.name, t, { invoice: ref.invoice, createdBy: source, correlationId: ref.correlationId }));
    reversedLines += t.lines.length;
  }
  return { gliList, reversedLines };
}

// Book a message into a GLI journal inside a draft: run the engine, emit the journal lines,
// advance the entity's GLI. Returns the new GLI number (or null if nothing booked). Shared by
// the immediate path and the End of Month release of pending messages. A reversal-category event
// is routed to the mirror path (find original by reference → flip D/C) instead of the rule engine.
export function postMessage(d: AppData, msg: EventMessage, source: string): { gli: number; difference: boolean } | null {
  const entity = d.legalEntities.find(e => e.id === msg.legalEntityId);
  if (!entity) return null;
  const event = d.accountingEvents.find(e => e.id === msg.accountingEventId);
  if (event?.eventCategoryId === 2 && event.reverseMatchBy) {
    const res = reverseByMessage(d, entity.id, event, { reference: msg.reversalReference, agreement: msg.agreement, agreementLine: msg.agreementLine, period: msg.period, invoice: msg.invoice, correlationId: msg.messageId }, source);
    return res.gliList.length ? { gli: res.gliList[0], difference: false } : null;
  }
  const lines = simulateMessage(d, msg);
  if (lines.length === 0) return null;
  const baseCode = d.currencies.find(c => c.id === entity.baseCurrencyId)?.code ?? 'EUR';
  const currency = msg.currency ?? baseCode;
  const currencyRate = msg.currencyRate ?? 1;
  const gli = takeGliFor(d, entity);
  const eventName = d.accountingEvents.find(e => e.id === msg.accountingEventId)?.name ?? '';
  const totalD = lines.filter(l => l.debitCredit === 'D').reduce((s, l) => s + l.amount, 0);
  const totalC = lines.filter(l => l.debitCredit === 'C').reduce((s, l) => s + l.amount, 0);
  const difference = Math.round((totalD - totalC) * 100) / 100 !== 0;
  const bookingDate = resolveBookingDate(d, msg).date;
  const period = msg.period || bookingDate.slice(0, 7).replace('-', '');
  const journalLines: JournalLine[] = lines.map((l, i) => ({
    line: i + 1, pseudoAccount: l.account ?? '', description: l.accountDescription,
    agreement: msg.agreement, agreementLine: Number(msg.agreementLine) || null, period, invoicingPeriod: msg.invoicingPeriod,
    customer: msg.customer || undefined, supplier: msg.supplier || undefined,
    invoice: msg.invoice, refNo: msg.referenceNumber || '', paymentId: msg.paymentId || undefined,
    debit: l.debitCredit === 'D' ? l.amount : 0, credit: l.debitCredit === 'C' ? l.amount : 0,
    ledger: l.ledger, currency, currencyRate, formula: l.formulaCode, externalAccountString: l.externalAccount,
    amountType: l.amountType, amountCode: l.amountCode || msg.conditionInputs[AMOUNT_CODE_CONDITION_VALUE] || undefined, conditionValue: l.trace,
  }));
  addJournal(d, {
    gliNumber: gli, gliPrefix: entity.gliPrefix, legalEntityId: entity.id, accountingEvent: eventName,
    lines: journalLines, lineCount: journalLines.length,
    bookingDate, createDate: new Date().toISOString().slice(0, 10), exportDate: null,
    difference, createdBy: source,
  }, { correlationId: msg.messageId, source });
  entity.journalDifferences = d.journals.filter(x => x.legalEntityId === entity.id && x.difference).length;
  return { gli, difference };
}

// Reconstruct the event message from a stored pending message.
export function pendingToMessage(p: PendingMessage): EventMessage {
  return {
    legalEntityId: p.legalEntityId, accountingClassId: p.accountingClassId, accountingEventId: p.accountingEventId,
    bookingDate: p.bookingDate, calculationDate: p.calculationDate, period: p.period, invoicingPeriod: p.invoicingPeriod, agreement: p.agreement, agreementLine: p.agreementLine,
    portfolio: p.portfolio, invoice: p.invoice, referenceNumber: p.referenceNumber, product: p.product, customer: p.customer, supplier: p.supplier,
    currency: p.currency, currencyRate: p.currencyRate,
    conditionInputs: p.conditionInputs, amounts: p.amounts, accountValues: p.accountValues,
  };
}

// Read-only: how many pending messages an End of Month for `period` would release.
export function pendingDue(data: AppData, entityId: number, period: string): PendingMessage[] {
  const held = new Set(data.accountingEvents.filter(e => e.postingMode === 'EndOfMonth').map(e => e.id));
  return data.pendingMessages.filter(
    p => p.legalEntityId === entityId && p.status === 'Pending' && held.has(p.accountingEventId) && p.period <= period,
  );
}

// Release every pending message for the entity, for an EndOfMonth event, with period <= the
// run period: book each as a journal and mark it Released. Mutates the draft.
export function releasePendingMessages(d: AppData, entityId: number, period: string, source: string): { released: number; gliList: number[] } {
  const gliList: number[] = [];
  for (const p of pendingDue(d, entityId, period)) {
    const res = postMessage(d, pendingToMessage(p), source);
    if (res) { p.status = 'Released'; p.releasedGli = res.gli; gliList.push(res.gli); }
  }
  return { released: gliList.length, gliList };
}
