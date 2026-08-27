import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { NavigateFunction } from 'react-router-dom';
import { useStore, formatAmount } from '../store';
import type { ActivityEntry } from '../store';
import { Breadcrumb } from '../components/Chrome';
import { Icon } from '../components/Icon';
import { planRecognition, importedPositions, goingForwardImportedPositions } from '../recognition';
import type { AppData, LegalEntity } from '../types';

const tileColors = ['linear-gradient(135deg, #7c3aed, #46137c)', 'linear-gradient(135deg, #0ea5e9, #1e40af)', 'linear-gradient(135deg, #10b981, #047857)'];
const GREEN = '#1a7f37', AMBER = '#b3541e', RED = '#c0392b';
const ACTIVITY_EVENTS = ['Activation', 'Invoicing', 'AR Payment', 'AP Payment', 'AP Definite Posting'];
const ACTIVITY_ABBR: Record<string, string> = { 'AP Definite Posting': 'AP Posting' };

function metricsFor(data: AppData, e: LegalEntity) {
  const js = data.journals.filter(j => j.legalEntityId === e.id);
  const diffs = js.filter(j => j.difference).length;
  const pending = data.pendingMessages.filter(m => m.legalEntityId === e.id && m.status === 'Pending').length;
  const unexported = js.filter(j => !j.exportDate).length;
  const noJournal = data.journalEvents.filter(ev => ev.legalEntityId === e.id && ev.status === 'Rejected').length;
  const activePlans = data.recognitionPlans.filter(p => p.legalEntityId === e.id && p.status === 'Active').length;
  const mbRan = js.some(j => j.accountingEvent === 'Monthly Booking' && j.bookingDate.slice(0, 7).replace('-', '') === e.endOfMonth);
  const positions = planRecognition(data, e.id, e.ownerCode, e.openPeriod);
  const imp = [...importedPositions(data, e.id), ...goingForwardImportedPositions(data, e.id, e.openPeriod)];
  // Same split as the Recognition page summary: amortization and interest counted separately, so the
  // tile matches the amounts shown there.
  let accrued = 0, deferred = 0;
  positions.forEach(p => { if (p.position > 0) accrued += p.position; else deferred += -p.position; });
  imp.forEach(ip => {
    if (ip.amortPosition > 0) accrued += ip.amortPosition; else deferred += -ip.amortPosition;
    if (ip.interestPosition > 0) accrued += ip.interestPosition; else deferred += -ip.interestPosition;
  });
  const suspense = data.pseudoAccounts
    .filter(p => p.entityCode === e.ownerCode && /unapplied|contra|clearing|suspense|on.?account|unalloc/i.test(`${p.description} ${p.pseudo}`))
    .map(p => ({ desc: p.description, bal: Math.round(js.reduce((s, j) => s + j.lines.filter(l => l.pseudoAccount === p.pseudo).reduce((a, l) => a + (l.debit - l.credit), 0), 0) * 100) / 100 }))
    .filter(c => Math.abs(c.bal) > 0.005);
  const activity = ACTIVITY_EVENTS.map(name => {
    const n = js.filter(j => j.accountingEvent === name).length;
    // Demo trend vs the previous period (no real prior-period data yet) — deterministic per
    // entity+event so it stays stable across renders.
    const seed = [...`${e.id}:${name}`].reduce((a, c) => ((a * 33) + c.charCodeAt(0)) | 0, 7);
    const delta = (Math.abs(seed) % 19) - 6; // −6 … +12
    return { name, n, delta };
  });
  const maxAct = Math.max(1, ...activity.map(a => a.n));
  return { diffs, pending, unexported, noJournal, activePlans, mbRan, suspense, activity, maxAct, accrued: Math.round(accrued * 100) / 100, deferred: Math.round(deferred * 100) / 100 };
}

export default function Dashboard() {
  const { data } = useStore();
  const navigate = useNavigate();
  const openPeriods = [...new Set(data.legalEntities.map(e => e.openPeriod))];
  const heroPeriod = openPeriods.length === 1 ? openPeriods[0] : null;

  return (
    <>
      <Breadcrumb />
      <div className="dash-hero" style={{ marginBottom: 14 }}>
        <h1>Accounting</h1>
        <p>{data.legalEntities.length} legal entities configured{heroPeriod ? ` · period ${heroPeriod} open` : ''}</p>
      </div>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', gap: 12, alignItems: 'stretch' }}>
          {data.legalEntities.map((e, i) => <EntityColumn key={e.id} entity={e} data={data} navigate={navigate} accent={tileColors[i % tileColors.length]} />)}
        </div>
        <ActivityTicker data={data} navigate={navigate} />
      </div>
    </>
  );
}

function Tile({ label, value, color, onClick }: { label: string; value: React.ReactNode; color?: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} style={{ textAlign: 'left', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 8, padding: '7px 10px', cursor: onClick ? 'pointer' : 'default', overflow: 'hidden' }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: color ?? 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
    </button>
  );
}

function EntityColumn({ entity: e, data, navigate, accent }: { entity: LegalEntity; data: AppData; navigate: NavigateFunction; accent: string }) {
  const m = metricsFor(data, e);
  const base = `/legal-entity/${e.id}`;
  const initials = e.ownerCode.split(' ').map(w => w[0]).join('').slice(0, 3);
  const ready = m.diffs === 0 && m.pending === 0;

  return (
    <div className="card" style={{ flex: 1, minWidth: 220, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ cursor: 'pointer' }} onClick={() => navigate(base)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ background: accent, width: 32, height: 32, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 12 }}>{initials}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700 }}>{e.ownerCode}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.name}</div>
          </div>
          <span style={{ color: 'var(--purple)' }}><Icon name="arrowRight" size={16} /></span>
        </div>
        <span className="pill" style={{ background: ready ? GREEN : AMBER, marginTop: 8, display: 'inline-block' }}>{ready ? `Ready to close ${e.openPeriod}` : `${m.diffs + m.pending} to resolve before close`}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Tile label="End of month" value={e.endOfMonth} onClick={() => navigate(`${base}?dialog=eom`)} />
        <Tile label="Open period" value={e.openPeriod} onClick={() => navigate(`${base}?dialog=close`)} />
        <Tile label="Unbalanced" value={m.diffs} color={m.diffs ? RED : GREEN} onClick={() => navigate(`/journals?entity=${e.id}&diff=1`)} />
        <Tile label="Pending msgs" value={m.pending} color={m.pending ? AMBER : GREEN} onClick={() => navigate('/journals/pending')} />
        <Tile label="Unexported" value={m.unexported} onClick={() => navigate(`${base}/journals?unexported=1`)} />
        <Tile label="No-journal msgs" value={m.noJournal} color={m.noJournal ? AMBER : GREEN} onClick={() => navigate(`/journals/events?entity=${e.id}&status=Rejected`)} />
        <Tile label="Accrued" value={formatAmount(m.accrued)} color={GREEN} onClick={() => navigate(`${base}/recognition?period=${e.openPeriod}`)} />
        <Tile label="Deferred" value={formatAmount(m.deferred)} color={AMBER} onClick={() => navigate(`${base}/recognition?period=${e.openPeriod}`)} />
      </div>

      <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px' }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Cash to clear</div>
        {m.suspense.length === 0
          ? <div style={{ fontSize: 12, color: 'var(--muted)' }}>Nothing in suspense.</div>
          : m.suspense.slice(0, 3).map((c, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, padding: '2px 0' }}>
              <span style={{ color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.desc}</span><span style={{ whiteSpace: 'nowrap' }}>{formatAmount(c.bal)}</span>
            </div>
          ))}
      </div>

      <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px' }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Activity by event · vs last</div>
        {m.activity.map(a => (
          <div key={a.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}>
            <span style={{ fontSize: 12, color: 'var(--muted)', width: 68, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ACTIVITY_ABBR[a.name] ?? a.name}</span>
            <span style={{ flex: 1, background: '#efeafe', height: 8, borderRadius: 4, overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${Math.max(a.n ? 8 : 0, (a.n / m.maxAct) * 100)}%`, background: 'var(--purple)' }} /></span>
            <span style={{ fontSize: 12, width: 44, textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
              {a.n}
              {a.n > 0 && (a.delta === 0
                ? <span style={{ color: 'var(--muted)', fontSize: 10, marginLeft: 3 }}>▬</span>
                : <span style={{ color: a.delta > 0 ? GREEN : RED, fontSize: 10, marginLeft: 3 }}>{a.delta > 0 ? '▲' : '▼'}{Math.abs(a.delta)}</span>)}
            </span>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 'auto' }}>
        Monthly booking — {m.mbRan ? `booked for ${e.endOfMonth}` : 'not yet booked'} · {m.activePlans} active plans
      </div>
    </div>
  );
}

function ago(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 4) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// One coloured dot per activity kind so journals, config changes and new entities read apart.
const KIND_ICON: Record<string, string> = {
  journal: 'book', pseudo: 'rows', formula: 'sigma', amountType: 'coins', attrCode: 'tag',
  rule: 'sliders', plan: 'calendar', category: 'calendar', accrual: 'layers', ledger: 'layers',
  currency: 'coins', entity: 'building',
};
function kindColor(kind: string) {
  if (kind === 'journal') return 'var(--purple)';
  if (kind === 'entity' || kind === 'plan') return GREEN;
  return '#0ea5e9'; // configuration change
}

// Live activity: shows everything happening in the system — journals booked, plus config changes
// (a new pseudo account, formula, attribute code, ledger…) tracked by the store's activity log —
// merged with a synthetic inbound stream of journals other domains keep sending while the page is open.
function ActivityTicker({ data, navigate }: { data: AppData; navigate: NavigateFunction }) {
  const { activityLog } = useStore();
  const [synth, setSynth] = useState<ActivityEntry[]>([]);
  const [, setNow] = useState(Date.now());
  const next = useRef(0);
  const tick = useRef(0);

  useEffect(() => {
    next.current = Math.max(1000, ...data.journals.map(j => j.gliNumber)) + 1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const kinds = [
      { event: 'Invoicing', by: 'Contract domain', lo: 2, hi: 12 },
      { event: 'AR Payment', by: 'Receivables domain', lo: 2, hi: 4 },
      { event: 'Activation', by: 'Contract domain', lo: 6, hi: 16 },
      { event: 'AP Definite Posting', by: 'Payables domain', lo: 2, hi: 6 },
      { event: 'AP Payment', by: 'Payables domain', lo: 2, hi: 2 },
      { event: 'Credit Invoicing', by: 'Contract domain', lo: 2, hi: 4 },
    ];
    const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
    const id = setInterval(() => {
      setNow(Date.now());
      tick.current += 1;
      if (tick.current % 4 !== 0 || data.legalEntities.length === 0) return; // ~every 4s
      const k = kinds[rnd(0, kinds.length - 1)];
      const ent = data.legalEntities[rnd(0, data.legalEntities.length - 1)];
      const gli = next.current++;
      const rows = rnd(k.lo, k.hi);
      const ledger = Math.random() < 0.2 ? 'US GAAP' : 'Local Legal';
      setSynth(prev => [{
        id: `s${gli}`, ts: Date.now(), kind: 'journal', title: 'Journal posted',
        detail: `${ent.gliPrefix ?? ''}${gli} · ${k.event} · ${rows} rows · by ${k.by} · ${ledger}`,
        entity: ent.ownerCode, to: `/legal-entity/${ent.id}/journals`,
      }, ...prev].slice(0, 40));
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const now = Date.now();
  const feed = [...synth, ...activityLog].sort((a, b) => b.ts - a.ts).slice(0, 80);

  return (
    <div className="card" style={{ width: 300, flexShrink: 0, padding: 0, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 236px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderBottom: '1px solid var(--line)' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: GREEN, display: 'inline-block', boxShadow: '0 0 0 0 rgba(26,127,55,0.5)', animation: 'pulse 1.6s infinite' }} />
        <span style={{ fontWeight: 700, fontSize: 13 }}>Live activity</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>streaming</span>
      </div>
      <style>{`@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(26,127,55,0.5)}70%{box-shadow:0 0 0 6px rgba(26,127,55,0)}100%{box-shadow:0 0 0 0 rgba(26,127,55,0)}}`}</style>
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {feed.map(v => {
          const fresh = now - v.ts < 4000;
          return (
            <button key={v.id} onClick={() => v.to && navigate(v.to)}
              style={{ display: 'block', width: '100%', textAlign: 'left', background: fresh ? '#f4effd' : 'transparent', border: 'none', borderBottom: '1px solid var(--line)', padding: '9px 14px', cursor: v.to ? 'pointer' : 'default', transition: 'background 0.6s' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: kindColor(v.kind), display: 'inline-flex' }}><Icon name={KIND_ICON[v.kind] ?? 'zap'} size={13} /></span>
                <span style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--ink)' }}>{v.title}</span>
                {v.entity && <span style={{ fontSize: 11, color: 'var(--muted)' }}>{v.entity}</span>}
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{ago(now - v.ts)}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text)', marginTop: 2 }}>{v.detail}</div>
            </button>
          );
        })}
        {feed.length === 0 && <div className="empty" style={{ padding: 16 }}>No activity yet.</div>}
      </div>
    </div>
  );
}
