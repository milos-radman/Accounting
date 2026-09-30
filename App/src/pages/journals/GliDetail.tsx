import { useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Breadcrumb, Dialog } from '../../components/Chrome';
import { DrillLink } from '../../components/trail';
import { Icon } from '../../components/Icon';
import { useStore, formatAmount } from '../../store';
import { exportBookingDate, gliLabel, mirrorReversalJournal } from '../../business/engine';
import type { Journal } from '../../types';

// Slides 42-45: GLI detail with lines, expandable formula info, difference and Add transaction line
export default function GliDetail() {
  const { gli } = useParams();
  const navigate = useNavigate();
  const { data, update } = useStore();
  const [expanded, setExpanded] = useState<number[]>([]);
  const [diffOnly, setDiffOnly] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showCredit, setShowCredit] = useState(false);

  const journal = data.journals.find(j => j.gliNumber === Number(gli));
  if (!journal) return <div className="page">Journal not found. <Link to="/journals">Back to search</Link></div>;

  const round2 = (n: number) => Math.round(n * 100) / 100;
  // Balance-check per sub-transaction: lines sharing ledger + agreement + line + period should
  // net to zero (the same agreement+line can appear for several periods on one invoice). "View
  // Differences Only" shows just the lines whose group does not balance, so a 500-line journal
  // collapses to the handful that actually cause the difference.
  const groupKey = (l: Journal['lines'][number]) => `${l.ledger}|${l.agreement}|${l.agreementLine ?? ''}|${l.period ?? ''}`;
  const groupNet = new Map<string, number>();
  for (const l of journal.lines) groupNet.set(groupKey(l), round2((groupNet.get(groupKey(l)) ?? 0) + l.debit - l.credit));
  const lineNet = (l: Journal['lines'][number]) => groupNet.get(groupKey(l)) ?? 0;
  const inDiff = (l: Journal['lines'][number]) => Math.abs(lineNet(l)) >= 0.005;
  const diffLineCount = journal.lines.filter(inDiff).length;
  const visibleLines = diffOnly ? journal.lines.filter(inDiff) : journal.lines;

  const totalDebit = visibleLines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = visibleLines.reduce((s, l) => s + l.credit, 0);
  const diff = round2(journal.lines.reduce((s, l) => s + l.debit - l.credit, 0));

  // Currency: the accounting is kept in the entity's base currency; each line's transaction
  // currency + the rate used are shown in the line detail, with the base-currency equivalent.
  const entity = data.legalEntities.find(e => e.id === journal.legalEntityId);
  // Accounting stores the real booking date; if it falls in a closed period the GL receives the
  // first day of the current (first open) period instead. The stored journal is never changed.
  const exportBd = entity ? exportBookingDate(entity, journal.bookingDate) : journal.bookingDate;
  const bdAdjusted = exportBd !== journal.bookingDate;
  const baseCur = data.currencies.find(c => c.id === entity?.baseCurrencyId);
  const rateToBase = (code: string) => {
    const from = data.currencies.find(c => c.code.toLowerCase() === code.toLowerCase())?.rate;
    return from && baseCur?.rate ? from / baseCur.rate : 1;
  };
  const lineCurrencies = [...new Set(journal.lines.map(l => l.currency.toUpperCase()))];
  const journalCurrency = lineCurrencies.length === 1 ? lineCurrencies[0] : `${lineCurrencies.length} currencies`;

  // Reversal linkage. As a reversal, this journal may reverse another journal in full or only in
  // part; as an original, it may be fully or partly reversed by one or more credit journals.
  const reversesGli = journal.reversesGli;
  const original = reversesGli != null ? data.journals.find(j => j.gliNumber === reversesGli) : undefined;
  const reversedOriginalLines = new Set(journal.lines.map(l => l.reversesLine).filter((n): n is number => n != null));
  const reversesInFull = original ? reversedOriginalLines.size >= original.lines.length : false;
  const reversedBy = data.journals.filter(j => j.reversesGli === journal.gliNumber);
  const reversedLineCount = journal.lines.filter(l => l.reversed).length;
  const fullyReversed = journal.lines.length > 0 && reversedLineCount >= journal.lines.length;

  const toggle = (line: number) =>
    setExpanded(prev => (prev.includes(line) ? prev.filter(x => x !== line) : [...prev, line]));

  return (
    <>
      <Breadcrumb />
      <div className="page">
        <div className="card">
          <div className="field-grid" style={{ gridTemplateColumns: 'repeat(7, 1fr)', alignItems: 'center' }}>
            <div className="field"><label>Journal number</label><div className="val" style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{gliLabel(journal)}</div></div>
            <div className="field"><label>Accounting Event</label><div className="val">{journal.accountingEvent}</div></div>
            <div className="field"><label>Booking Date</label><div className="val">{journal.bookingDate}</div></div>
            <div className="field">
              <label>Export Booking Date</label>
              <div className="val" title={bdAdjusted ? `Booking date ${journal.bookingDate} is in a closed period — exported as the first day of the current period (${entity?.openPeriod})` : 'Same as booking date — the period is open'}>
                {exportBd}{bdAdjusted && <span className="badge-diff" style={{ marginLeft: 6, fontSize: 11 }}>closed</span>}
              </div>
            </div>
            {journal.exportVoucher && <div className="field"><label>Export Voucher</label><div className="val">{journal.exportVoucher}</div></div>}
            <div className="field"><label>Currency</label><div className="val">{journalCurrency}{baseCur && ` · base ${baseCur.code}`}</div></div>
            <div className="field"><label>Difference</label><div className="val">{diff !== 0 ? <b className="badge-diff">Yes</b> : 'No'}</div></div>
            <label className="checkbox-inline">
              <input type="checkbox" checked={diffOnly} onChange={e => setDiffOnly(e.target.checked)} /> View Differences Only
              {diffLineCount > 0 && <span className="badge-diff" style={{ marginLeft: 6, fontSize: 11 }}>{diffLineCount}</span>}
            </label>
          </div>
        </div>

        {(reversesGli != null || reversedBy.length > 0) && (
          <div className="info-card" style={{ fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="swap" size={14} />
            <span>
              {reversesGli != null && (reversesInFull
                ? <>This journal reverses <DrillLink to={`/journals/gli/${reversesGli}`} label={`Journal ${original ? gliLabel(original) : reversesGli}`}>journal {original ? gliLabel(original) : reversesGli}</DrillLink> in full. </>
                : <>This journal reverses <b>part of</b> <DrillLink to={`/journals/gli/${reversesGli}`} label={`Journal ${original ? gliLabel(original) : reversesGli}`}>journal {original ? gliLabel(original) : reversesGli}</DrillLink> — {reversedOriginalLines.size} of {original?.lines.length} lines. </>)}
              {reversedBy.length > 0 && (
                <>{fullyReversed ? 'Fully' : 'Partly'} reversed by {reversedBy.map((rj, i) => <span key={rj.gliNumber}>{i > 0 ? ', ' : ''}<DrillLink to={`/journals/gli/${rj.gliNumber}`} label={`Journal ${gliLabel(rj)}`}>journal {gliLabel(rj)}</DrillLink></span>)}{!fullyReversed && <> — {reversedLineCount} of {journal.lines.length} lines</>}.</>
              )}
            </span>
          </div>
        )}

        <div className="toolbar">
          <button className="btn" onClick={() => setShowAdd(true)}><Icon name="plus" size={14} /> Add</button>
          {journal.accountingEvent === 'Invoicing' && !journal.reversesGli && (
            <button className="btn" onClick={() => setShowCredit(true)}><Icon name="swap" size={14} /> Credit invoice…</button>
          )}
        </div>

        <div className="grid-wrap">
          <table className="grid">
            <thead>
              <tr>
                <th style={{ width: 30 }} />
                <th>Account</th>
                <th>Description</th>
                <th>Agreement</th>
                <th className="num">Line</th>
                <th>Period</th>
                <th>Invoice</th>
                <th>Ref.No</th>
                <th>Customer</th>
                <th>Supplier</th>
                <th className="num">Debit</th>
                <th className="num">Credit</th>
                <th>Acc. Ledger</th>
                <th>Formula</th>
                <th>Account dimension</th>
                <th style={{ width: 80 }}>Reversed</th>
              </tr>
            </thead>
            <tbody>
              {visibleLines
                .map(l => {
                  const isOpen = expanded.includes(l.line);
                  return (
                    <RowGroup key={l.line}>
                      <tr style={inDiff(l) ? { background: 'rgba(220, 38, 38, 0.06)' } : undefined}>
                        <td>
                          <button className="expander" onClick={() => toggle(l.line)} title="Line details">
                            {isOpen ? '−' : '+'}
                          </button>
                        </td>
                        <td style={{ fontWeight: 600 }}>{l.pseudoAccount}</td>
                        <td style={{ color: 'var(--purple)' }}>{l.description}</td>
                        <td>{l.agreement}</td>
                        <td className="num">{l.agreementLine ?? ''}</td>
                        <td>{l.period ?? ''}</td>
                        <td>{l.invoice}</td>
                        <td>{l.refNo}</td>
                        <td>{l.customer ?? ''}</td>
                        <td>{l.supplier ?? ''}</td>
                        <td className="num">{formatAmount(l.debit)}</td>
                        <td className="num">{formatAmount(l.credit)}</td>
                        <td>{l.ledger}</td>
                        <td>{l.formula}</td>
                        <td style={{ fontFamily: 'Consolas, monospace', fontSize: 12.5, whiteSpace: 'pre' }}>
                          {l.externalAccountString || '—'}
                        </td>
                        <td>{l.reversed ? <span className="pill inactive">Reversed</span> : ''}</td>
                      </tr>
                      {isOpen && (() => {
                        const rate = l.currencyRate ?? rateToBase(l.currency);
                        const isBase = l.currency.toUpperCase() === (baseCur?.code.toUpperCase() ?? '');
                        return (
                        <tr className="detail-row">
                          <td />
                          <td colSpan={15}>
                            <div className="field-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                              <div className="field"><label>Amount type</label><div className="val">{l.amountType || '—'}{l.amountCode ? ` · code ${l.amountCode}` : ''}</div></div>
                              <div className="field"><label>Condition value</label><div className="val">{l.conditionValue || '—'}</div></div>
                              <div className="field"><label>Transaction currency</label><div className="val">{l.currency.toUpperCase()}</div></div>
                              <div className="field">
                                <label>Currency rate</label>
                                <div className="val">{isBase ? '1.000000 (base)' : `${rate.toFixed(6)}  ·  1 ${l.currency.toUpperCase()} = ${rate.toFixed(4)} ${baseCur?.code ?? ''}`}</div>
                              </div>
                              <div className="field"><label>Amount ({l.currency.toUpperCase()})</label><div className="val">{formatAmount(l.debit)} Dr / {formatAmount(l.credit)} Cr</div></div>
                              <div className="field"><label>Amount ({baseCur?.code ?? 'base'})</label><div className="val">{formatAmount(l.debit * rate)} Dr / {formatAmount(l.credit * rate)} Cr</div></div>
                              {l.reversesLine != null && reversesGli && (
                                <div className="field"><label>Reverses</label><div className="val"><DrillLink to={`/journals/gli/${reversesGli}`} label={`Journal ${original ? gliLabel(original) : reversesGli}`}>journal {original ? gliLabel(original) : reversesGli}</DrillLink> line {l.reversesLine}</div></div>
                              )}
                              <div className="field" style={{ gridColumn: l.reversesLine != null ? undefined : 'span 2' }}><label>External Account String</label><div className="val">{l.externalAccountString || '—'}</div></div>
                            </div>
                          </td>
                        </tr>
                        );
                      })()}
                    </RowGroup>
                  );
                })}
              {visibleLines.length === 0 && (
                <tr><td colSpan={16} className="empty">
                  Every sub-transaction balances — no difference lines. Uncheck “View Differences Only” to see all {journal.lines.length} lines.
                </td></tr>
              )}
              <tr className="totals-row">
                <td colSpan={10}>{diffOnly && diffLineCount > 0 && <span className="muted" style={{ fontSize: 12 }}>Showing {visibleLines.length} of {journal.lines.length} lines — the sub-transactions that don’t balance</span>}</td>
                <td className="num">{formatAmount(totalDebit)}</td>
                <td className="num">{formatAmount(totalCredit)}</td>
                <td colSpan={4}>{diff !== 0 && <span className="badge-diff">Difference {formatAmount(Math.abs(diff))}</span>}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      {showAdd && (
        <AddTransactionLineDialog journal={journal} diff={diff} onClose={() => setShowAdd(false)} onSave={line => {
          update(d => {
            const j = d.journals.find(x => x.gliNumber === journal.gliNumber);
            if (j) {
              j.lines.push(line);
              const td = j.lines.reduce((s, l) => s + l.debit, 0);
              const tc = j.lines.reduce((s, l) => s + l.credit, 0);
              j.difference = Math.round((td - tc) * 100) / 100 !== 0;
              const entity = d.legalEntities.find(e => e.id === j.legalEntityId);
              if (entity) entity.journalDifferences = d.journals.filter(x => x.legalEntityId === entity.id && x.difference).length;
            }
          });
          setShowAdd(false);
        }} />
      )}
      {showCredit && <CreditInvoiceDialog journal={journal} onClose={() => setShowCredit(false)} onCredited={gliNo => { setShowCredit(false); navigate(`/journals/gli/${gliNo}`); }} />}
    </>
  );
}

function RowGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

// Credit Invoicing: pick the units to credit (agreement + line + period + amount type + amount
// code) and generate a credit note that reverses just those, referencing the originals. The
// accounting domain only books the credit — any re-invoicing / period reset is the agreement
// domain's job (a separate message).
function CreditInvoiceDialog({ journal, onClose, onCredited }: {
  journal: Journal; onClose: () => void; onCredited: (gli: number) => void;
}) {
  const { data, update } = useStore();
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const key = (l: Journal['lines'][number]) => `${l.agreement}|${l.agreementLine ?? ''}|${l.period ?? ''}|${l.amountType}|${l.amountCode ?? ''}`;

  // Creditable units = groups not already fully reversed.
  const groups = useMemo(() => {
    const m = new Map<string, { lines: Journal['lines']; agreement: string; line: number | null; period: string; amountType: string; amountCode?: string; amount: number; alreadyCredited: boolean }>();
    for (const l of journal.lines) {
      const k = key(l);
      if (!m.has(k)) m.set(k, { lines: [], agreement: l.agreement, line: l.agreementLine, period: l.period ?? '', amountType: l.amountType, amountCode: l.amountCode, amount: 0, alreadyCredited: true });
      const g = m.get(k)!;
      g.lines.push(l);
      g.amount = round2(g.amount + l.debit); // one side of the balanced group
      if (!l.reversed) g.alreadyCredited = false;
    }
    return [...m.entries()].map(([k, g]) => ({ k, ...g }));
  }, [journal.lines]);

  const [selected, setSelected] = useState<string[]>([]);
  const nextInvoice = useMemo(() => {
    const max = Math.max(0, ...data.journals.flatMap(j => j.lines.map(l => Number(l.invoice)).filter(n => !isNaN(n))));
    return String(max + 1);
  }, [data.journals]);
  const [invoiceNo, setInvoiceNo] = useState(nextInvoice);

  const toggle = (k: string) => setSelected(s => s.includes(k) ? s.filter(x => x !== k) : [...s, k]);
  const selectedGroups = groups.filter(g => selected.includes(g.k) && !g.alreadyCredited);
  const total = round2(selectedGroups.reduce((s, g) => s + g.amount, 0));

  const credit = () => {
    if (selectedGroups.length === 0) return;
    // Line numbers the user selected to credit (skipping any already reversed).
    const lineNos = new Set(selectedGroups.flatMap(g => g.lines.filter(l => !l.reversed).map(l => l.line)));
    let gliNo = 0;
    update(d => {
      const orig = d.journals.find(j => j.gliNumber === journal.gliNumber);
      const e = d.legalEntities.find(x => x.id === journal.legalEntityId);
      if (!orig || !e) return;
      const sel = orig.lines.filter(l => lineNos.has(l.line) && !l.reversed);
      if (sel.length === 0) return;
      // Same engine mirror the message-driven path uses — flip D/C, stamp reversesGli/reversesLine.
      gliNo = mirrorReversalJournal(d, e, 'Credit Invoicing', { journal: orig, lines: sel }, { invoice: invoiceNo, createdBy: 'Credit invoice' });
    });
    if (gliNo) onCredited(gliNo);
  };

  return (
    <Dialog title={`Credit invoice — journal ${gliLabel(journal)}`} wide onClose={onClose} footer={
      <>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={selectedGroups.length === 0} onClick={credit}>
          Create credit note {selectedGroups.length > 0 && `(${formatAmount(total)})`}
        </button>
      </>
    }>
      <p className="muted" style={{ marginTop: 0, fontSize: 12.5 }}>
        Select what to credit at the lowest level — agreement + line + period + amount type (+ amount code).
        A new credit note is created with its own number, reversing just those lines. Any re-invoicing or
        period reset is the agreement domain’s responsibility (a separate message).
      </p>
      <div className="f" style={{ maxWidth: 220, marginBottom: 12 }}>
        <label>Credit note number</label>
        <input value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} />
      </div>
      <div className="grid-wrap" style={{ maxHeight: 320, boxShadow: 'none' }}>
        <table className="grid">
          <thead>
            <tr><th style={{ width: 30 }} /><th>Agreement</th><th className="num">Line</th><th>Period</th><th>Amount type</th><th>Code</th><th className="num">Amount</th><th /></tr>
          </thead>
          <tbody>
            {groups.map(g => (
              <tr key={g.k} className={g.alreadyCredited ? undefined : 'clickable'} onClick={() => !g.alreadyCredited && toggle(g.k)} style={g.alreadyCredited ? { opacity: 0.5 } : undefined}>
                <td>{!g.alreadyCredited && <input type="checkbox" checked={selected.includes(g.k)} readOnly />}</td>
                <td>{g.agreement}</td>
                <td className="num">{g.line ?? ''}</td>
                <td>{g.period}</td>
                <td>{g.amountType}</td>
                <td>{g.amountCode ?? ''}</td>
                <td className="num">{formatAmount(g.amount)}</td>
                <td>{g.alreadyCredited && <span className="pill inactive">Credited</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Dialog>
  );
}

// Slides 44-45: Add transaction line (to correct a difference)
function AddTransactionLineDialog({ journal, diff, onClose, onSave }: {
  journal: Journal; diff: number; onClose: () => void;
  onSave: (line: Journal['lines'][number]) => void;
}) {
  const { data } = useStore();
  const entity = data.legalEntities.find(e => e.id === journal.legalEntityId);
  const pseudo = data.pseudoAccounts.filter(p => p.entityCode === entity?.ownerCode);
  const baseCur = data.currencies.find(c => c.id === entity?.baseCurrencyId);
  const ledgerValues = [...new Set([...data.ledgers.map(l => l.description || l.name), ...journal.lines.map(l => l.ledger)])].filter(Boolean);
  const num = (s: string) => Number(s.replace(/\s/g, '').replace(',', '.')) || 0;

  const [ledger, setLedger] = useState(journal.lines[0]?.ledger ?? ledgerValues[0] ?? 'Local Legal');
  const [account, setAccount] = useState(pseudo[0]?.pseudo ?? '');
  const [agreement, setAgreement] = useState('');
  const [agreementLine, setAgreementLine] = useState('');
  const [period, setPeriod] = useState(journal.lines[0]?.period ?? journal.bookingDate.slice(0, 7).replace('-', ''));
  const [invoice, setInvoice] = useState('');
  const [refNo, setRefNo] = useState('');
  const [customer, setCustomer] = useState('');
  const [supplier, setSupplier] = useState('');
  const [currencyCode, setCurrencyCode] = useState(journal.lines[0]?.currency ?? baseCur?.code ?? 'EUR');
  const [externalAccount, setExternalAccount] = useState('');
  const [amountType, setAmountType] = useState('Manual');
  const [amountCode, setAmountCode] = useState('');
  const [debit, setDebit] = useState('');
  const [credit, setCredit] = useState(diff > 0 ? String(diff) : '');

  const save = () => {
    const p = pseudo.find(x => x.pseudo === account);
    const cur = data.currencies.find(c => c.code === currencyCode);
    const rate = cur?.rate && baseCur?.rate ? cur.rate / baseCur.rate : 1;
    onSave({
      line: Math.max(0, ...journal.lines.map(l => l.line)) + 1,
      pseudoAccount: account, description: p?.description ?? 'Manual line',
      agreement, agreementLine: Number(agreementLine) || null, period: period || undefined,
      customer: customer || undefined, supplier: supplier || undefined,
      invoice, refNo,
      debit: num(debit), credit: num(credit),
      ledger, currency: currencyCode, currencyRate: rate, formula: 'MAN',
      externalAccountString: externalAccount, amountType, amountCode: amountCode || undefined, conditionValue: '',
    });
  };

  return (
    <Dialog title="Add transaction line" wide onClose={onClose} footer={
      <>
        <button className="btn ghost" onClick={onClose}>Close</button>
        <button className="btn primary" onClick={save}>Save</button>
      </>
    }>
      <div className="field-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 14 }}>
        <div className="field"><label>Journal number</label><div className="val">{gliLabel(journal)}</div></div>
        <div className="field"><label>Accounting Event</label><div className="val">{journal.accountingEvent}</div></div>
        <div className="field"><label>Booking Date</label><div className="val">{journal.bookingDate}</div></div>
        <div className="field"><label>Difference</label><div className="val badge-diff">{diff === 0 ? '—' : (diff < 0 ? `Credit: ${formatAmount(Math.abs(diff))}` : `Debit: ${formatAmount(diff)}`)}</div></div>
      </div>
      <div className="form-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="f">
          <label>Ledger</label>
          <select value={ledger} onChange={e => setLedger(e.target.value)}>
            {ledgerValues.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div className="f"><label>Agreement</label><input value={agreement} onChange={e => setAgreement(e.target.value)} /></div>
        <div className="f"><label>Agreement line</label><input value={agreementLine} onChange={e => setAgreementLine(e.target.value)} placeholder="—" /></div>
        <div className="f"><label>Period</label><input value={period} onChange={e => setPeriod(e.target.value)} placeholder="YYYYMM" /></div>
        <div className="f"><label>Invoice number</label><input value={invoice} onChange={e => setInvoice(e.target.value)} /></div>
        <div className="f"><label>Reference number</label><input value={refNo} onChange={e => setRefNo(e.target.value)} placeholder="—" /></div>
        <div className="f"><label>Customer</label><input value={customer} onChange={e => setCustomer(e.target.value)} placeholder="—" /></div>
        <div className="f"><label>Supplier</label><input value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="—" /></div>
        <div className="f">
          <label>Currency</label>
          <select value={currencyCode} onChange={e => setCurrencyCode(e.target.value)}>
            {data.currencies.map(c => <option key={c.id} value={c.code}>{c.code}{c.id === baseCur?.id ? ' (base)' : ''}</option>)}
          </select>
        </div>
        <div className="f"><label>Amount type</label>
          <select value={amountType} onChange={e => setAmountType(e.target.value)}>
            <option value="Manual">Manual</option>
            {data.amountTypes.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
          </select>
        </div>
        <div className="f"><label>Amount code</label><input value={amountCode} onChange={e => setAmountCode(e.target.value)} placeholder="—" /></div>
        <div className="f"><label>External account</label><input value={externalAccount} onChange={e => setExternalAccount(e.target.value)} placeholder="—" style={{ fontFamily: 'Consolas, monospace', fontSize: 12.5 }} /></div>
        <div className="f full">
          <label>Pseudo account</label>
          <select value={account} onChange={e => setAccount(e.target.value)}>
            {pseudo.map(p => <option key={p.id} value={p.pseudo}>{p.pseudo} – {p.description}</option>)}
          </select>
        </div>
        <div className="f"><label>Debit</label><input value={debit} onChange={e => setDebit(e.target.value)} style={{ textAlign: 'right' }} /></div>
        <div className="f"><label>Credit</label><input value={credit} onChange={e => setCredit(e.target.value)} style={{ textAlign: 'right' }} /></div>
      </div>
    </Dialog>
  );
}
