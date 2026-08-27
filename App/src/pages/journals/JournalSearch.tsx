import { useState } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import { useStore } from '../../store';
import { gliLabel } from '../../engine';
import { useDrill } from '../../components/trail';
import { Icon } from '../../components/Icon';
import { SearchCombo, makeColumnSearch } from '../../components/Combo';

// Slides 39-40: GLI search with filters. Also mounts inside a legal entity (/legal-entity/:id/journals),
// where it's scoped to that entity and the Legal-entity picker is hidden — so single-entity customers
// can work from within their entity workspace.
export default function JournalSearch() {
  const { data } = useStore();
  const drill = useDrill();
  const [params] = useSearchParams();
  const { id: scopedId } = useParams(); // present when opened under a legal entity
  const scoped = !!scopedId;

  const [entityId, setEntityId] = useState(params.get('entity') ?? '');
  const effEntityId = scoped ? scopedId! : entityId;
  const [event, setEvent] = useState('');
  const [ledger, setLedger] = useState('');
  const [gli, setGli] = useState('');
  const [diffOnly, setDiffOnly] = useState(params.get('diff') === '1');
  const [unexportedOnly, setUnexportedOnly] = useState(params.get('unexported') === '1');
  const [bookedFrom, setBookedFrom] = useState('');
  const [bookedTo, setBookedTo] = useState('');

  const events = [...new Set(data.journals.map(j => j.accountingEvent))];
  const scopedJournals = data.journals.filter(j => !effEntityId || j.legalEntityId === Number(effEntityId));
  const searchGli = makeColumnSearch(() => scopedJournals.map(j => gliLabel(j)), v => {
    const j = scopedJournals.find(x => gliLabel(x) === v);
    return j ? `${j.accountingEvent} · ${j.bookingDate}` : undefined;
  });

  const rows = data.journals
    .filter(j => !effEntityId || j.legalEntityId === Number(effEntityId))
    .filter(j => !event || j.accountingEvent === event)
    .filter(j => !gli || String(j.gliNumber).includes(gli) || gliLabel(j).toLowerCase().includes(gli.toLowerCase()))
    .filter(j => !diffOnly || j.difference)
    .filter(j => !unexportedOnly || !j.exportDate)
    .filter(j => !bookedFrom || j.bookingDate >= bookedFrom)
    .filter(j => !bookedTo || j.bookingDate <= bookedTo)
    .filter(j => !ledger || j.lines.some(l => l.ledger === ledger));

  return (
    <div className="card">
      <div className="searchbar">
        {!scoped && (
          <div className="f">
            <label>Legal entity</label>
            <select value={entityId} onChange={e => setEntityId(e.target.value)}>
              <option value=""></option>
              {data.legalEntities.map(e => <option key={e.id} value={e.id}>{e.ownerCode} – {e.name}</option>)}
            </select>
          </div>
        )}
        <div className="f">
          <label>Accounting event</label>
          <select value={event} onChange={e => setEvent(e.target.value)}>
            <option value=""></option>
            {events.map(ev => <option key={ev} value={ev}>{ev}</option>)}
          </select>
        </div>
        <div className="f">
          <label>Accounting ledger</label>
          <select value={ledger} onChange={e => setLedger(e.target.value)}>
            <option value=""></option>
            <option>Local Legal</option>
            <option>US GAAP</option>
          </select>
        </div>
        <div className="f"><label>Journal number</label><SearchCombo value={gli} onChange={setGli} search={searchGli} placeholder="type to search…" /></div>
        <label className="checkbox-inline" style={{ alignSelf: 'center' }}>
          Difference only: <input type="checkbox" checked={diffOnly} onChange={e => setDiffOnly(e.target.checked)} />
        </label>
        <label className="checkbox-inline" style={{ alignSelf: 'center' }}>
          Unexported only: <input type="checkbox" checked={unexportedOnly} onChange={e => setUnexportedOnly(e.target.checked)} />
        </label>
        <div className="f"><label>Booking date from</label><input type="date" value={bookedFrom} onChange={e => setBookedFrom(e.target.value)} /></div>
        <div className="f"><label>Booking date to</label><input type="date" value={bookedTo} onChange={e => setBookedTo(e.target.value)} /></div>
        <div className="f"><label>Export date from</label><input type="date" /></div>
        <div className="f"><label>Export date to</label><input type="date" /></div>
        <button className="btn primary" style={{ alignSelf: 'center' }}><Icon name="search" size={14} /> Search</button>
      </div>

      <div className="grid-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th>Journal Number</th>
              <th>Accounting Event</th>
              <th className="num">Lines</th>
              <th>Booking Date</th>
              <th>Create Date</th>
              <th>Export Date</th>
              <th>Difference</th>
              <th>Legal entity</th>
              <th style={{ width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map(j => {
              const entity = data.legalEntities.find(e => e.id === j.legalEntityId);
              return (
                <tr key={j.gliNumber} className="clickable" onClick={() => drill(`/journals/gli/${j.gliNumber}`, `Journal ${gliLabel(j)}`)}>
                  <td style={{ color: 'var(--purple)', fontWeight: 600 }}>{gliLabel(j)}</td>
                  <td>{j.accountingEvent}</td>
                  <td className="num">{j.lineCount}</td>
                  <td>{j.bookingDate}</td>
                  <td>{j.createDate}</td>
                  <td>{j.exportDate ?? ''}</td>
                  <td>{j.difference ? <span className="badge-yes">Yes</span> : ''}</td>
                  <td>{entity?.ownerCode}</td>
                  <td><span className="arrow-link"><Icon name="arrowRight" size={16} /></span></td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={9} className="empty">No journals match the search.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
