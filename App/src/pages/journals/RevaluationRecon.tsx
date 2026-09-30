import { useMemo, useState } from 'react';
import { useStore, formatAmount } from '../../store';
import { gliLabel } from '../../business/engine';
import { DrillLink } from '../../components/trail';
import { Icon } from '../../components/Icon';
import { revalTransactionPreview } from '../../business/revaluation';

const rate = (n: number) => n.toLocaleString('sv-SE', { minimumFractionDigits: 4, maximumFractionDigits: 4 });

// Revalue Reconciliation: inspect the End-of-Month balance revaluation for a period. Top grid =
// per account+currency balances (RevalueAccounts); bottom grid = the period's transactions on
// revaluation accounts. Mirrors the old ProFinance "Revalue Reconciliation" form.
export default function RevaluationRecon() {
  const { data } = useStore();
  const [entityId, setEntityId] = useState(data.legalEntities[0]?.id ?? 1);
  const entity = data.legalEntities.find(e => e.id === entityId)!;
  const [period, setPeriod] = useState(entity.endOfMonth || entity.openPeriod);
  const [account, setAccount] = useState('');
  const [currency, setCurrency] = useState('');

  const [applied, setApplied] = useState({ entityId, period, account, currency });
  const load = () => setApplied({ entityId, period, account, currency });

  const accounts = useMemo(
    () => data.revalueAccounts.filter(r => r.entityCode === entity.ownerCode).map(r => r.account),
    [data.revalueAccounts, entity.ownerCode],
  );
  const accountOptions = [...new Set(accounts)];

  const appliedEntity = data.legalEntities.find(e => e.id === applied.entityId)!;
  const accRows = data.revalueAccounts.filter(r =>
    r.entityCode === appliedEntity.ownerCode &&
    r.period === applied.period &&
    (!applied.account || r.account === applied.account) &&
    (!applied.currency || r.currency === applied.currency),
  );
  // Bottom grid: the persisted revalued transactions if End of Month has run, else a preview.
  const accCur = (r: { account: string; currency: string }) =>
    (!applied.account || r.account === applied.account) && (!applied.currency || r.currency === applied.currency);
  const persisted = data.revalueTransactions
    .filter(r => r.entityCode === appliedEntity.ownerCode && r.period === applied.period)
    .filter(accCur)
    .map(r => ({
      account: r.account, period: r.period, currency: r.currency, gli: r.sourceGli, line: r.sourceLine, revalue: r.revalue,
      bookingRate: r.bookingRate, currentRate: r.currentRate, rateChange: r.currentRate - r.bookingRate,
      transactionAmount: r.transactionAmount, bookedAmount: r.bookedAmount,
      revaluation: r.revaluation as number | null, revalueGli: r.revalueGli, newBookedAmount: r.newBookedAmount as number | null,
    }));
  const txnRows = persisted.length > 0
    ? persisted
    : revalTransactionPreview(data, applied.entityId, applied.period).filter(accCur);

  return (
    <div>
      <div className="pagelike-title">Revalue Reconciliation</div>
      <p className="muted" style={{ maxWidth: 760, marginTop: -6 }}>
        The currency revaluation booked automatically at <b>End of Month</b> (Monthly revaluation of
        Balance). The top grid shows each account/currency balance brought forward, revalued to the
        current rate; the bottom grid lists the period’s transactions on revaluation accounts.
      </p>

      <div className="card">
        <div className="form-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', alignItems: 'end' }}>
          <div className="f">
            <label>Legal entity</label>
            <select value={entityId} onChange={e => setEntityId(Number(e.target.value))}>
              {data.legalEntities.map(e => <option key={e.id} value={e.id}>{e.ownerCode}</option>)}
            </select>
          </div>
          <div className="f"><label>Year/Month</label><input value={period} onChange={e => setPeriod(e.target.value)} placeholder="YYYYMM" /></div>
          <div className="f">
            <label>Account</label>
            <select value={account} onChange={e => setAccount(e.target.value)}>
              <option value="">All accounts</option>
              {accountOptions.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="f">
            <label>Currency</label>
            <select value={currency} onChange={e => setCurrency(e.target.value)}>
              <option value="">All currencies</option>
              {data.currencies.map(c => <option key={c.id} value={c.code}>{c.code}</option>)}
            </select>
          </div>
          <div className="f">
            <button className="btn primary" onClick={load} style={{ width: '100%' }}><Icon name="search" size={14} /> Load</button>
          </div>
        </div>
      </div>

      <div className="card">
        <h4>Account balances <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>({accRows.length})</span></h4>
        <div className="grid-wrap" style={{ boxShadow: 'none' }}>
          <table className="grid">
            <thead>
              <tr>
                <th>Account</th><th>Year/Month</th><th>Currency</th>
                <th className="num">Prev. Rate</th><th className="num">Current Rate</th><th className="num">Rate Change</th>
                <th className="num">Currency Value BF</th><th className="num">Revaluation</th>
                <th className="num">Base Value BF</th><th className="num">Base Value CF</th>
                <th className="num">New Bookings</th><th className="num">Closing Amount</th><th>Journal</th>
              </tr>
            </thead>
            <tbody>
              {accRows.map(r => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{r.account}</td>
                  <td>{r.period}</td>
                  <td>{r.currency}</td>
                  <td className="num">{rate(r.ratePrev)}</td>
                  <td className="num">{rate(r.rate)}</td>
                  <td className="num">{rate(r.rate - r.ratePrev)}</td>
                  <td className="num">{formatAmount(r.currencyValueBF)}</td>
                  <td className="num" style={{ fontWeight: 600, color: r.revaluation >= 0 ? 'var(--purple)' : 'var(--red)' }}>{formatAmount(r.revaluation)}</td>
                  <td className="num">{formatAmount(r.baseValueBF)}</td>
                  <td className="num">{formatAmount(r.baseValueCF)}</td>
                  <td className="num">{formatAmount(r.newBookingsBase)}</td>
                  <td className="num">{formatAmount(r.closingAmount)}</td>
                  <td>{r.revalueGli ? <DrillLink to={`/journals/gli/${r.revalueGli}`} label={`Journal ${gliLabel(data.journals.find(j => j.gliNumber === r.revalueGli) ?? { gliNumber: r.revalueGli })}`}>{gliLabel(data.journals.find(j => j.gliNumber === r.revalueGli) ?? { gliNumber: r.revalueGli })}</DrillLink> : '—'}</td>
                </tr>
              ))}
              {accRows.length === 0 && <tr><td colSpan={13} className="empty">No revaluation balances for this selection. Run End of Month for a revaluation entity, or check the account/currency filter.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h4>Transactions on revaluation accounts <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>({txnRows.length})</span></h4>
        <div className="grid-wrap" style={{ boxShadow: 'none' }}>
          <table className="grid">
            <thead>
              <tr>
                <th>Account</th><th>Year/Month</th><th>Currency</th><th>Created at journal</th><th className="num">Line</th>
                <th className="num">Booking Rate</th><th className="num">Current Rate</th><th className="num">Rate Change</th>
                <th className="num">Transaction Amount</th><th className="num">Booked Amount</th>
                <th className="num">Revaluation</th><th>Revalue journal</th><th className="num">New Booked Amount</th>
              </tr>
            </thead>
            <tbody>
              {txnRows.map((r, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600 }}>{r.account}{!r.revalue && <span className="muted" style={{ fontSize: 10.5, marginLeft: 5 }}>no reval</span>}</td>
                  <td>{r.period}</td>
                  <td>{r.currency}</td>
                  <td><DrillLink to={`/journals/gli/${r.gli}`} label={`Journal ${r.gli}`}>{r.gli}</DrillLink></td>
                  <td className="num">{r.line}</td>
                  <td className="num">{rate(r.bookingRate)}</td>
                  <td className="num">{rate(r.currentRate)}</td>
                  <td className="num">{rate(r.rateChange)}</td>
                  <td className="num">{formatAmount(r.transactionAmount)}</td>
                  <td className="num">{formatAmount(r.bookedAmount)}</td>
                  <td className="num" style={{ fontWeight: 600 }}>{r.revaluation == null ? '—' : formatAmount(r.revaluation)}</td>
                  <td>{r.revalueGli ? <DrillLink to={`/journals/gli/${r.revalueGli}`} label={`Journal ${gliLabel(data.journals.find(j => j.gliNumber === r.revalueGli) ?? { gliNumber: r.revalueGli })}`}>{gliLabel(data.journals.find(j => j.gliNumber === r.revalueGli) ?? { gliNumber: r.revalueGli })}</DrillLink> : '—'}</td>
                  <td className="num">{r.newBookedAmount == null ? '—' : formatAmount(r.newBookedAmount)}</td>
                </tr>
              ))}
              {txnRows.length === 0 && <tr><td colSpan={13} className="empty">No transactions on revaluation accounts for this period.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
