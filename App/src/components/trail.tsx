import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode, CSSProperties, MouseEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { gliLabel } from '../engine';
import type { AppData } from '../types';

// A breadcrumb crumb: a label and where clicking it goes.
export type Crumb = { label: string; to: string };

// ---- Navigation trail -------------------------------------------------------------------------
// The breadcrumb is the PATH THE USER TOOK, not a fixed map:
//   * Any navigation that ISN'T a drill-down (top-nav, side-menu, a crumb click, refresh, Back)
//     rebuilds a fresh structural trail from the URL — that is the automatic "start over".
//   * A drill-down link (DrillLink: an agreement row, the "Booked in" journal) appends a crumb and
//     records its target, so on arrival the trail is kept and extended instead of reset.
//   * Clicking a crumb navigates to it; that's a non-drill nav, so the trail rebuilds structurally
//     to the prefix for that page.
const TrailCtx = createContext<{ trail: Crumb[]; push: (c: Crumb) => void }>({ trail: [], push: () => {} });

export function TrailProvider({ children }: { children: ReactNode }) {
  const [trail, setTrail] = useState<Crumb[]>([]);
  const drillTarget = useRef<string | null>(null); // path a drill is navigating to; keep+extend on arrival
  const loc = useLocation();
  const { data } = useStore();

  useEffect(() => {
    if (drillTarget.current === loc.pathname) { drillTarget.current = null; return; } // arrived via drill — keep trail
    setTrail(structuralTrail(loc.pathname, data)); // any other navigation starts over from the URL
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.pathname]);

  const push = (crumb: Crumb) => { drillTarget.current = crumb.to; setTrail(t => [...t, crumb]); };
  return <TrailCtx.Provider value={{ trail, push }}>{children}</TrailCtx.Provider>;
}

export function useTrail() { return useContext(TrailCtx); }

const ENTITY_SUB: Record<string, string> = {
  integration: 'Integration', 'chart-of-account': 'Chart of account', 'pseudo-account': 'Pseudo account',
  dimensions: 'Accounting Dimensions', 'ext-account-parts': 'Accounting Dimensions', accruals: 'Accruals',
  recognition: 'Recognition', formulas: 'Formulas', 'classes-ledgers': 'Classes & ledgers', 'accounting-rules': 'Accounting rules',
  journals: 'Journal search', transactions: 'Transaction search',
};
const JOURNAL_SUB: Record<string, string> = {
  transactions: 'Transaction search', manual: 'Manual journal', simulator: 'Message simulator',
  pending: 'Pending messages', events: 'Published events', revaluation: 'Revaluation',
};
const SETTINGS_SUB: Record<string, string> = {
  'amount-types': 'Amount types', ledgers: 'Ledgers', 'chart-of-account': 'Chart of account',
  'ext-account-values': 'External account values', 'accounting-events': 'Accounting events', currencies: 'Currencies',
  'attribute-codes': 'Message attribute codes',
};
const REPORTS_SUB: Record<string, string> = { reconciliation: 'Reconciliation', agreement: 'Agreement reconciliation' };

// The default (structural) breadcrumb for a route — the "where am I in the app" trail, used whenever
// the stored trail doesn't already end at the current page (i.e. after a menu click / refresh / back).
export function structuralTrail(pathname: string, data: AppData): Crumb[] {
  const p = pathname.split('/').filter(Boolean);
  if (p.length === 0) return [];

  if (p[0] === 'legal-entity') {
    const out: Crumb[] = [{ label: 'Legal entity', to: '/legal-entity' }];
    if (p[1]) {
      const ent = data.legalEntities.find(e => String(e.id) === p[1]);
      out.push({ label: ent ? `${ent.id} – ${ent.name}` : `Legal entity ${p[1]}`, to: `/legal-entity/${p[1]}` });
      if (p[2]) {
        out.push({ label: ENTITY_SUB[p[2]] ?? p[2], to: `/legal-entity/${p[1]}/${p[2]}` });
        if (p[3]) {
          if (p[2] === 'recognition') out.push({ label: `Agreement ${p[3]}`, to: `/legal-entity/${p[1]}/recognition/${p[3]}` });
          else if (p[2] === 'formulas') {
            const f = data.formulas.find(x => String(x.id) === p[3]);
            out.push({ label: f ? f.name : `Formula ${p[3]}`, to: `/legal-entity/${p[1]}/formulas/${p[3]}` });
          } else out.push({ label: p[3], to: pathname });
        }
      }
    }
    return out;
  }

  if (p[0] === 'journals') {
    const out: Crumb[] = [{ label: 'Journal search', to: '/journals' }];
    if (p[1] === 'gli' && p[2]) {
      const j = data.journals.find(x => String(x.gliNumber) === p[2]);
      out.push({ label: `Journal ${j ? gliLabel(j) : p[2]}`, to: `/journals/gli/${p[2]}` });
    } else if (p[1]) {
      out.push({ label: JOURNAL_SUB[p[1]] ?? p[1], to: `/journals/${p[1]}` });
    }
    return out;
  }

  if (p[0] === 'settings') {
    const out: Crumb[] = [{ label: 'Settings', to: '/settings' }];
    if (p[1]) out.push({ label: SETTINGS_SUB[p[1]] ?? p[1], to: `/settings/${p[1]}` });
    return out;
  }

  if (p[0] === 'reports') {
    const out: Crumb[] = [{ label: 'Reports', to: '/reports' }];
    if (p[1]) out.push({ label: REPORTS_SUB[p[1]] ?? p[1], to: `/reports/${p[1]}` });
    return out;
  }

  return [];
}

// A link that records itself as a breadcrumb step before navigating (for cross-section drill-downs
// like the "Booked in" journal link, so the trail keeps "…› Recognition › Agreement X › Journal Y").
export function DrillLink({ to, label, children, className, style, title, onClick }: {
  to: string; label: string; children?: ReactNode; className?: string; style?: CSSProperties; title?: string;
  onClick?: (e: MouseEvent) => void;
}) {
  const { push } = useTrail();
  return (
    <Link to={to} className={className} style={style} title={title} onClick={e => { onClick?.(e); push({ label, to }); }}>
      {children ?? label}
    </Link>
  );
}

// Programmatic drill for row-click handlers: records the crumb, then navigates.
export function useDrill() {
  const { push } = useTrail();
  const navigate = useNavigate();
  return (to: string, label: string) => { push({ label, to }); navigate(to); };
}
