import { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { useStore, copyCoaTemplate, nextCoaIdBase, toPartyRef, formatAmount } from '../../store';
import { Dialog } from '../../components/Chrome';
import { Icon } from '../../components/Icon';
import { PartyPicker } from '../../components/PartyPicker';
import { planAccrualRecognition, recognizeAccruals } from '../../business/accruals';
import { pendingDue, releasePendingMessages } from '../../business/engine';
import { planBalanceRevaluation, revalueBalances } from '../../business/revaluation';
import { planRecognition, runRecognition } from '../../business/recognition';
import { commitExportInDraft } from '../../glexport';
import type { LegalEntity, PartyRef } from '../../types';

// Owner / Responsible / Controller card rendered from the stored party snapshot.
// Clicking the card (when onEdit is given) lets you select a different party.
function PartyCard({ title, party, onEdit }: { title: string; party?: PartyRef; onEdit?: () => void }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
        {title}
        {onEdit && <span className="muted" style={{ fontSize: 11, fontWeight: 400 }}>· click to change</span>}
      </div>
      {party ? (
        <div
          className={'info-card' + (onEdit ? ' clickable-card' : '')}
          onClick={onEdit}
          role={onEdit ? 'button' : undefined}
          title={onEdit ? `Change ${title.toLowerCase()}` : undefined}
        >
          {party.reference && <span className="tag">#{party.reference}</span>}
          <div className="name">{party.fullName}</div>
          {party.address && <div className="muted">{party.address}</div>}
          {party.city && <div className="muted">{party.city}</div>}
          {party.email && <div className="muted" style={{ marginTop: 6 }}>{party.email}</div>}
          {party.phone && <div className="muted">{party.phone}</div>}
          <div className="muted" style={{ fontSize: 10.5, marginTop: 6 }}>
            snapshot as of {party.asOf}
          </div>
        </div>
      ) : (
        <div
          className={'info-card' + (onEdit ? ' clickable-card' : '')}
          onClick={onEdit}
          role={onEdit ? 'button' : undefined}
        >
          <span className="muted">{onEdit ? 'Not assigned — click to select' : 'Not assigned'}</span>
        </div>
      )}
    </div>
  );
}

// Slide 8/32/33/34: entity info card, Owner/Responsible cards, Action menu with dialogs
export default function EntityInfo() {
  const entity = useOutletContext<LegalEntity>();
  const { data, update } = useStore();
  const [params, setParams] = useSearchParams();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [pickingRole, setPickingRole] = useState<null | 'owner' | 'responsible' | 'controller'>(null);
  const [eomNotice, setEomNotice] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Once transactions exist under the entity, only Description, Revaluation and the three
  // party cards may change — identity-defining fields (name, currency, chart, GLI serie) lock.
  const hasTransactions = useMemo(
    () => data.journals.some(j => j.legalEntityId === entity.id),
    [data.journals, entity.id],
  );

  const dialog = params.get('dialog'); // eom | close (deep-linked from dashboard tiles)
  const setDialog = (v: string | null) => {
    const p = new URLSearchParams(params);
    if (v) p.set('dialog', v); else p.delete('dialog');
    setParams(p, { replace: true });
  };

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  // Display from the stored snapshots (reference + snapshot pattern), not a live join.
  const owner = entity.owner;
  const responsible = entity.responsibleRef;
  const controller = entity.controllerRef;
  const currency = data.currencies.find(c => c.id === entity.baseCurrencyId);
  const coa = data.chartOfAccounts.find(c => c.id === entity.coaId);

  return (
    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 480px', minWidth: 0 }}>
        <div className="toolbar">
          <button className="btn" onClick={() => setShowEdit(true)}><Icon name="pencil" size={14} /> Edit</button>
          <div className="action-menu" ref={menuRef}>
            <button className="btn" onClick={() => setMenuOpen(o => !o)}>Action <Icon name="chevronDown" size={13} /></button>
            {menuOpen && (
              <div className="menu">
                <button onClick={() => { setMenuOpen(false); setDialog('eom'); }}>End of month</button>
                <button onClick={() => { setMenuOpen(false); setDialog('close'); }}>Close period</button>
              </div>
            )}
          </div>
        </div>
        {eomNotice && (
          <div className="info-card" style={{ fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name="zap" size={14} />
            <span style={{ flex: 1 }}>{eomNotice}</span>
            <button className="btn ghost small" onClick={() => setEomNotice(null)}>Dismiss</button>
          </div>
        )}
        <div className="card">
          <div className="field-grid">
            <div className="field"><label>ID</label><div className="val">{entity.id}</div></div>
            <div className="field"><label>Name</label><div className="val">{entity.name}</div></div>
            <div className="field"><label>Description</label><div className="val">{entity.description}</div></div>
            <div className="field"><label>Responsible</label><div className="val">{responsible?.fullName ?? '—'}</div></div>
            <div className="field"><label>Base currency</label><div className="val">{currency?.name}</div></div>
            <div className="field"><label>Revaluation</label><div className="val">{entity.revaluation ? `Yes · gain/loss ${entity.revaluationResultAccount ?? '—'}` : 'No'}</div></div>
            <div className="field"><label>Exchange difference account</label><div className="val">{entity.exchangeDifferenceAccount ?? <span className="muted">not set</span>}</div></div>
            <div className="field"><label>Chart of account</label><div className="val">{coa?.name}</div></div>
            <div className="field"><label>Journal number serie</label><div className="val">{entity.gliPrefix ?? ''}{entity.gliNumberSerie}<span className="muted" style={{ fontWeight: 400, marginLeft: 8 }}>· next {entity.gliPrefix ?? ''}{entity.gliNumberSerie + 1}</span></div></div>
            <div className="field"><label>Owner</label><div className="val">{owner?.fullName ?? '—'}</div></div>
            <div className="field"><label>End of month</label><div className="val">{entity.endOfMonth}</div></div>
            <div className="field"><label>Closed period</label><div className="val">{entity.closedPeriod}</div></div>
            <div className="field"><label>Open period</label><div className="val">{entity.openPeriod}</div></div>
          </div>
        </div>
      </div>
      <div style={{ flex: '0 1 260px', minWidth: 230 }}>
        <PartyCard title="Owner" party={owner} onEdit={() => setPickingRole('owner')} />
        <PartyCard title="Responsible" party={responsible} onEdit={() => setPickingRole('responsible')} />
        <PartyCard title="Controller" party={controller} onEdit={() => setPickingRole('controller')} />
      </div>

      {dialog === 'eom' && <EndOfMonthDialog entity={entity} onClose={() => setDialog(null)} onStart={period => {
        // The End of Month run does two things for this period: (1) release every Pending
        // Monthly-Booking message due up to the period (booking one journal each), and (2)
        // recognise every accrual slice due up to the period. Counts are read read-only first
        // so the banner is reliable under StrictMode; the mutations are applied in update().
        const plan = planAccrualRecognition(data, entity.ownerCode, period);
        const dueMessages = pendingDue(data, entity.id, period).length;
        const revalPlan = planBalanceRevaluation(data, entity.id, period);
        const recPositions = planRecognition(data, entity.id, entity.ownerCode, period);
        const recAccrued = recPositions.filter(p => p.position > 0).reduce((s, p) => s + p.position, 0);
        const recDeferred = recPositions.filter(p => p.position < 0).reduce((s, p) => s - p.position, 0);
        // Captured from inside update() (assign, not accumulate, so StrictMode's double-invoke
        // overwrites with the same value rather than doubling).
        let exportedLines = 0, exportedBatches = 0;
        update(d => {
          releasePendingMessages(d, entity.id, period, 'End of month release');
          recognizeAccruals(d, entity.id, entity.ownerCode, period, 'End of month');
          runRecognition(d, entity.id, entity.ownerCode, period, 'End of month recognition');
          revalueBalances(d, entity.id, period, 'End of month revaluation');
          const e = d.legalEntities.find(x => x.id === entity.id);
          if (e) { e.endOfMonth = period; e.glInterfaceDate = periodLastDay(period); }
          // Export the integrations set to run at End of Month (Manual-only ones are skipped).
          // Runs last, so the pending/accrual/revaluation journals just booked are included.
          let lines = 0, batches = 0;
          for (const integ of d.integrations.filter(i => i.legalEntityId === entity.id && i.executionType !== 'Manual')) {
            const res = commitExportInDraft(d, integ, integ.ledger, period, { mode: integ.summarization, defaultKeepPartIds: integ.defaultKeepPartIds }, 'End of month');
            if (res) { lines += res.lineCount; batches += 1; }
          }
          exportedLines = lines; exportedBatches = batches;
        });
        const parts = [
          dueMessages > 0 ? `released ${dueMessages} pending message${dueMessages === 1 ? '' : 's'}` : null,
          plan.count > 0 ? `recognised ${formatAmount(plan.total)} across ${plan.count} accrual${plan.count === 1 ? '' : 's'}` : null,
          revalPlan.items.length > 0 ? `revalued ${revalPlan.items.length} balance${revalPlan.items.length === 1 ? '' : 's'} (${formatAmount(revalPlan.total)})` : null,
          recPositions.length > 0 ? `recognition cutoff — accrued ${formatAmount(recAccrued)}, deferred ${formatAmount(recDeferred)}` : null,
          exportedBatches > 0 ? `exported ${exportedLines} GL line${exportedLines === 1 ? '' : 's'} to ${exportedBatches} integration${exportedBatches === 1 ? '' : 's'}` : null,
        ].filter(Boolean);
        setEomNotice(`End of month ${period}: ${parts.length ? parts.join('; ') + '.' : 'nothing due.'}`);
        setDialog(null);
      }} />}
      {dialog === 'close' && <ClosePeriodDialog entity={entity} onClose={() => setDialog(null)} onCloseCurrent={() => {
        update(d => {
          const e = d.legalEntities.find(x => x.id === entity.id);
          if (e) {
            e.closedPeriod = e.openPeriod;
            e.openPeriod = nextPeriod(e.openPeriod);
          }
        });
        setDialog(null);
      }} />}

      {showEdit && (
        <EditLegalEntityDialog entity={entity} locked={hasTransactions} onClose={() => setShowEdit(false)} />
      )}

      {pickingRole && (
        <PartyPicker
          kind={pickingRole === 'owner' ? 'Organization' : 'Person'}
          title={pickingRole === 'owner' ? 'Select owner organization' : `Select ${pickingRole}`}
          onSelect={party => {
            update(d => {
              const e = d.legalEntities.find(x => x.id === entity.id);
              if (!e) return;
              const ref = toPartyRef(party);
              if (pickingRole === 'owner') {
                // owner reference/snapshot changes; ownerCode stays as the entity's config key
                e.ownerPartyId = party.id;
                e.owner = ref;
              } else if (pickingRole === 'responsible') {
                e.responsiblePartyId = party.id;
                e.responsibleRef = ref;
                e.responsible = party.fullName;
              } else {
                e.controllerPartyId = party.id;
                e.controllerRef = ref;
              }
            });
            setPickingRole(null);
          }}
          onClose={() => setPickingRole(null)}
        />
      )}
    </div>
  );
}

// Edit the entity's own fields. When the entity already has transactions, only Description
// and Revaluation are editable — name, base currency, chart of account and GLI serie lock,
// because changing them after bookings exist would break continuity of the ledger.
function EditLegalEntityDialog({ entity, locked, onClose }: {
  entity: LegalEntity; locked: boolean; onClose: () => void;
}) {
  const { data, update } = useStore();
  const [name, setName] = useState(entity.name);
  const [description, setDescription] = useState(entity.description);
  const [baseCurrencyId, setBaseCurrencyId] = useState(entity.baseCurrencyId);
  const [coaId, setCoaId] = useState(entity.coaId);
  const [gliSerie, setGliSerie] = useState(String(entity.gliNumberSerie));
  const [gliPrefix, setGliPrefix] = useState(entity.gliPrefix ?? '');
  const [revaluation, setRevaluation] = useState(entity.revaluation);
  const [revalResultAccount, setRevalResultAccount] = useState(entity.revaluationResultAccount ?? '');
  const [exchangeDiffAccount, setExchangeDiffAccount] = useState(entity.exchangeDifferenceAccount ?? '');
  const [fiscalStart, setFiscalStart] = useState(String(entity.fiscalYearStartMonth ?? 1));
  const [showInTabs, setShowInTabs] = useState(!!entity.showInTabs);
  const resultAccounts = data.pseudoAccounts.filter(p => p.entityCode === entity.ownerCode && p.accountKind === 'Result');

  const coaChanged = coaId !== entity.coaId;
  const placementCount = data.pseudoAccountCoaLinks.filter(l => l.entityCode === entity.ownerCode).length;

  const save = () => {
    if (!name.trim()) return;
    update(d => {
      const e = d.legalEntities.find(x => x.id === entity.id);
      if (!e) return;
      e.description = description.trim() || e.name;
      e.revaluation = revaluation;
      e.revaluationResultAccount = revalResultAccount || e.revaluationResultAccount;
      e.exchangeDifferenceAccount = exchangeDiffAccount || undefined;
      e.fiscalYearStartMonth = Number(fiscalStart) || 1;
      // The GLI series (running number + prefix) is a live counter, not an identity field — it
      // stays editable even once the entity has booked transactions.
      e.gliNumberSerie = Number(gliSerie) || e.gliNumberSerie;
      e.gliPrefix = gliPrefix.trim() || undefined;
      e.showInTabs = showInTabs || undefined; // display/navigation preference — editable even when locked

      if (!locked) {
        e.name = name.trim();
        e.baseCurrencyId = baseCurrencyId;
        if (coaChanged) {
          e.coaId = coaId;
          // regenerate this entity's chart-of-account copy from the new template and
          // drop its placements (node ids change) — only reachable when unlocked
          d.entityCoaNodes = d.entityCoaNodes.filter(n => n.legalEntityId !== e.id);
          const base = nextCoaIdBase(d.entityCoaNodes);
          d.entityCoaNodes.push(...copyCoaTemplate(d.coaNodes, coaId, e.id, base));
          d.pseudoAccountCoaLinks = d.pseudoAccountCoaLinks.filter(l => l.entityCode !== e.ownerCode);
        }
      }
    });
    onClose();
  };

  const lockedField = (label: string, value: React.ReactNode) => (
    <div className="f">
      <label>{label} <span className="muted" style={{ fontWeight: 400 }}>· locked</span></label>
      <input value={String(value)} disabled readOnly />
    </div>
  );

  return (
    <Dialog title={`Edit legal entity ${entity.id}`} onClose={onClose} footer={
      <>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={save} disabled={!name.trim()}>Save</button>
      </>
    }>
      {locked && (
        <div className="info-card" style={{ borderLeftColor: 'var(--amber-text)', marginBottom: 14, fontSize: 12.5 }}>
          This legal entity has booked transactions. Only <b>Description</b>, <b>Revaluation</b> and the
          Owner / Responsible / Controller cards can be changed. Identity-defining fields are locked.
        </div>
      )}
      <div className="form-grid">
        {locked
          ? lockedField('Name', entity.name)
          : <div className="f"><label>Name</label><input value={name} onChange={e => setName(e.target.value)} /></div>}
        <div className="f"><label>Journal number prefix <span className="muted" style={{ fontWeight: 400 }}>· e.g. 2026/</span></label><input value={gliPrefix} onChange={e => setGliPrefix(e.target.value)} placeholder="—" /></div>
        <div className="f">
          <label>Journal number serie <span className="muted" style={{ fontWeight: 400 }}>· latest used</span></label>
          <input value={gliSerie} onChange={e => setGliSerie(e.target.value)} inputMode="numeric" />
          <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>next journal: {gliPrefix.trim()}{(Number(gliSerie) || entity.gliNumberSerie) + 1}</div>
        </div>
        <div className="f full"><label>Description</label><input value={description} onChange={e => setDescription(e.target.value)} /></div>
        {locked
          ? lockedField('Base currency', data.currencies.find(c => c.id === entity.baseCurrencyId)?.name ?? '')
          : (
            <div className="f">
              <label>Base currency</label>
              <select value={baseCurrencyId} onChange={e => setBaseCurrencyId(Number(e.target.value))}>
                {data.currencies.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
              </select>
            </div>
          )}
        {locked
          ? lockedField('Chart of account', data.chartOfAccounts.find(c => c.id === entity.coaId)?.name ?? '')
          : (
            <div className="f">
              <label>Chart of account</label>
              <select value={coaId} onChange={e => setCoaId(Number(e.target.value))}>
                {data.chartOfAccounts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
        <div className="f full">
          <label className="checkbox-inline">
            <input type="checkbox" checked={revaluation} onChange={e => setRevaluation(e.target.checked)} /> Revaluation
          </label>
        </div>
        <div className="f full">
          <label className="checkbox-inline">
            <input type="checkbox" checked={showInTabs} onChange={e => setShowInTabs(e.target.checked)} /> Show in entity tabs
            <span className="muted" style={{ fontWeight: 400, marginLeft: 6, fontSize: 12 }}>· one-click quick-switch at the top of the legal-entity workspace</span>
          </label>
        </div>
        {revaluation && (
          <div className="f full">
            <label>Revaluation result account <span className="muted" style={{ fontWeight: 400 }}>· currency gain/loss (P&amp;L)</span></label>
            <select value={revalResultAccount} onChange={e => setRevalResultAccount(e.target.value)}>
              {!resultAccounts.some(p => p.pseudo === revalResultAccount) && revalResultAccount && <option value={revalResultAccount}>{revalResultAccount}</option>}
              {resultAccounts.map(p => <option key={p.id} value={p.pseudo}>{p.pseudo} — {p.description}</option>)}
            </select>
          </div>
        )}
        <div className="f">
          <label>Financial year starts <span className="muted" style={{ fontWeight: 400 }}>· reporting</span></label>
          <select value={fiscalStart} onChange={e => setFiscalStart(e.target.value)}>
            {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
              .map((m, i) => <option key={m} value={i + 1}>{m}{i === 0 ? ' (calendar year)' : ''}</option>)}
          </select>
        </div>
        <div className="f full">
          <label>Exchange difference account <span className="muted" style={{ fontWeight: 400 }}>· base-currency rounding</span></label>
          <select value={exchangeDiffAccount} onChange={e => setExchangeDiffAccount(e.target.value)}>
            <option value="">— not set —</option>
            {!resultAccounts.some(p => p.pseudo === exchangeDiffAccount) && exchangeDiffAccount && <option value={exchangeDiffAccount}>{exchangeDiffAccount}</option>}
            {resultAccounts.map(p => <option key={p.id} value={p.pseudo}>{p.pseudo} — {p.description}</option>)}
          </select>
          <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>
            Converting each line to {data.currencies.find(c => c.id === baseCurrencyId)?.code ?? 'base'} rounds to 2 decimals, so a journal
            that balances in transaction currency can still be a cent out in base currency. That technical residual is booked here —
            separate from the revaluation result account, which holds real FX gain/loss.
          </div>
        </div>
      </div>
      {!locked && coaChanged && placementCount > 0 && (
        <p className="badge-diff" style={{ display: 'inline-block', marginTop: 12, fontSize: 12 }}>
          Changing the chart of account rebuilds this entity's chart from the template and removes
          its {placementCount} pseudo-account placement{placementCount === 1 ? '' : 's'}.
        </p>
      )}
    </Dialog>
  );
}

function nextPeriod(p: string): string {
  const y = Number(p.slice(0, 4));
  const m = Number(p.slice(4));
  return m === 12 ? `${y + 1}01` : `${y}${String(m + 1).padStart(2, '0')}`;
}

function periodLastDay(p: string): string {
  const y = Number(p.slice(0, 4));
  const m = Number(p.slice(4));
  const last = new Date(y, m, 0).getDate();
  return `${y}-${String(m).padStart(2, '0')}-${last}`;
}

function firstDay(p: string): string {
  return `${p.slice(0, 4)}-${p.slice(4)}-01`;
}

// Slide 33
function EndOfMonthDialog({ entity, onClose, onStart }: {
  entity: LegalEntity; onClose: () => void; onStart: (period: string) => void;
}) {
  const [period, setPeriod] = useState('');
  const valid = /^\d{6}$/.test(period);
  return (
    <Dialog title="End of month" onClose={onClose} footer={
      <>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!valid} onClick={() => onStart(period)}>Start</button>
      </>
    }>
      <div className="section-strip">Latest end of month</div>
      <div className="form-grid">
        <div className="f"><label>End of month</label><input readOnly value={entity.endOfMonth} /></div>
        <div className="f"><label>Booking date</label><input readOnly value={entity.glInterfaceDate} /></div>
        <div className="f"><label>Journal number</label><input readOnly value="126266" /></div>
        <div className="f"><label>Lines</label><input readOnly value="14 562" /></div>
        <div className="f"><label>Created date</label><input readOnly value="2024-10-02" /></div>
        <div className="f"><label>Created by</label><input readOnly value="Rikard Krameus" /></div>
      </div>
      <div className="section-strip">New end of month</div>
      <div className="form-grid">
        <div className="f">
          <label>End of month</label>
          <input placeholder="YYYYMM" value={period} onChange={e => setPeriod(e.target.value)} />
        </div>
      </div>
    </Dialog>
  );
}

// Slide 34
function ClosePeriodDialog({ entity, onClose, onCloseCurrent }: {
  entity: LegalEntity; onClose: () => void; onCloseCurrent: () => void;
}) {
  const next = nextPeriod(entity.openPeriod);
  return (
    <Dialog title="Close period" onClose={onClose} footer={
      <>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={onCloseCurrent}>Close current period</button>
      </>
    }>
      <div className="section-strip">Current period</div>
      <div className="form-grid">
        <div className="f"><label>Current period</label><input readOnly value={entity.openPeriod} /></div>
        <div className="f"><label>&nbsp;</label><input readOnly value={firstDay(entity.openPeriod)} /></div>
      </div>
      <div className="section-strip">Next period</div>
      <div className="form-grid">
        <div className="f"><label>Next period</label><input readOnly value={next} /></div>
        <div className="f"><label>&nbsp;</label><input readOnly value={firstDay(next)} /></div>
      </div>
    </Dialog>
  );
}
