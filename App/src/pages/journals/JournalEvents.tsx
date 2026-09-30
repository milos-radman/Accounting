import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStore, formatAmount } from '../../store';
import { gliLabel } from '../../business/engine';
import { DrillLink } from '../../components/trail';

type EventStatusFilter = 'All' | 'Posted' | 'AcceptedPending' | 'Rejected';

// The outbox: every time the accounting domain creates a journal it publishes a "Journal posted"
// event here, carrying the correlation id from the inbound message plus the journal number and
// status — so the originating domain (agreement, asset, AR/AP) can update its own side. In a real
// deployment these go onto a message bus / topic; here they are an outbox log.
export default function JournalEvents() {
  const { data } = useStore();
  const [params] = useSearchParams();
  const statusParam = params.get('status');
  const [entityId, setEntityId] = useState<number | 'All'>(params.get('entity') ? Number(params.get('entity')) : 'All');
  const [status, setStatus] = useState<EventStatusFilter>(
    ['Posted', 'AcceptedPending', 'Rejected'].includes(statusParam ?? '') ? (statusParam as EventStatusFilter) : 'All',
  );

  const rows = data.journalEvents
    .filter(e => entityId === 'All' || e.legalEntityId === entityId)
    .filter(e => status === 'All' || e.status === status)
    .sort((a, b) => b.id - a.id);

  const statusPill = (s: string) =>
    s === 'Posted' ? <span className="pill">Posted</span>
    : s === 'AcceptedPending' ? <span className="pill inactive">Accepted · pending</span>
    : <span className="badge-diff">Rejected</span>;

  return (
    <div>
      <div className="pagelike-title">
        Published events
        <span className="spacer" style={{ flex: 1 }} />
        <span className="pill">{data.journalEvents.length} published</span>
      </div>
      <p className="muted" style={{ maxWidth: 760, marginTop: -6 }}>
        When the accounting domain books a journal it publishes a <b>Journal posted</b> event —
        the journal number plus the correlation id and business keys from the message that triggered
        it — so other domains can consume it and update their own records. This is the outbound side
        (a subscribable event), separate from the GL export.
      </p>

      <div className="toolbar">
        <div className="f" style={{ minWidth: 200 }}>
          <label>Legal entity</label>
          <select value={String(entityId)} onChange={e => setEntityId(e.target.value === 'All' ? 'All' : Number(e.target.value))}>
            <option value="All">All entities</option>
            {data.legalEntities.map(e => <option key={e.id} value={e.id}>{e.ownerCode}</option>)}
          </select>
        </div>
        <div className="f" style={{ minWidth: 160 }}>
          <label>Status</label>
          <select value={status} onChange={e => setStatus(e.target.value as typeof status)}>
            <option value="All">All</option>
            <option value="Posted">Posted</option>
            <option value="AcceptedPending">Accepted · pending</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
      </div>

      <div className="grid-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th>Published</th><th>Entity</th><th>Event</th><th>Status</th><th>Journal</th>
              <th>Agreement</th><th>Lines</th><th>Invoice / ref</th><th>Correlation id</th>
              <th className="num">Debit</th><th className="num">Credit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(e => (
              <tr key={e.id}>
                <td className="muted" style={{ fontSize: 12 }}>{e.publishedAt}</td>
                <td>{e.entityCode}</td>
                <td>{e.accountingEvent}{e.reversesGli ? <span className="muted" style={{ fontSize: 11 }}> · reverses {e.reversesGli}</span> : ''}</td>
                <td>{statusPill(e.status)}</td>
                <td>{e.journalNumber != null
                  ? <DrillLink to={`/journals/gli/${e.journalNumber}`} label={`Journal ${gliLabel({ gliPrefix: e.gliPrefix, gliNumber: e.journalNumber })}`}>{gliLabel({ gliPrefix: e.gliPrefix, gliNumber: e.journalNumber })}</DrillLink>
                  : <span className="muted">—</span>}</td>
                <td>{e.agreement || <span className="muted">—</span>}</td>
                <td>{e.agreementLines.length ? e.agreementLines.join(', ') : <span className="muted">—</span>}</td>
                <td>{[...e.invoices, ...e.references].filter(Boolean).join(', ') || <span className="muted">—</span>}</td>
                <td className="muted" style={{ fontSize: 12 }}>{e.correlationId || '—'}</td>
                <td className="num">{formatAmount(e.totalDebit)}</td>
                <td className="num">{formatAmount(e.totalCredit)}{e.difference && <span className="badge-diff" style={{ marginLeft: 6 }}>diff</span>}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={11} className="empty">No events published yet — book a journal (send a message, run End of Month, credit an invoice…) and it appears here.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
