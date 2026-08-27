import { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useStore, formatAmount } from '../../store';
import { gliLabel } from '../../engine';
import { DrillLink } from '../../components/trail';
import { Dialog } from '../../components/Chrome';
import { planRecognition, resolveRecognitionLeg, undoMonthlyBooking, importedPositions, goingForwardImportedPositions, parseMonthlyRecImport } from '../../recognition';
import type { RecognitionPosition, ImportedLinePosition } from '../../recognition';
import type { AppData, LegalEntity, RecognitionPlan, RecognitionCategory } from '../../types';

const PAGE_SIZE = 20; // agreements per page in the search list

// The Accounting Recognition Plan page, shaped for volume: a per-entity position summary
// (aggregated by category, not per agreement), an agreement search with pagination, and the full
// plan / schedule / positions only when you drill into a single agreement. At 100k+ agreements the
// summary is a server-side aggregate and the search is a paged query — this page shows that shape
// on the demo data rather than rendering every plan.
export default function Recognition() {
  const entity = useOutletContext<LegalEntity>();
  const { data, update } = useStore();

  const plans = useMemo(() => data.recognitionPlans.filter(p => p.legalEntityId === entity.id), [data.recognitionPlans, entity.id]);
  const categories = data.recognitionCategories.filter(c => c.entityCode === entity.ownerCode);
  const cutoffCategories = categories.filter(c => c.kind === 'Cutoff');

  // Landing here from the dashboard's Accrued/Deferred tile carries ?period= (the open period) so the
  // position matches what the tile showed.
  const [sp] = useSearchParams();
  const periodParam = sp.get('period');
  const paramValid = !!periodParam && /^\d{6}$/.test(periodParam);

  const schedulePeriods = useMemo(
    () => [...new Set([
      ...plans.flatMap(p => p.lines.flatMap(l => [...l.schedule.map(s => s.period), ...(l.imported?.rows.map(r => r.period) ?? [])])),
      entity.openPeriod,
      ...(paramValid ? [periodParam!] : []),
    ])].sort(),
    [plans, entity.openPeriod, periodParam, paramValid],
  );
  const defaultPeriod = schedulePeriods.filter(p => p <= (entity.endOfMonth || entity.openPeriod)).pop()
    ?? schedulePeriods[0] ?? (entity.endOfMonth || entity.openPeriod);

  const [period, setPeriod] = useState(paramValid ? periodParam! : defaultPeriod);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  // The drilled-into agreement lives in the URL (/legal-entity/:id/recognition/:agreement) so it is a
  // real breadcrumb step and survives Back / deep links.
  const { agreement: agreementParam } = useParams();
  const selected = agreementParam ?? null;
  const navigate = useNavigate();
  const goto = (agr: string | null) =>
    navigate(agr ? `/legal-entity/${entity.id}/recognition/${encodeURIComponent(agr)}` : `/legal-entity/${entity.id}/recognition`);
  const [showImport, setShowImport] = useState(false);
  const [editorPlan, setEditorPlan] = useState<RecognitionPlan | 'new' | null>(null);

  // Positions as of the period. In production this is a stored/aggregated read; here it is computed
  // once and memoised, and both the summary and the agreement list are derived from it. Live plans
  // are journal-based (`positions`); imported old-system plans are watermark-based (`imported`).
  const positions = useMemo(
    () => planRecognition(data, entity.id, entity.ownerCode, period),
    [data, entity.id, entity.ownerCode, period],
  );
  // Historical imports read their frozen watermarks; activated (going-forward) plans recognise up to
  // the viewed period and net against real invoicing — both feed the same summary and drill-down.
  const imported = useMemo(
    () => [...importedPositions(data, entity.id), ...goingForwardImportedPositions(data, entity.id, period)],
    [data, entity.id, period],
  );

  // Aggregate summary by component name — merges live category positions and imported
  // amortization/interest positions (the month-end view: a handful of rows, not 100k).
  const summaryMap = new Map<string, { accrued: number; deferred: number; agreements: Set<string> }>();
  const bump = (name: string, pos: number, agreement: string) => {
    const e = summaryMap.get(name) ?? { accrued: 0, deferred: 0, agreements: new Set<string>() };
    if (pos > 0) e.accrued += pos; else if (pos < 0) e.deferred += -pos;
    if (pos !== 0) e.agreements.add(agreement);
    summaryMap.set(name, e);
  };
  cutoffCategories.forEach(c => summaryMap.set(c.name, { accrued: 0, deferred: 0, agreements: new Set() }));
  positions.forEach(p => bump(p.category.name, p.position, p.plan.agreement));
  imported.forEach(ip => { bump('Amortization', ip.amortPosition, ip.plan.agreement); bump('Interest', ip.interestPosition, ip.plan.agreement); });
  const summary = [...summaryMap.entries()].map(([name, e]) => ({ name, accrued: e.accrued, deferred: e.deferred, agreements: e.agreements.size }));
  const accruedTotal = summary.reduce((s, r) => s + r.accrued, 0);
  const deferredTotal = summary.reduce((s, r) => s + r.deferred, 0);

  // Per-agreement rows for the search list (position totals attached; imported plans use their
  // watermark rent position, live plans use the journal-based position).
  const agreementRows = plans.map(plan => {
    let accrued = 0, deferred = 0;
    if (plan.imported) {
      const rent = imported.filter(x => x.plan.agreement === plan.agreement).reduce((s, x) => s + x.rentPosition, 0);
      if (rent > 0) accrued = rent; else deferred = -rent;
    } else {
      const pos = positions.filter(x => x.plan.agreement === plan.agreement);
      accrued = pos.filter(x => x.position > 0).reduce((s, x) => s + x.position, 0);
      deferred = pos.filter(x => x.position < 0).reduce((s, x) => s - x.position, 0);
    }
    return { agreement: plan.agreement, description: plan.agreementDescription, customer: plan.customer, lineCount: plan.lines.length, accrued, deferred, imported: !!plan.imported, status: plan.status };
  });
  const q = search.trim().toLowerCase();
  const filtered = q
    ? agreementRows.filter(r => r.agreement.toLowerCase().includes(q) || r.customer.toLowerCase().includes(q) || r.description.toLowerCase().includes(q))
    : agreementRows;
  const pageStart = page * PAGE_SIZE;
  const pageRows = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  const selectedPlan = selected ? plans.find(p => p.agreement === selected) : undefined;
  const selectedPositions = selectedPlan ? positions.filter(x => x.plan.agreement === selectedPlan.agreement) : [];

  return (
    <div>
      <div className="pagelike-title">Accounting recognition</div>
      <p className="muted" style={{ maxWidth: 780, marginTop: -6 }}>
        Monthly Booking reconciles <b>earned</b> (the recognition plan) vs <b>billed</b> and books the timing
        difference accrue-and-reverse into the cutoff buckets. This page reads the resulting <b>position</b>:
        an aggregate summary by category, then search an agreement to drill into its plan and cutoff.
      </p>

      {/* ---- Aggregate position summary (the month-end view) ---- */}
      <div className="toolbar">
        <div className="f" style={{ minWidth: 180 }}>
          <label>Position as of period</label>
          <select value={period} onChange={e => setPeriod(e.target.value)}>
            {schedulePeriods.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="spacer" style={{ flex: 1 }} />
        <span className="pill">Accrued (asset) {formatAmount(accruedTotal)}</span>
        <span className="pill inactive">Deferred (liability) {formatAmount(deferredTotal)}</span>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ fontWeight: 700, padding: '2px 2px 8px' }}>Position summary as of {period}</div>
        <div className="grid-wrap">
          <table className="grid">
            <thead>
              <tr><th>Category</th><th className="num">Accrued (asset)</th><th className="num">Deferred (liability)</th><th className="num">Net</th><th className="num">Agreements</th></tr>
            </thead>
            <tbody>
              {summary.map(r => (
                <tr key={r.name}>
                  <td>{r.name}</td>
                  <td className="num" style={{ color: r.accrued ? '#1a7f37' : 'inherit' }}>{formatAmount(r.accrued)}</td>
                  <td className="num" style={{ color: r.deferred ? '#b3541e' : 'inherit' }}>{formatAmount(r.deferred)}</td>
                  <td className="num">{formatAmount(r.accrued - r.deferred)}</td>
                  <td className="num">{r.agreements}</td>
                </tr>
              ))}
              {summary.length === 0 && <tr><td colSpan={5} className="empty">No recognition categories configured.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          At scale this is a server-side aggregate over the stored positions — a few rows regardless of agreement volume.
        </p>
      </div>

      {/* ---- Drill-down for one agreement, or the search list ---- */}
      {selectedPlan && selectedPlan.imported ? (
        <ImportedAgreementDetail
          key={selectedPlan.agreement}
          plan={selectedPlan}
          positions={imported.filter(x => x.plan.agreement === selectedPlan.agreement)}
          onBack={() => goto(null)}
          onEdit={() => setEditorPlan(selectedPlan)}
        />
      ) : selectedPlan ? (
        <AgreementDetail
          plan={selectedPlan}
          positions={selectedPositions}
          categories={categories}
          period={period}
          entity={entity}
          schedulePeriods={schedulePeriods}
          onBack={() => goto(null)}
          update={update}
        />
      ) : (
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="toolbar" style={{ marginTop: 0, marginBottom: 8 }}>
            <div style={{ fontWeight: 700 }}>Agreements</div>
            <div className="spacer" style={{ flex: 1 }} />
            <button className="btn" onClick={() => setEditorPlan('new')}>New plan</button>
            <button className="btn" onClick={() => setShowImport(true)}>Import from old system</button>
          </div>
          <div className="toolbar" style={{ marginTop: 0 }}>
            <div className="f" style={{ flex: 1, minWidth: 220 }}>
              <label>Search agreement / customer</label>
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder="Agreement number, customer or description…" />
            </div>
            <div className="spacer" style={{ flex: 1 }} />
            <span className="muted" style={{ fontSize: 12, alignSelf: 'flex-end', paddingBottom: 8 }}>
              {filtered.length} agreement{filtered.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="grid-wrap">
            <table className="grid">
              <thead>
                <tr><th>Agreement</th><th>Customer</th><th className="num">Lines</th><th className="num">Accrued</th><th className="num">Deferred</th><th style={{ width: 40 }} /></tr>
              </thead>
              <tbody>
                {pageRows.map(r => (
                  <tr key={r.agreement} className="clickable" onClick={() => goto(r.agreement)}>
                    <td>{r.agreement} <span className="muted" style={{ fontSize: 11 }}>· {r.description}</span>{r.imported && <span className="pill inactive" style={{ marginLeft: 6, fontSize: 10 }}>imported</span>}{r.status === 'Proposed' && <span className="pill" style={{ marginLeft: 6, fontSize: 10, background: '#b3541e' }}>proposed</span>}</td>
                    <td>{r.customer}</td>
                    <td className="num">{r.lineCount}</td>
                    <td className="num" style={{ color: r.accrued ? '#1a7f37' : 'inherit' }}>{formatAmount(r.accrued)}</td>
                    <td className="num" style={{ color: r.deferred ? '#b3541e' : 'inherit' }}>{formatAmount(r.deferred)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--purple)' }}>›</td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={6} className="empty">No agreements match “{search}”.</td></tr>}
              </tbody>
            </table>
          </div>
          {filtered.length > PAGE_SIZE && (
            <div className="toolbar" style={{ marginTop: 8, justifyContent: 'flex-end' }}>
              <button className="btn ghost small" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Prev</button>
              <span className="muted" style={{ fontSize: 12, alignSelf: 'center' }}>
                {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <button className="btn ghost small" disabled={pageStart + PAGE_SIZE >= filtered.length} onClick={() => setPage(p => p + 1)}>Next</button>
            </div>
          )}
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            The list never renders every agreement — it's a paged, searchable query. Only the one you open loads its plan and schedule.
          </p>
        </div>
      )}

      {/* ---- Configuration (per-entity, not per-agreement) ---- */}
      <div className="card">
        <div style={{ fontWeight: 700, padding: '2px 2px 8px' }}>Recognition categories</div>
        <p className="muted" style={{ fontSize: 12, marginTop: -2, marginBottom: 8 }}>
          The <b>accounts</b> come from the <b>Monthly Booking accounting rules</b> whose formulas reference the
          system amount types — edit them under Accounting rules, not here. A <b>Cutoff</b> category reverses
          (accrue-and-reverse); a <b>Straight</b> category (depreciation) is permanent and never reversed.
        </p>
        <div className="grid-wrap">
          <table className="grid">
            <thead>
              <tr><th>Category</th><th>Kind</th><th>Reverses?</th><th>Legs (account · system amount type)</th></tr>
            </thead>
            <tbody>
              {categories.map(c => {
                const legNames = c.kind === 'Cutoff'
                  ? [c.accruedAmountType, c.deferredAmountType, c.incomeAmountType]
                  : [c.debitAmountType, c.creditAmountType];
                return (
                  <tr key={c.id}>
                    <td>{c.name}{c.invoicedAmountType ? <span className="muted" style={{ fontSize: 11 }}> · vs invoiced {c.invoicedAmountType}</span> : ''}</td>
                    <td>{c.kind}</td>
                    <td>{c.kind === 'Cutoff'
                      ? <span className="pill">yes · accrue &amp; reverse</span>
                      : <span className="pill inactive">no · permanent</span>}</td>
                    <td>
                      {legNames.filter(Boolean).map(n => {
                        const r = resolveRecognitionLeg(data, entity.ownerCode, n);
                        return <div key={n}>{r ? r.account : '(no rule)'} <span className="muted" style={{ fontSize: 11 }}>· {n}</span></div>;
                      })}
                    </td>
                  </tr>
                );
              })}
              {categories.length === 0 && <tr><td colSpan={4} className="empty">No recognition categories configured.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showImport && <ImportDialog entity={entity} onClose={() => setShowImport(false)} />}
      {editorPlan && <PlanEditor entity={entity} existing={editorPlan === 'new' ? undefined : editorPlan} onClose={() => setEditorPlan(null)} />}
    </div>
  );
}

// ---- Paste importer for the old-system monthly-recognition export ----
function ImportDialog({ entity, onClose }: { entity: LegalEntity; onClose: () => void }) {
  const { data, update } = useStore();
  const [text, setText] = useState('');
  const [result, setResult] = useState<string | null>(null);

  const doImport = () => {
    const startId = Math.max(0, ...data.recognitionPlans.map(p => p.id)) + 1;
    const res = parseMonthlyRecImport(text, entity.id, entity.ownerCode, startId);
    if (res.plans.length === 0) { setResult(res.errors[0] ?? 'Nothing recognised — check the columns.'); return; }
    update(d => {
      let nextId = Math.max(0, ...d.recognitionPlans.map(p => p.id)) + 1;
      for (const p of res.plans) {
        const at = d.recognitionPlans.findIndex(x => x.legalEntityId === entity.id && x.agreement === p.agreement);
        const plan = { ...p, id: at >= 0 ? d.recognitionPlans[at].id : nextId++ };
        if (at >= 0) d.recognitionPlans[at] = plan; else d.recognitionPlans.push(plan);
      }
    });
    setResult(`Imported ${res.agreements} agreement${res.agreements === 1 ? '' : 's'} · ${res.lines} line${res.lines === 1 ? '' : 's'} · ${res.rows} month rows${res.errors.length ? ` (${res.errors.length} rows skipped)` : ''}.`);
    setText('');
  };

  return (
    <Dialog title="Import agreements from the old system" onClose={onClose} footer={
      <>
        <button className="btn ghost" onClick={onClose}>Close</button>
        <button className="btn primary" disabled={!text.trim()} onClick={doImport}>Import</button>
      </>
    }>
      <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
        Paste the monthly-recognition export straight from Excel (tab-separated). A header row is detected
        automatically; otherwise the columns are read in the PF_MonthlyRec order. Depreciation is kept only
        when the depreciation type is <b>Annuity</b>. Imports onto <b>{entity.ownerCode}</b>; an existing
        agreement number is replaced.
      </p>
      <div className="muted" style={{ fontSize: 11, marginBottom: 6 }}>
        Columns: Agreement · Agreement Description · Customer name · Currency · Agreement line · Asset description ·
        Booked To Month · Invoiced To Period · Invoicing Period · Year Month · Amortization · Interest · Depreciation · Depreciation Type
      </div>
      <textarea
        rows={10}
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Paste rows here…"
        style={{ width: '100%', fontFamily: 'monospace', fontSize: 12 }}
      />
      {result && <div className="banner" style={{ marginTop: 10 }}>{result}</div>}
    </Dialog>
  );
}

// ---- One agreement's plan + cutoff position + the plan-change (Undo) trigger ----
function AgreementDetail({ plan, positions, categories, period, entity, schedulePeriods, onBack, update }: {
  plan: RecognitionPlan;
  positions: RecognitionPosition[];
  categories: RecognitionCategory[];
  period: string;
  entity: LegalEntity;
  schedulePeriods: string[];
  onBack: () => void;
  update: (mutate: (d: AppData) => void) => void;
}) {
  const { data } = useStore();
  const rentCategory = categories.find(c => c.kind === 'Cutoff' && c.name === 'Rent');
  const [chgFrom, setChgFrom] = useState(schedulePeriods[1] ?? schedulePeriods[0] ?? '');
  const [chgRent, setChgRent] = useState('150');
  const [notice, setNotice] = useState<string | null>(null);

  const applyPlanChange = () => {
    if (!rentCategory) return;
    const newRent = Number(chgRent);
    if (!Number.isFinite(newRent) || !chgFrom) return;
    const bookedPeriod = entity.endOfMonth || period;
    let res = { count: 0 };
    update(d => {
      const p = d.recognitionPlans.find(x => x.id === plan.id);
      if (!p) return;
      for (const l of p.lines) for (const row of l.schedule) {
        if (row.categoryId === rentCategory.id && row.period >= chgFrom) row.amount = newRent;
      }
      res = undoMonthlyBooking(d, entity.id, entity.ownerCode, p.agreement, null, bookedPeriod, 'Undo Monthly Booking (plan change)');
    });
    setNotice(`Plan change applied — Rent ${formatAmount(newRent)}/mo from ${chgFrom}. Undo Monthly Booking reversed the live cutoff for ${plan.agreement} and re-derived ${bookedPeriod} (${res.count} line/category re-booked).`);
  };

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="toolbar" style={{ marginTop: 0, marginBottom: 8 }}>
          <button className="btn ghost small" onClick={onBack}>← All agreements</button>
          <div className="spacer" style={{ flex: 1 }} />
        </div>
        <div className="field-grid" style={{ marginBottom: 10 }}>
          <div className="field"><label>Agreement</label><div className="val">{plan.agreement}</div></div>
          <div className="field"><label>Description</label><div className="val">{plan.agreementDescription}</div></div>
          <div className="field"><label>Customer</label><div className="val">{plan.customer}</div></div>
          <div className="field"><label>Currency</label><div className="val">{plan.currency}</div></div>
          <div className="field"><label>Classification</label><div className="val">{plan.classification} lease</div></div>
          <div className="field"><label>Received</label><div className="val">{plan.receivedDate} · {plan.source}</div></div>
        </div>

        <div style={{ fontWeight: 700, margin: '6px 2px 6px' }}>Cutoff position as of {period}</div>
        <div className="grid-wrap">
          <table className="grid">
            <thead>
              <tr><th>Line</th><th>Category</th><th className="num">Recognised</th><th className="num">Invoiced</th><th className="num">Position</th><th>Bucket</th></tr>
            </thead>
            <tbody>
              {positions.map((p, i) => {
                const accrued = p.position > 0;
                const bucket = p.position === 0 ? '—' : accrued ? p.category.accruedAmountType : p.category.deferredAmountType;
                const account = p.position === 0 ? '' : resolveRecognitionLeg(data, entity.ownerCode, bucket)?.account ?? '(no rule)';
                return (
                  <tr key={i}>
                    <td>{p.agreementLine}</td>
                    <td>{p.category.name}</td>
                    <td className="num">{formatAmount(p.recognized)}</td>
                    <td className="num">{formatAmount(p.invoiced)}</td>
                    <td className="num" style={{ fontWeight: 600, color: p.position === 0 ? 'inherit' : accrued ? '#1a7f37' : '#b3541e' }}>{formatAmount(p.position)}</td>
                    <td>{bucket === '—' ? <span className="muted">cleared</span> : <>{bucket} <span className="muted" style={{ fontSize: 11 }}>· {account}</span></>}</td>
                  </tr>
                );
              })}
              {positions.length === 0 && <tr><td colSpan={6} className="empty">Nothing earned or invoiced yet as of {period}.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {plan.lines.map(line => (
        <div key={line.agreementLine} className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            Line {line.agreementLine} <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>· {line.assetDescription}</span>
          </div>
          <div className="grid-wrap">
            <table className="grid">
              <thead>
                <tr>
                  <th>Period</th>
                  {categories.map(c => <th key={c.id} className="num">{c.name}{c.kind === 'Straight' ? '' : ' earned'}</th>)}
                </tr>
              </thead>
              <tbody>
                {[...new Set(line.schedule.map(s => s.period))].sort().map(per => (
                  <tr key={per}>
                    <td>{per}</td>
                    {categories.map(c => {
                      const row = line.schedule.find(s => s.period === per && s.categoryId === c.id);
                      return <td key={c.id} className="num">{row ? formatAmount(row.amount) : '—'}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {rentCategory && (
        <div className="card">
          <div style={{ fontWeight: 700, padding: '2px 2px 8px' }}>Simulate a recognition-plan change</div>
          <p className="muted" style={{ fontSize: 12, marginTop: -2, marginBottom: 10 }}>
            The agreement domain re-sends the plan for <b>{plan.agreement}</b> with a new monthly Rent from a period
            onward. Accounting triggers <b>Undo Monthly Booking</b> (mirrors this agreement's live cutoff only —
            depreciation is left alone) and re-derives it immediately. Run an End of Month first so there is a booked cutoff to undo.
          </p>
          <div className="toolbar" style={{ alignItems: 'flex-end' }}>
            <div className="f" style={{ minWidth: 150 }}>
              <label>New monthly Rent</label>
              <input value={chgRent} onChange={e => setChgRent(e.target.value)} />
            </div>
            <div className="f" style={{ minWidth: 150 }}>
              <label>Effective from</label>
              <select value={chgFrom} onChange={e => setChgFrom(e.target.value)}>
                {schedulePeriods.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <button className="btn" onClick={applyPlanChange}>Apply change &amp; undo</button>
          </div>
          {notice && (
            <div className="banner" style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ flex: 1 }}>{notice}</span>
              <button className="btn ghost small" onClick={() => setNotice(null)}>Dismiss</button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ---- One imported (old-system) agreement: watermark-based, read-only ----
function ImportedAgreementDetail({ plan, positions, onBack, onEdit }: {
  plan: RecognitionPlan;
  positions: ImportedLinePosition[];
  onBack: () => void;
  onEdit: () => void;
}) {
  const { data } = useStore();
  const importedLines = plan.lines.filter(l => l.imported);
  const [selLine, setSelLine] = useState<number>(importedLines[0]?.agreementLine ?? 1);
  const line = importedLines.find(l => l.agreementLine === selLine) ?? importedLines[0];

  // Last month Monthly Booking actually ran for this line: the recognition state's last period for a
  // going-forward plan (booked forward at End of Month), or the frozen watermark for a historical import.
  const lastBooked = useMemo(() => {
    if (!line) return null;
    if (plan.goingForward) {
      const periods = data.recognitionStates
        .filter(s => s.entityCode === plan.entityCode && s.agreement === plan.agreement && s.agreementLine === line.agreementLine && s.lastPeriod)
        .map(s => s.lastPeriod);
      return periods.length ? periods.sort().slice(-1)[0] : null;
    }
    return line.imported?.bookedToPeriod || null;
  }, [data.recognitionStates, plan, line]);

  const sortedRows = useMemo(
    () => (line?.imported ? [...line.imported.rows].sort((a, b) => a.period.localeCompare(b.period) || a.invoicingPeriod - b.invoicingPeriod) : []),
    [line],
  );

  // The Monthly Booking journal this line's last-booked month was booked in — matched on the journal
  // line's agreement + line + period. A historical import has no journal here (booked in the old system).
  const bookedJournal = useMemo(() => {
    if (!line || !lastBooked || !plan.goingForward) return null;
    return data.journals.find(j =>
      j.accountingEvent === 'Monthly Booking'
      && j.lines.some(l => l.agreement === plan.agreement && (l.agreementLine ?? null) === line.agreementLine && l.period === lastBooked),
    ) ?? null;
  }, [data.journals, plan, line, lastBooked]);

  // Open the schedule scrolled so the last-booked month sits at the top (just under the sticky header),
  // so a part-way-through agreement shows "now and what's next" instead of starting at month 1.
  const gridRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const wrap = gridRef.current;
    if (!wrap || !lastBooked) return;
    const row = wrap.querySelector('tr[data-lastbooked="1"]') as HTMLElement | null;
    if (!row) return;
    const headH = wrap.querySelector('thead')?.getBoundingClientRect().height ?? 0;
    wrap.scrollTop = wrap.scrollTop + (row.getBoundingClientRect().top - wrap.getBoundingClientRect().top) - headH;
  }, [lastBooked, selLine]);

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="toolbar" style={{ marginTop: 0, marginBottom: 8 }}>
          <button className="btn ghost small" onClick={onBack}>← All agreements</button>
          <div className="spacer" style={{ flex: 1 }} />
          <button className="btn small" onClick={onEdit}>Edit plan</button>
        </div>
        <div className="field-grid" style={{ marginBottom: 10 }}>
          <div className="field"><label>Agreement</label><div className="val">{plan.agreement}</div></div>
          <div className="field"><label>Description</label><div className="val">{plan.agreementDescription}</div></div>
          <div className="field"><label>Customer</label><div className="val">{plan.customer}</div></div>
          <div className="field"><label>Currency</label><div className="val">{plan.currency}</div></div>
          <div className="field"><label>Classification</label><div className="val">{plan.classification} lease</div></div>
          <div className="field"><label>Source</label><div className="val">{plan.source}</div></div>
          <div className="field"><label>Status</label><div className="val">{plan.status === 'Proposed'
            ? <span className="pill" style={{ background: '#b3541e' }}>Proposed</span>
            : <span className={plan.status === 'Active' ? 'pill' : 'pill inactive'}>{plan.status}</span>}</div></div>
        </div>

        {plan.status === 'Proposed' && (
          <p className="muted" style={{ fontSize: 12, margin: '0 2px 10px', color: '#b3541e' }}>
            This plan is <b>Proposed</b> — entered by hand, standing in for the agreement domain. It does not
            recognise yet. Run the agreement’s <b>Activation</b> event (Message simulator) with the recognition-plan
            checkbox on to adopt it; it then flips to <b>Active</b> and starts booking at End of Month.
          </p>
        )}

        <div style={{ fontWeight: 700, margin: '6px 2px 6px' }}>Booked vs invoiced (watermarks)</div>
        <div className="grid-wrap">
          <table className="grid">
            <thead>
              <tr>
                <th>Line</th><th>Booked to <span className="muted" style={{ fontWeight: 400 }}>(month)</span></th><th>Invoiced to <span className="muted" style={{ fontWeight: 400 }}>(period)</span></th>
                <th className="num">Recognised rent</th><th className="num">Invoiced rent</th>
                <th className="num">Position (amort)</th><th className="num">Position (interest)</th><th>Bucket</th>
              </tr>
            </thead>
            <tbody>
              {positions.length === 0 && <tr><td colSpan={8} className="empty">No position yet — the plan is not Active.</td></tr>}
              {positions.map((p, i) => {
                const accrued = p.rentPosition > 0;
                const bucket = p.rentPosition === 0 ? 'cleared' : accrued ? 'Accrued rent (asset)' : 'Deferred rent (liability)';
                return (
                  <tr key={i}>
                    <td>{p.agreementLine} <span className="muted" style={{ fontSize: 11 }}>· {p.assetDescription}</span></td>
                    <td>{p.bookedToPeriod}</td>
                    <td>period {p.invoicedToPeriod}{p.invoicedToMonth && <span className="muted" style={{ fontSize: 11 }}> · in {p.invoicedToMonth}</span>}</td>
                    <td className="num">{formatAmount(p.recognizedRent)}</td>
                    <td className="num">{formatAmount(p.invoicedRent)}</td>
                    <td className="num" style={{ color: p.amortPosition === 0 ? 'inherit' : p.amortPosition > 0 ? '#1a7f37' : '#b3541e' }}>{formatAmount(p.amortPosition)}</td>
                    <td className="num" style={{ color: p.interestPosition === 0 ? 'inherit' : p.interestPosition > 0 ? '#1a7f37' : '#b3541e' }}>{formatAmount(p.interestPosition)}</td>
                    <td>{p.rentPosition === 0 ? <span className="muted">cleared</span> : <span style={{ color: accrued ? '#1a7f37' : '#b3541e' }}>{bucket}</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          {plan.goingForward
            ? 'Recognised up to the viewed period (change “Position as of period” above) and netted against real invoicing — the position moves month by month.'
            : 'Position is read from the gap between the two watermarks — no journals needed for historical data.'}
          {' '}Depreciation type <b>{positions[0]?.depreciationType ?? plan.lines[0]?.imported?.depreciationType}</b>
          {(positions[0]?.depreciationType ?? plan.lines[0]?.imported?.depreciationType)?.toLowerCase() === 'annuity'
            ? ' — depreciation is taken from this plan.'
            : ' — depreciation comes from the asset domain, so it is not in this plan.'}
        </p>
      </div>

      {line?.imported && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="toolbar" style={{ marginTop: 0, marginBottom: 8, alignItems: 'flex-end' }}>
            {importedLines.length > 1 ? (
              <div className="f" style={{ minWidth: 300 }}>
                <label>Line / asset <span className="muted" style={{ fontWeight: 400, fontSize: 11 }}>· {importedLines.length} on this agreement</span></label>
                <select value={selLine} onChange={e => setSelLine(Number(e.target.value))}>
                  {importedLines.map(l => (
                    <option key={l.agreementLine} value={l.agreementLine}>Line {l.agreementLine} · {l.assetDescription} · {l.imported!.rows.length} mo</option>
                  ))}
                </select>
              </div>
            ) : (
              <div style={{ fontWeight: 600 }}>
                Line {line.agreementLine} <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>· {line.assetDescription} · {line.imported.rows.length} months</span>
              </div>
            )}
            <div className="spacer" style={{ flex: 1 }} />
            {lastBooked
              ? <span className="pill" style={{ background: '#1a7f37' }}>booked to {lastBooked}</span>
              : <span className="pill inactive">nothing booked yet</span>}
          </div>
          <div className="grid-wrap" ref={gridRef} style={{ maxHeight: 360, overflowY: 'auto' }}>
            <table className="grid">
              <thead>
                <tr><th>Month</th><th className="num">Inv. period</th><th className="num">Amortization</th><th className="num">Interest</th><th className="num">Depreciation</th><th>Booked in</th></tr>
              </thead>
              <tbody>
                {sortedRows.map(row => {
                  // A broken period puts the same month on two rows (different invoicing periods),
                  // so the key must combine both — the month alone is not unique.
                  const isLastBooked = !!lastBooked && row.period === lastBooked;
                  const isInvoiced = !plan.goingForward && row.invoicingPeriod === line.imported!.invoicedToPeriod;
                  return (
                    <tr key={`${row.period}-${row.invoicingPeriod}`} data-lastbooked={isLastBooked ? '1' : undefined}>
                      <td style={isLastBooked ? { background: '#d6f0dc', fontWeight: 700 } : undefined}>{row.period}</td>
                      <td className="num">{row.invoicingPeriod}</td>
                      <td className="num">{formatAmount(row.amortization)}</td>
                      <td className="num">{formatAmount(row.interest)}</td>
                      <td className="num">{row.depreciation == null ? <span className="muted">—</span> : formatAmount(row.depreciation)}</td>
                      <td style={{ fontSize: 11 }}>
                        {isLastBooked && (bookedJournal
                          ? <DrillLink
                              to={`/journals/gli/${bookedJournal.gliNumber}`}
                              label={`Journal ${gliLabel(bookedJournal)}`}
                              title={`Open Monthly Booking journal ${gliLabel(bookedJournal)} — its transactions`}
                              style={{ background: '#1a7f37', color: '#fff', padding: '2px 9px', borderRadius: 10, textDecoration: 'none', fontWeight: 700, whiteSpace: 'nowrap' }}
                            >{gliLabel(bookedJournal)}</DrillLink>
                          : <span className="pill" style={{ marginRight: 4, background: '#1a7f37' }}>booked</span>)}
                        {isInvoiced && <span className="pill inactive" style={{ marginLeft: 4 }}>invoiced to</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>
            The <span style={{ background: '#d6f0dc', fontWeight: 700, padding: '0 4px', borderRadius: 3 }}>green</span> month is the last one booked at End of Month; the grid opens there so the months still to book are right below it.
          </p>
        </div>
      )}
    </>
  );
}

// ---- Manual recognition-plan editor -----------------------------------------------------------
// Enter (or edit) a plan in the same import layout the old system sends: a header + a month-by-month
// schedule carrying an invoicing-period index, amortization, interest and (optionally) depreciation.
// Saving stores it as an `imported` plan, so it drills down and positions exactly like a plan that
// arrived over the message contract — position read from the Booked-To / Invoiced-To watermarks.
function PlanEditor({ entity, existing, onClose }: {
  entity: LegalEntity;
  existing?: RecognitionPlan;
  onClose: () => void;
}) {
  const { update } = useStore();
  const line0 = existing?.lines[0];
  const im0 = line0?.imported;

  const [agreement, setAgreement] = useState(existing?.agreement ?? '');
  const [desc, setDesc] = useState(existing?.agreementDescription ?? '');
  const [customer, setCustomer] = useState(existing?.customer ?? '');
  const [currency, setCurrency] = useState(existing?.currency ?? 'EUR');
  const [line, setLine] = useState(String(line0?.agreementLine ?? 1));
  const [asset, setAsset] = useState(line0?.assetDescription ?? '');
  const [depType, setDepType] = useState(im0?.depreciationType ?? 'Straight Line');
  const [bookedTo, setBookedTo] = useState(im0?.bookedToPeriod ?? '');
  const [invoicedTo, setInvoicedTo] = useState(String(im0?.invoicedToPeriod ?? 0));
  const [loadText, setLoadText] = useState('');
  const [loadMsg, setLoadMsg] = useState<string | null>(null);

  interface Row { period: string; invPer: string; amort: string; interest: string; dep: string; }
  const [rows, setRows] = useState<Row[]>(() => im0
    ? im0.rows.map(r => ({
        period: r.period, invPer: String(r.invoicingPeriod), amort: String(r.amortization),
        interest: String(r.interest), dep: r.depreciation == null ? '' : String(r.depreciation),
      }))
    : [{ period: entity.openPeriod || '202401', invPer: '1', amort: '', interest: '', dep: '' }]);

  const num = (s: string) => { const n = Number(String(s).replace(/\s/g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
  const round2 = (n: number) => Math.round(n * 100) / 100;
  // Auto-increment YYYYMM by one calendar month for the "Add month" row.
  const periodPlus = (p: string, n: number) => {
    const y = Number(p.slice(0, 4)); const m = Number(p.slice(4)) - 1 + n;
    const yy = y + Math.floor(m / 12); const mm = ((m % 12) + 12) % 12 + 1;
    return `${yy}${String(mm).padStart(2, '0')}`;
  };
  const setRow = (i: number, patch: Partial<Row>) => setRows(rs => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addRow = () => setRows(rs => {
    const last = rs[rs.length - 1];
    if (!last) return [{ period: entity.openPeriod || '202401', invPer: '1', amort: '', interest: '', dep: '' }];
    return [...rs, {
      period: /^\d{6}$/.test(last.period) ? periodPlus(last.period, 1) : '',
      invPer: String((Number(last.invPer) || 0) + 1),
      amort: last.amort, interest: last.interest, dep: last.dep,
    }];
  });
  const total = (f: 'amort' | 'interest' | 'dep') => rows.reduce((s, r) => s + num(r[f]), 0);
  const validRows = rows.filter(r => r.period.trim());
  const canSave = !!agreement.trim() && validRows.length > 0;

  // Load one agreement from an old-system export (same columns / parser as "Import from old system")
  // straight into this form, so it can be reviewed and edited before saving. Bulk files: the first
  // agreement is loaded and the rest are ignored (use the bulk importer for those).
  const loadFromText = (raw: string) => {
    if (!raw.trim()) return;
    const res = parseMonthlyRecImport(raw, entity.id, entity.ownerCode, 1);
    if (res.plans.length === 0) { setLoadMsg(res.errors[0] ?? 'Nothing recognised — check the columns.'); return; }
    const p = res.plans[0];
    const l = p.lines[0];
    const im = l?.imported;
    setAgreement(p.agreement);
    setDesc(p.agreementDescription);
    setCustomer(p.customer);
    setCurrency(p.currency);
    setLine(String(l?.agreementLine ?? 1));
    setAsset(l?.assetDescription ?? '');
    if (im) {
      setDepType(im.depreciationType);
      setBookedTo(im.bookedToPeriod);
      setInvoicedTo(String(im.invoicedToPeriod));
      setRows(im.rows.map(r => ({
        period: r.period, invPer: String(r.invoicingPeriod), amort: String(r.amortization),
        interest: String(r.interest), dep: r.depreciation == null ? '' : String(r.depreciation),
      })));
    }
    const extra = res.plans.length > 1 ? ` · file had ${res.plans.length} agreements, loaded the first (use “Import from old system” for bulk)` : '';
    setLoadMsg(`Loaded ${p.agreement} · ${im?.rows.length ?? 0} month rows${extra}. Review and Save.`);
  };
  const onFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onerror = () => setLoadMsg('Could not read the file.');
    // Binary Excel (.xlsx/.xls) → parse with SheetJS (lazy-loaded) and flatten the first sheet to the
    // same tab-separated text the paste parser reads. Plain text (.csv/.tsv/.txt) is read as-is.
    if (/\.(xlsx|xlsm|xls)$/i.test(file.name)) {
      reader.onload = async () => {
        try {
          const XLSX = await import('xlsx');
          const wb = XLSX.read(new Uint8Array(reader.result as ArrayBuffer), { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const tsv = XLSX.utils.sheet_to_csv(ws, { FS: '\t' });
          setLoadText(tsv);
          loadFromText(tsv);
        } catch {
          setLoadMsg('Could not read the Excel file. Try copying the rows and pasting them instead.');
        }
      };
      reader.readAsArrayBuffer(file);
      return;
    }
    reader.onload = () => { const t = String(reader.result ?? ''); setLoadText(t); loadFromText(t); };
    reader.readAsText(file);
  };

  const save = () => {
    if (!canSave) return;
    const importedRows = validRows.map(r => ({
      period: r.period.trim(),
      invoicingPeriod: Math.round(num(r.invPer)) || 0,
      amortization: round2(num(r.amort)),
      interest: round2(num(r.interest)),
      depreciation: r.dep.trim() === '' ? null : round2(num(r.dep)),
    }));
    update(d => {
      const id = existing?.id ?? Math.max(0, ...d.recognitionPlans.map(p => p.id)) + 1;
      const plan: RecognitionPlan = {
        id, legalEntityId: entity.id, entityCode: entity.ownerCode,
        agreement: agreement.trim(),
        agreementDescription: desc.trim() || `Agreement ${agreement.trim()}`,
        customer: customer.trim(),
        currency: (currency.trim() || 'EUR').toUpperCase(),
        // A hand-entered plan is Proposed until the agreement's Activation event adopts it (→ Active).
        // It recognises going-forward (up to the viewed period, netted against real invoicing).
        classification: 'Finance', status: existing?.status ?? 'Proposed', goingForward: existing?.goingForward ?? true,
        receivedDate: existing?.receivedDate ?? new Date().toISOString().slice(0, 10),
        source: existing?.source ?? 'Manual entry', sourceGli: existing?.sourceGli ?? null, imported: true,
        lines: [{
          agreementLine: Number(line) || 1,
          assetDescription: asset.trim() || `Line ${line || 1}`,
          schedule: [],
          imported: {
            bookedToPeriod: bookedTo.trim(),
            invoicedToPeriod: Math.round(num(invoicedTo)) || 0,
            depreciationType: depType,
            rows: importedRows,
          },
        }],
      };
      const idx = d.recognitionPlans.findIndex(p => p.id === id);
      if (idx >= 0) d.recognitionPlans[idx] = plan; else d.recognitionPlans.push(plan);
    });
    onClose();
  };

  return (
    <Dialog
      title={existing ? `Edit recognition plan · ${existing.agreement}` : 'New recognition plan'}
      wide
      onClose={onClose}
      footer={<>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!canSave} onClick={save}>Save plan</button>
      </>}
    >
      <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
        Same layout the old system sends in: a header plus a month-by-month schedule with an
        invoicing-period index. Leave depreciation blank unless the type is Annuity (otherwise the
        asset domain supplies it). Position is read from the Booked-To / Invoiced-To watermarks.
        {!existing && ' A new plan is saved as Proposed — it starts recognising once the agreement’s Activation event adopts it.'}
      </p>

      {/* Upload / paste one agreement's plan from the old-system export → fills the form below. */}
      <div style={{ border: '1px solid var(--border, #e2e2e2)', borderRadius: 6, padding: 10, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>Load from old-system export</div>
          <span className="muted" style={{ fontSize: 11, flex: 1, minWidth: 160 }}>same columns as “Import from old system”, but one agreement — loads into the form to review before saving</span>
          <label className="btn small" style={{ cursor: 'pointer' }}>
            Choose file…
            <input type="file" accept=".xlsx,.xlsm,.xls,.csv,.tsv,.txt" style={{ display: 'none' }} onChange={e => onFile(e.target.files?.[0])} />
          </label>
        </div>
        <textarea
          rows={4}
          value={loadText}
          onChange={e => setLoadText(e.target.value)}
          placeholder="…or paste the rows copied from Excel (tab-separated). Excel .xlsx / .csv / .tsv files: use “Choose file…”."
          style={{ width: '100%', fontFamily: 'monospace', fontSize: 11, marginTop: 8 }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
          <button className="btn small" disabled={!loadText.trim()} onClick={() => loadFromText(loadText)}>Load into form</button>
          {loadMsg && <span className="muted" style={{ fontSize: 12 }}>{loadMsg}</span>}
        </div>
        <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
          Columns: Agreement · Agreement Description · Customer name · Currency · Agreement line · Asset description ·
          Booked To Month · Invoiced To Period · Invoicing Period · Year Month · Amortization · Interest · Depreciation · Depreciation Type
        </div>
      </div>

      <div className="form-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="f"><label>Agreement</label><input value={agreement} onChange={e => setAgreement(e.target.value)} /></div>
        <div className="f" style={{ gridColumn: 'span 2' }}><label>Agreement description</label><input value={desc} onChange={e => setDesc(e.target.value)} /></div>
        <div className="f"><label>Customer</label><input value={customer} onChange={e => setCustomer(e.target.value)} /></div>
        <div className="f"><label>Currency</label><input value={currency} onChange={e => setCurrency(e.target.value)} /></div>
        <div className="f"><label>Agreement line</label><input value={line} onChange={e => setLine(e.target.value)} inputMode="numeric" /></div>
        <div className="f" style={{ gridColumn: 'span 2' }}><label>Asset description</label><input value={asset} onChange={e => setAsset(e.target.value)} /></div>
        <div className="f">
          <label>Depreciation type</label>
          <select value={depType} onChange={e => setDepType(e.target.value)}>
            {['Annuity', 'Straight Line', 'Sum of years', 'variable declining'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="f"><label>Booked to month <span className="muted" style={{ fontWeight: 400, fontSize: 11 }}>· YYYYMM</span></label><input value={bookedTo} onChange={e => setBookedTo(e.target.value)} placeholder="—" inputMode="numeric" /></div>
        <div className="f"><label>Invoiced to period <span className="muted" style={{ fontWeight: 400, fontSize: 11 }}>· index</span></label><input value={invoicedTo} onChange={e => setInvoicedTo(e.target.value)} inputMode="numeric" /></div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', marginTop: 10, marginBottom: 6 }}>
        <div style={{ fontWeight: 600 }}>Schedule</div>
        <div style={{ flex: 1 }} />
        <button className="btn small" onClick={addRow}>Add month</button>
      </div>
      <div className="grid-wrap" style={{ maxHeight: 320, overflowY: 'auto' }}>
        <table className="grid">
          <thead>
            <tr>
              <th style={{ width: 110 }}>Year month</th>
              <th className="num" style={{ width: 90 }}>Inv. period</th>
              <th className="num">Amortization</th>
              <th className="num">Interest</th>
              <th className="num">Depreciation</th>
              <th style={{ width: 36 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td><input value={r.period} placeholder="YYYYMM" onChange={e => setRow(i, { period: e.target.value })} style={{ width: '100%' }} inputMode="numeric" /></td>
                <td className="num"><input value={r.invPer} onChange={e => setRow(i, { invPer: e.target.value })} style={{ width: '100%', textAlign: 'right' }} inputMode="numeric" /></td>
                <td className="num"><input value={r.amort} onChange={e => setRow(i, { amort: e.target.value })} style={{ width: '100%', textAlign: 'right' }} inputMode="numeric" /></td>
                <td className="num"><input value={r.interest} onChange={e => setRow(i, { interest: e.target.value })} style={{ width: '100%', textAlign: 'right' }} inputMode="numeric" /></td>
                <td className="num"><input value={r.dep} placeholder="—" onChange={e => setRow(i, { dep: e.target.value })} style={{ width: '100%', textAlign: 'right' }} inputMode="numeric" /></td>
                <td><button className="btn ghost small" title="Remove month" disabled={rows.length <= 1} onClick={() => setRows(rs => rs.filter((_, j) => j !== i))}>✕</button></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="totals-row">
              <td colSpan={2}>Total</td>
              <td className="num">{formatAmount(total('amort'))}</td>
              <td className="num">{formatAmount(total('interest'))}</td>
              <td className="num">{formatAmount(total('dep'))}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </Dialog>
  );
}
