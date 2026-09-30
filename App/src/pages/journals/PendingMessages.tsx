import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore, formatAmount } from '../../store';
import { gliLabel } from '../../business/engine';
import { DrillLink } from '../../components/trail';
import { Icon } from '../../components/Icon';
import type { PendingMessage } from '../../types';

// The pending inbox: messages for EndOfMonth events (e.g. Monthly Booking) wait here until the
// entity's End of Month run releases them. Several systems can send in; the accountant controls
// when they are accounted for.
export default function PendingMessages() {
  const { data } = useStore();
  const [status, setStatus] = useState<'Pending' | 'Released' | 'All'>('Pending');
  const [entityId, setEntityId] = useState<number | 'All'>('All');

  const rows = data.pendingMessages
    .filter(m => status === 'All' || m.status === status)
    .filter(m => entityId === 'All' || m.legalEntityId === entityId)
    .sort((a, b) => b.id - a.id);

  const entityCode = (id: number) => data.legalEntities.find(e => e.id === id)?.ownerCode ?? String(id);
  const total = (m: PendingMessage) => Object.values(m.amounts).reduce((s, v) => s + v, 0);
  const pendingCount = data.pendingMessages.filter(m => m.status === 'Pending').length;

  return (
    <div>
      <div className="pagelike-title">
        Pending messages
        <span className="spacer" style={{ flex: 1 }} />
        <span className="pill">{pendingCount} pending</span>
      </div>
      <p className="muted" style={{ maxWidth: 720, marginTop: -6 }}>
        Messages for End-of-Month events (Monthly Booking) are held here on arrival instead of
        being booked. They are released — one journal each — when the legal entity’s
        <b> End of Month</b> run is executed for a period, picking up everything due up to that period.
      </p>

      <div className="toolbar">
        <div className="f" style={{ minWidth: 160 }}>
          <label>Status</label>
          <select value={status} onChange={e => setStatus(e.target.value as typeof status)}>
            <option value="Pending">Pending</option>
            <option value="Released">Released</option>
            <option value="All">All</option>
          </select>
        </div>
        <div className="f" style={{ minWidth: 200 }}>
          <label>Legal entity</label>
          <select value={String(entityId)} onChange={e => setEntityId(e.target.value === 'All' ? 'All' : Number(e.target.value))}>
            <option value="All">All entities</option>
            {data.legalEntities.map(e => <option key={e.id} value={e.id}>{e.ownerCode}</option>)}
          </select>
        </div>
        <div className="spacer" style={{ flex: 1 }} />
        <Link className="btn" to="/journals/simulator"><Icon name="zap" size={13} /> Send a message</Link>
      </div>

      <div className="grid-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th>Entity</th><th>Event</th><th>Period</th><th>Agreement</th>
              <th className="num">Amount</th><th>Source</th><th>Received</th><th>Status</th><th>Journal</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(m => (
              <tr key={m.id}>
                <td>{entityCode(m.legalEntityId)}</td>
                <td>{m.eventName}</td>
                <td>{m.period}</td>
                <td>{m.agreement}{m.agreementLine ? `-${m.agreementLine}` : ''}</td>
                <td className="num">{formatAmount(total(m))}</td>
                <td className="muted" style={{ fontSize: 12 }}>{m.source}</td>
                <td>{m.receivedDate}</td>
                <td>{m.status === 'Pending'
                  ? <span className="pill inactive">Pending</span>
                  : <span className="pill">Released</span>}</td>
                <td>{m.releasedGli ? <DrillLink to={`/journals/gli/${m.releasedGli}`} label={`Journal ${gliLabel(data.journals.find(j => j.gliNumber === m.releasedGli) ?? { gliNumber: m.releasedGli })}`}>{gliLabel(data.journals.find(j => j.gliNumber === m.releasedGli) ?? { gliNumber: m.releasedGli })}</DrillLink> : '—'}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={9} className="empty">No messages for this filter.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
