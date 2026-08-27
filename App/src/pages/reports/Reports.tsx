import { useState, useEffect, useMemo, Fragment } from 'react';
import { Outlet } from 'react-router-dom';
import { Breadcrumb, SidePanel, MenuItem } from '../../components/Chrome';
import { DrillLink } from '../../components/trail';
import { useStore, formatAmount } from '../../store';
import { gliLabel, fiscalYearOf, fiscalYearLabel } from '../../engine';
import { exportGrid, exportWorkbook, stamp } from '../../reportExport';
import { Icon } from '../../components/Icon';
import type { AppData, JournalLine, LegalEntity } from '../../types';

const ExportButton = ({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) => (
  <button className="btn small" onClick={onClick} disabled={disabled} title="Export the grid to Excel (.xlsx)">
    <Icon name="download" size={13} /> Export to Excel
  </button>
);

const r2 = (n: number) => Math.round(n * 100) / 100;

// Rate from a line's transaction currency to its entity's base currency. The rate stored on the
// line at booking wins (that is what the books were made with); otherwise the current cross-rate.
function rateToBase(data: AppData, entity: LegalEntity | undefined, l: JournalLine): number {
  if (l.currencyRate != null) return l.currencyRate;
  const baseCur = data.currencies.find(c => c.id === entity?.baseCurrencyId);
  const cur = data.currencies.find(c => c.code.toUpperCase() === l.currency.toUpperCase());
  return cur?.rate && baseCur?.rate ? cur.rate / baseCur.rate : 1;
}

const baseCodeOf = (data: AppData, entity: LegalEntity | undefined) =>
  data.currencies.find(c => c.id === entity?.baseCurrencyId)?.code ?? 'EUR';

// Slide 38: reports area — Transaction list and Total reconciliation
export function ReportsLayout() {
  return (
    <>
      <Breadcrumb />
      <div className="workspace">
        <SidePanel caption="Report menu">
          <MenuItem to="/reports" icon="file" label="Transaction List" end />
          <MenuItem to="/reports/reconciliation" icon="scale" label="Total reconciliation" />
          <MenuItem to="/reports/agreement" icon="layers" label="Agreement reconciliation" />
        </SidePanel>
        <main>
          <Outlet />
        </main>
      </div>
    </>
  );
}

// Per-journal list. Amounts are booked in the transaction currency, so the currency is shown per
// row and the entity's base-currency equivalent alongside it — the two are never added together.
// Remembered so returning to the report (e.g. after a drill-and-back) keeps the entity filter.
const savedTxnList = { entityId: '' };

export function TransactionListReport() {
  const { data } = useStore();
  const [entityId, setEntityId] = useState(savedTxnList.entityId);
  useEffect(() => { savedTxnList.entityId = entityId; }, [entityId]);

  const journals = data.journals.filter(j => !entityId || j.legalEntityId === Number(entityId));

  const exportXlsx = () => {
    const header = ['Journal', 'Legal entity', 'Event', 'Booking date', 'Lines', 'Currency', 'Debit', 'Credit', 'Base currency', 'Base debit', 'Base credit', 'Difference'];
    const rows = journals.map(j => {
      const entity = data.legalEntities.find(e => e.id === j.legalEntityId);
      const debit = r2(j.lines.reduce((s, l) => s + l.debit, 0));
      const credit = r2(j.lines.reduce((s, l) => s + l.credit, 0));
      const baseDebit = r2(j.lines.reduce((s, l) => s + r2(l.debit * rateToBase(data, entity, l)), 0));
      const baseCredit = r2(j.lines.reduce((s, l) => s + r2(l.credit * rateToBase(data, entity, l)), 0));
      const currencies = [...new Set(j.lines.map(l => l.currency).filter(Boolean))];
      return [gliLabel(j), entity?.ownerCode ?? '', j.accountingEvent, j.bookingDate, j.lines.length,
        currencies.length === 1 ? currencies[0] : 'mixed', debit, credit, baseCodeOf(data, entity), baseDebit, baseCredit,
        r2(debit - credit) !== 0 ? 'Yes' : ''] as (string | number)[];
    });
    const who = entityId ? data.legalEntities.find(e => e.id === Number(entityId))?.ownerCode : 'AllEntities';
    exportGrid(`TransactionList_${who}_${stamp()}`, header, rows, 'Transactions');
  };

  return (
    <div>
      <div className="toolbar">
        <div className="pagelike-title" style={{ margin: 0 }}>Transaction list</div>
        <div className="spacer" />
        <ExportButton onClick={exportXlsx} disabled={journals.length === 0} />
      </div>
      <div className="f" style={{ maxWidth: 320, marginBottom: 14 }}>
        <label>Legal entity</label>
        <select value={entityId} onChange={e => setEntityId(e.target.value)}>
          <option value="">All</option>
          {data.legalEntities.map(e => <option key={e.id} value={e.id}>{e.ownerCode} – {e.name}</option>)}
        </select>
      </div>
      <div className="grid-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th>Journal</th><th>Legal entity</th><th>Event</th><th>Booking date</th>
              <th className="num">Lines</th><th>Cur</th><th className="num">Debit</th><th className="num">Credit</th>
              <th>Base</th><th className="num">Base debit</th><th className="num">Base credit</th><th>Difference</th>
            </tr>
          </thead>
          <tbody>
            {journals.map(j => {
              const entity = data.legalEntities.find(e => e.id === j.legalEntityId);
              const debit = r2(j.lines.reduce((s, l) => s + l.debit, 0));
              const credit = r2(j.lines.reduce((s, l) => s + l.credit, 0));
              const baseDebit = r2(j.lines.reduce((s, l) => s + r2(l.debit * rateToBase(data, entity, l)), 0));
              const baseCredit = r2(j.lines.reduce((s, l) => s + r2(l.credit * rateToBase(data, entity, l)), 0));
              const currencies = [...new Set(j.lines.map(l => l.currency).filter(Boolean))];
              const cur = currencies.length === 1 ? currencies[0] : `mixed (${currencies.length})`;
              return (
                <tr key={j.gliNumber}>
                  <td>{gliLabel(j)}</td>
                  <td>{entity?.ownerCode}</td>
                  <td>{j.accountingEvent}</td>
                  <td>{j.bookingDate}</td>
                  <td className="num">{j.lines.length}</td>
                  <td>{cur}</td>
                  <td className="num">{formatAmount(debit)}</td>
                  <td className="num">{formatAmount(credit)}</td>
                  <td>{baseCodeOf(data, entity)}</td>
                  <td className="num">{formatAmount(baseDebit)}</td>
                  <td className="num">{formatAmount(baseCredit)}</td>
                  <td>{r2(debit - credit) !== 0 ? <span className="badge-diff">Yes</span> : ''}</td>
                </tr>
              );
            })}
            {journals.length === 0 && <tr><td colSpan={12} className="empty">No journals.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
        Debit / Credit are in each journal's transaction currency — they are not comparable across rows. The base columns
        convert every line at the rate booked on it, into the legal entity's base currency.
      </p>
    </div>
  );
}

type Basis = 'base' | 'transaction';

// Reconciliation must be expressed in a single currency to mean anything. Default is the legal
// entity's base currency (and the group reporting currency when all entities are shown); the
// transaction-currency view never adds currencies together — it splits and subtotals per currency.
// Remembered so returning to the report keeps the entity + currency-basis selection.
const savedRecon: { entityId: string; basis: Basis } = { entityId: '', basis: 'base' };

export function ReconciliationReport() {
  const { data } = useStore();
  const [entityId, setEntityId] = useState(savedRecon.entityId);
  const [basis, setBasis] = useState<Basis>(savedRecon.basis);
  useEffect(() => { savedRecon.entityId = entityId; savedRecon.basis = basis; }, [entityId, basis]);

  const allEntities = !entityId;
  const selected = data.legalEntities.find(e => e.id === Number(entityId));
  // Reporting currency = the currency the rates are quoted against (rate 1).
  const reportingCode = (data.currencies.find(c => c.rate === 1) ?? data.currencies.find(c => c.code === 'EUR'))?.code ?? 'EUR';
  const targetCode = allEntities ? reportingCode : baseCodeOf(data, selected);

  const journals = data.journals.filter(j => allEntities || j.legalEntityId === Number(entityId));

  // --- base / reporting currency view -------------------------------------
  const byAccount = new Map<string, { description: string; debit: number; credit: number }>();
  // --- transaction currency view (split per currency, never summed together)
  const byAccountCur = new Map<string, { account: string; description: string; currency: string; debit: number; credit: number }>();

  for (const j of journals) {
    const entity = data.legalEntities.find(e => e.id === j.legalEntityId);
    // When showing every entity, lift each entity's base amount into the reporting currency.
    const toReporting = allEntities ? (data.currencies.find(c => c.id === entity?.baseCurrencyId)?.rate ?? 1) : 1;
    for (const l of j.lines) {
      const rate = rateToBase(data, entity, l);
      const a = byAccount.get(l.pseudoAccount) ?? { description: l.description, debit: 0, credit: 0 };
      a.debit = r2(a.debit + r2(l.debit * rate * toReporting));
      a.credit = r2(a.credit + r2(l.credit * rate * toReporting));
      byAccount.set(l.pseudoAccount, a);

      const key = `${l.currency}|${l.pseudoAccount}`;
      const c = byAccountCur.get(key) ?? { account: l.pseudoAccount, description: l.description, currency: l.currency, debit: 0, credit: 0 };
      c.debit = r2(c.debit + l.debit);
      c.credit = r2(c.credit + l.credit);
      byAccountCur.set(key, c);
    }
  }

  const baseRows = [...byAccount.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const totDebit = r2(baseRows.reduce((s, [, v]) => s + v.debit, 0));
  const totCredit = r2(baseRows.reduce((s, [, v]) => s + v.credit, 0));

  const txnRows = [...byAccountCur.values()].sort((a, b) => a.currency.localeCompare(b.currency) || a.account.localeCompare(b.account));
  const curTotals = new Map<string, { debit: number; credit: number }>();
  for (const r of txnRows) {
    const t = curTotals.get(r.currency) ?? { debit: 0, credit: 0 };
    t.debit = r2(t.debit + r.debit); t.credit = r2(t.credit + r.credit);
    curTotals.set(r.currency, t);
  }

  const exportXlsx = () => {
    const who = allEntities ? 'AllEntities' : selected?.ownerCode ?? '';
    if (basis === 'base') {
      const header = ['Pseudo account', 'Description', `Debit (${targetCode})`, `Credit (${targetCode})`, `Balance (${targetCode})`];
      const rows = baseRows.map(([account, v]) => [account, v.description, v.debit, v.credit, r2(v.debit - v.credit)] as (string | number)[]);
      rows.push(['Total', '', totDebit, totCredit, r2(totDebit - totCredit)]);
      exportGrid(`TotalReconciliation_${who}_${targetCode}_${stamp()}`, header, rows, 'Reconciliation');
    } else {
      const header = ['Currency', 'Pseudo account', 'Description', 'Debit', 'Credit', 'Balance'];
      const rows: (string | number)[][] = [];
      let cur = '';
      for (const r of txnRows) {
        if (r.currency !== cur && cur) { const t = curTotals.get(cur)!; rows.push([`Total ${cur}`, '', '', t.debit, t.credit, r2(t.debit - t.credit)]); }
        cur = r.currency;
        rows.push([r.currency, r.account, r.description, r.debit, r.credit, r2(r.debit - r.credit)]);
      }
      if (cur) { const t = curTotals.get(cur)!; rows.push([`Total ${cur}`, '', '', t.debit, t.credit, r2(t.debit - t.credit)]); }
      exportGrid(`TotalReconciliation_${who}_ByCurrency_${stamp()}`, header, rows, 'Reconciliation');
    }
  };

  return (
    <div>
      <div className="toolbar">
        <div className="pagelike-title" style={{ margin: 0 }}>Total reconciliation per pseudo account</div>
        <div className="spacer" />
        <ExportButton onClick={exportXlsx} disabled={journals.length === 0} />
      </div>
      <div className="form-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0,320px))', marginBottom: 14 }}>
        <div className="f">
          <label>Legal entity</label>
          <select value={entityId} onChange={e => setEntityId(e.target.value)}>
            <option value="">All</option>
            {data.legalEntities.map(e => <option key={e.id} value={e.id}>{e.ownerCode} – {e.name}</option>)}
          </select>
        </div>
        <div className="f">
          <label>Amounts in</label>
          <select value={basis} onChange={e => setBasis(e.target.value as Basis)}>
            <option value="base">{allEntities ? `Reporting currency (${targetCode})` : `Base currency (${targetCode})`}</option>
            <option value="transaction">Transaction currency (split per currency)</option>
          </select>
        </div>
      </div>

      <div className="info-card" style={{ fontSize: 12.5, marginBottom: 12 }}>
        {basis === 'base'
          ? (allEntities
            ? <>Every line is converted at the rate it was booked with into its entity's base currency, then into the group reporting currency <b>{targetCode}</b> — so entities with different base currencies can be totalled.</>
            : <>Every line is converted at the rate it was booked with into <b>{selected?.ownerCode}</b>'s base currency <b>{targetCode}</b>.</>)
          : <>Amounts are shown as booked, <b>split and subtotalled per currency</b> — currencies are never added together.</>}
      </div>

      <div className="grid-wrap" style={{ maxWidth: 900 }}>
        <table className="grid">
          <thead>
            {basis === 'base' ? (
              <tr>
                <th>Pseudo account</th><th>Description</th>
                <th className="num">Debit ({targetCode})</th><th className="num">Credit ({targetCode})</th><th className="num">Balance ({targetCode})</th>
              </tr>
            ) : (
              <tr>
                <th>Currency</th><th>Pseudo account</th><th>Description</th>
                <th className="num">Debit</th><th className="num">Credit</th><th className="num">Balance</th>
              </tr>
            )}
          </thead>
          <tbody>
            {basis === 'base' ? (
              <>
                {baseRows.map(([account, v]) => (
                  <tr key={account}>
                    <td style={{ fontWeight: 600 }}>{account}</td>
                    <td>{v.description}</td>
                    <td className="num">{formatAmount(v.debit)}</td>
                    <td className="num">{formatAmount(v.credit)}</td>
                    <td className="num">{formatAmount(r2(v.debit - v.credit))}</td>
                  </tr>
                ))}
                <tr className="totals-row">
                  <td colSpan={2}>Total ({targetCode})</td>
                  <td className="num">{formatAmount(totDebit)}</td>
                  <td className="num">{formatAmount(totCredit)}</td>
                  <td className="num">{formatAmount(r2(totDebit - totCredit))}</td>
                </tr>
                {baseRows.length === 0 && <tr><td colSpan={5} className="empty">No journal lines.</td></tr>}
              </>
            ) : (
              <>
                {txnRows.map((row, i) => {
                  const last = !txnRows[i + 1] || txnRows[i + 1].currency !== row.currency;
                  const t = curTotals.get(row.currency)!;
                  return (
                    <Fragment key={`${row.currency}|${row.account}`}>
                      <tr>
                        <td>{row.currency}</td>
                        <td style={{ fontWeight: 600 }}>{row.account}</td>
                        <td>{row.description}</td>
                        <td className="num">{formatAmount(row.debit)}</td>
                        <td className="num">{formatAmount(row.credit)}</td>
                        <td className="num">{formatAmount(r2(row.debit - row.credit))}</td>
                      </tr>
                      {last && (
                        <tr className="totals-row">
                          <td colSpan={3}>Total {row.currency}</td>
                          <td className="num">{formatAmount(t.debit)}</td>
                          <td className="num">{formatAmount(t.credit)}</td>
                          <td className="num">{formatAmount(r2(t.debit - t.credit))}</td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                {txnRows.length === 0 && <tr><td colSpan={6} className="empty">No journal lines.</td></tr>}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Agreement reconciliation — what accounting booked for one agreement.
// Two views: what was booked per accounting event (drill to pseudo account), and what was
// invoiced vs paid per amount type. Deliberately holds no agreement master data (description,
// original/present value, dates, status) — that is owned by the Agreement domain.
// ---------------------------------------------------------------------------

const eventCategory = (ev: string): 'credit' | 'paid' | 'invoiced' | 'other' =>
  /credit/i.test(ev) ? 'credit' : /payment/i.test(ev) ? 'paid' : /invoic/i.test(ev) ? 'invoiced' : 'other';

// Remembers the last selection so returning to this report — e.g. after drilling into a journal and
// clicking back in the breadcrumb — restores the same agreement / period / view instead of resetting.
const savedAgRecon: { key: string; agLine: string; year: string; tab: 'bookings' | 'invoiced'; basis: Basis; openEvent: string | null } = {
  key: '', agLine: '', year: '', tab: 'bookings', basis: 'base', openEvent: null,
};

export function AgreementReconciliation() {
  const { data } = useStore();
  const [key, setKey] = useState(savedAgRecon.key);
  const [agLine, setAgLine] = useState(savedAgRecon.agLine); // '' = all lines, 'none' = lines without an agreement line
  const [year, setYear] = useState(savedAgRecon.year);
  const [tab, setTab] = useState<'bookings' | 'invoiced'>(savedAgRecon.tab);
  const [basis, setBasis] = useState<Basis>(savedAgRecon.basis);
  const [openEvent, setOpenEvent] = useState<string | null>(savedAgRecon.openEvent);

  // Persist the selection on every change, so a later remount restores it.
  useEffect(() => {
    savedAgRecon.key = key; savedAgRecon.agLine = agLine; savedAgRecon.year = year;
    savedAgRecon.tab = tab; savedAgRecon.basis = basis; savedAgRecon.openEvent = openEvent;
  }, [key, agLine, year, tab, basis, openEvent]);

  // Agreements accounting has actually seen (derived from journal lines — no master data).
  const agreements = useMemo(() => {
    const m = new Map<string, { agreement: string; entityId: number; currencies: Set<string>; lines: number; first: string; last: string }>();
    for (const j of data.journals) {
      for (const l of j.lines) {
        if (!l.agreement) continue;
        const k = `${j.legalEntityId}|${l.agreement}`;
        const a = m.get(k) ?? { agreement: l.agreement, entityId: j.legalEntityId, currencies: new Set<string>(), lines: 0, first: j.bookingDate, last: j.bookingDate };
        a.lines += 1;
        if (l.currency) a.currencies.add(l.currency);
        if (j.bookingDate < a.first) a.first = j.bookingDate;
        if (j.bookingDate > a.last) a.last = j.bookingDate;
        m.set(k, a);
      }
    }
    return [...m.values()].sort((x, y) => x.agreement.localeCompare(y.agreement, undefined, { numeric: true }));
  }, [data.journals]);

  const sel = agreements.find(a => `${a.entityId}|${a.agreement}` === key) ?? agreements[0];
  const entity = data.legalEntities.find(e => e.id === sel?.entityId);
  const fyStart = entity?.fiscalYearStartMonth ?? 1;
  const targetCode = baseCodeOf(data, entity);

  // Every (journal, line) pair booked on this agreement.
  const all = useMemo(() => {
    const out: { j: typeof data.journals[number]; l: JournalLine }[] = [];
    if (!sel) return out;
    for (const j of data.journals) {
      if (j.legalEntityId !== sel.entityId) continue;
      for (const l of j.lines) if (l.agreement === sel.agreement) out.push({ j, l });
    }
    return out;
  }, [data.journals, sel]);

  const years = [...new Set(all.map(({ j }) => fiscalYearOf(j.bookingDate, fyStart)))].sort((a, b) => b - a);

  // Each agreement line is an asset, so the report can be narrowed to one line.
  const rawLines = [...new Set(all.map(({ l }) => l.agreementLine))];
  const lineOptions = rawLines.filter((n): n is number => n != null).sort((a, b) => a - b);
  const hasUnlined = rawLines.some(n => n == null);
  const matchLine = (l: JournalLine) =>
    !agLine || (agLine === 'none' ? l.agreementLine == null : String(l.agreementLine) === agLine);

  const rows = all
    .filter(({ j }) => !year || String(fiscalYearOf(j.bookingDate, fyStart)) === year)
    .filter(({ l }) => matchLine(l));
  const amt = (l: JournalLine, side: 'debit' | 'credit') =>
    basis === 'base' ? r2(l[side] * rateToBase(data, entity, l)) : l[side];

  // --- bookings per accounting event, drill-down per pseudo account ---
  const byEvent = new Map<string, { debit: number; credit: number; glis: Set<number> }>();
  const byEventAccount = new Map<string, Map<string, { description: string; debit: number; credit: number }>>();
  for (const { j, l } of rows) {
    const e = byEvent.get(j.accountingEvent) ?? { debit: 0, credit: 0, glis: new Set<number>() };
    e.debit = r2(e.debit + amt(l, 'debit')); e.credit = r2(e.credit + amt(l, 'credit')); e.glis.add(j.gliNumber);
    byEvent.set(j.accountingEvent, e);

    const accs = byEventAccount.get(j.accountingEvent) ?? new Map();
    const a = accs.get(l.pseudoAccount) ?? { description: l.description, debit: 0, credit: 0 };
    a.debit = r2(a.debit + amt(l, 'debit')); a.credit = r2(a.credit + amt(l, 'credit'));
    accs.set(l.pseudoAccount, a);
    byEventAccount.set(j.accountingEvent, accs);
  }
  const eventRows = [...byEvent.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const evTotDebit = r2(eventRows.reduce((s, [, v]) => s + v.debit, 0));
  const evTotCredit = r2(eventRows.reduce((s, [, v]) => s + v.credit, 0));

  // --- journals touching this agreement (traceability + export status) ---
  const journals = [...new Map(rows.map(({ j }) => [j.gliNumber, j])).values()]
    .sort((a, b) => b.bookingDate.localeCompare(a.bookingDate));

  // --- invoiced vs paid per amount type, in contract (transaction) currency ---
  const byType = new Map<string, { currency: string; amountType: string; invoiced: number; paid: number }>();
  for (const { j, l } of rows) {
    const cat = eventCategory(j.accountingEvent);
    if (cat === 'other') continue;
    const k = `${l.currency}|${l.amountType || '—'}`;
    const t = byType.get(k) ?? { currency: l.currency, amountType: l.amountType || '—', invoiced: 0, paid: 0 };
    // Each formula books a balanced pair with the same amount type, so the debit side is the amount.
    if (cat === 'invoiced') t.invoiced = r2(t.invoiced + l.debit);
    else if (cat === 'credit') t.invoiced = r2(t.invoiced - l.debit);
    else if (cat === 'paid') t.paid = r2(t.paid + l.debit);
    byType.set(k, t);
  }
  const typeRows = [...byType.values()]
    .filter(t => t.invoiced !== 0 || t.paid !== 0)
    .sort((a, b) => a.currency.localeCompare(b.currency) || a.amountType.localeCompare(b.amountType));
  const invTot = new Map<string, { invoiced: number; paid: number }>();
  for (const t of typeRows) {
    const g = invTot.get(t.currency) ?? { invoiced: 0, paid: 0 };
    g.invoiced = r2(g.invoiced + t.invoiced); g.paid = r2(g.paid + t.paid);
    invTot.set(t.currency, g);
  }

  // One workbook covering the whole agreement (respecting the line / year / basis filters):
  // Bookings summary, its per-account specification, the journals, and invoiced vs paid.
  const exportXlsx = () => {
    const tag = `${sel?.agreement ?? ''}${agLine && agLine !== 'none' ? `-L${agLine}` : ''}_${year || 'AllYears'}`;
    const curLabel = basis === 'base' ? ` (${targetCode})` : '';

    const bookings = eventRows.map(([ev, v]) => [ev, v.glis.size, v.debit, v.credit, r2(v.debit - v.credit)] as (string | number)[]);
    bookings.push(['Total bookings', journals.length, evTotDebit, evTotCredit, r2(evTotDebit - evTotCredit)]);

    const accSpec: (string | number)[][] = [];
    for (const [ev, accs] of byEventAccount) {
      for (const [acc, a] of [...accs.entries()].sort((x, y) => x[0].localeCompare(y[0]))) {
        accSpec.push([ev, acc, a.description, a.debit, a.credit]);
      }
    }

    const jrnls = journals.map(j => [gliLabel(j), j.accountingEvent, j.bookingDate, j.exportDate ?? 'Not sent', j.exportVoucher ?? '', j.difference ? 'Yes' : ''] as (string | number)[]);

    const invoiced: (string | number)[][] = [];
    let cur = '';
    for (const t of typeRows) {
      if (t.currency !== cur && cur) { const g = invTot.get(cur)!; invoiced.push([`Total ${cur}`, '', g.invoiced, g.paid, r2(g.invoiced - g.paid)]); }
      cur = t.currency;
      invoiced.push([t.currency, t.amountType, t.invoiced, t.paid, r2(t.invoiced - t.paid)]);
    }
    if (cur) { const g = invTot.get(cur)!; invoiced.push([`Total ${cur}`, '', g.invoiced, g.paid, r2(g.invoiced - g.paid)]); }

    exportWorkbook(`Agreement_${tag}_${stamp()}`, [
      { name: 'Bookings', header: ['Accounting event', 'Journals', `Debit${curLabel}`, `Credit${curLabel}`, 'Balance'], rows: bookings },
      { name: 'Account specification', header: ['Accounting event', 'Account', 'Description', `Debit${curLabel}`, `Credit${curLabel}`], rows: accSpec },
      { name: 'Journals', header: ['Journal', 'Event', 'Booking date', 'Exported', 'Voucher', 'Difference'], rows: jrnls },
      { name: 'Invoiced & paid', header: ['Currency', 'Amount type', 'Invoiced', 'Paid', 'Outstanding'], rows: invoiced },
    ]);
  };

  if (agreements.length === 0) {
    return <div><div className="pagelike-title">Agreement reconciliation</div><div className="empty">No agreements have been booked yet.</div></div>;
  }

  return (
    <div>
      <div className="toolbar">
        <div className="pagelike-title" style={{ margin: 0 }}>Agreement reconciliation</div>
        <div className="spacer" />
        <ExportButton onClick={exportXlsx} disabled={rows.length === 0} />
      </div>

      <div className="form-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0,240px))', marginBottom: 12 }}>
        <div className="f">
          <label>Agreement</label>
          <select value={sel ? `${sel.entityId}|${sel.agreement}` : ''} onChange={e => { setKey(e.target.value); setAgLine(''); setYear(''); setOpenEvent(null); }}>
            {agreements.map(a => {
              const ent = data.legalEntities.find(x => x.id === a.entityId);
              return <option key={`${a.entityId}|${a.agreement}`} value={`${a.entityId}|${a.agreement}`}>{a.agreement} · {ent?.ownerCode} · {[...a.currencies].join('/')}</option>;
            })}
          </select>
        </div>
        <div className="f">
          <label>Agreement line <span className="muted" style={{ fontWeight: 400, fontSize: 11 }}>· asset</span></label>
          <select value={agLine} onChange={e => { setAgLine(e.target.value); setOpenEvent(null); }}>
            <option value="">All lines{lineOptions.length ? ` (${lineOptions.length})` : ''}</option>
            {lineOptions.map(n => <option key={n} value={String(n)}>Line {n}</option>)}
            {hasUnlined && <option value="none">(no agreement line)</option>}
          </select>
        </div>
        <div className="f">
          <label>Financial year <span className="muted" style={{ fontWeight: 400, fontSize: 11 }}>· starts {fyStart === 1 ? 'Jan' : new Date(2000, fyStart - 1).toLocaleString('en', { month: 'short' })}</span></label>
          <select value={year} onChange={e => setYear(e.target.value)}>
            <option value="">All years</option>
            {years.map(y => <option key={y} value={String(y)}>{fiscalYearLabel(y, fyStart)}</option>)}
          </select>
        </div>
        {tab === 'bookings' && (
          <div className="f">
            <label>Amounts in</label>
            <select value={basis} onChange={e => setBasis(e.target.value as Basis)}>
              <option value="base">Base currency ({targetCode})</option>
              <option value="transaction">Transaction currency</option>
            </select>
          </div>
        )}
      </div>

      {/* what accounting knows about this agreement — no master data */}
      {sel && (
        <div className="field-grid" style={{ gridTemplateColumns: 'repeat(6, 1fr)', marginBottom: 12 }}>
          <div className="field"><label>Agreement</label><div className="val" style={{ fontWeight: 700 }}>{sel.agreement}</div></div>
          <div className="field">
            <label>Agreement line</label>
            <div className="val">{agLine === '' ? <>All <span className="muted" style={{ fontSize: 11 }}>({lineOptions.length || '—'})</span></> : agLine === 'none' ? '—' : agLine}</div>
          </div>
          <div className="field"><label>Legal entity</label><div className="val">{entity?.ownerCode}</div></div>
          <div className="field"><label>Currency</label><div className="val">{[...sel.currencies].join(', ') || '—'}</div></div>
          <div className="field"><label>First / last booking</label><div className="val">{sel.first} → {sel.last}</div></div>
          <div className="field"><label>Journal lines</label><div className="val">{rows.length}{year && <span className="muted" style={{ fontSize: 11 }}> of {all.length}</span>}</div></div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-start', gap: 8, marginBottom: 12 }}>
        <button className={`btn small ${tab === 'bookings' ? 'primary' : 'ghost'}`} onClick={() => setTab('bookings')}>Bookings per event</button>
        <button className={`btn small ${tab === 'invoiced' ? 'primary' : 'ghost'}`} onClick={() => setTab('invoiced')}>Invoiced &amp; paid</button>
      </div>

      {tab === 'bookings' ? (
        <>
          <div className="grid-wrap" style={{ maxWidth: 900 }}>
            <table className="grid">
              <thead>
                <tr>
                  <th style={{ width: 30 }} /><th>Accounting event</th><th className="num">Journals</th>
                  <th className="num">Debit{basis === 'base' ? ` (${targetCode})` : ''}</th>
                  <th className="num">Credit{basis === 'base' ? ` (${targetCode})` : ''}</th>
                  <th className="num">Balance</th>
                </tr>
              </thead>
              <tbody>
                {eventRows.map(([ev, v]) => {
                  const open = openEvent === ev;
                  const accs = [...(byEventAccount.get(ev) ?? new Map()).entries()].sort((a, b) => a[0].localeCompare(b[0]));
                  return (
                    <Fragment key={ev}>
                      <tr className="clickable" onClick={() => setOpenEvent(open ? null : ev)}>
                        <td><button className="expander">{open ? '−' : '+'}</button></td>
                        <td style={{ fontWeight: 600 }}>{ev}</td>
                        <td className="num">{v.glis.size}</td>
                        <td className="num">{formatAmount(v.debit)}</td>
                        <td className="num">{formatAmount(v.credit)}</td>
                        <td className="num">{formatAmount(r2(v.debit - v.credit))}</td>
                      </tr>
                      {open && (
                        <tr className="detail-row">
                          <td />
                          <td colSpan={5}>
                            <div className="muted" style={{ fontSize: 11.5, margin: '4px 0 6px' }}>Specification per pseudo account</div>
                            <table className="cond-table" style={{ maxWidth: 640 }}>
                              <thead><tr><th>Account</th><th>Description</th><th className="num">Debit</th><th className="num">Credit</th></tr></thead>
                              <tbody>
                                {accs.map(([acc, a]) => (
                                  <tr key={acc}>
                                    <td style={{ fontWeight: 600 }}>{acc}</td>
                                    <td>{a.description}</td>
                                    <td className="num">{formatAmount(a.debit)}</td>
                                    <td className="num">{formatAmount(a.credit)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                <tr className="totals-row">
                  <td /><td>Total bookings</td><td className="num">{journals.length}</td>
                  <td className="num">{formatAmount(evTotDebit)}</td>
                  <td className="num">{formatAmount(evTotCredit)}</td>
                  <td className="num">{formatAmount(r2(evTotDebit - evTotCredit))}</td>
                </tr>
                {eventRows.length === 0 && <tr><td colSpan={6} className="empty">Nothing booked in this financial year.</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="grid-wrap" style={{ marginTop: 16, maxWidth: 900 }}>
            <div className="pagelike-title" style={{ marginTop: 0, fontSize: 15 }}>Journals</div>
            <table className="grid">
              <thead><tr><th>Journal</th><th>Event</th><th>Booking date</th><th>Exported</th><th>Voucher</th><th>Difference</th></tr></thead>
              <tbody>
                {journals.map(j => (
                  <tr key={j.gliNumber}>
                    <td><DrillLink to={`/journals/gli/${j.gliNumber}`} label={`Journal ${gliLabel(j)}`}>{gliLabel(j)}</DrillLink></td>
                    <td>{j.accountingEvent}</td>
                    <td>{j.bookingDate}</td>
                    <td>{j.exportDate ? <span className="pill">{j.exportDate}</span> : <span className="pill inactive">Not sent</span>}</td>
                    <td>{j.exportVoucher ?? '—'}</td>
                    <td>{j.difference ? <span className="badge-diff">Yes</span> : ''}</td>
                  </tr>
                ))}
                {journals.length === 0 && <tr><td colSpan={6} className="empty">No journals.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <div className="info-card" style={{ fontSize: 12.5, marginBottom: 12 }}>
            Amounts as <b>booked by accounting</b>, in the agreement's transaction currency. Invoiced is net of credit notes;
            paid comes from payment events. The invoice register in the Receivables domain is the authoritative source — this is
            the accounting reflection of it, which is what makes the two reconcilable.
          </div>
          <div className="grid-wrap" style={{ maxWidth: 820 }}>
            <table className="grid">
              <thead><tr><th>Cur</th><th>Amount type</th><th className="num">Invoiced</th><th className="num">Paid</th><th className="num">Outstanding</th></tr></thead>
              <tbody>
                {typeRows.map((t, i) => {
                  const last = !typeRows[i + 1] || typeRows[i + 1].currency !== t.currency;
                  const g = invTot.get(t.currency)!;
                  return (
                    <Fragment key={`${t.currency}|${t.amountType}`}>
                      <tr>
                        <td>{t.currency}</td>
                        <td style={{ fontWeight: 600 }}>{t.amountType}</td>
                        <td className="num">{formatAmount(t.invoiced)}</td>
                        <td className="num">{formatAmount(t.paid)}</td>
                        <td className="num">{formatAmount(r2(t.invoiced - t.paid))}</td>
                      </tr>
                      {last && (
                        <tr className="totals-row">
                          <td colSpan={2}>Total {t.currency}</td>
                          <td className="num">{formatAmount(g.invoiced)}</td>
                          <td className="num">{formatAmount(g.paid)}</td>
                          <td className="num">{formatAmount(r2(g.invoiced - g.paid))}</td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                {typeRows.length === 0 && <tr><td colSpan={5} className="empty">Nothing invoiced or paid in this financial year.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
