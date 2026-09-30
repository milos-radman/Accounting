import type { AppData, ImportedScheduleRow, JournalLine, LegalEntity, RecognitionCategory, RecognitionPlan } from '../types';
import { takeGliFor, addJournal } from './engine';
import { round2 } from './accruals';

// The Accounting Recognition Plan turns the earning schedule (what the agreement domain says is
// earned each month) into the monthly cutoff that bridges recognition and invoicing. At each
// month-end, per agreement line + Cutoff category:
//   recognizedToDate = Σ plan schedule up to the period       (earned — follows the plan)
//   invoicedToDate   = Σ invoices raised up to the period     (billed — from the journals)
//   position         = recognizedToDate − invoicedToDate
//     position > 0 → Accrued …Not Invoiced   (balance-sheet asset)
//     position < 0 → Invoiced …Not Accrued   (balance-sheet liability)
// Booked accrue-and-reverse: each run reverses the prior month's cutoff (event "Monthly Booking
// reversal") and re-books the current position (event "Monthly Booking").
//
// Reversal is SELECTIVE. Only postings whose formula is `reverseMonthly` (the cutoff) are mirrored
// when reversing; Straight categories (e.g. Monthly Depreciation) are permanent and survive. A
// recognition-plan change re-sent for an agreement (+line) triggers Undo Monthly Booking, which
// mirrors that agreement's live cutoff only and immediately re-derives it from the new plan.

// Cumulative planned recognition for a plan line + category through `period` (inclusive).
function recognizedToDate(plan: RecognitionPlan, agreementLine: number, categoryId: number, period: string): number {
  const line = plan.lines.find(l => l.agreementLine === agreementLine);
  if (!line) return 0;
  return round2(line.schedule
    .filter(r => r.categoryId === categoryId && r.period <= period)
    .reduce((s, r) => s + r.amount, 0));
}

// The plan's scheduled amount for one line + category in exactly `period` (a single month) — used
// by Straight categories, which book that month's amount as a permanent entry (not cumulative).
function scheduledInPeriod(plan: RecognitionPlan, agreementLine: number, categoryId: number, period: string): number {
  const line = plan.lines.find(l => l.agreementLine === agreementLine);
  if (!line) return 0;
  return round2(line.schedule
    .filter(r => r.categoryId === categoryId && r.period === period)
    .reduce((s, r) => s + r.amount, 0));
}

// Cumulative amount billed (invoice raised) for an agreement line + category through `period`.
// Keys on the journal's booking period — a quarterly-in-arrears invoice raised in month 3 counts
// only from month 3, even though its lines cover months 1–3 — net of any credit notes.
function invoicedToDate(data: AppData, entityId: number, agreement: string, agreementLine: number, invoicedAmountType: string, period: string): number {
  let net = 0;
  for (const j of data.journals) {
    if (j.legalEntityId !== entityId) continue;
    const jPeriod = j.bookingDate.slice(0, 7).replace('-', '');
    if (jPeriod > period) continue;
    for (const l of j.lines) {
      if (l.agreement !== agreement) continue;
      if ((l.agreementLine ?? null) !== agreementLine) continue;
      if (l.amountType !== invoicedAmountType) continue;
      net += l.credit - l.debit; // invoicing credits income; a credit note debits it back
    }
  }
  return round2(net);
}

export interface RecognitionPosition {
  plan: RecognitionPlan;
  agreementLine: number;
  category: RecognitionCategory;
  recognized: number;
  invoiced: number;
  position: number; // + accrued / − deferred
}

// Read-only: the cutoff position of every active plan line + Cutoff category as of `period`. Used
// for the End-of-Month banner (compute before update() for StrictMode safety) and the UI page.
export function planRecognition(data: AppData, entityId: number, ownerCode: string, period: string): RecognitionPosition[] {
  const out: RecognitionPosition[] = [];
  const categories = data.recognitionCategories.filter(c => c.entityCode === ownerCode && c.kind === 'Cutoff');
  for (const plan of data.recognitionPlans) {
    if (plan.legalEntityId !== entityId || plan.status !== 'Active' || plan.imported) continue;
    for (const line of plan.lines) {
      for (const category of categories) {
        const recognized = recognizedToDate(plan, line.agreementLine, category.id, period);
        const invoiced = invoicedToDate(data, entityId, plan.agreement, line.agreementLine, category.invoicedAmountType ?? '', period);
        const position = round2(recognized - invoiced);
        if (recognized === 0 && invoiced === 0) continue; // nothing has started for this category yet
        out.push({ plan, agreementLine: line.agreementLine, category, recognized, invoiced, position });
      }
    }
  }
  return out;
}

// The description of a pseudo account for an entity (falls back to the code).
function pseudoDescOf(d: AppData, ownerCode: string, code: string): string {
  return d.pseudoAccounts.find(p => p.entityCode === ownerCode && p.pseudo === code)?.description ?? code;
}

// The Monthly Booking event id (resolved by name so it survives reference-data renumbering).
function monthlyBookingEventId(d: AppData): number | undefined {
  return d.accountingEvents.find(e => e.name === 'Monthly Booking')?.id;
}

export interface ResolvedLeg { account: string; ledger: string; formula: string; }

// Where a system amount type lands: read the entity's Monthly Booking accounting rule whose
// formula references that amount type, and take the mapped account + ledger from it. This is the
// single place recognition accounts come from — the accounting rules, not the category. Null when
// the user has not set up a rule for that amount type yet.
export function resolveRecognitionLeg(d: AppData, entityCode: string, amountTypeName: string | undefined): ResolvedLeg | null {
  if (!amountTypeName) return null;
  const eventId = monthlyBookingEventId(d);
  if (eventId == null) return null;
  // Match through the formula's own amount type name (a name can be shared by several amount type
  // ids — e.g. the seed's "Monthly Depreciation" and the recognition system one — so resolving a
  // single id by name up front would pick the wrong one).
  for (const rule of d.accountingRules) {
    if (rule.entityCode !== entityCode || rule.accountingEventId !== eventId) continue;
    const f = d.formulas.find(x => x.id === rule.formulaId);
    if (!f || f.amountTypeId == null) continue;
    const at = d.amountTypes.find(a => a.id === f.amountTypeId);
    if (!at || at.name !== amountTypeName) continue;
    const account = rule.debitCredit === 'D' ? f.debitAccount : f.creditAccount;
    if (!account) continue;
    const lal = d.legalAccountingLedgers.find(l => l.id === rule.legalAccountingLedgerId);
    const ledger = d.ledgers.find(l => l.id === lal?.ledgerId)?.description ?? 'Local Legal';
    return { account, ledger, formula: f.name };
  }
  return null;
}

interface Ctx { agreement: string; agreementLine: number; currency: string; period: string; categoryName: string; }

function line(d: AppData, ownerCode: string, leg: ResolvedLeg, amountType: string, amount: number, debit: boolean, ctx: Ctx, no: number): JournalLine {
  return {
    line: no, pseudoAccount: leg.account, description: pseudoDescOf(d, ownerCode, leg.account),
    agreement: ctx.agreement, agreementLine: ctx.agreementLine, period: ctx.period,
    invoice: '', refNo: '',
    debit: debit ? amount : 0, credit: debit ? 0 : amount,
    ledger: leg.ledger, currency: ctx.currency,
    formula: leg.formula, externalAccountString: '',
    amountType, conditionValue: `${ctx.categoryName} ${ctx.period}`,
  };
}

// A cutoff booking for one line + Cutoff category: the two legs (balance-sheet bucket + P&L
// income), accounts resolved from the Monthly Booking rules. A positive position accrues
// (Dr asset / Cr income); a negative one defers (Cr liability / Dr income). `sign` = +1 to book
// the position, −1 to reverse a prior one. Returns [] if a needed rule is not configured.
function cutoffLines(d: AppData, ownerCode: string, category: RecognitionCategory, position: number, sign: 1 | -1, ctx: Ctx, startLine: number): JournalLine[] {
  const amount = round2(Math.abs(position));
  if (amount === 0) return [];
  const accrued = position > 0;
  const bucketType = accrued ? category.accruedAmountType : category.deferredAmountType;
  const bucket = resolveRecognitionLeg(d, ownerCode, bucketType);
  const income = resolveRecognitionLeg(d, ownerCode, category.incomeAmountType);
  if (!bucket || !income) return [];
  const bucketDebit = accrued ? sign > 0 : sign < 0;
  return [
    line(d, ownerCode, bucket, bucketType!, amount, bucketDebit, ctx, startLine),
    line(d, ownerCode, income, category.incomeAmountType!, amount, !bucketDebit, ctx, startLine + 1),
  ];
}

// A permanent (Straight) monthly booking for one line + category, e.g. depreciation:
// Dr debit-leg / Cr credit-leg for the month's scheduled amount. Never reversed.
function straightLines(d: AppData, ownerCode: string, category: RecognitionCategory, amount: number, ctx: Ctx, startLine: number): JournalLine[] {
  const amt = round2(amount);
  if (amt === 0) return [];
  const debit = resolveRecognitionLeg(d, ownerCode, category.debitAmountType);
  const credit = resolveRecognitionLeg(d, ownerCode, category.creditAmountType);
  if (!debit || !credit) return [];
  return [
    line(d, ownerCode, debit, category.debitAmountType!, amt, true, ctx, startLine),
    line(d, ownerCode, credit, category.creditAmountType!, amt, false, ctx, startLine + 1),
  ];
}

interface RunOptions {
  filterAgreement?: string; // limit to one agreement (Undo Monthly Booking)
  filterLine?: number | null; // limit to one line; null = every line of the agreement
  reversalEvent: string; // 'Monthly Booking reversal' or 'Undo Monthly Booking'
  includeStraight: boolean; // book Straight (depreciation) legs — routine run only, not on undo
  source: string;
}

export interface RunResult { count: number; accrued: number; deferred: number; straight: number; }

// The shared recognition run: reverse each affected line+category's prior cutoff (under
// opts.reversalEvent, mirroring only reverseMonthly postings), re-book the current position
// (Monthly Booking), and — for the routine run — book the permanent Straight legs. Mutates draft.
function runCutoff(d: AppData, entity: LegalEntity, ownerCode: string, period: string, opts: RunOptions): RunResult {
  const cats = d.recognitionCategories.filter(c => c.entityCode === ownerCode);
  const cutoffCats = cats.filter(c => c.kind === 'Cutoff');
  const straightCats = cats.filter(c => c.kind === 'Straight');
  const bookingDate = `${period.slice(0, 4)}-${period.slice(4)}-01`;

  const reversalLines: JournalLine[] = [];
  const bookingLines: JournalLine[] = [];
  const pending: { stateId: number; position: number }[] = [];
  let count = 0, accrued = 0, deferred = 0, straight = 0;

  for (const plan of d.recognitionPlans) {
    // Live plans and going-forward import plans are booked; a historical (frozen-watermark) import is not.
    if (plan.legalEntityId !== entity.id || plan.status !== 'Active' || (plan.imported && !plan.goingForward)) continue;
    if (opts.filterAgreement && plan.agreement !== opts.filterAgreement) continue;
    for (const pl of plan.lines) {
      if (opts.filterLine != null && pl.agreementLine !== opts.filterLine) continue;

      for (const category of cutoffCats) {
        // A going-forward import plan has no live schedule — recognise the mapped import column
        // (amortization ↔ the rent cutoff, interest ↔ the interest cutoff) summed up to the period.
        const recognized = plan.imported && pl.imported
          ? sumToMonth(pl.imported.rows, category.name.toLowerCase().includes('interest') ? 'interest' : 'amortization', period)
          : recognizedToDate(plan, pl.agreementLine, category.id, period);
        const invoiced = invoicedToDate(d, entity.id, plan.agreement, pl.agreementLine, category.invoicedAmountType ?? '', period);
        const position = round2(recognized - invoiced);
        let state = d.recognitionStates.find(s => s.entityCode === ownerCode && s.agreement === plan.agreement && s.agreementLine === pl.agreementLine && s.categoryId === category.id);
        const prior = state?.position ?? 0;
        if (position === 0 && prior === 0) continue;
        const ctx: Ctx = { agreement: plan.agreement, agreementLine: pl.agreementLine, currency: plan.currency, period, categoryName: category.name };
        if (prior !== 0) reversalLines.push(...cutoffLines(d, ownerCode, category, prior, -1, ctx, reversalLines.length + 1));
        bookingLines.push(...cutoffLines(d, ownerCode, category, position, 1, ctx, bookingLines.length + 1));
        if (!state) {
          state = { id: Math.max(0, ...d.recognitionStates.map(s => s.id)) + 1, entityCode: ownerCode, agreement: plan.agreement, agreementLine: pl.agreementLine, categoryId: category.id, lastPeriod: period, recognizedToDate: recognized, invoicedToDate: invoiced, position, lastGli: null };
          d.recognitionStates.push(state);
        } else {
          state.lastPeriod = period; state.recognizedToDate = recognized; state.invoicedToDate = invoiced; state.position = position;
        }
        pending.push({ stateId: state.id, position });
        count += 1;
        if (position > 0) accrued = round2(accrued + position);
        else if (position < 0) deferred = round2(deferred + Math.abs(position));
      }

      if (opts.includeStraight) {
        for (const category of straightCats) {
          // Straight (depreciation): the month's amount. For an import plan it's the depreciation
          // column summed over that month's rows (a broken period splits a month across two rows).
          const amount = plan.imported && pl.imported
            ? round2(pl.imported.rows.filter(r => r.period === period).reduce((s, r) => s + (r.depreciation ?? 0), 0))
            : scheduledInPeriod(plan, pl.agreementLine, category.id, period);
          if (amount === 0) continue;
          const ctx: Ctx = { agreement: plan.agreement, agreementLine: pl.agreementLine, currency: plan.currency, period, categoryName: category.name };
          bookingLines.push(...straightLines(d, ownerCode, category, amount, ctx, bookingLines.length + 1));
          straight = round2(straight + amount);
        }
      }
    }
  }

  if (reversalLines.length > 0) {
    const gli = takeGliFor(d, entity);
    addJournal(d, {
      gliNumber: gli, gliPrefix: entity.gliPrefix, legalEntityId: entity.id, accountingEvent: opts.reversalEvent,
      lines: reversalLines, lineCount: reversalLines.length, bookingDate,
      createDate: new Date().toISOString().slice(0, 10), exportDate: null, difference: false, createdBy: opts.source,
    }, { source: opts.source });
  }
  let bookingGli: number | null = null;
  if (bookingLines.length > 0) {
    bookingGli = takeGliFor(d, entity);
    addJournal(d, {
      gliNumber: bookingGli, gliPrefix: entity.gliPrefix, legalEntityId: entity.id, accountingEvent: 'Monthly Booking',
      lines: bookingLines, lineCount: bookingLines.length, bookingDate,
      createDate: new Date().toISOString().slice(0, 10), exportDate: null, difference: false, createdBy: opts.source,
    }, { source: opts.source });
  }
  for (const p of pending) {
    const st = d.recognitionStates.find(s => s.id === p.stateId);
    if (st) st.lastGli = p.position === 0 ? null : bookingGli;
  }
  return { count, accrued, deferred, straight };
}

// Routine End-of-Month recognition: all active plans, all lines. Reverses each prior cutoff
// (Monthly Booking reversal) and re-books the current position, plus the permanent Straight legs.
export function runRecognition(d: AppData, entityId: number, ownerCode: string, period: string, source: string): RunResult {
  const entity = d.legalEntities.find(e => e.id === entityId);
  if (!entity) return { count: 0, accrued: 0, deferred: 0, straight: 0 };
  return runCutoff(d, entity, ownerCode, period, { reversalEvent: 'Monthly Booking reversal', includeStraight: true, source });
}

// Undo Monthly Booking: a recognition-plan change re-sent for an agreement (+line) whose period is
// already booked. Mirrors ONLY that agreement's live cutoff (event Undo Monthly Booking) and
// immediately re-derives it from the (already-updated) plan for the same period. Straight postings
// (depreciation) are left untouched. Pass the plan update BEFORE calling this. `agreementLine` null
// = the whole agreement (all lines).
export function undoMonthlyBooking(d: AppData, entityId: number, ownerCode: string, agreement: string, agreementLine: number | null, period: string, source: string): RunResult {
  const entity = d.legalEntities.find(e => e.id === entityId);
  if (!entity) return { count: 0, accrued: 0, deferred: 0, straight: 0 };
  return runCutoff(d, entity, ownerCode, period, { filterAgreement: agreement, filterLine: agreementLine, reversalEvent: 'Undo Monthly Booking', includeStraight: false, source });
}

// ---- Recognition plan created at Activation ----
// When an Activation message is booked, create the agreement's recognition plan in the same rich
// (import) format the manual editor uses: a month-by-month schedule with an invoicing-period index
// and Amortization / Interest per month, plus the Booked-To / Invoiced-To watermarks (nothing
// booked or invoiced yet on a fresh activation). Depreciation defaults to asset-domain (blank).
// Activation does NOT compute a schedule — the agreement domain owns the amortization/interest maths
// (an annuity split moves every period; a flat rent-per-month plan is never what a loan / HP / finance
// lease looks like). Until that domain is live, the plan is entered by hand on the Recognition page as
// a `Proposed` plan; running the Activation event adopts that plan for the agreement — flipping it to
// `Active` and stamping the activation journal so it starts recognising at End of Month.
export function activateRecognitionPlan(
  d: AppData, entityId: number, agreement: string, activationGli: number | null,
): RecognitionPlan | null {
  if (!agreement) return null;
  const plan = d.recognitionPlans.find(p => p.legalEntityId === entityId && p.agreement === agreement && p.status !== 'Terminated');
  if (!plan) return null; // nothing entered for this agreement yet — create it on the Recognition page first
  plan.status = 'Active';
  plan.sourceGli = activationGli;
  plan.source = 'Activation';
  plan.receivedDate = new Date().toISOString().slice(0, 10);
  return plan;
}

// ---- Imported (old-system) plans: watermark-based position, no journals ----
export interface ImportedLinePosition {
  plan: RecognitionPlan;
  agreementLine: number;
  assetDescription: string;
  bookedToPeriod: string; // YYYYMM
  invoicedToPeriod: number; // billing-period index
  invoicedToMonth: string; // the accounting month that period falls in (display hint only)
  depreciationType: string;
  recognizedRent: number; // amortization + interest booked (up to bookedToPeriod)
  invoicedRent: number; // amortization + interest invoiced (up to invoicedToPeriod)
  amortPosition: number; // + accrued / − deferred
  interestPosition: number;
  rentPosition: number; // amortPosition + interestPosition
}

// ---- Paste importer for the old-system monthly-recognition export ----
export interface ImportParseResult {
  plans: RecognitionPlan[];
  agreements: number;
  lines: number;
  rows: number;
  errors: string[];
}

// Parse a number that may be locale-formatted (space thousands, comma or dot decimal).
function parseImportNum(s: string): number {
  let v = String(s ?? '').trim().replace(/\s/g, '');
  if (v === '') return 0;
  const lastComma = v.lastIndexOf(','), lastDot = v.lastIndexOf('.');
  if (lastComma > lastDot) v = v.replace(/\./g, '').replace(',', '.'); // comma is the decimal
  else v = v.replace(/,/g, ''); // dot is the decimal (or no comma)
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Parse a pasted PF_MonthlyRec table (tab-separated, as copied from Excel) into imported plans.
// Columns are matched by header name when a header row is present, else by the known position.
// Depreciation is kept only when the depreciation type is Annuity. Ids start at `startId`.
export function parseMonthlyRecImport(text: string, legalEntityId: number, entityCode: string, startId: number): ImportParseResult {
  const errors: string[] = [];
  const raw = text.split(/\r?\n/).filter(l => l.trim() !== '');
  if (raw.length === 0) return { plans: [], agreements: 0, lines: 0, rows: 0, errors: ['Nothing to import.'] };

  const split = (l: string) => l.split('\t');
  const defaults = ['agreement', 'agreement description', 'customer name', 'currency', 'agreement line', 'asset description', 'booked to month', 'invoiced to period', 'invoicing period', 'year month', 'amortization', 'interest', 'depreciation', 'depreciation type'];
  const idx: Record<string, number> = {};
  let dataLines = raw;
  const firstCells = split(raw[0]).map(c => c.trim().toLowerCase());
  if (firstCells.includes('agreement')) {
    firstCells.forEach((c, i) => { idx[c] = i; });
    dataLines = raw.slice(1);
  } else {
    defaults.forEach((c, i) => { idx[c] = i; });
  }
  const col = (cells: string[], name: string) => (idx[name] != null ? (cells[idx[name]] ?? '') : '').trim();

  // Group rows by agreement, then line.
  const byAgr = new Map<string, { info: string[]; lines: Map<string, string[][]> }>();
  for (const line of dataLines) {
    const cells = split(line);
    const agr = col(cells, 'agreement');
    if (!agr) { errors.push('Skipped a row with no agreement number.'); continue; }
    let a = byAgr.get(agr);
    if (!a) { a = { info: cells, lines: new Map() }; byAgr.set(agr, a); }
    const lineNo = col(cells, 'agreement line') || '1';
    const arr = a.lines.get(lineNo) ?? [];
    if (!a.lines.has(lineNo)) a.lines.set(lineNo, arr);
    arr.push(cells);
  }

  const plans: RecognitionPlan[] = [];
  let id = startId, lineCount = 0, rowCount = 0;
  for (const [agr, a] of byAgr) {
    const planLines: RecognitionPlan['lines'] = [];
    for (const [lineNo, rs] of a.lines) {
      // Sort by month, then invoicing period — a broken period repeats a month across two rows.
      rs.sort((x, y) => col(x, 'year month').localeCompare(col(y, 'year month')) || (Number(parseImportNum(col(x, 'invoicing period'))) - Number(parseImportNum(col(y, 'invoicing period')))));
      const first = rs[0];
      const depType = col(first, 'depreciation type');
      const isAnnuity = depType.toLowerCase() === 'annuity';
      const importedRows: ImportedScheduleRow[] = rs.map(r => ({
        period: col(r, 'year month'),
        invoicingPeriod: Number(parseImportNum(col(r, 'invoicing period'))) || 0,
        amortization: parseImportNum(col(r, 'amortization')),
        interest: parseImportNum(col(r, 'interest')),
        depreciation: isAnnuity ? parseImportNum(col(r, 'depreciation')) : null,
      }));
      planLines.push({
        agreementLine: Number(lineNo) || 1,
        assetDescription: col(first, 'asset description'),
        schedule: [],
        // invoiced-to is a billing-period index (not a month) — periods can be broken.
        imported: { bookedToPeriod: col(first, 'booked to month'), invoicedToPeriod: Number(parseImportNum(col(first, 'invoiced to period'))) || 0, depreciationType: depType, rows: importedRows },
      });
      lineCount += 1; rowCount += importedRows.length;
    }
    const info = a.info;
    plans.push({
      id: id++, legalEntityId, entityCode, agreement: agr,
      agreementDescription: col(info, 'agreement description'), customer: col(info, 'customer name'),
      currency: (col(info, 'currency') || 'EUR').toUpperCase(), classification: 'Finance', status: 'Active',
      receivedDate: new Date().toISOString().slice(0, 10), source: 'Old system import (paste)', sourceGli: null, imported: true,
      lines: planLines,
    });
  }
  return { plans, agreements: plans.length, lines: lineCount, rows: rowCount, errors };
}

// Recognised side: sum a component up to (and including) an accounting month (booking is monthly).
function sumToMonth(rows: ImportedScheduleRow[], field: 'amortization' | 'interest', period: string): number {
  return round2(rows.filter(r => r.period <= period).reduce((s, r) => s + (r[field] ?? 0), 0));
}

// Invoiced side: sum a component up to (and including) a billing-period INDEX — never a month, so
// broken periods (mid-month starts) are handled exactly.
function sumToInvPeriod(rows: ImportedScheduleRow[], field: 'amortization' | 'interest', index: number): number {
  return round2(rows.filter(r => r.invoicingPeriod <= index).reduce((s, r) => s + (r[field] ?? 0), 0));
}

// The cutoff position of every imported agreement line for an entity, read from the two watermarks:
// booked-to (month) vs invoiced-to (period index). Position = recognised − invoiced (per component);
// positive is accrued (earned not billed), negative is deferred (billed not earned).
export function importedPositions(data: AppData, entityId: number): ImportedLinePosition[] {
  const out: ImportedLinePosition[] = [];
  for (const plan of data.recognitionPlans) {
    if (plan.legalEntityId !== entityId || !plan.imported || plan.status !== 'Active' || plan.goingForward) continue;
    for (const line of plan.lines) {
      const im = line.imported;
      if (!im) continue;
      const amortBooked = sumToMonth(im.rows, 'amortization', im.bookedToPeriod);
      const amortInvoiced = sumToInvPeriod(im.rows, 'amortization', im.invoicedToPeriod);
      const intBooked = sumToMonth(im.rows, 'interest', im.bookedToPeriod);
      const intInvoiced = sumToInvPeriod(im.rows, 'interest', im.invoicedToPeriod);
      const amortPosition = round2(amortBooked - amortInvoiced);
      const interestPosition = round2(intBooked - intInvoiced);
      // The accounting month the invoiced-to period falls in — a display hint only (a broken
      // period is not a full month), so the watermark can be shown as "period N (month)".
      const invoicedToMonth = im.rows.find(r => r.invoicingPeriod === im.invoicedToPeriod)?.period ?? '';
      out.push({
        plan, agreementLine: line.agreementLine, assetDescription: line.assetDescription,
        bookedToPeriod: im.bookedToPeriod, invoicedToPeriod: im.invoicedToPeriod, invoicedToMonth, depreciationType: im.depreciationType,
        recognizedRent: round2(amortBooked + intBooked), invoicedRent: round2(amortInvoiced + intInvoiced),
        amortPosition, interestPosition, rentPosition: round2(amortPosition + interestPosition),
      });
    }
  }
  return out;
}

// Going-forward recognition for an *activated* import-format plan. Unlike a historical import (frozen
// at its stored watermarks), an activated plan recognises everything up to the *viewed period* and
// nets it against the invoicing actually raised in the journals — so the position moves month by month
// as the period advances, instead of sitting at a fixed watermark gap. Reuses the import drill-down by
// returning the same shape: `bookedToPeriod` is the recognised-through month (the viewed period), and
// the invoiced side comes from real invoices, not a watermark.
export function goingForwardImportedPositions(data: AppData, entityId: number, period: string): ImportedLinePosition[] {
  const out: ImportedLinePosition[] = [];
  const cutoff = data.recognitionCategories.filter(c => c.kind === 'Cutoff');
  const interestCat = cutoff.find(c => c.name.toLowerCase().includes('interest'));
  const rentCat = cutoff.find(c => c !== interestCat);
  const invRentType = rentCat?.invoicedAmountType ?? 'Rent';       // amortization ↔ the rental billed
  const invIntType = interestCat?.invoicedAmountType ?? 'Interest'; // interest ↔ interest billed
  for (const plan of data.recognitionPlans) {
    if (plan.legalEntityId !== entityId || plan.status !== 'Active' || !plan.imported || !plan.goingForward) continue;
    for (const line of plan.lines) {
      const im = line.imported;
      if (!im) continue;
      const amortBooked = sumToMonth(im.rows, 'amortization', period); // earned up to the viewed period
      const intBooked = sumToMonth(im.rows, 'interest', period);
      const amortInvoiced = invoicedToDate(data, entityId, plan.agreement, line.agreementLine, invRentType, period);
      const intInvoiced = invoicedToDate(data, entityId, plan.agreement, line.agreementLine, invIntType, period);
      const amortPosition = round2(amortBooked - amortInvoiced);
      const interestPosition = round2(intBooked - intInvoiced);
      // Display hint: the furthest billing-period index fully covered by what has actually been invoiced.
      const invoicedToPeriod = im.rows.reduce((mx, r) => (sumToInvPeriod(im.rows, 'amortization', r.invoicingPeriod) <= amortInvoiced + 0.005 ? Math.max(mx, r.invoicingPeriod) : mx), 0);
      out.push({
        plan, agreementLine: line.agreementLine, assetDescription: line.assetDescription,
        bookedToPeriod: period, invoicedToPeriod, invoicedToMonth: '', depreciationType: im.depreciationType,
        recognizedRent: round2(amortBooked + intBooked), invoicedRent: round2(amortInvoiced + intInvoiced),
        amortPosition, interestPosition, rentPosition: round2(amortPosition + interestPosition),
      });
    }
  }
  return out;
}
