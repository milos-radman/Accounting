import type { AppData, JournalLine, LegalEntity } from '../types';
import { round2 } from './accruals';
import { nextGliFor, addJournal } from './engine';

const periodOf = (bookingDate: string) => bookingDate.slice(0, 7).replace('-', '');
function periodLastDay(period: string): string {
  const y = Number(period.slice(0, 4));
  const m = Number(period.slice(4));
  const last = new Date(y, m, 0).getDate();
  return `${y}-${String(m).padStart(2, '0')}-${last}`;
}

const baseCode = (d: AppData, entity: LegalEntity) =>
  d.currencies.find(c => c.id === entity.baseCurrencyId)?.code ?? 'EUR';

// Current rate to convert 1 unit of `code` into the entity's base currency (cross-rate).
function rateToBase(d: AppData, entity: LegalEntity, code: string): number {
  const from = d.currencies.find(c => c.code.toLowerCase() === code.toLowerCase())?.rate;
  const base = d.currencies.find(c => c.id === entity.baseCurrencyId)?.rate;
  return from && base ? from / base : 1;
}

const revalAccountsOf = (d: AppData, entity: LegalEntity) =>
  d.pseudoAccounts.filter(p => p.entityCode === entity.ownerCode && p.revaluation && p.accountKind === 'Balance');

function resultAccountOf(d: AppData, entity: LegalEntity): string {
  return entity.revaluationResultAccount
    ?? d.pseudoAccounts.find(p => p.entityCode === entity.ownerCode && p.accountKind === 'Result')?.pseudo
    ?? '420420';
}

// A booked line is revalued unless its formula is flagged excludeFromRevaluation (historical rate).
function lineRevalue(data: AppData, line: JournalLine): boolean {
  const f = data.formulas.find(x => x.name.split(' ')[0] === line.formula);
  return !(f && f.excludeFromRevaluation);
}

interface RLine { account: string; currency: string; period: string; movement: number; revalue: boolean; gli: number; line: number; bookingRate: number; }

// Foreign-currency lines booked on the entity's revaluation accounts (revaluation postings in
// base currency are naturally excluded).
function revalLines(data: AppData, entity: LegalEntity): RLine[] {
  const base = baseCode(data, entity).toUpperCase();
  const accts = new Set(revalAccountsOf(data, entity).map(a => a.pseudo));
  const out: RLine[] = [];
  for (const j of data.journals.filter(x => x.legalEntityId === entity.id)) {
    for (const l of j.lines) {
      if (!accts.has(l.pseudoAccount) || l.currency.toUpperCase() === base) continue;
      out.push({
        account: l.pseudoAccount, currency: l.currency.toUpperCase(), period: periodOf(j.bookingDate),
        movement: round2(l.debit - l.credit), revalue: lineRevalue(data, l),
        gli: j.gliNumber, line: l.line, bookingRate: l.currencyRate ?? rateToBase(data, entity, l.currency),
      });
    }
  }
  return out;
}

export interface BalanceRevalItem {
  account: string; currency: string;
  currencyValueBF: number; ratePrev: number; rate: number;
  newTxnMovement: number; revaluation: number;
}

// Read-only: the balance revaluation (mrb) a run for `period` would produce. Only the revalued
// portion of each account/currency balance is considered (no-revaluation lines keep their rate).
export function planBalanceRevaluation(data: AppData, entityId: number, period: string): { items: BalanceRevalItem[]; total: number } {
  const entity = data.legalEntities.find(e => e.id === entityId);
  if (!entity || !entity.revaluation) return { items: [], total: 0 };
  const lines = revalLines(data, entity).filter(l => l.revalue);
  const priorAll = data.revalueAccounts.filter(r => r.entityCode === entity.ownerCode);
  const pairs = new Set<string>();
  lines.forEach(l => pairs.add(`${l.account}|${l.currency}`));
  priorAll.forEach(r => pairs.add(`${r.account}|${r.currency.toUpperCase()}`));

  const items: BalanceRevalItem[] = [];
  let total = 0;
  for (const key of pairs) {
    const [account, currency] = key.split('|');
    const prior = priorAll
      .filter(r => r.account === account && r.currency.toUpperCase() === currency && r.period < period)
      .sort((a, b) => b.period.localeCompare(a.period))[0];
    const rate = rateToBase(data, entity, currency);
    const ratePrev = prior ? prior.rate : rate;
    const currencyValueBF = prior ? prior.currencyClosing : 0;
    const txnUpTo = lines.filter(l => l.account === account && l.currency === currency && l.period <= period).reduce((s, l) => s + l.movement, 0);
    const newTxnMovement = round2(txnUpTo - currencyValueBF);
    const revaluation = round2(currencyValueBF * (rate - ratePrev));
    if (currencyValueBF === 0 && newTxnMovement === 0 && !prior) continue;
    items.push({ account, currency, currencyValueBF, ratePrev, rate, newTxnMovement, revaluation });
    total = round2(total + revaluation);
  }
  return { items, total };
}

function mkLine(line: number, account: string, description: string, debit: number, credit: number, currency: string, formula: string, cond: string): JournalLine {
  return {
    line, pseudoAccount: account, description, agreement: '', agreementLine: null, invoice: '', refNo: '',
    debit, credit, ledger: 'Local Legal', currency, currencyRate: 1,
    formula, externalAccountString: '', amountType: 'Revaluation', conditionValue: cond,
  };
}

// End-of-Month revaluation: (A) revalue opening balances to the current rate — Monthly
// revaluation of Balance (mrb); (B) revalue the month's new transactions to the current rate —
// Monthly revaluation of Transaction (mrt). Writes RevalueAccount + RevalueTransaction records.
// Re-runnable: the period's prior mrb/mrt journals and records are replaced. Mutates the draft.
export function revalueBalances(d: AppData, entityId: number, period: string, source: string): { count: number; total: number } {
  const entity = d.legalEntities.find(e => e.id === entityId);
  if (!entity || !entity.revaluation) return { count: 0, total: 0 };

  const isRevalJournal = (j: { legalEntityId: number; accountingEvent: string; bookingDate: string }) =>
    j.legalEntityId === entityId &&
    (j.accountingEvent === 'Monthly revaluation of Balance' || j.accountingEvent === 'Monthly revaluation of Transaction') &&
    periodOf(j.bookingDate) === period;
  const oldGlis = new Set(d.journals.filter(isRevalJournal).map(j => j.gliNumber));
  d.journals = d.journals.filter(j => !oldGlis.has(j.gliNumber));
  d.revalueAccounts = d.revalueAccounts.filter(r => !(r.entityCode === entity.ownerCode && r.period === period));
  d.revalueTransactions = d.revalueTransactions.filter(r => !(r.entityCode === entity.ownerCode && r.period === period));

  const base = baseCode(d, entity);
  const resultAccount = resultAccountOf(d, entity);
  const pseudoDesc = (code: string) => d.pseudoAccounts.find(p => p.entityCode === entity.ownerCode && p.pseudo === code)?.description ?? code;
  const bookPair = (lines: JournalLine[], account: string, amount: number, currencyCode: string, cond: string) => {
    const dr = amount > 0; // positive = balance worth more in base → Dr the balance account
    const a = Math.abs(amount);
    lines.push(mkLine(lines.length + 1, account, pseudoDesc(account), dr ? a : 0, dr ? 0 : a, currencyCode, 'ACR-MRB', cond));
    lines.push(mkLine(lines.length + 1, resultAccount, pseudoDesc(resultAccount), dr ? 0 : a, dr ? a : 0, currencyCode, 'ACR-MRB', cond));
  };

  // ---- Phase A: balance revaluation (mrb) ----
  const plan = planBalanceRevaluation(d, entityId, period);
  const mrbGli = nextGliFor(d, entity); // next number in this entity's GLI series
  const mrbLines: JournalLine[] = [];
  let recId = Math.max(0, ...d.revalueAccounts.map(r => r.id));
  for (const it of plan.items) {
    const baseValueBF = round2(it.currencyValueBF * it.ratePrev);
    const baseValueCF = round2(it.currencyValueBF * it.rate);
    const newBookingsBase = round2(it.newTxnMovement * it.rate);
    if (it.revaluation !== 0) bookPair(mrbLines, it.account, it.revaluation, base, `${it.currency} bal reval ${period}`);
    recId += 1;
    d.revalueAccounts.push({
      id: recId, entityCode: entity.ownerCode, account: it.account, period, currency: it.currency,
      ratePrev: it.ratePrev, rate: it.rate, currencyValueBF: it.currencyValueBF, baseValueBF,
      revaluation: it.revaluation, newBookingsBase, baseValueCF,
      closingAmount: round2(baseValueCF + newBookingsBase),
      currencyClosing: round2(it.currencyValueBF + it.newTxnMovement),
      revalueGli: it.revaluation !== 0 ? mrbGli : null,
    });
  }
  if (mrbLines.length > 0) {
    addJournal(d, {
      gliNumber: mrbGli, gliPrefix: entity.gliPrefix, legalEntityId: entityId, accountingEvent: 'Monthly revaluation of Balance',
      lines: mrbLines, lineCount: mrbLines.length, bookingDate: periodLastDay(period),
      createDate: new Date().toISOString().slice(0, 10), exportDate: null, difference: false, createdBy: source,
    }, { source });
    entity.gliNumberSerie = mrbGli; entity.nextGli = mrbGli + 1;
  }

  // ---- Phase B: transaction revaluation (mrt) ----
  const mrtGli = nextGliFor(d, entity); // continues the series after the balance journal
  const mrtLines: JournalLine[] = [];
  let txnId = Math.max(0, ...d.revalueTransactions.map(t => t.id));
  for (const l of revalLines(d, entity).filter(x => x.period === period)) {
    const currentRate = rateToBase(d, entity, l.currency);
    const bookedAmount = round2(l.movement * l.bookingRate);
    const revaluation = l.revalue ? round2(l.movement * (currentRate - l.bookingRate)) : 0;
    if (revaluation !== 0) bookPair(mrtLines, l.account, revaluation, base, `${l.currency} txn reval ${period}`);
    txnId += 1;
    d.revalueTransactions.push({
      id: txnId, entityCode: entity.ownerCode, account: l.account, period, currency: l.currency,
      sourceGli: l.gli, sourceLine: l.line, revalue: l.revalue,
      bookingRate: l.bookingRate, currentRate, transactionAmount: l.movement, bookedAmount,
      revaluation, revalueGli: revaluation !== 0 ? mrtGli : null, newBookedAmount: round2(bookedAmount + revaluation),
    });
  }
  if (mrtLines.length > 0) {
    addJournal(d, {
      gliNumber: mrtGli, gliPrefix: entity.gliPrefix, legalEntityId: entityId, accountingEvent: 'Monthly revaluation of Transaction',
      lines: mrtLines, lineCount: mrtLines.length, bookingDate: periodLastDay(period),
      createDate: new Date().toISOString().slice(0, 10), exportDate: null, difference: false, createdBy: source,
    }, { source });
    entity.gliNumberSerie = mrtGli; entity.nextGli = mrtGli + 1;
  }

  return { count: plan.items.length, total: plan.total };
}

// Preview rows for the reconciliation form when a period hasn't been run yet — the period's
// revaluation-account transactions with their booking vs current rate (no revaluation booked).
export interface RevalTxnRow {
  account: string; period: string; currency: string; gli: number; line: number; revalue: boolean;
  bookingRate: number; currentRate: number; rateChange: number;
  transactionAmount: number; bookedAmount: number; revaluation: number | null; revalueGli: number | null; newBookedAmount: number | null;
}
export function revalTransactionPreview(data: AppData, entityId: number, period: string): RevalTxnRow[] {
  const entity = data.legalEntities.find(e => e.id === entityId);
  if (!entity) return [];
  return revalLines(data, entity).filter(l => l.period === period).map(l => {
    const currentRate = rateToBase(data, entity, l.currency);
    return {
      account: l.account, period, currency: l.currency, gli: l.gli, line: l.line, revalue: l.revalue,
      bookingRate: l.bookingRate, currentRate, rateChange: round2(currentRate - l.bookingRate),
      transactionAmount: l.movement, bookedAmount: round2(l.movement * l.bookingRate),
      revaluation: null, revalueGli: null, newBookedAmount: null,
    };
  });
}
