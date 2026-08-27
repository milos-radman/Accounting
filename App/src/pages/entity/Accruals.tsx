import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useStore, formatAmount } from '../../store';
import { Dialog } from '../../components/Chrome';
import { DrillLink } from '../../components/trail';
import { Icon } from '../../components/Icon';
import { deferralLines, round2, appendAccrualItem, planAccrualRecognition, recognizeAccruals } from '../../accruals';
import { takeGliFor } from '../../engine';
import type { AccrualCode, LegalEntity } from '../../types';

// Accruals: create an item from a message-line amount (deferring the total on the balance
// sheet) and recognise it monthly to the P&L. In production, creation is triggered by an
// activation message line tagged AmountGroup=Accrual, and recognition by the Monthly job;
// this page is the manual/demo surface for both.
export default function Accruals() {
  const entity = useOutletContext<LegalEntity>();
  const { data, update } = useStore();
  const [showCreate, setShowCreate] = useState(false);
  const [showAddCode, setShowAddCode] = useState(false);
  const [runPeriod, setRunPeriod] = useState(entity.openPeriod);
  const [expanded, setExpanded] = useState<number[]>([]);
  const [runResult, setRunResult] = useState<string | null>(null);

  const currencyCode = data.currencies.find(c => c.id === entity.baseCurrencyId)?.code ?? 'EUR';
  const codes = data.accrualCodes.filter(c => c.entityCode === entity.ownerCode);
  const items = data.accrualItems.filter(i => i.entityCode === entity.ownerCode);
  const linesOf = (itemId: number) =>
    data.accrualScheduleLines.filter(l => l.accrualItemId === itemId).sort((a, b) => a.period.localeCompare(b.period));
  const pseudoDesc = (code: string) =>
    data.pseudoAccounts.find(p => p.entityCode === entity.ownerCode && p.pseudo === code)?.description ?? code;

  const toggle = (id: number) => setExpanded(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  // Create an accrual: deferral GLI booking + item + schedule. Same engine the message
  // simulator uses — this page is the manual surface.
  const createAccrual = (code: AccrualCode, agreement: string, agreementLine: number | null, amount: number, startPeriod: string, accountingType: string, months: number) => {
    update(d => {
      const e = d.legalEntities.find(x => x.id === entity.id);
      if (!e) return;
      const gli = takeGliFor(d, e); // next number in this entity's GLI series
      const lines = deferralLines(code, amount, pseudoDesc, { agreement, agreementLine, currency: currencyCode });
      d.journals.unshift({
        gliNumber: gli, gliPrefix: e.gliPrefix, legalEntityId: entity.id, accountingEvent: 'Accrual',
        lines, lineCount: lines.length,
        bookingDate: `${startPeriod.slice(0, 4)}-${startPeriod.slice(4)}-01`,
        createDate: new Date().toISOString().slice(0, 10), exportDate: null,
        difference: false, createdBy: 'Accrual creation',
      });
      appendAccrualItem(d, entity.ownerCode, code, { agreement, agreementLine, amount, startPeriod, currency: currencyCode, sourceGli: gli, conditionInputs: accountingType ? { 7: accountingType } : {}, months });
    });
    setShowCreate(false);
  };

  // Monthly recognition: book all pending lines due up to the selected period. The plan is
  // computed read-only first (so the summary is reliable under StrictMode), then applied.
  // This is exactly what End of Month runs — the button here is the manual trigger.
  const runRecognition = (period: string) => {
    const plan = planAccrualRecognition(data, entity.ownerCode, period);
    if (plan.count === 0) {
      setRunResult(`Nothing due up to ${period}.`);
      return;
    }
    update(d => recognizeAccruals(d, entity.id, entity.ownerCode, period, 'Monthly accrual run'));
    setRunResult(`Recognised ${formatAmount(plan.total)} across ${plan.count} accrual${plan.count === 1 ? '' : 's'} for ${period}.`);
  };

  return (
    <div>
      <div className="pagelike-title">
        Accruals
        <span className="spacer" style={{ flex: 1 }} />
        <button className="btn" onClick={() => setShowAddCode(true)}><Icon name="plus" size={14} /> Accrual code</button>
        <button className="btn primary" disabled={codes.length === 0} onClick={() => setShowCreate(true)}>
          <Icon name="plus" size={14} /> Create accrual
        </button>
      </div>
      <p className="muted" style={{ maxWidth: 720, marginTop: -6 }}>
        An accrual defers the full amount on the balance sheet at creation and releases it to the
        profit &amp; loss account over its months. Creation stands in for an activation message line
        tagged as an accrual; the monthly run stands in for the Monthly Booking job.
      </p>

      <div className="card">
        <h4>Accrual codes</h4>
        <div className="grid-wrap" style={{ boxShadow: 'none' }}>
          <table className="grid">
            <thead>
              <tr><th>Code</th><th>Name</th><th>Direction</th><th className="num">Months</th><th>Deferral</th><th>Counter</th><th>Recognition</th><th>Message trigger</th></tr>
            </thead>
            <tbody>
              {codes.map(c => {
                const trigger = c.triggerAmountTypeId != null
                  ? data.amountTypes.find(a => a.id === c.triggerAmountTypeId)?.name
                  : null;
                return (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.code}</td>
                    <td>{c.name}</td>
                    <td>{c.direction}</td>
                    <td className="num">{c.months}</td>
                    <td>{c.deferralAccount}</td>
                    <td>{c.counterAccount}</td>
                    <td>{c.recognitionFormulaId != null
                      ? <span className="pill" title="condition-routed via formula">{data.formulas.find(f => f.id === c.recognitionFormulaId)?.name ?? `formula ${c.recognitionFormulaId}`}</span>
                      : c.recognitionAccount}</td>
                    <td>{trigger ? <span className="pill">{trigger}</span> : <span className="muted">manual</span>}</td>
                  </tr>
                );
              })}
              {codes.length === 0 && <tr><td colSpan={8} className="empty">No accrual codes — add one.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h4 style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          Monthly recognition run
          <span className="spacer" style={{ flex: 1 }} />
          <input
            value={runPeriod}
            onChange={e => setRunPeriod(e.target.value)}
            placeholder="YYYYMM"
            style={{ width: 100, border: '1px solid var(--line-strong)', borderRadius: 7, padding: '5px 9px', fontSize: 13 }}
          />
          <button className="btn primary small" disabled={!/^\d{6}$/.test(runPeriod)} onClick={() => runRecognition(runPeriod)}>
            <Icon name="zap" size={13} /> Run for period
          </button>
        </h4>
        <p className="muted" style={{ fontSize: 12.5, marginTop: 0 }}>
          Recognises every accrual slice due up to and including the period, and books a Monthly
          Booking journal (Dr P&amp;L / Cr balance for costs).
        </p>
        {runResult && <div className="info-card" style={{ fontSize: 12.5 }}>{runResult}</div>}
      </div>

      <div className="card">
        <h4>Accrual items</h4>
        <div className="grid-wrap" style={{ boxShadow: 'none' }}>
          <table className="grid">
            <thead>
              <tr>
                <th style={{ width: 30 }} /><th>Code</th><th>Agreement</th><th>Period</th>
                <th className="num">Total</th><th className="num">Accrued</th><th className="num">Remaining</th>
                <th>Status</th><th>Source journal</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const open = expanded.includes(item.id);
                return (
                  <RowGroup key={item.id}>
                    <tr className="clickable" onClick={() => toggle(item.id)}>
                      <td><button className="expander">{open ? '−' : '+'}</button></td>
                      <td style={{ fontWeight: 600 }}>{item.accrualCode}</td>
                      <td>{item.agreement}{item.agreementLine != null ? `-${item.agreementLine}` : ''}</td>
                      <td>{item.startPeriod}–{item.endPeriod}</td>
                      <td className="num">{formatAmount(item.totalAmount)}</td>
                      <td className="num">{formatAmount(item.amountAccrued)}</td>
                      <td className="num">{formatAmount(item.amountRemaining)}</td>
                      <td>
                        <span className={'pill' + (item.status === 'Active' ? '' : item.status === 'Completed' ? '' : ' inactive')}>
                          {item.status}
                        </span>
                      </td>
                      <td>
                        {item.sourceGli && <DrillLink to={`/journals/gli/${item.sourceGli}`} label={`Journal ${item.sourceGli}`} onClick={e => e.stopPropagation()}>{item.sourceGli}</DrillLink>}
                      </td>
                    </tr>
                    {open && (
                      <tr className="detail-row">
                        <td />
                        <td colSpan={8}>
                          <table className="cond-table" style={{ maxWidth: 620 }}>
                            <thead>
                              <tr><th>Period</th><th className="num">Planned</th><th className="num">Recognised</th><th>Status</th><th>Journal</th></tr>
                            </thead>
                            <tbody>
                              {linesOf(item.id).map(l => (
                                <tr key={l.id}>
                                  <td>{l.period}</td>
                                  <td className="num">{formatAmount(l.plannedAmount)}</td>
                                  <td className="num">{l.recognizedAmount ? formatAmount(l.recognizedAmount) : '—'}</td>
                                  <td>{l.status === 'Recognized'
                                    ? <span className="pill">Recognised</span>
                                    : <span className="muted">Pending</span>}</td>
                                  <td>{l.recognizedGli
                                    ? <DrillLink to={`/journals/gli/${l.recognizedGli}`} label={`Journal ${l.recognizedGli}`}>{l.recognizedGli}</DrillLink>
                                    : '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </RowGroup>
                );
              })}
              {items.length === 0 && <tr><td colSpan={9} className="empty">No accrual items yet — create one.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <CreateAccrualDialog
          codes={codes}
          defaultPeriod={entity.openPeriod}
          onClose={() => setShowCreate(false)}
          onCreate={createAccrual}
        />
      )}
      {showAddCode && (
        <AddCodeDialog entity={entity} onClose={() => setShowAddCode(false)} />
      )}
    </div>
  );
}

function RowGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function CreateAccrualDialog({ codes, defaultPeriod, onClose, onCreate }: {
  codes: AccrualCode[];
  defaultPeriod: string;
  onClose: () => void;
  onCreate: (code: AccrualCode, agreement: string, agreementLine: number | null, amount: number, startPeriod: string, accountingType: string, months: number) => void;
}) {
  const { data } = useStore();
  const accountingTypeOptions = (data.conditionValueOptions ?? []).filter(o => o.conditionValueId === 7);
  const [codeId, setCodeId] = useState(codes[0]?.id ?? 0);
  const [agreement, setAgreement] = useState('1232');
  const [agreementLine, setAgreementLine] = useState('1');
  const [amount, setAmount] = useState('1200');
  const [startPeriod, setStartPeriod] = useState(defaultPeriod);
  const [accountingType, setAccountingType] = useState('MG');
  const [months, setMonths] = useState('');

  const code = codes.find(c => c.id === codeId);
  const amt = Number(amount.replace(/\s/g, '').replace(',', '.')) || 0;
  const effMonths = Number(months) > 0 ? Number(months) : (code?.months ?? 12);
  const perMonth = amt ? round2(amt / Math.max(1, effMonths)) : 0;
  const valid = code != null && amt > 0 && /^\d{6}$/.test(startPeriod);

  return (
    <Dialog title="Create accrual" onClose={onClose} footer={
      <>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!valid} onClick={() => code && onCreate(code, agreement, Number(agreementLine) || null, amt, startPeriod, accountingType, effMonths)}>
          Create
        </button>
      </>
    }>
      <div className="form-grid">
        <div className="f">
          <label>Accrual code</label>
          <select value={codeId} onChange={e => setCodeId(Number(e.target.value))}>
            {codes.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
          </select>
        </div>
        <div className="f"><label>Start period</label><input value={startPeriod} onChange={e => setStartPeriod(e.target.value)} placeholder="YYYYMM" /></div>
        <div className="f">
          <label>Accounting type</label>
          <select value={accountingType} onChange={e => setAccountingType(e.target.value)}>
            <option value=""></option>
            {accountingTypeOptions.map(o => <option key={o.code} value={o.code}>{o.code} — {o.description}</option>)}
          </select>
        </div>
        <div className="f"><label>Agreement</label><input value={agreement} onChange={e => setAgreement(e.target.value)} /></div>
        <div className="f"><label>Agreement line</label><input value={agreementLine} onChange={e => setAgreementLine(e.target.value)} /></div>
        <div className="f"><label>Total amount</label><input value={amount} onChange={e => setAmount(e.target.value)} style={{ textAlign: 'right' }} /></div>
        <div className="f">
          <label>Months (spread length)</label>
          <input value={months} onChange={e => setMonths(e.target.value)} placeholder={code ? `${code.months} (code default)` : ''} style={{ textAlign: 'right' }} />
        </div>
        <div className="f" style={{ alignSelf: 'end' }}>
          <div className="muted" style={{ fontSize: 12 }}>
            {code ? `${formatAmount(perMonth)} × ${effMonths} months` : ''}
          </div>
        </div>
      </div>
    </Dialog>
  );
}

function AddCodeDialog({ entity, onClose }: { entity: LegalEntity; onClose: () => void }) {
  const { data, update } = useStore();
  const accounts = data.pseudoAccounts.filter(p => p.entityCode === entity.ownerCode);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [direction, setDirection] = useState<'Cost' | 'Income'>('Cost');
  const [months, setMonths] = useState('12');
  const [deferralAccount, setDeferralAccount] = useState(accounts[0]?.pseudo ?? '');
  const [counterAccount, setCounterAccount] = useState(accounts[0]?.pseudo ?? '');
  const [recognitionAccount, setRecognitionAccount] = useState(accounts[0]?.pseudo ?? '');
  const [recognitionFormulaId, setRecognitionFormulaId] = useState('');
  const [triggerAmountTypeId, setTriggerAmountTypeId] = useState('');
  const accrualAmountTypes = data.amountTypes.filter(a => a.amountGroup === 'Accrual');

  const save = () => {
    if (!code.trim()) return;
    update(d => {
      d.accrualCodes.push({
        id: Math.max(0, ...d.accrualCodes.map(c => c.id)) + 1,
        entityCode: entity.ownerCode, code: code.trim(), name: name.trim() || code.trim(),
        direction, months: Number(months) || 12,
        deferralAccount, counterAccount, recognitionAccount,
        recognitionFormulaId: recognitionFormulaId ? Number(recognitionFormulaId) : null,
        triggerAmountTypeId: triggerAmountTypeId ? Number(triggerAmountTypeId) : null,
      });
    });
    onClose();
  };

  const accountSelect = (value: string, set: (v: string) => void) => (
    <select value={value} onChange={e => set(e.target.value)}>
      {accounts.map(a => <option key={a.id} value={a.pseudo}>{a.pseudo} – {a.description}</option>)}
    </select>
  );

  return (
    <Dialog title="Add accrual code" onClose={onClose} footer={
      <>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!code.trim()} onClick={save}>Save</button>
      </>
    }>
      <div className="form-grid">
        <div className="f"><label>Code</label><input value={code} onChange={e => setCode(e.target.value)} /></div>
        <div className="f"><label>Name</label><input value={name} onChange={e => setName(e.target.value)} /></div>
        <div className="f">
          <label>Direction</label>
          <select value={direction} onChange={e => setDirection(e.target.value as 'Cost' | 'Income')}>
            <option value="Cost">Cost (prepaid → expense)</option>
            <option value="Income">Income (unearned → revenue)</option>
          </select>
        </div>
        <div className="f"><label>Months</label><input value={months} onChange={e => setMonths(e.target.value)} /></div>
        <div className="f"><label>Deferral account (balance)</label>{accountSelect(deferralAccount, setDeferralAccount)}</div>
        <div className="f"><label>Counter account</label>{accountSelect(counterAccount, setCounterAccount)}</div>
        <div className="f">
          <label>Recognition formula (P&amp;L, condition-routed)</label>
          <select value={recognitionFormulaId} onChange={e => setRecognitionFormulaId(e.target.value)}>
            <option value="">— none (use fixed account below) —</option>
            {data.formulas.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
        <div className="f"><label>Recognition account (P&amp;L) — fallback</label>{accountSelect(recognitionAccount, setRecognitionAccount)}</div>
        <div className="f">
          <label>Trigger amount type (from message)</label>
          <select value={triggerAmountTypeId} onChange={e => setTriggerAmountTypeId(e.target.value)}>
            <option value="">— none (manual only) —</option>
            {accrualAmountTypes.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      </div>
    </Dialog>
  );
}
