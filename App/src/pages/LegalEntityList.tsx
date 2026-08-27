import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore, copyCoaTemplate, nextCoaIdBase, toPartyRef } from '../store';
import { Breadcrumb, Dialog } from '../components/Chrome';
import { Icon } from '../components/Icon';
import { PartyPicker, PartyField } from '../components/PartyPicker';
import type { LegalEntity, Party, PartyKind } from '../types';

// Slides 6-7: legal entity list with expandable owner details and Add
export default function LegalEntityList() {
  const { data, update } = useStore();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<number[]>([]);
  const [showAdd, setShowAdd] = useState(false);

  const toggle = (id: number) =>
    setExpanded(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  return (
    <>
      <Breadcrumb />
      <div className="page">
        <div className="toolbar">
          <button className="btn" onClick={() => setShowAdd(true)}><Icon name="plus" size={14} /> Add</button>
        </div>
        <div className="grid-wrap">
          <table className="grid">
            <thead>
              <tr>
                <th style={{ width: 30 }} />
                <th>ID</th>
                <th>Name</th>
                <th>Description</th>
                <th>Owner</th>
                <th>Currency</th>
                <th>Revaluation</th>
                <th>Chart of Account</th>
                <th>End of month</th>
                <th>Closed Period</th>
                <th>Next journal</th>
                <th style={{ width: 40 }} />
              </tr>
            </thead>
            <tbody>
              {data.legalEntities.map(e => {
                const owner = data.parties.find(p => p.id === e.ownerPartyId);
                const currency = data.currencies.find(c => c.id === e.baseCurrencyId);
                const coa = data.chartOfAccounts.find(c => c.id === e.coaId);
                const open = expanded.includes(e.id);
                return (
                  <FragmentRow key={e.id}>
                    <tr className="clickable" onClick={() => navigate(`/legal-entity/${e.id}`)}>
                      <td>
                        <button className="expander" onClick={ev => { ev.stopPropagation(); toggle(e.id); }} title="Show owner details">
                          {open ? '−' : '+'}
                        </button>
                      </td>
                      <td>{e.id}</td>
                      <td>{e.name}</td>
                      <td>{e.description}</td>
                      <td>{e.ownerCode}</td>
                      <td>{currency?.code}</td>
                      <td>{e.revaluation ? 'Yes' : 'No'}</td>
                      <td>{coa?.name}</td>
                      <td>{e.endOfMonth.slice(0, 4)}-{e.endOfMonth.slice(4)}</td>
                      <td>{e.closedPeriod.slice(0, 4)}-{e.closedPeriod.slice(4)}</td>
                      <td>{e.nextGli}</td>
                      <td><span className="arrow-link"><Icon name="arrowRight" size={16} /></span></td>
                    </tr>
                    {open && owner && (
                      <tr className="detail-row">
                        <td />
                        <td colSpan={11}>
                          <div style={{ fontWeight: 700, textDecoration: 'underline', marginBottom: 8 }}>Owner</div>
                          <div className="field-grid" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
                            <div className="field"><label>Organization Number</label><div className="val">{owner.orgNumber}</div></div>
                            <div className="field"><label>Name</label><div className="val">{owner.fullName}</div></div>
                            <div className="field"><label>Registration Number</label><div className="val">{owner.orgNumber}</div></div>
                            <div className="field"><label>VAT Number</label><div className="val">—</div></div>
                            <div className="field"><label>Tax Country</label><div className="val">{owner.taxCountry}</div></div>
                            <div className="field"><label>Phone</label><div className="val">{owner.phone}</div></div>
                            <div className="field"><label>Address 1</label><div className="val">{owner.address1}</div></div>
                            <div className="field"><label>Address 2</label><div className="val">{owner.address2 || '—'}</div></div>
                            <div className="field"><label>Zip Code</label><div className="val">{owner.zip}</div></div>
                            <div className="field"><label>City</label><div className="val">{owner.city}</div></div>
                            <div className="field"><label>County/State</label><div className="val">{owner.countyState || '—'}</div></div>
                            <div className="field"><label>Email</label><div className="val">{owner.email}</div></div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </FragmentRow>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {showAdd && (
        <AddLegalEntityDialog
          onClose={() => setShowAdd(false)}
          onSave={entity => {
            update(d => {
              d.legalEntities.push(entity);
              // give the new entity its own copy of the selected chart-of-account template
              const base = nextCoaIdBase(d.entityCoaNodes);
              d.entityCoaNodes.push(...copyCoaTemplate(d.coaNodes, entity.coaId, entity.id, base));
            });
            setShowAdd(false);
          }}
        />
      )}
    </>
  );
}

function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function AddLegalEntityDialog({ onClose, onSave }: {
  onClose: () => void;
  onSave: (e: LegalEntity) => void;
}) {
  const { data } = useStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [owner, setOwner] = useState<Party | null>(null);
  const [responsible, setResponsible] = useState<Party | null>(null);
  const [controller, setController] = useState<Party | null>(null);
  const [currencyId, setCurrencyId] = useState(7);
  const [coaId, setCoaId] = useState(2);
  const [gliSerie, setGliSerie] = useState('1000');
  const [gliPrefix, setGliPrefix] = useState('');
  const [revaluation, setRevaluation] = useState(false);
  // Periods default from today: the current month is open, the previous month is the last closed
  // one, and no End of Month has run yet on a brand-new entity.
  const now = new Date();
  const curPeriod = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevPeriod = `${prev.getFullYear()}${String(prev.getMonth() + 1).padStart(2, '0')}`;
  const [openPeriod, setOpenPeriod] = useState(curPeriod);
  const [closedPeriod, setClosedPeriod] = useState(prevPeriod);
  // which party role the picker is open for (null = closed)
  const [picking, setPicking] = useState<null | { role: 'owner' | 'responsible' | 'controller'; kind: PartyKind }>(null);

  const canSave = name.trim().length > 0 && owner != null;

  const save = () => {
    if (!canSave || !owner) return;
    const nextId = Math.max(...data.legalEntities.map(e => e.id)) + 1;
    onSave({
      id: nextId, name: name.trim(), description: description.trim() || name.trim(),
      ownerPartyId: owner.id, ownerCode: owner.name,
      owner: toPartyRef(owner),
      responsiblePartyId: responsible?.id,
      responsibleRef: responsible ? toPartyRef(responsible) : undefined,
      controllerPartyId: controller?.id,
      controllerRef: controller ? toPartyRef(controller) : undefined,
      baseCurrencyId: currencyId, revaluation,
      gliNumberSerie: Number(gliSerie) || 1000, gliPrefix: gliPrefix.trim() || undefined,
      coaId, responsible: responsible?.fullName ?? '',
      endOfMonth: '', closedPeriod: closedPeriod.trim(), glInterfaceDate: '',
      openPeriod: openPeriod.trim() || curPeriod, journalDifferences: 0, nextGli: (Number(gliSerie) || 1000) + 1,
    });
  };

  const pickResult = (party: Party) => {
    if (picking?.role === 'owner') setOwner(party);
    else if (picking?.role === 'responsible') setResponsible(party);
    else if (picking?.role === 'controller') setController(party);
    setPicking(null);
  };

  return (
    <Dialog title="Add legal entity" onClose={onClose} footer={
      <>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={save} disabled={!canSave}>Save</button>
      </>
    }>
      <div className="form-grid">
        <div className="f full"><label>Name</label><input value={name} onChange={e => setName(e.target.value)} /></div>
        <div className="f full"><label>Description</label><input value={description} onChange={e => setDescription(e.target.value)} /></div>
        <PartyField
          label="Owner"
          required
          party={owner ? { name: owner.name, fullName: owner.fullName, reference: owner.orgNumber } : null}
          onPick={() => setPicking({ role: 'owner', kind: 'Organization' })}
        />
        <div className="f">
          <label>Base currency</label>
          <select value={currencyId} onChange={e => setCurrencyId(Number(e.target.value))}>
            {data.currencies.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
          </select>
        </div>
        <PartyField
          label="Responsible"
          party={responsible ? { name: responsible.name, fullName: responsible.fullName, reference: responsible.orgNumber } : null}
          onPick={() => setPicking({ role: 'responsible', kind: 'Person' })}
          onClear={() => setResponsible(null)}
        />
        <PartyField
          label="Controller"
          party={controller ? { name: controller.name, fullName: controller.fullName, reference: controller.orgNumber } : null}
          onPick={() => setPicking({ role: 'controller', kind: 'Person' })}
          onClear={() => setController(null)}
        />
        <div className="f">
          <label>Chart of account</label>
          <select value={coaId} onChange={e => setCoaId(Number(e.target.value))}>
            {data.chartOfAccounts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="f"><label>Journal number prefix <span className="muted" style={{ fontWeight: 400 }}>· e.g. 2026/</span></label><input value={gliPrefix} onChange={e => setGliPrefix(e.target.value)} placeholder="—" /></div>
        <div className="f">
          <label>Journal number serie</label>
          <input value={gliSerie} onChange={e => setGliSerie(e.target.value)} inputMode="numeric" />
          <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>next journal: {gliPrefix.trim()}{(Number(gliSerie) || 1000) + 1}</div>
        </div>
        <div className="f">
          <label>Open period <span className="muted" style={{ fontWeight: 400, fontSize: 11 }}>· current</span></label>
          <input value={openPeriod} onChange={e => setOpenPeriod(e.target.value)} placeholder="YYYYMM" inputMode="numeric" />
        </div>
        <div className="f">
          <label>Closed period <span className="muted" style={{ fontWeight: 400, fontSize: 11 }}>· last closed</span></label>
          <input value={closedPeriod} onChange={e => setClosedPeriod(e.target.value)} placeholder="YYYYMM" inputMode="numeric" />
          <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>End of Month is empty until the first run.</div>
        </div>
        <div className="f full">
          <label className="checkbox-inline">
            <input type="checkbox" checked={revaluation} onChange={e => setRevaluation(e.target.checked)} /> Revaluation
          </label>
        </div>
      </div>

      {picking && (
        <PartyPicker
          kind={picking.kind}
          title={picking.role === 'owner' ? 'Select owner organization' : `Select ${picking.role}`}
          onSelect={pickResult}
          onClose={() => setPicking(null)}
        />
      )}
    </Dialog>
  );
}
