import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useStore, formatAmount } from '../../store';
import { Dialog } from '../../components/Chrome';
import { Icon } from '../../components/Icon';
import { fiscalYearOf, fiscalYearLabel, computeYearClose, applyYearClose } from '../../business/engine';
import type { LegalEntity, OpeningBalance } from '../../types';

// Opening (brought-forward) balances per legal entity + ledger + fiscal year. The position as of
// the first day of the fiscal year (derived from the entity's fiscalYearStartMonth, so broken /
// non-calendar years work). A valid set balances: sum(debit) === sum(credit).
export default function OpeningBalances() {
  const entity = useOutletContext<LegalEntity>();
  const { data, update } = useStore();

  const fyStart = entity.fiscalYearStartMonth ?? 1;
  const today = new Date().toISOString().slice(0, 10);
  const currentFy = fiscalYearOf(today, fyStart);

  // Ledgers configured for this entity (via its accounting classes).
  const ledgerOptions = useMemo(() => {
    const classIds = data.legalAccountingClasses.filter(c => c.legalEntityId === entity.id).map(c => c.id);
    const ledgerIds = data.legalAccountingLedgers.filter(l => classIds.includes(l.legalAccountingClassId)).map(l => l.ledgerId);
    const names = [...new Set(ledgerIds.map(id => data.ledgers.find(l => l.id === id)?.description).filter((x): x is string => !!x))];
    return names.length ? names : ['Local Legal'];
  }, [data, entity.id]);

  const myRows = (data.openingBalances ?? []).filter(o => o.entityCode === entity.ownerCode);
  const yearOptions = [...new Set([...myRows.map(r => r.fiscalYear), currentFy, currentFy - 1])].sort((a, b) => b - a);

  const [ledger, setLedger] = useState(ledgerOptions[0]);
  // Prefer a year that actually has opening balances; otherwise the current fiscal year.
  const [fiscalYear, setFiscalYear] = useState(myRows.length ? Math.max(...myRows.map(r => r.fiscalYear)) : currentFy);
  const [edit, setEdit] = useState<OpeningBalance | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [closing, setClosing] = useState(false);

  const rows = myRows.filter(o => o.ledger === ledger && o.fiscalYear === fiscalYear);
  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
  const diff = Math.round((totalDebit - totalCredit) * 100) / 100;

  const remove = (id: number) => update(d => { d.openingBalances = d.openingBalances.filter(o => o.id !== id); });

  return (
    <div>
      <div className="toolbar">
        <select value={ledger} onChange={e => setLedger(e.target.value)}>
          {ledgerOptions.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <select value={fiscalYear} onChange={e => setFiscalYear(Number(e.target.value))}>
          {yearOptions.map(y => <option key={y} value={y}>FY {fiscalYearLabel(y, fyStart)}</option>)}
        </select>
        <span className="muted" style={{ fontSize: 12 }}>
          as of {fiscalYear}-{String(fyStart).padStart(2, '0')}-01 · {rows.length} accounts
        </span>
        <div className="spacer" />
        <button className="btn ghost" onClick={() => setClosing(true)} title="Close this fiscal year and carry balances forward">
          <Icon name="calendar" size={14} /> Close year → {fiscalYear + 1}
        </button>
        <button className="btn" onClick={() => setShowAdd(true)}><Icon name="plus" size={14} /> Add</button>
      </div>

      <div
        style={{
          margin: '4px 0 12px', padding: '9px 14px', borderRadius: 8,
          border: '1px solid ' + (diff === 0 ? 'var(--line)' : '#f5c6c2'),
          background: diff === 0 ? 'var(--card, transparent)' : '#fdecea',
          display: 'flex', alignItems: 'center', gap: 14, fontSize: 13,
        }}
      >
        {diff === 0
          ? <><Icon name="check" size={15} /> <b>Balanced</b> — debit = credit = {formatAmount(totalDebit)}</>
          : <><Icon name="x" size={15} /> <b>Out of balance by {formatAmount(Math.abs(diff))}</b> — debit {formatAmount(totalDebit)} vs credit {formatAmount(totalCredit)}</>}
      </div>

      <div className="grid-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th>Account</th>
              <th>Description</th>
              <th style={{ textAlign: 'right' }}>Debit</th>
              <th style={{ textAlign: 'right' }}>Credit</th>
              <th style={{ width: 60 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map(o => (
              <tr key={o.id} className="clickable" onClick={() => setEdit(o)}>
                <td style={{ fontWeight: 600 }}>{o.pseudoAccount}</td>
                <td>{o.description}</td>
                <td style={{ textAlign: 'right' }}>{o.debit ? formatAmount(o.debit) : ''}</td>
                <td style={{ textAlign: 'right' }}>{o.credit ? formatAmount(o.credit) : ''}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="icon-btn" title="Edit" onClick={e => { e.stopPropagation(); setEdit(o); }}><Icon name="pencil" size={14} /></button>
                  <button className="icon-btn del" title="Delete" onClick={e => { e.stopPropagation(); remove(o.id); }}><Icon name="trash" size={15} /></button>
                </td>
              </tr>
            ))}
            {rows.length > 0 && (
              <tr style={{ fontWeight: 700, borderTop: '2px solid var(--line)' }}>
                <td colSpan={2} style={{ textAlign: 'right' }}>Total</td>
                <td style={{ textAlign: 'right' }}>{formatAmount(totalDebit)}</td>
                <td style={{ textAlign: 'right' }}>{formatAmount(totalCredit)}</td>
                <td />
              </tr>
            )}
            {rows.length === 0 && <tr><td colSpan={5} className="empty">No opening balances for {ledger}, FY {fiscalYearLabel(fiscalYear, fyStart)}. Add one to start.</td></tr>}
          </tbody>
        </table>
      </div>

      {(showAdd || edit) && (
        <OpeningBalanceDialog
          entity={entity}
          row={edit ?? undefined}
          defaults={{ ledger, fiscalYear }}
          onClose={() => { setShowAdd(false); setEdit(null); }}
        />
      )}
      {closing && (
        <CloseYearDialog
          entity={entity}
          ledger={ledger}
          fiscalYear={fiscalYear}
          onDone={() => { setClosing(false); setFiscalYear(fiscalYear + 1); }}
          onClose={() => setClosing(false)}
        />
      )}
    </div>
  );
}

// Year-end close: preview the result disposition + carry-forward, then apply it.
function CloseYearDialog({ entity, ledger, fiscalYear, onDone, onClose }: {
  entity: LegalEntity; ledger: string; fiscalYear: number; onDone: () => void; onClose: () => void;
}) {
  const { data, update } = useStore();
  const fyStart = entity.fiscalYearStartMonth ?? 1;
  const { summary } = useMemo(() => computeYearClose(data, entity, ledger, fiscalYear), [data, entity, ledger, fiscalYear]);
  const nextHasRows = data.openingBalances.some(o => o.entityCode === entity.ownerCode && o.ledger === ledger && o.fiscalYear === fiscalYear + 1);

  const confirm = () => {
    update(d => { applyYearClose(d, entity, ledger, fiscalYear); });
    onDone();
  };

  const label = (n: number) => n.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <Dialog title={`Close FY ${fiscalYearLabel(fiscalYear, fyStart)} · ${ledger}`} onClose={onClose} footer={
      <>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={confirm}>Close year & carry forward</button>
      </>
    }>
      <p style={{ marginTop: 0, fontSize: 13 }}>
        This moves the year's result into equity, creates the opening balances for
        <b> FY {fiscalYearLabel(fiscalYear + 1, fyStart)}</b> from this year's closing balance-sheet positions,
        and posts a <b>“Balance brought forward”</b> journal dated {fiscalYear + 1}-{String(fyStart).padStart(2, '0')}-01
        so the carry-forward is visible in the ledger. P&L accounts open the new year at zero.
      </p>
      <div className="field-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        <div className="field"><label>Result for the year</label><div className="val">{label(summary.netResult)} {summary.netResult >= 0 ? '(profit)' : '(loss)'}</div></div>
        <div className="field"><label>Accounts carried forward</label><div className="val">{summary.carriedAccounts}</div></div>
        <div className="field"><label>Retained earnings account</label><div className="val">{summary.retainedAccount ?? '— none found —'}</div></div>
        <div className="field"><label>Retained earnings after</label><div className="val">{label(summary.retainedBefore)} → <b>{label(summary.retainedAfter)}</b></div></div>
      </div>
      {!summary.retainedAccount && (
        <p className="muted" style={{ fontSize: 12, marginTop: 10, color: '#b3261e' }}>
          No equity / retained-earnings account was found for this entity, so the result cannot be disposed and next
          year's opening will not balance. Add a Balance account with "Equity" or "Retained" in its name first.
        </p>
      )}
      {nextHasRows && (
        <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
          FY {fiscalYearLabel(fiscalYear + 1, fyStart)} already has opening balances — closing again will replace them.
        </p>
      )}
    </Dialog>
  );
}

function OpeningBalanceDialog({ entity, row, defaults, onClose }: {
  entity: LegalEntity;
  row?: OpeningBalance;
  defaults: { ledger: string; fiscalYear: number };
  onClose: () => void;
}) {
  const { data, update } = useStore();
  const pseudoOptions = data.pseudoAccounts.filter(p => p.entityCode === entity.ownerCode);

  const [account, setAccount] = useState(row?.pseudoAccount ?? '');
  const [description, setDescription] = useState(row?.description ?? '');
  const [debit, setDebit] = useState(String(row?.debit ?? ''));
  const [credit, setCredit] = useState(String(row?.credit ?? ''));

  const onAccount = (pseudo: string) => {
    setAccount(pseudo);
    const p = pseudoOptions.find(x => x.pseudo === pseudo);
    if (p && !description) setDescription(p.description);
  };

  const save = () => {
    if (!account.trim()) return;
    const p = pseudoOptions.find(x => x.pseudo === account);
    update(d => {
      if (row) {
        const o = d.openingBalances.find(x => x.id === row.id);
        if (o) { o.pseudoAccount = account; o.description = description || p?.description || account; o.debit = Number(debit) || 0; o.credit = Number(credit) || 0; }
      } else {
        d.openingBalances.push({
          id: Math.max(0, ...d.openingBalances.map(x => x.id)) + 1,
          entityCode: entity.ownerCode, ledger: defaults.ledger, fiscalYear: defaults.fiscalYear,
          pseudoAccount: account, description: description || p?.description || account,
          debit: Number(debit) || 0, credit: Number(credit) || 0,
        });
      }
    });
    onClose();
  };

  return (
    <Dialog title={row ? 'Edit opening balance' : `Add opening balance · ${defaults.ledger} · FY ${defaults.fiscalYear}`} onClose={onClose} footer={
      <>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!account.trim()} onClick={save}>Save</button>
      </>
    }>
      <div className="form-grid">
        <div className="f">
          <label>Account</label>
          <select value={account} onChange={e => onAccount(e.target.value)}>
            <option value="">—</option>
            {pseudoOptions.map(p => <option key={p.id} value={p.pseudo}>{p.pseudo} – {p.description} {p.accountKind === 'Result' ? '(P&L)' : ''}</option>)}
          </select>
        </div>
        <div className="f">
          <label>Description</label>
          <input value={description} onChange={e => setDescription(e.target.value)} />
        </div>
        <div className="f">
          <label>Debit</label>
          <input type="number" value={debit} onChange={e => setDebit(e.target.value)} placeholder="0" />
        </div>
        <div className="f">
          <label>Credit</label>
          <input type="number" value={credit} onChange={e => setCredit(e.target.value)} placeholder="0" />
        </div>
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
        Opening balances belong on balance-sheet accounts (assets = debit; liabilities / equity = credit).
        P&L accounts open at zero. The set should balance: total debit = total credit.
      </p>
    </Dialog>
  );
}
