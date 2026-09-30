import { useState, useRef, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore, formatAmount } from '../../store';
import { nextGliFor, addJournal } from '../../business/engine';
import { Icon } from '../../components/Icon';
import type { JournalLine } from '../../types';

interface DraftLine {
  id: number;
  account: string;
  debit: string;
  credit: string;
  // Per-line attributes (set via the row's expander). A manual journal can therefore span
  // several agreements / customers / ledgers rather than one shared context.
  agreement: string;
  agreementLine: string;
  period: string;
  externalAccount: string;
  currency: string;
  customer: string;
  invoice: string;
  supplier: string;
  refNo: string;
  ledger: string;
  amountType: string;
  amountCode: string;
}

// Manual journal: register a manual GLI with balanced lines. Each line carries the full set of
// booking attributes (agreement, external account, customer/supplier, invoice, ledger, …).
export default function ManualJournal() {
  const { data, update } = useStore();
  const navigate = useNavigate();
  const [entityId, setEntityId] = useState(data.legalEntities[0]?.id ?? 1);
  const [bookingDate, setBookingDate] = useState('2024-10-01');

  const entity = data.legalEntities.find(e => e.id === entityId);
  const pseudo = data.pseudoAccounts.filter(p => p.entityCode === entity?.ownerCode);
  const baseCur = data.currencies.find(c => c.id === entity?.baseCurrencyId);
  const ledgerValues = [...new Set(data.ledgers.map(l => l.description || l.name))].filter(Boolean);
  const defaultCurrency = baseCur?.code ?? 'EUR';
  const defaultLedger = ledgerValues[0] ?? 'Local Legal';
  const defaultPeriod = bookingDate.slice(0, 7).replace('-', '');

  const idc = useRef(0);
  const blank = (): DraftLine => ({
    id: ++idc.current,
    account: '', debit: '', credit: '',
    agreement: '', agreementLine: '', period: defaultPeriod, externalAccount: '',
    currency: defaultCurrency, customer: '', invoice: '', supplier: '', refNo: '',
    ledger: defaultLedger, amountType: 'Manual', amountCode: '',
  });

  const [lines, setLines] = useState<DraftLine[]>(() => [blank(), blank()]);
  const [expanded, setExpanded] = useState<number[]>([]);

  const toggle = (id: number) => setExpanded(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  const num = (s: string) => Number(s.replace(/\s/g, '').replace(',', '.')) || 0;
  const totalDebit = lines.reduce((s, l) => s + num(l.debit), 0);
  const totalCredit = lines.reduce((s, l) => s + num(l.credit), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.005 && totalDebit > 0;
  const filled = lines.every(l => l.account && (num(l.debit) > 0 || num(l.credit) > 0));

  const patch = (id: number, p: Partial<DraftLine>) =>
    setLines(prev => prev.map(l => (l.id === id ? { ...l, ...p } : l)));

  // Add a row after the given one, carrying that row's attributes forward as defaults (all still
  // editable). Only account + debit/credit are cleared, since those change on every line — the
  // context (agreement, period, customer, ledger, amount type, …) is usually the same.
  const addAfter = (id: number) =>
    setLines(prev => {
      const i = prev.findIndex(l => l.id === id);
      const src = prev[i];
      const copy: DraftLine = { ...src, id: ++idc.current, account: '', debit: '', credit: '' };
      return [...prev.slice(0, i + 1), copy, ...prev.slice(i + 1)];
    });

  const removeLine = (id: number) => setLines(prev => prev.filter(l => l.id !== id));

  // A line has extra attributes beyond account/debit/credit — used to hint the expander.
  const hasDetail = (l: DraftLine) =>
    !!(l.agreement || l.agreementLine || l.externalAccount || l.customer || l.invoice || l.supplier || l.refNo || l.amountCode)
    || l.currency !== defaultCurrency || l.ledger !== defaultLedger || l.amountType !== 'Manual' || l.period !== defaultPeriod;

  const save = () => {
    if (!entity) return;
    const gliNumber = nextGliFor(data, entity); // next number in this entity's GLI series
    const journalLines: JournalLine[] = lines.map((l, i) => {
      const p = pseudo.find(x => x.pseudo === l.account);
      const cur = data.currencies.find(c => c.code === l.currency);
      const rate = cur?.rate && baseCur?.rate ? cur.rate / baseCur.rate : 1;
      return {
        line: i + 1, pseudoAccount: l.account, description: p?.description ?? 'Manual',
        agreement: l.agreement, agreementLine: Number(l.agreementLine) || null, period: l.period || undefined,
        customer: l.customer || undefined, supplier: l.supplier || undefined,
        invoice: l.invoice, refNo: l.refNo,
        debit: num(l.debit), credit: num(l.credit),
        ledger: l.ledger || 'Local Legal', currency: l.currency, currencyRate: rate,
        formula: 'MAN', externalAccountString: l.externalAccount,
        amountType: l.amountType || 'Manual', amountCode: l.amountCode || undefined, conditionValue: '',
      };
    });
    update(d => {
      addJournal(d, {
        gliNumber, gliPrefix: entity.gliPrefix, legalEntityId: entity.id, accountingEvent: 'Manual Transaction',
        lines: journalLines, lineCount: journalLines.length,
        bookingDate, createDate: bookingDate, exportDate: null,
        difference: false, createdBy: 'Rikard Krameus', manual: true,
      }, { source: 'Manual journal' });
      const e = d.legalEntities.find(x => x.id === entity.id);
      if (e) { e.gliNumberSerie = gliNumber; e.nextGli = gliNumber + 1; }
    });
    navigate(`/journals/gli/${gliNumber}`);
  };

  return (
    <div className="card">
      <div className="pagelike-title">Manual journal</div>
      <div className="form-grid" style={{ maxWidth: 560, marginBottom: 16 }}>
        <div className="f">
          <label>Legal entity</label>
          <select value={entityId} onChange={e => setEntityId(Number(e.target.value))}>
            {data.legalEntities.map(e => <option key={e.id} value={e.id}>{e.ownerCode} – {e.name}</option>)}
          </select>
        </div>
        <div className="f"><label>Booking date</label><input type="date" value={bookingDate} onChange={e => setBookingDate(e.target.value)} /></div>
      </div>

      <table className="cond-table" style={{ maxWidth: 860 }}>
        <thead>
          <tr>
            <th style={{ width: 96 }} />
            <th>Pseudo account</th>
            <th style={{ width: 140 }}>Debit</th>
            <th style={{ width: 140 }}>Credit</th>
          </tr>
        </thead>
        <tbody>
          {lines.map(l => {
            const isOpen = expanded.includes(l.id);
            return (
              <Fragment key={l.id}>
                <tr>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="expander" title="Line details" onClick={() => toggle(l.id)} style={hasDetail(l) && !isOpen ? { borderColor: 'var(--purple)', color: 'var(--purple)' } : undefined}>{isOpen ? '−' : '+'}</button>
                    <button className="icon-btn add" title="Add row" onClick={() => addAfter(l.id)}><Icon name="plus" size={15} /></button>
                    <button className="icon-btn del" title="Remove row" disabled={lines.length <= 2} onClick={() => removeLine(l.id)}><Icon name="x" size={15} /></button>
                  </td>
                  <td>
                    <select value={l.account} onChange={e => patch(l.id, { account: e.target.value })}>
                      <option value=""></option>
                      {pseudo.map(p => <option key={p.id} value={p.pseudo}>{p.pseudo} – {p.description}</option>)}
                    </select>
                  </td>
                  <td><input value={l.debit} onChange={e => patch(l.id, { debit: e.target.value, credit: '' })} /></td>
                  <td><input value={l.credit} onChange={e => patch(l.id, { credit: e.target.value, debit: '' })} /></td>
                </tr>
                {isOpen && (
                  <tr className="detail-row">
                    <td />
                    <td colSpan={3}>
                      <div className="form-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', margin: '4px 0 8px' }}>
                        <div className="f">
                          <label>Ledger</label>
                          <select value={l.ledger} onChange={e => patch(l.id, { ledger: e.target.value })}>
                            {ledgerValues.map(lv => <option key={lv} value={lv}>{lv}</option>)}
                          </select>
                        </div>
                        <div className="f">
                          <label>Currency</label>
                          <select value={l.currency} onChange={e => patch(l.id, { currency: e.target.value })}>
                            {data.currencies.map(c => <option key={c.id} value={c.code}>{c.code}{c.id === baseCur?.id ? ' (base)' : ''}</option>)}
                          </select>
                        </div>
                        <div className="f"><label>Period</label><input value={l.period} onChange={e => patch(l.id, { period: e.target.value })} placeholder="YYYYMM" inputMode="numeric" /></div>
                        <div className="f"><label>Agreement</label><input value={l.agreement} onChange={e => patch(l.id, { agreement: e.target.value })} placeholder="—" /></div>
                        <div className="f"><label>Agreement line</label><input value={l.agreementLine} onChange={e => patch(l.id, { agreementLine: e.target.value })} placeholder="—" inputMode="numeric" /></div>
                        <div className="f"><label>Customer</label><input value={l.customer} onChange={e => patch(l.id, { customer: e.target.value })} placeholder="—" /></div>
                        <div className="f"><label>Supplier</label><input value={l.supplier} onChange={e => patch(l.id, { supplier: e.target.value })} placeholder="—" /></div>
                        <div className="f"><label>Invoice number</label><input value={l.invoice} onChange={e => patch(l.id, { invoice: e.target.value })} placeholder="—" /></div>
                        <div className="f"><label>Reference number</label><input value={l.refNo} onChange={e => patch(l.id, { refNo: e.target.value })} placeholder="—" /></div>
                        <div className="f">
                          <label>Amount type</label>
                          <select value={l.amountType} onChange={e => patch(l.id, { amountType: e.target.value })}>
                            <option value="Manual">Manual</option>
                            {data.amountTypes.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
                          </select>
                        </div>
                        <div className="f"><label>Amount code</label><input value={l.amountCode} onChange={e => patch(l.id, { amountCode: e.target.value })} placeholder="—" /></div>
                        <div className="f"><label>External account (part)</label><input value={l.externalAccount} onChange={e => patch(l.id, { externalAccount: e.target.value })} placeholder="—" style={{ fontFamily: 'Consolas, monospace' }} /></div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
          <tr className="totals-row">
            <td />
            <td>Total</td>
            <td>{formatAmount(totalDebit)}</td>
            <td>{formatAmount(totalCredit)}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <button className="btn primary" disabled={!balanced || !filled} onClick={save}>Save journal</button>
        {!balanced && totalDebit + totalCredit > 0 && (
          <span className="badge-diff">Journal is not balanced (difference {formatAmount(Math.abs(totalDebit - totalCredit))})</span>
        )}
      </div>
    </div>
  );
}
