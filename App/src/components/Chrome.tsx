import { NavLink, Link, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useStore } from '../store';
import { gliLabel } from '../business/engine';
import { useTrail, structuralTrail, DrillLink } from './trail';
import { Icon } from './Icon';

export function TopNav() {
  return (
    <div className="topnav">
      <button className="burger" title="Menu">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      <span className="brand"><span className="spark">✦</span> Tieto</span>
      <nav>
        <NavLink to="/legal-entity" className={({ isActive }) => (isActive ? 'active' : '')}>Legal entity</NavLink>
        <NavLink to="/journals" className={({ isActive }) => (isActive ? 'active' : '')}>Journals</NavLink>
        <NavLink to="/reports" className={({ isActive }) => (isActive ? 'active' : '')}>Reports</NavLink>
        <NavLink to="/settings" className={({ isActive }) => (isActive ? 'active' : '')}>Settings</NavLink>
      </nav>
      <div className="right">
        <button className="iconbtn" title="Search"><Icon name="search" size={17} /></button>
        <button className="iconbtn" title="Language"><Icon name="globe" size={17} /></button>
        <div className="user">
          <span className="avatar">RK</span>
          <div className="who">
            <div className="nm">Rikard Krameus</div>
            <div className="ctx">Tieto</div>
          </div>
          <Icon name="chevronDown" size={13} />
        </div>
      </div>
    </div>
  );
}

// The breadcrumb renders the navigation trail. It shows the stored trail only while we're sitting at
// its tail (i.e. the drill-downs you followed to get here); the moment the URL is anywhere else — a
// top-nav or side-menu click, a crumb click, a refresh, the Back button — it falls back to a fresh
// structural trail derived from the URL. That fallback IS the automatic "start over". A drill-down
// link (DrillLink) extends the trail before navigating, so cross-section paths are kept.
export function Breadcrumb() {
  const { trail } = useTrail();
  const { data } = useStore();
  const loc = useLocation();
  const atTail = trail.length > 0 && trail[trail.length - 1].to === loc.pathname;
  const crumbs = atTail ? trail : structuralTrail(loc.pathname, data);

  return (
    <div className="breadcrumb">
      <Link to="/" className="home" title="Dashboard"><Icon name="home" size={15} /></Link>
      {crumbs.map((item, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span className="sep"><Icon name="chevronRight" size={12} /></span>
          {i < crumbs.length - 1 ? <Link to={item.to}>{item.label}</Link> : <b>{item.label}</b>}
        </span>
      ))}
    </div>
  );
}

export function LastJournalBox() {
  const { data } = useStore();
  const last = data.journals[0];
  if (!last) return null;
  const entity = data.legalEntities.find(e => e.id === last.legalEntityId);
  return (
    // The card links to the journal's transactions — same destination as Journals → click the journal.
    <DrillLink
      to={`/journals/gli/${last.gliNumber}`}
      label={`Journal ${gliLabel(last)}`}
      className="lastjournal"
      title={`Open journal ${gliLabel(last)}`}
      style={{ display: 'block', textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}
    >
      <div className="title">Last journal transaction</div>
      <div className="row"><span>Legal entity</span><span>{entity?.ownerCode}</span></div>
      <div className="row"><span>Journal number</span><span>{gliLabel(last)}</span></div>
      <div className="row"><span>Event</span><span>{last.accountingEvent}</span></div>
      <div className="row"><span>Transactions</span><span>{last.lineCount}</span></div>
      <div className="row"><span>Created</span><span>{last.createDate}</span></div>
      <div className="row"><span>Created by</span><span>{last.createdBy}</span></div>
    </DrillLink>
  );
}

export function SidePanel({ caption, beforeMenu, children }: { caption: string; beforeMenu?: ReactNode; children: ReactNode }) {
  return (
    <div className="sidepanel">
      <div className="bu">Business unit · <b>Tieto Fin</b></div>
      <LastJournalBox />
      {beforeMenu}
      <div className="sidemenu-card">
        <div className="sidemenu-caption">{caption}</div>
        <div className="sidemenu">{children}</div>
      </div>
    </div>
  );
}

export function MenuItem({ to, icon, label, end }: { to: string; icon: string; label: string; end?: boolean }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}>
      <span className="mi"><Icon name={icon} size={16} /></span> {label}
    </NavLink>
  );
}

export function Dialog({ title, wide, onClose, children, footer }: {
  title: string; wide?: boolean; onClose: () => void; children: ReactNode; footer?: ReactNode;
}) {
  return (
    <div className="dialog-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={'dialog' + (wide ? ' wide' : '')}>
        <header>
          {title}
          <button className="x" onClick={onClose} title="Close"><Icon name="x" size={15} /></button>
        </header>
        <div className="body">{children}</div>
        {footer && <footer>{footer}</footer>}
      </div>
    </div>
  );
}
