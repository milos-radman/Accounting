import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore, formatAmount } from '../../store';
import { Icon } from '../../components/Icon';
import {
  simulateMessage, formulasFor, conditionInputsNeeded, defaultAmounts, resolveBookingDate,
  exportBookingDate, nextGliFor, findReversalOriginals, reverseByMessage, addJournal, externalAccountFor,
} from '../../business/engine';
import { deferralLines, appendAccrualItem, resolveMessageAccruals } from '../../business/accruals';
import { activateRecognitionPlan } from '../../business/recognition';
import type { EventMessage, SimLine } from '../../business/engine';
import type { JournalLine } from '../../types';

interface AccrualLineInput { amountTypeId: number; amountCode: string; amount: string; months: string; }

// Event-message simulator: compose a message as another domain would send it,
// run it through the booking engine and create the resulting GLI journal.
export default function Simulator() {
  const { data, update } = useStore();
  const navigate = useNavigate();

  const [entityId, setEntityId] = useState(data.legalEntities[0]?.id ?? 1);
  const [classId, setClassId] = useState<number | null>(null); // null = follow the event's class
  const [eventId, setEventId] = useState<number | null>(1);
  const [bookingDate, setBookingDate] = useState('2024-10-05'); // event date (day the event ran)
  const [calculationDate, setCalculationDate] = useState('2024-11-01'); // e.g. agreement line start date
  const [agreement, setAgreement] = useState('1232');
  const [agreementLine, setAgreementLine] = useState('1');
  const [invoicingPeriod, setInvoicingPeriod] = useState(''); // billing period the event relates to (a number)
  const [portfolio, setPortfolio] = useState('23');
  const [invoice, setInvoice] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [product, setProduct] = useState('200');
  const [customer, setCustomer] = useState('');
  const [supplier, setSupplier] = useState('');
  const [conditionInputs, setConditionInputs] = useState<Record<number, string>>({ 7: 'MG' });
  const [currency, setCurrency] = useState(''); // '' = the entity base currency
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [codeLines, setCodeLines] = useState<Record<number, { code: string; amount: string }[]>>({});
  const [accrualLines, setAccrualLines] = useState<AccrualLineInput[]>([]);
  const [accountValues, setAccountValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<SimLine[] | null>(null);
  // Activation → recognition plan
  const [createPlan, setCreatePlan] = useState(true);

  const entity = data.legalEntities.find(e => e.id === entityId)!;

  // Every accounting event configured (with rules) for this entity, and the accounting class(es)
  // each is valid under. The event dropdown lists all of them across classes; picking an event
  // selects its class. Both class and event are separate fields on the message.
  const eventClasses = useMemo(() => {
    const m = new Map<number, number[]>();
    for (const r of data.accountingRules.filter(r => r.entityCode === entity.ownerCode)) {
      const lal = data.legalAccountingLedgers.find(l => l.id === r.legalAccountingLedgerId);
      const cid = data.legalAccountingClasses.find(c => c.id === lal?.legalAccountingClassId)?.accountingClassId;
      if (cid == null) continue;
      const arr = m.get(r.accountingEventId) ?? [];
      if (!arr.includes(cid)) arr.push(cid);
      m.set(r.accountingEventId, arr);
    }
    // The Accrual event books via the accrual engine, not accounting rules, so it has none — but it
    // should still be selectable (to post a standalone accrual) when the entity has accrual codes.
    const accrualEvent = data.accountingEvents.find(e => e.name === 'Accrual');
    const hasAccruals = data.accrualCodes.some(c => c.entityCode === entity.ownerCode && c.triggerAmountTypeId != null);
    if (accrualEvent && hasAccruals && !m.has(accrualEvent.id)) m.set(accrualEvent.id, [data.accountingClasses[0]?.id ?? 0]);
    return m;
  }, [data, entity.ownerCode]);
  const entityEventIds = useMemo(() => [...eventClasses.keys()], [eventClasses]);
  const effectiveEventId = eventId != null && entityEventIds.includes(eventId) ? eventId : entityEventIds[0] ?? null;
  const validClassIds = effectiveEventId != null ? (eventClasses.get(effectiveEventId) ?? []) : [];
  const effectiveClassId = classId != null && validClassIds.includes(classId) ? classId : validClassIds[0] ?? 0;

  const formulas = useMemo(
    () => (effectiveEventId == null ? [] : formulasFor(data, entity, effectiveClassId, effectiveEventId)),
    [data, entity, effectiveClassId, effectiveEventId],
  );
  const amountTypeIds = useMemo(
    () => [...new Set(formulas.map(f => f.amountTypeId).filter((x): x is number => x != null))],
    [formulas],
  );
  const condInputsNeeded = useMemo(() => conditionInputsNeeded(data, formulas), [data, formulas]);

  // The accounting month is DERIVED from the message's date (per the event's Event/Calculation basis,
  // mirroring engine.resolveBookingDate) — it is never typed in. "Period" in the message is instead a
  // number (which billing/invoicing period the event relates to) — see the Event data section.
  const dateBasisEvent = data.accountingEvents.find(e => e.id === effectiveEventId);
  const effBookingDate = dateBasisEvent && dateBasisEvent.bookingDate === 0 ? (calculationDate || bookingDate) : bookingDate;
  const effPeriod = effBookingDate.slice(0, 7).replace('-', '');
  const currencyCode = data.currencies.find(c => c.id === entity.baseCurrencyId)?.code ?? 'EUR';
  // Transaction currency (default = entity base) and its rate to the base currency.
  const txnCurrency = currency || currencyCode;
  const baseCur = data.currencies.find(c => c.id === entity.baseCurrencyId);
  const txnCur = data.currencies.find(c => c.code === txnCurrency);
  const rateToBase = txnCur?.rate && baseCur?.rate ? txnCur.rate / baseCur.rate : 1;
  const amountValue = (id: number): string => amounts[id] ?? String(defaultAmounts[id] ?? 1000);
  const num = (s: string) => Number(s.replace(/\s/g, '').replace(',', '.')) || 0;

  // Amount types that can carry several amount codes on one message (e.g. Added Cost).
  const isMultiCode = (id: number) => data.amountTypes.find(a => a.id === id)?.allowsMultipleCodes ?? false;
  // Configured Amount Code values (condition value 18) — picked as code + description, code stored.
  const amountCodeOptions = (data.conditionValueOptions ?? []).filter(o => o.conditionValueId === 18);
  // Configured Product values (condition value 8) — shown as code — description in the Product combo.
  const productOptions = (data.conditionValueOptions ?? []).filter(o => o.conditionValueId === 8);
  const codeRowsOf = (id: number) => codeLines[id] ?? [{ code: '', amount: '' }];
  const setCodeRows = (id: number, rows: { code: string; amount: string }[]) => {
    setCodeLines(prev => ({ ...prev, [id]: rows })); setResult(null);
  };

  // Accrual codes for this entity, and the amount types that trigger them (for the accrual-line
  // editor). Several codes can share a trigger type (e.g. Tax → PTAX and VTAX).
  const entityAccrualCodes = data.accrualCodes.filter(c => c.entityCode === entity.ownerCode && c.triggerAmountTypeId != null);
  const accrualTriggerTypeIds = [...new Set(entityAccrualCodes.map(c => c.triggerAmountTypeId as number))];
  const codesForType = (typeId: number) => entityAccrualCodes.filter(c => c.triggerAmountTypeId === typeId);

  // Configured dimensions whose source is the AccountValues list — their values come from the
  // contract/asset/supplier domains and must be supplied on the message. (Parts sourced from
  // the pseudo account or a message field are resolved automatically.)
  const extraDimensionParts = data.extAccountParts
    .filter(p => {
      if (p.legalEntityId !== entityId) return false;
      const def = data.extAccountValues.find(v => v.id === p.extAccountValueId);
      return (def?.source ?? 'AccountValuesList') === 'AccountValuesList';
    })
    .sort((a, b) => a.partNumber - b.partNumber);

  // Accruals this message would create, resolved from the accrual lines (read-only).
  const detectedAccruals = resolveMessageAccruals(
    data, entity.ownerCode,
    accrualLines.map(l => ({ amountTypeId: l.amountTypeId, amountCode: l.amountCode || null, amount: num(l.amount), months: Number(l.months) || undefined })),
  );

  const buildMessage = (): EventMessage => ({
    legalEntityId: entityId,
    accountingClassId: effectiveClassId,
    accountingEventId: effectiveEventId!,
    bookingDate, calculationDate,
    agreement, agreementLine, portfolio, invoice, referenceNumber, product, customer, supplier,
    period: effPeriod, invoicingPeriod: Number(invoicingPeriod) || undefined, currency: txnCurrency, currencyRate: rateToBase,
    conditionInputs,
    amounts: Object.fromEntries(amountTypeIds.filter(id => !isMultiCode(id)).map(id => [id, num(amountValue(id))])),
    amountCodeLines: amountTypeIds.filter(isMultiCode).flatMap(id =>
      codeRowsOf(id).map(r => ({ amountTypeId: id, amountCode: r.code, amount: num(r.amount) })).filter(l => l.amount),
    ),
    accountValues,
  });

  // An EndOfMonth event (e.g. Monthly Booking) is not booked on arrival — the message is held
  // Pending and released by the entity's End of Month run.
  const effectiveEvent = data.accountingEvents.find(e => e.id === effectiveEventId);
  const heldEvent = effectiveEvent?.postingMode === 'EndOfMonth';
  // The recognition plan the agreement domain will eventually send — for now entered by hand on the
  // Recognition page. Activation adopts this existing plan (it never generates a schedule here).
  const activationPlan = agreement.trim()
    ? data.recognitionPlans.find(p => p.legalEntityId === entityId && p.agreement === agreement.trim() && p.status !== 'Terminated')
    : undefined;
  // Effective booking date, per the event's Calculation Date / Event Date basis.
  const bookingInfo = effectiveEventId != null ? resolveBookingDate(data, buildMessage()) : null;

  const post = () => {
    if (effectiveEventId == null) return;
    setResult(simulateMessage(data, buildMessage()));
  };

  // Queue a held-event message into the pending inbox instead of booking it now.
  const queueMessage = () => {
    if (effectiveEventId == null) return;
    const eventName = data.accountingEvents.find(e => e.id === effectiveEventId)?.name ?? '';
    update(d => {
      const id = Math.max(0, ...d.pendingMessages.map(m => m.id)) + 1;
      d.pendingMessages.push({
        id, legalEntityId: entityId, accountingClassId: effectiveClassId, accountingEventId: effectiveEventId,
        eventName, period: effPeriod, invoicingPeriod: Number(invoicingPeriod) || undefined, bookingDate, calculationDate,
        agreement, agreementLine, portfolio, product, customer, supplier, invoice, referenceNumber,
        conditionInputs, amounts: Object.fromEntries(amountTypeIds.map(aid => [aid, num(amountValue(aid))])),
        accountValues, currency: txnCurrency, currencyRate: rateToBase,
        status: 'Pending', receivedDate: new Date().toISOString().slice(0, 10), releasedGli: null,
        source: 'Message simulator',
      });
    });
    navigate('/journals/pending');
  };

  const totalDebit = (result ?? []).filter(l => l.debitCredit === 'D').reduce((s, l) => s + l.amount, 0);
  const totalCredit = (result ?? []).filter(l => l.debitCredit === 'C').reduce((s, l) => s + l.amount, 0);
  const diff = Math.round((totalDebit - totalCredit) * 100) / 100;

  const createJournal = () => {
    // Allow an accrual-only message (no formula lines) to book its deferral + create the accrual.
    if (effectiveEventId == null || ((!result || result.length === 0) && detectedAccruals.length === 0)) return;
    const eventName = data.accountingEvents.find(e => e.id === effectiveEventId)?.name ?? '';
    const gliNumber = nextGliFor(data, entity); // next number in this entity's GLI series
    const startPeriod = effPeriod; // accounting month, derived from the message date (effBookingDate)
    const journalLines: JournalLine[] = (result ?? []).map((l, i) => {
      return {
        line: i + 1,
        pseudoAccount: l.account ?? '',
        description: l.accountDescription,
        agreement, agreementLine: Number(agreementLine) || null, period: effPeriod, invoicingPeriod: Number(invoicingPeriod) || undefined,
        customer: customer || undefined, supplier: supplier || undefined,
        invoice, refNo: referenceNumber,
        debit: l.debitCredit === 'D' ? l.amount : 0,
        credit: l.debitCredit === 'C' ? l.amount : 0,
        ledger: l.ledger, currency: txnCurrency, currencyRate: rateToBase,
        formula: l.formulaCode,
        externalAccountString: l.externalAccount,
        amountType: l.amountType,
        amountCode: l.amountCode || conditionInputs[18] || undefined,
        conditionValue: l.trace,
      };
    });
    // An amount tagged as an accrual trigger books its deferral on the same activation
    // journal, then the accrual item + schedule are created for the Monthly / End-of-Month
    // job to recognise. The message books the deferral; it does not book the P&L.
    const pseudoDesc = (acc: string) =>
      data.pseudoAccounts.find(p => p.entityCode === entity.ownerCode && p.pseudo === acc)?.description ?? acc;
    let lineNo = journalLines.length;
    const accrualMsg = buildMessage(); // carries the message dimensions (customer, asset, …)
    for (const a of detectedAccruals) {
      for (const dl of deferralLines(a.code, a.amount, pseudoDesc, { agreement, agreementLine: Number(agreementLine) || null, currency: txnCurrency })) {
        lineNo += 1;
        const pseudo = data.pseudoAccounts.find(p => p.entityCode === entity.ownerCode && p.pseudo === dl.pseudoAccount);
        journalLines.push({
          ...dl, line: lineNo, period: effPeriod, invoicingPeriod: Number(invoicingPeriod) || undefined, currencyRate: rateToBase,
          externalAccountString: externalAccountFor(data, entity, pseudo, accrualMsg),
          customer: customer || undefined, supplier: supplier || undefined,
        });
      }
    }
    const correlationId = `SIM-${Date.now()}`; // stands in for the sending domain's message id
    update(d => {
      addJournal(d, {
        gliNumber, gliPrefix: entity.gliPrefix, legalEntityId: entityId, accountingEvent: eventName,
        lines: journalLines, lineCount: journalLines.length,
        bookingDate: effBookingDate, createDate: bookingDate, exportDate: null,
        difference: diff !== 0, createdBy: 'Message simulator',
      }, { correlationId, source: 'Message simulator' });
      for (const a of detectedAccruals) {
        appendAccrualItem(d, entity.ownerCode, a.code, {
          agreement, agreementLine: Number(agreementLine) || null,
          amount: a.amount, startPeriod, currency: currencyCode, sourceGli: gliNumber,
          conditionInputs: { ...conditionInputs }, months: a.months,
          messageContext: { portfolio, product, customer, supplier, accountValues: { ...accountValues } },
        });
      }
      // On Activation, adopt the agreement's manually-entered recognition plan: flip it Proposed →
      // Active and stamp this activation journal. The schedule itself is authored on the Recognition
      // page (the agreement domain will own that maths later), not generated here.
      if (createPlan && effectiveEvent?.name === 'Activation') {
        activateRecognitionPlan(d, entityId, agreement, gliNumber);
      }
      const e = d.legalEntities.find(x => x.id === entityId);
      if (e) {
        e.gliNumberSerie = gliNumber; // advance this entity's GLI series to the number just used
        e.nextGli = gliNumber + 1;
        e.journalDifferences = d.journals.filter(x => x.legalEntityId === e.id && x.difference).length;
      }
    });
    navigate(`/journals/gli/${gliNumber}`);
  };

  return (
    <div>
      <div className="pagelike-title">Message simulator</div>
      <p className="muted" style={{ maxWidth: 680, marginTop: -6 }}>
        Compose an event message as another domain (Contract, Receivables…) would send it.
        The booking engine applies the accounting rules of the selected legal entity and event,
        resolves formulas and conditions, and produces the journal lines.
      </p>

      <ReversalCard />

      <div className="card">
        <h4>Message header</h4>
        <div className="form-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <div className="f">
            <label>Legal entity</label>
            <select value={entityId} onChange={e => { setEntityId(Number(e.target.value)); setClassId(null); setEventId(null); setCurrency(''); setResult(null); }}>
              {data.legalEntities.map(e => <option key={e.id} value={e.id}>{e.ownerCode} – {e.name}</option>)}
            </select>
          </div>
          <div className="f">
            <label>Accounting event</label>
            <select value={effectiveEventId ?? ''} onChange={e => { setEventId(Number(e.target.value)); setClassId(null); setResult(null); }}>
              {entityEventIds.map(id => (
                <option key={id} value={id}>{data.accountingEvents.find(e => e.id === id)?.name}</option>
              ))}
            </select>
          </div>
          <div className="f">
            <label>Accounting class</label>
            <select value={effectiveClassId} onChange={e => { setClassId(Number(e.target.value)); setResult(null); }}>
              {validClassIds.map(id => <option key={id} value={id}>{data.accountingClasses.find(c => c.id === id)?.name}</option>)}
            </select>
          </div>
          <div className="f"><label>Event date <span className="muted" style={{ fontWeight: 400, fontSize: 11 }}>· when the event ran</span></label><input type="date" value={bookingDate} onChange={e => { setBookingDate(e.target.value); setResult(null); }} /></div>
          <div className="f"><label>Calculation date <span className="muted" style={{ fontWeight: 400, fontSize: 11 }}>· e.g. agreement start</span></label><input type="date" value={calculationDate} onChange={e => { setCalculationDate(e.target.value); setResult(null); }} /></div>
          <div className="f">
            <label>Booking date <span className="muted" style={{ fontWeight: 400, fontSize: 11 }}>· {bookingInfo?.basis === 'Calculation' ? 'Calculation Date' : 'Event Date'} basis</span></label>
            <div className="val" style={{ padding: '7px 2px', fontWeight: 600 }}>{bookingInfo?.date ?? '—'}</div>
            {bookingInfo && <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{bookingInfo.reason} · accounting period {effPeriod}</div>}
            {bookingInfo && exportBookingDate(entity, bookingInfo.date) !== bookingInfo.date && (
              <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>closed period — exported to GL as {exportBookingDate(entity, bookingInfo.date)}</div>
            )}
          </div>
          <div className="f">
            <label>Transaction currency</label>
            <select value={txnCurrency} onChange={e => { setCurrency(e.target.value); setResult(null); }}>
              {data.currencies.map(c => <option key={c.id} value={c.code}>{c.code}{c.code === currencyCode ? ' (base)' : ''}</option>)}
            </select>
          </div>
          <div className="f">
            <label>Rate to base ({currencyCode})</label>
            <div className="val" style={{ padding: '7px 2px', fontVariantNumeric: 'tabular-nums' }}>
              {txnCurrency === currencyCode ? '1.000000 (base)' : `${rateToBase.toFixed(6)}  ·  1 ${txnCurrency} = ${rateToBase.toFixed(4)} ${currencyCode}`}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h4>Event data</h4>
        <div className="form-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <div className="f"><label>Agreement</label><input value={agreement} onChange={e => { setAgreement(e.target.value); setResult(null); }} placeholder="—" /></div>
          <div className="f"><label>Agreement line</label><input value={agreementLine} onChange={e => { setAgreementLine(e.target.value); setResult(null); }} placeholder="—" /></div>
          <div className="f"><label>Period <span className="muted" style={{ fontWeight: 400, fontSize: 11 }}>· billing period no.</span></label><input value={invoicingPeriod} onChange={e => { setInvoicingPeriod(e.target.value); setResult(null); }} placeholder="— (e.g. installment 1, 2, 3…)" inputMode="numeric" /></div>
          <div className="f"><label>Portfolio</label><input value={portfolio} onChange={e => { setPortfolio(e.target.value); setResult(null); }} /></div>
          <div className="f"><label>Product</label>
            <select value={product} onChange={e => { setProduct(e.target.value); setResult(null); }}>
              <option value=""></option>
              {!productOptions.some(o => o.code === product) && product && <option value={product}>{product}</option>}
              {productOptions.map(o => <option key={o.code} value={o.code}>{o.code} — {o.description}</option>)}
            </select>
          </div>
          <div className="f"><label>Invoice number</label><input value={invoice} onChange={e => setInvoice(e.target.value)} placeholder="Optional" /></div>
          <div className="f"><label>Reference number <span className="muted" style={{ fontWeight: 400, fontSize: 11 }}>· e.g. supplier invoice no.</span></label><input value={referenceNumber} onChange={e => setReferenceNumber(e.target.value)} placeholder="—" /></div>
          <div className="f"><label>Customer</label><input value={customer} onChange={e => { setCustomer(e.target.value); setResult(null); }} placeholder="—" /></div>
          <div className="f"><label>Supplier</label><input value={supplier} onChange={e => { setSupplier(e.target.value); setResult(null); }} placeholder="— (AP)" /></div>
          {condInputsNeeded.map(ci => (
            <div className="f" key={ci.conditionValueId}>
              <label>{ci.name}</label>
              <select
                value={conditionInputs[ci.conditionValueId] ?? ''}
                onChange={e => { setConditionInputs(prev => ({ ...prev, [ci.conditionValueId]: e.target.value })); setResult(null); }}
              >
                <option value="">— none —</option>
                {ci.options.map(o => <option key={o.code} value={o.code}>{o.label}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>

      {extraDimensionParts.length > 0 && (
        <div className="card">
          <h4>Accounting dimensions <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>(values from the contract / asset / supplier domains — build the external account string)</span></h4>
          <p className="muted" style={{ fontSize: 12.5, marginTop: -4 }}>
            {entity.ownerCode} configures these parts in addition to the header fields. They are not
            tied to an agreement, so a supplier invoice for an asset (no agreement/line) still resolves
            its dimensions. Supply the values the sending domain has; blanks are left empty in the string.
          </p>
          <div className="form-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {extraDimensionParts.map(p => (
              <div className="f" key={p.id}>
                <label>{p.name} <span className="muted" style={{ fontSize: 11 }}>· pos {p.partNumber}</span></label>
                <input
                  value={accountValues[p.name] ?? ''}
                  placeholder="—"
                  onChange={e => { setAccountValues(prev => ({ ...prev, [p.name]: e.target.value })); setResult(null); }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h4>Amounts <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>(amount types used by the formulas of this event)</span></h4>
        {amountTypeIds.length === 0 ? (
          <div className="empty">No accounting rules configured for this combination.</div>
        ) : (
          <>
            <div className="form-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
              {amountTypeIds.filter(id => !isMultiCode(id)).map(id => {
                const at = data.amountTypes.find(a => a.id === id);
                return (
                  <div className="f" key={id}>
                    <label title={at?.description}>{at?.name}</label>
                    <input
                      value={amountValue(id)}
                      onChange={e => { setAmounts(prev => ({ ...prev, [id]: e.target.value })); setResult(null); }}
                      style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
                    />
                  </div>
                );
              })}
            </div>
            {amountTypeIds.filter(isMultiCode).map(id => {
              const at = data.amountTypes.find(a => a.id === id);
              const rows = codeRowsOf(id);
              return (
                <div key={id} style={{ marginTop: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <b>{at?.name}</b>
                    <span className="pill">multi-code</span>
                    <span className="muted" style={{ fontSize: 12 }}>total {formatAmount(rows.reduce((s, r) => s + num(r.amount), 0))} — one row per amount code (each books to its own account)</span>
                    <span style={{ flex: 1 }} />
                    <button className="btn small" onClick={() => setCodeRows(id, [...rows, { code: '', amount: '' }])}><Icon name="plus" size={13} /> Add code</button>
                  </div>
                  <div className="grid-wrap" style={{ boxShadow: 'none' }}>
                    <table className="grid">
                      <thead><tr><th style={{ width: 180 }}>Amount code</th><th className="num" style={{ width: 160 }}>Amount</th><th style={{ width: 40 }} /></tr></thead>
                      <tbody>
                        {rows.map((r, i) => (
                          <tr key={i}>
                            <td>
                              <select value={r.code} onChange={e => setCodeRows(id, rows.map((x, j) => j === i ? { ...x, code: e.target.value } : x))} style={{ width: '100%' }}>
                                <option value="">— amount code —</option>
                                {!amountCodeOptions.some(o => o.code === r.code) && r.code && <option value={r.code}>{r.code}</option>}
                                {amountCodeOptions.map(o => <option key={o.code} value={o.code}>{o.code} — {o.description}</option>)}
                              </select>
                            </td>
                            <td className="num"><input value={r.amount} placeholder="0" onChange={e => setCodeRows(id, rows.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))} style={{ textAlign: 'right', width: '100%' }} /></td>
                            <td><button className="btn ghost small" onClick={() => setCodeRows(id, rows.filter((_, j) => j !== i))}>✕</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </>
        )}
        <div style={{ marginTop: 16 }}>
          <button className="btn primary" disabled={effectiveEventId == null || (amountTypeIds.length === 0 && detectedAccruals.length === 0)} onClick={post}>
            <Icon name="zap" size={14} /> Post message
          </button>
        </div>
      </div>

      {effectiveEvent?.name === 'Activation' && (
        <div className="card">
          <h4 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            Recognition plan
            <span className="muted" style={{ fontWeight: 400, fontSize: 12, flex: 1 }}>
              (the agreement domain owns the schedule — activation adopts the plan entered on the Recognition page)
            </span>
          </h4>
          <label className="checkbox-inline" style={{ marginBottom: 8 }}>
            <input type="checkbox" checked={createPlan} onChange={e => setCreatePlan(e.target.checked)} />
            Activate the recognition plan for this agreement
          </label>
          {createPlan && (
            activationPlan ? (
              <div className={activationPlan.status === 'Proposed' ? 'notice ok' : 'notice'} style={{ fontSize: 13, padding: '8px 10px', borderRadius: 6, background: activationPlan.status === 'Proposed' ? 'rgba(26,127,55,0.10)' : 'rgba(0,0,0,0.04)' }}>
                {activationPlan.status === 'Proposed'
                  ? <>Will adopt the manually-entered plan for agreement <b>{activationPlan.agreement}</b> — {activationPlan.lines.length} line{activationPlan.lines.length === 1 ? '' : 's'}, {activationPlan.lines.reduce((s, l) => s + (l.imported?.rows.length ?? 0), 0)} months. It is <b>Proposed</b> now; booking this activation flips it to <b>Active</b> and stamps this journal.</>
                  : <>A recognition plan for agreement <b>{activationPlan.agreement}</b> already exists and is <b>{activationPlan.status}</b> — activation will re-stamp it, nothing to create.</>}
              </div>
            ) : (
              <div className="notice warn" style={{ fontSize: 13, padding: '8px 10px', borderRadius: 6, background: 'rgba(179,84,30,0.10)', color: '#b3541e' }}>
                No recognition plan found for agreement <b>{agreement.trim() || '—'}</b>. Enter it first on the entity’s <b>Recognition</b> page (<b>New plan</b>) — the activation will then adopt it. The journal still books either way.
              </div>
            )
          )}
          <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            Activation does not compute a schedule (a loan / HP / finance-lease split moves every period — that’s the
            agreement domain’s maths). Until that domain is live, author the plan by hand on the <b>Recognition</b> page;
            activation here adopts it and it’s reconciled against invoicing at End of Month.
          </p>
        </div>
      )}

      {accrualTriggerTypeIds.length > 0 && (
        <div className="card">
          <h4 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            Accrual lines
            <span className="muted" style={{ fontWeight: 400, fontSize: 12, flex: 1 }}>
              (amount type + Amount Code → accrual code; defers now, recognised at End of Month)
            </span>
            <button className="btn small" onClick={() => setAccrualLines(prev => [...prev, { amountTypeId: accrualTriggerTypeIds[0], amountCode: '', amount: '', months: '' }])}>
              <Icon name="plus" size={13} /> Add line
            </button>
          </h4>
          {accrualLines.length === 0 ? (
            <div className="empty">No accrual lines. Add one to carry e.g. Insurance, Deposit or a Tax (PTAX/VTAX) amount.</div>
          ) : (
            <div className="grid-wrap" style={{ boxShadow: 'none' }}>
              <table className="grid">
                <thead>
                  <tr><th style={{ width: 200 }}>Amount type</th><th style={{ width: 160 }}>Amount Code</th><th className="num" style={{ width: 140 }}>Amount</th><th className="num" style={{ width: 90 }}>Months</th><th>Accrual code</th><th style={{ width: 40 }} /></tr>
                </thead>
                <tbody>
                  {accrualLines.map((line, i) => {
                    const candidates = codesForType(line.amountTypeId);
                    const resolved = candidates.length === 1 && !line.amountCode
                      ? candidates[0]
                      : candidates.find(c => c.code.toLowerCase() === line.amountCode.toLowerCase());
                    const setLine = (patch: Partial<AccrualLineInput>) => {
                      setAccrualLines(prev => prev.map((l, j) => j === i ? { ...l, ...patch } : l));
                      setResult(null);
                    };
                    return (
                      <tr key={i}>
                        <td>
                          <select value={line.amountTypeId} onChange={e => setLine({ amountTypeId: Number(e.target.value), amountCode: '' })}>
                            {accrualTriggerTypeIds.map(id => (
                              <option key={id} value={id}>{data.amountTypes.find(a => a.id === id)?.name}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          {candidates.length > 1 ? (
                            <select value={line.amountCode} onChange={e => setLine({ amountCode: e.target.value })}>
                              <option value="">— pick —</option>
                              {candidates.map(c => <option key={c.id} value={c.code}>{c.code}</option>)}
                            </select>
                          ) : (
                            <span className="muted">{candidates[0]?.code ?? '—'}</span>
                          )}
                        </td>
                        <td className="num">
                          <input value={line.amount} placeholder="0"
                            onChange={e => setLine({ amount: e.target.value })}
                            style={{ textAlign: 'right', width: '100%' }} />
                        </td>
                        <td className="num">
                          <input value={line.months} placeholder={resolved ? String(resolved.months) : ''}
                            onChange={e => setLine({ months: e.target.value })}
                            title="Spread length for this accrual (blank = the code's default)"
                            style={{ textAlign: 'right', width: '100%' }} />
                        </td>
                        <td>{resolved ? <span className="pill">{resolved.code} — {resolved.name}</span> : <span className="muted">unresolved</span>}</td>
                        <td>
                          <button className="btn ghost small" onClick={() => { setAccrualLines(prev => prev.filter((_, j) => j !== i)); setResult(null); }}>✕</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {result && (
        <div className="card">
          <h4>
            Booking result
            <span className="muted" style={{ fontWeight: 400, fontSize: 12, marginLeft: 8 }}>
              {result.length} journal lines from {new Set(result.map(l => l.ruleId)).size} matching rules
            </span>
          </h4>
          {result.length === 0 && detectedAccruals.length === 0 ? (
            <div className="empty">No lines produced — check that amounts are non-zero and conditions match.</div>
          ) : (
            <>
              {result.length > 0 && (
              <div className="grid-wrap" style={{ boxShadow: 'none' }}>
                <table className="grid">
                  <thead>
                    <tr>
                      <th>Ledger</th>
                      <th>Formula</th>
                      <th>Amount type</th>
                      <th>Account</th>
                      <th>Description</th>
                      <th className="num">Debit</th>
                      <th className="num">Credit</th>
                      <th>Account dimension</th>
                      <th>Resolved by</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.map((l, i) => (
                      <tr key={i}>
                        <td>{l.ledger}</td>
                        <td>{l.formulaCode}</td>
                        <td>{l.amountType}</td>
                        <td style={{ fontWeight: 600 }}>{l.account}</td>
                        <td>{l.accountDescription}</td>
                        <td className="num">{l.debitCredit === 'D' ? formatAmount(l.amount) : ''}</td>
                        <td className="num">{l.debitCredit === 'C' ? formatAmount(l.amount) : ''}</td>
                        <td style={{ fontFamily: 'Consolas, monospace', fontSize: 12.5, whiteSpace: 'pre' }}>
                          {l.externalAccount || '—'}
                        </td>
                        <td className="muted" style={{ fontSize: 12 }}>{l.trace}</td>
                      </tr>
                    ))}
                    <tr className="totals-row">
                      <td colSpan={5}>Total</td>
                      <td className="num">{formatAmount(totalDebit)}</td>
                      <td className="num">{formatAmount(totalCredit)}</td>
                      <td colSpan={2}>{diff !== 0
                        ? <span className="badge-diff">Difference {formatAmount(Math.abs(diff))}</span>
                        : <span className="pill">Balanced</span>}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              )}
              {detectedAccruals.length > 0 && (
                <div className="info-card" style={{ marginTop: 14, fontSize: 12.5 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icon name="layers" size={14} /> Accruals created from this message
                  </div>
                  {detectedAccruals.map(a => (
                    <div key={a.code.id} className="muted">
                      {a.code.code} — {a.code.name}: {formatAmount(a.amount)} deferred, released {formatAmount(a.amount / Math.max(1, a.months ?? a.code.months))} × {a.months ?? a.code.months} months from {bookingDate.slice(0, 7).replace('-', '')}.
                    </div>
                  ))}
                  <div className="muted" style={{ marginTop: 4 }}>
                    The deferral is booked on this journal; the monthly slices are recognised by End of Month.
                  </div>
                </div>
              )}
              {heldEvent ? (
                <>
                  <div className="info-card" style={{ marginTop: 14, fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon name="calendar" size={14} />
                    <span><b>{effectiveEvent?.name}</b> is posted at End of Month. This preview is not booked — the message is held <b>Pending</b> for period {bookingDate.slice(0, 7).replace('-', '')} and released when the accountant runs End of Month for {entity.ownerCode}.</span>
                  </div>
                  <div style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
                    <button className="btn primary" onClick={queueMessage}>
                      <Icon name="calendar" size={14} /> Queue as Pending
                    </button>
                    <span className="muted" style={{ fontSize: 12 }}>Adds to the pending inbox for {entity.ownerCode} · period {bookingDate.slice(0, 7).replace('-', '')}</span>
                  </div>
                </>
              ) : (
                <div style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
                  <button className="btn primary" onClick={createJournal}>
                    <Icon name="check" size={14} /> Create journal
                  </button>
                  <span className="muted" style={{ fontSize: 12 }}>
                    Creates journal {entity.gliPrefix ?? ''}{nextGliFor(data, entity)} for {entity.ownerCode}
                    {diff !== 0 && ' — will be flagged with a difference'}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// A reversal message: one generic Reversal Reference, interpreted by the event's match rule, finds
// the original booking and mirrors it (flip D/C). No accounting rules — reversal events carry none.
function ReversalCard() {
  const { data, update } = useStore();
  const navigate = useNavigate();
  const reversalEvents = data.accountingEvents.filter(e => e.eventCategoryId === 2 && e.reverseMatchBy);

  const [entityId, setEntityId] = useState(data.legalEntities[0]?.id ?? 1);
  const [eventId, setEventId] = useState(reversalEvents.find(e => e.id === 17)?.id ?? reversalEvents[0]?.id ?? 0);
  const [reference, setReference] = useState('');
  const [agreement, setAgreement] = useState('');
  const [agreementLine, setAgreementLine] = useState('1');
  const [period, setPeriod] = useState('');
  const [newInvoice, setNewInvoice] = useState('');

  const event = data.accountingEvents.find(e => e.id === eventId);
  const matchBy = event?.reverseMatchBy;
  const original = event?.originalEventId != null ? data.accountingEvents.find(e => e.id === event.originalEventId) : undefined;
  const usesRef = matchBy === 'InvoiceNumber' || matchBy === 'ReferenceNumber' || matchBy === 'PaymentId';
  const usesDims = matchBy === 'AgreementLine' || matchBy === 'AgreementLinePeriod';
  const refLabel = matchBy === 'InvoiceNumber' ? 'Original invoice number'
    : matchBy === 'PaymentId' ? 'Payment id (the specific payment to undo)'
    : 'Reference number (our unique supplier-invoice id)';
  const entity = data.legalEntities.find(e => e.id === entityId);

  const ref = { reference, agreement, agreementLine, period, invoice: newInvoice };
  const preview = useMemo(
    () => (event && entity) ? findReversalOriginals(data, entityId, event, ref) : [],
    [data, entityId, event, reference, agreement, agreementLine, period],
  );
  const totalLines = preview.reduce((s, t) => s + t.lines.length, 0);
  const fmt = (n: number) => n.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const book = () => {
    if (!event || preview.length === 0) return;
    let first = 0;
    update(d => {
      const ev = d.accountingEvents.find(e => e.id === eventId)!;
      const res = reverseByMessage(d, entityId, ev, ref, 'Message simulator (reversal)');
      first = res.gliList[0] ?? 0;
    });
    if (first) navigate(`/journals/gli/${first}`);
  };

  return (
    <div className="card">
      <h4>Reversal message <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>(credit / undo — mirrors an existing booking, no accounting rules)</span></h4>
      <div className="form-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="f">
          <label>Legal entity</label>
          <select value={entityId} onChange={e => setEntityId(Number(e.target.value))}>
            {data.legalEntities.map(e => <option key={e.id} value={e.id}>{e.ownerCode} – {e.name}</option>)}
          </select>
        </div>
        <div className="f">
          <label>Reversal event</label>
          <select value={eventId} onChange={e => setEventId(Number(e.target.value))}>
            {reversalEvents.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
        <div className="f" style={{ gridColumn: 'span 2', alignSelf: 'end' }}>
          <div className="muted" style={{ fontSize: 12 }}>
            Reverses <b>{original?.name ?? '—'}</b> · finds the original by{' '}
            <b>{matchBy === 'InvoiceNumber' ? 'invoice number' : matchBy === 'ReferenceNumber' ? 'reference number' : matchBy === 'PaymentId' ? 'payment id' : matchBy === 'AgreementLinePeriod' ? 'agreement line + period' : 'agreement line'}</b>.
          </div>
        </div>

        {usesRef && (
          <div className="f" style={{ gridColumn: 'span 2' }}>
            <label>Reversal reference <span className="muted" style={{ fontWeight: 400, fontSize: 11 }}>· {refLabel}</span></label>
            <input value={reference} onChange={e => setReference(e.target.value)} placeholder="the debit document being reversed" />
          </div>
        )}
        {matchBy === 'InvoiceNumber' && (
          <div className="f"><label>New credit invoice no. <span className="muted" style={{ fontWeight: 400, fontSize: 11 }}>· optional</span></label><input value={newInvoice} onChange={e => setNewInvoice(e.target.value)} placeholder="—" /></div>
        )}
        {usesDims && <>
          <div className="f"><label>Agreement</label><input value={agreement} onChange={e => setAgreement(e.target.value)} placeholder="—" /></div>
          <div className="f"><label>Agreement line</label><input value={agreementLine} onChange={e => setAgreementLine(e.target.value)} placeholder="—" /></div>
          {matchBy === 'AgreementLinePeriod' && <div className="f"><label>Period</label><input value={period} onChange={e => setPeriod(e.target.value)} placeholder="YYYYMM" /></div>}
        </>}
      </div>

      <div style={{ marginTop: 12 }}>
        {preview.length === 0 ? (
          <div className="empty">No matching original booking {usesRef && reference ? `for reference "${reference}"` : ''} — nothing to reverse yet.</div>
        ) : (
          <>
            <div className="grid-wrap" style={{ boxShadow: 'none' }}>
              <table className="grid">
                <thead><tr><th>Original journal</th><th>Event</th><th className="num">Lines to mirror</th><th className="num">Debit</th><th className="num">Credit</th></tr></thead>
                <tbody>
                  {preview.map((t, i) => (
                    <tr key={i}>
                      <td>{entity?.gliPrefix ?? ''}{t.journal.gliNumber}</td>
                      <td>{t.journal.accountingEvent}</td>
                      <td className="num">{t.lines.length}</td>
                      <td className="num">{fmt(t.lines.reduce((s, l) => s + l.debit, 0))}</td>
                      <td className="num">{fmt(t.lines.reduce((s, l) => s + l.credit, 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
              <button className="btn primary" onClick={book}><Icon name="swap" size={14} /> Book reversal</button>
              <span className="muted" style={{ fontSize: 12 }}>
                Mirrors {totalLines} line{totalLines === 1 ? '' : 's'} across {preview.length} journal{preview.length === 1 ? '' : 's'}, flipping debit/credit.
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
