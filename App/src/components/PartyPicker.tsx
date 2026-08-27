import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { Dialog } from './Chrome';
import { Icon } from './Icon';
import type { Party, PartyKind } from '../types';

// Picks an existing party from the party directory (the Interested Party domain
// stand-in). By design there is no "create" here — a party must already exist in the
// directory before it can be assigned. If it is missing, it is created in the party
// domain first, then it becomes selectable.
export function PartyPicker({ kind, title, onSelect, onClose }: {
  kind: PartyKind;
  title: string;
  onSelect: (party: Party) => void;
  onClose: () => void;
}) {
  const { data } = useStore();
  const [filter, setFilter] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const candidates = useMemo(
    () => data.parties.filter(p => p.kind === kind),
    [data.parties, kind],
  );
  const rows = candidates.filter(p =>
    !filter ||
    p.name.toLowerCase().includes(filter.toLowerCase()) ||
    p.fullName.toLowerCase().includes(filter.toLowerCase()) ||
    p.orgNumber.toLowerCase().includes(filter.toLowerCase()),
  );

  const confirm = () => {
    const party = candidates.find(p => p.id === selectedId);
    if (party) onSelect(party);
  };

  return (
    <Dialog title={title} onClose={onClose} footer={
      <>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={selectedId == null} onClick={confirm}>Select</button>
      </>
    }>
      <p className="muted" style={{ marginTop: 0, fontSize: 12.5 }}>
        Choose from the party directory ({kind === 'Organization' ? 'organizations' : 'persons'}).
        Parties are maintained in the Interested Party domain — create missing ones there first,
        then they appear here.
      </p>
      <div className="f" style={{ marginBottom: 10 }}>
        <input autoFocus placeholder="Search name or reference…" value={filter} onChange={e => setFilter(e.target.value)} />
      </div>
      <div className="grid-wrap" style={{ maxHeight: 320, boxShadow: 'none' }}>
        <table className="grid">
          <thead>
            <tr><th style={{ width: 30 }} /><th>{kind === 'Organization' ? 'Code' : 'Name'}</th><th>Full name</th><th>Reference</th><th>City</th></tr>
          </thead>
          <tbody>
            {rows.map(p => (
              <tr key={p.id} className="clickable" onClick={() => setSelectedId(p.id)}>
                <td>
                  <input type="radio" checked={selectedId === p.id} readOnly />
                </td>
                <td style={{ fontWeight: 600 }}>{p.name}</td>
                <td>{p.fullName}</td>
                <td>{p.orgNumber}</td>
                <td>{p.city}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="empty">
                No matching {kind === 'Organization' ? 'organization' : 'person'} in the directory —
                create it in the Interested Party domain first.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Dialog>
  );
}

// A compact display of a selected party (or an empty "choose" affordance) used on forms.
export function PartyField({ label, party, onPick, onClear, required }: {
  label: string;
  party?: { name: string; fullName: string; reference: string } | null;
  onPick: () => void;
  onClear?: () => void;
  required?: boolean;
}) {
  return (
    <div className="f">
      <label>{label}{required && <span style={{ color: 'var(--red)' }}> *</span>}</label>
      {party ? (
        <div className="party-chip">
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>{party.name}</div>
            <div className="muted" style={{ fontSize: 11.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {party.fullName}{party.reference ? ` · #${party.reference}` : ''}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 2, marginLeft: 'auto' }}>
            <button className="icon-btn" title="Change" onClick={onPick}><Icon name="pencil" size={13} /></button>
            {onClear && <button className="icon-btn del" title="Clear" onClick={onClear}><Icon name="x" size={14} /></button>}
          </div>
        </div>
      ) : (
        <button className="btn" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={onPick}>
          <Icon name="search" size={14} /> Select from directory…
        </button>
      )}
    </div>
  );
}
