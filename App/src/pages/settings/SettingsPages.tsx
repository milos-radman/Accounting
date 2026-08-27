import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useStore } from '../../store';
import { Dialog } from '../../components/Chrome';
import { Icon } from '../../components/Icon';
import { extValueDataTypes, dimensionSources, postingModes } from '../../types';
import type {
  CoaNode, ExtValueDataType, DimensionSource, PostingMode, AmountGroup,
  AccountingClass, AmountType, Currency, Ledger, AccountingEvent, ConditionValueOption,
} from '../../types';

const sourceLabel: Record<DimensionSource, string> = {
  PseudoAccount: 'Pseudo account',
  Message: 'Message',
  AccountValuesList: 'AccountValues-List',
};

const amountGroups: AmountGroup[] = ['Message', 'Accrual', 'Monthly'];
const nextId = (arr: { id: number }[]) => Math.max(0, ...arr.map(x => x.id)) + 1;
const fieldStyle = { border: '1px solid var(--line-strong)', borderRadius: 7, padding: '6px 9px', fontSize: 13, background: 'var(--card)', width: '100%' } as const;

// A pencil button that opens the edit dialog for a row.
function EditButton({ onEdit, label }: { onEdit: () => void; label: string }) {
  return (
    <button className="icon-btn" title={`Edit ${label}`} onClick={onEdit}>
      <Icon name="pencil" size={13} />
    </button>
  );
}

// A trash button that refuses to delete when the item is still referenced ("connected").
function RemoveButton({ reasons, onRemove, label }: { reasons: string[]; onRemove: () => void; label: string }) {
  const blocked = reasons.length > 0;
  return (
    <button
      className="icon-btn del"
      disabled={blocked}
      title={blocked ? `Can’t remove — ${reasons.join('; ')}` : `Remove ${label}`}
      onClick={() => { if (!blocked && window.confirm(`Remove ${label}?`)) onRemove(); }}
    >
      <Icon name="trash" size={14} />
    </button>
  );
}

// Header with an Add button, used by each maintainable settings list.
function ListHeader({ title, children, onAdd }: { title: string; children?: ReactNode; onAdd: () => void }) {
  return (
    <div className="pagelike-title" style={{ display: 'flex', alignItems: 'center' }}>
      {title}
      {children}
      <span style={{ flex: 1 }} />
      <button className="btn primary small" onClick={onAdd}><Icon name="plus" size={13} /> Add</button>
    </div>
  );
}

// Reset the whole prototype back to the seeded demo data. This app keeps every change in the
// browser (localStorage); this is the one-click way to discard those and reload the fresh seed —
// e.g. after a data-model change. reset() rebuilds in place, so no page refresh is needed.
export function ResetDataSettings() {
  const { reset } = useStore();
  const [done, setDone] = useState(false);
  const doReset = () => {
    if (window.confirm('Reset all demo data to the seeded defaults?\n\nEverything you added or changed in this browser — pseudo accounts, formulas & conditions, attribute codes, and any simulated / posted journals — will be discarded.')) {
      reset();
      setDone(true);
    }
  };
  return (
    <div>
      <div className="pagelike-title">Reset data</div>
      <div className="card" style={{ maxWidth: 640 }}>
        <p className="muted" style={{ marginTop: 0 }}>
          This prototype stores everything you do in the browser (localStorage). Resetting discards
          those changes and rebuilds the app from the seeded demo data — handy after a data-model
          change or to start from a clean, known state.
        </p>
        <p className="muted">
          <b>Discarded:</b> anything you added or edited here — pseudo accounts, formulas &amp;
          conditions, attribute codes, currencies/ledgers, and simulated or posted journals.{' '}
          <b>Result:</b> the fresh seed, exactly as a first-time load.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10 }}>
          <button className="btn primary" onClick={doReset}><Icon name="swap" size={14} /> Reset demo data</button>
          {done && <span style={{ color: '#1a7f37', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="check" size={13} /> Reset to seed defaults.</span>}
        </div>
      </div>
    </div>
  );
}

export function AccountingClassSettings() {
  const { data, update } = useStore();
  const [dialog, setDialog] = useState<AccountingClass | 'new' | null>(null);
  return (
    <div>
      <ListHeader title="Accounting Class" onAdd={() => setDialog('new')} />
      <div className="grid-wrap" style={{ maxWidth: 760 }}>
        <table className="grid">
          <thead><tr><th>ID</th><th>Code</th><th>Name</th><th>Description</th><th>Used by</th><th style={{ width: 40 }} /></tr></thead>
          <tbody>
            {data.accountingClasses.map(c => {
              const usedBy = data.legalAccountingClasses
                .filter(l => l.accountingClassId === c.id)
                .map(l => data.legalEntities.find(e => e.id === l.legalEntityId)?.ownerCode)
                .filter(Boolean) as string[];
              const reasons = usedBy.length ? [`assigned to ${usedBy.length} legal entit${usedBy.length === 1 ? 'y' : 'ies'}`] : [];
              return (
                <tr key={c.id}>
                  <td>{c.id}</td>
                  <td>{c.code}</td>
                  <td style={{ fontWeight: 600 }}>{c.name}</td>
                  <td>{c.description}</td>
                  <td>{usedBy.join(', ') || '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <EditButton label={`class ${c.code}`} onEdit={() => setDialog(c)} />
                    <RemoveButton label={`class ${c.code}`} reasons={reasons} onRemove={() => update(d => { d.accountingClasses = d.accountingClasses.filter(x => x.id !== c.id); })} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {dialog && <AccountingClassDialog item={dialog === 'new' ? undefined : dialog} onClose={() => setDialog(null)} />}
    </div>
  );
}

function AccountingClassDialog({ item, onClose }: { item?: AccountingClass; onClose: () => void }) {
  const { update } = useStore();
  const [code, setCode] = useState(item?.code ?? '');
  const [name, setName] = useState(item?.name ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const save = () => {
    if (!code.trim() || !name.trim()) return;
    update(d => {
      if (item) {
        const r = d.accountingClasses.find(x => x.id === item.id);
        if (r) { r.code = code.trim(); r.name = name.trim(); r.description = description.trim(); }
      } else {
        d.accountingClasses.push({ id: nextId(d.accountingClasses), code: code.trim(), name: name.trim(), description: description.trim() });
      }
    });
    onClose();
  };
  return (
    <Dialog title={item ? `Edit accounting class ${item.code}` : 'Add accounting class'} onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!code.trim() || !name.trim()} onClick={save}>Save</button></>}>
      <div className="form-grid">
        <div className="f"><label>Code</label><input value={code} onChange={e => setCode(e.target.value)} placeholder="e.g. CLA-Admin" /></div>
        <div className="f"><label>Name</label><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. CLA-Administration" /></div>
        <div className="f full"><label>Description</label><input value={description} onChange={e => setDescription(e.target.value)} /></div>
      </div>
      {!item && <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>Assign the class (and its ledgers) to a legal entity from the entity’s setup.</p>}
    </Dialog>
  );
}

export function AmountTypeSettings() {
  const { data, update } = useStore();
  const [filter, setFilter] = useState('');
  const [dialog, setDialog] = useState<AmountType | 'new' | null>(null);
  const rows = data.amountTypes.filter(a =>
    !filter || a.name.toLowerCase().includes(filter.toLowerCase()) || a.description.toLowerCase().includes(filter.toLowerCase()),
  );
  return (
    <div>
      <ListHeader title="Amount types" onAdd={() => setDialog('new')} />
      <p className="muted" style={{ maxWidth: 640, marginTop: -6 }}>
        Base values that can be used in formulas and retrieved from event messages.
        New amount types can be added both by Tieto and by external parties.
      </p>
      <div className="toolbar">
        <input placeholder="Filter…" value={filter} onChange={e => setFilter(e.target.value)}
          style={{ border: '1px solid var(--grey-line)', borderRadius: 4, padding: '6px 10px' }} />
        <div className="spacer" />
      </div>
      <div className="grid-wrap" style={{ maxWidth: 960 }}>
        <table className="grid">
          <thead><tr><th>ID</th><th>Name</th><th>Description</th><th style={{ width: 130 }}>Group</th><th style={{ width: 40 }} /></tr></thead>
          <tbody>
            {rows.map(a => {
              const usedByFormulas = data.formulas.filter(f => f.amountTypeId === a.id).length;
              const usedByAccruals = data.accrualCodes.filter(c => c.triggerAmountTypeId === a.id).length;
              const reasons = [
                usedByFormulas ? `used by ${usedByFormulas} formula${usedByFormulas === 1 ? '' : 's'}` : '',
                usedByAccruals ? `triggers ${usedByAccruals} accrual code${usedByAccruals === 1 ? '' : 's'}` : '',
              ].filter(Boolean);
              return (
                <tr key={a.id}>
                  <td>{a.id}</td>
                  <td style={{ fontWeight: 600 }}>{a.name}</td>
                  <td>{a.description}</td>
                  <td>
                    <select value={a.amountGroup} onChange={e => update(d => { const r = d.amountTypes.find(x => x.id === a.id); if (r) r.amountGroup = e.target.value as AmountGroup; })} style={fieldStyle}>
                      {amountGroups.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                    {a.allowsMultipleCodes && <span className="pill" style={{ marginLeft: 6 }}>multi-code</span>}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <EditButton label={`amount type ${a.name}`} onEdit={() => setDialog(a)} />
                    <RemoveButton label={`amount type ${a.name}`} reasons={reasons} onRemove={() => update(d => { d.amountTypes = d.amountTypes.filter(x => x.id !== a.id); })} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {dialog && <AmountTypeDialog item={dialog === 'new' ? undefined : dialog} onClose={() => setDialog(null)} />}
    </div>
  );
}

function AmountTypeDialog({ item, onClose }: { item?: AmountType; onClose: () => void }) {
  const { update } = useStore();
  const [name, setName] = useState(item?.name ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [amountGroup, setAmountGroup] = useState<AmountGroup>(item?.amountGroup ?? 'Message');
  const [allowsMultipleCodes, setAllowsMultipleCodes] = useState(item?.allowsMultipleCodes ?? false);
  const save = () => {
    if (!name.trim()) return;
    update(d => {
      if (item) {
        const r = d.amountTypes.find(x => x.id === item.id);
        if (r) { r.name = name.trim(); r.description = description.trim(); r.amountGroup = amountGroup; r.allowsMultipleCodes = allowsMultipleCodes; }
      } else {
        d.amountTypes.push({ id: nextId(d.amountTypes), name: name.trim(), description: description.trim(), amountGroup, allowsMultipleCodes });
      }
    });
    onClose();
  };
  return (
    <Dialog title={item ? `Edit amount type ${item.id}` : 'Add amount type'} onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!name.trim()} onClick={save}>Save</button></>}>
      <div className="form-grid">
        <div className="f"><label>Name</label><input value={name} onChange={e => setName(e.target.value)} /></div>
        <div className="f"><label>Group</label><select value={amountGroup} onChange={e => setAmountGroup(e.target.value as AmountGroup)} style={fieldStyle}>{amountGroups.map(g => <option key={g} value={g}>{g}</option>)}</select></div>
        <div className="f full"><label>Description</label><input value={description} onChange={e => setDescription(e.target.value)} /></div>
        <div className="f full">
          <label className="checkbox-inline">
            <input type="checkbox" checked={allowsMultipleCodes} onChange={e => setAllowsMultipleCodes(e.target.checked)} />
            Allows multiple amount codes <span className="muted" style={{ fontWeight: 400 }}>· one message can carry several of this type, one per amount code (e.g. Added Cost)</span>
          </label>
        </div>
      </div>
    </Dialog>
  );
}

const REPORTING_CURRENCY = 'EUR';

export function CurrencySettings() {
  const { data, update } = useStore();
  const [dialog, setDialog] = useState<Currency | 'new' | null>(null);
  return (
    <div>
      <ListHeader title="Currencies" onAdd={() => setDialog('new')} />
      <p className="muted" style={{ maxWidth: 720, marginTop: -6 }}>
        Each legal entity keeps its accounting in a <b>base currency</b>. The rate below is the value of
        1 unit of the currency in the reporting currency (<b>{REPORTING_CURRENCY}</b> = 1). A transaction in
        currency C is converted to an entity’s base currency B as <b>amount × rate[C] ÷ rate[B]</b>, so the
        same table serves entities with different base currencies.
      </p>
      <div className="grid-wrap" style={{ maxWidth: 700 }}>
        <table className="grid">
          <thead>
            <tr><th>ID</th><th>Code</th><th>Name</th><th className="num" style={{ width: 170 }}>Rate ({REPORTING_CURRENCY} per 1 unit)</th><th style={{ width: 120 }}>As of</th><th style={{ width: 40 }} /></tr>
          </thead>
          <tbody>
            {data.currencies.map(c => {
              const isReporting = c.code === REPORTING_CURRENCY;
              const baseOf = data.legalEntities.filter(e => e.baseCurrencyId === c.id).length;
              const inJournals = data.journals.some(j => j.lines.some(l => l.currency.toUpperCase() === c.code.toUpperCase()));
              const reasons = [
                isReporting ? 'the reporting currency' : '',
                baseOf ? `base currency of ${baseOf} entit${baseOf === 1 ? 'y' : 'ies'}` : '',
                inJournals ? 'used in journals' : '',
              ].filter(Boolean);
              return (
                <tr key={c.id}>
                  <td>{c.id}</td>
                  <td style={{ fontWeight: 600 }}>
                    {c.code}
                    {isReporting && <span className="pill" style={{ marginLeft: 6 }}>reporting</span>}
                  </td>
                  <td>{c.name}</td>
                  <td className="num" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    <span className={isReporting ? 'muted' : undefined}>{c.rate.toFixed(6)}</span>
                  </td>
                  <td className="muted" style={{ fontSize: 12 }}>{isReporting ? '—' : (c.asOf ?? '—')}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <EditButton label={`currency ${c.code}`} onEdit={() => setDialog(c)} />
                    <RemoveButton label={`currency ${c.code}`} reasons={reasons} onRemove={() => update(d => { d.currencies = d.currencies.filter(x => x.id !== c.id); })} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {dialog && <CurrencyDialog item={dialog === 'new' ? undefined : dialog} onClose={() => setDialog(null)} />}
    </div>
  );
}

function CurrencyDialog({ item, onClose }: { item?: Currency; onClose: () => void }) {
  const { data, update } = useStore();
  const isReporting = item?.code === REPORTING_CURRENCY;
  const [code, setCode] = useState(item?.code ?? '');
  const [name, setName] = useState(item?.name ?? '');
  const [rate, setRate] = useState(item ? String(item.rate) : '1');
  const dup = data.currencies.some(c => c.id !== item?.id && c.code.toUpperCase() === code.trim().toUpperCase());
  const rateNum = Number(rate.replace(',', '.'));
  const valid = code.trim().length > 0 && !dup && rateNum > 0;
  const save = () => {
    if (!valid) return;
    update(d => {
      if (item) {
        const r = d.currencies.find(x => x.id === item.id);
        if (r) { r.code = code.trim().toUpperCase(); r.name = name.trim() || r.code; if (!isReporting) { r.rate = rateNum; r.asOf = new Date().toISOString().slice(0, 10); } }
      } else {
        d.currencies.push({ id: nextId(d.currencies), code: code.trim().toUpperCase(), name: name.trim() || code.trim().toUpperCase(), rate: rateNum, asOf: new Date().toISOString().slice(0, 10) });
      }
    });
    onClose();
  };
  return (
    <Dialog title={item ? `Edit currency ${item.code}` : 'Add currency'} onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!valid} onClick={save}>Save</button></>}>
      <div className="form-grid">
        <div className="f"><label>Code</label><input value={code} onChange={e => setCode(e.target.value)} placeholder="e.g. CHF" maxLength={3} disabled={isReporting} /></div>
        <div className="f"><label>Rate ({REPORTING_CURRENCY} per 1 unit)</label><input value={rate} onChange={e => setRate(e.target.value)} style={{ textAlign: 'right' }} disabled={isReporting} /></div>
        <div className="f full"><label>Name</label><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Swiss Franc" /></div>
      </div>
      {dup && <p className="badge-diff" style={{ display: 'inline-block', marginTop: 10, fontSize: 12 }}>A currency with this code already exists.</p>}
      {isReporting && <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>The reporting currency’s code and rate are fixed at 1.</p>}
    </Dialog>
  );
}

export function LedgerSettings() {
  const { data, update } = useStore();
  const [dialog, setDialog] = useState<Ledger | 'new' | null>(null);
  return (
    <div>
      <ListHeader title="Ledgers" onAdd={() => setDialog('new')} />
      <div className="grid-wrap" style={{ maxWidth: 620 }}>
        <table className="grid">
          <thead><tr><th>ID</th><th>Code</th><th>Name</th><th>Description</th><th style={{ width: 40 }} /></tr></thead>
          <tbody>
            {data.ledgers.map(l => {
              const usedBy = data.legalAccountingLedgers.filter(x => x.ledgerId === l.id).length;
              const reasons = usedBy ? [`assigned to ${usedBy} accounting-class ledger${usedBy === 1 ? '' : 's'}`] : [];
              return (
                <tr key={l.id}>
                  <td>{l.id}</td><td>{l.code}</td><td style={{ fontWeight: 600 }}>{l.name}</td><td>{l.description}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <EditButton label={`ledger ${l.name}`} onEdit={() => setDialog(l)} />
                    <RemoveButton label={`ledger ${l.name}`} reasons={reasons} onRemove={() => update(d => { d.ledgers = d.ledgers.filter(x => x.id !== l.id); })} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {dialog && <LedgerDialog item={dialog === 'new' ? undefined : dialog} onClose={() => setDialog(null)} />}
      <div className="pagelike-title" style={{ marginTop: 24 }}>Ledger assignment per legal entity</div>
      <div className="grid-wrap" style={{ maxWidth: 700 }}>
        <table className="grid">
          <thead><tr><th>Legal entity</th><th>Accounting class</th><th>Ledger</th></tr></thead>
          <tbody>
            {data.legalAccountingLedgers.map(lal => {
              const lac = data.legalAccountingClasses.find(c => c.id === lal.legalAccountingClassId);
              const entity = data.legalEntities.find(e => e.id === lac?.legalEntityId);
              const cls = data.accountingClasses.find(c => c.id === lac?.accountingClassId);
              const ledger = data.ledgers.find(l => l.id === lal.ledgerId);
              return (
                <tr key={lal.id}>
                  <td>{entity?.ownerCode}</td>
                  <td>{cls?.name}</td>
                  <td>{ledger?.description}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LedgerDialog({ item, onClose }: { item?: Ledger; onClose: () => void }) {
  const { update } = useStore();
  const [code, setCode] = useState(item?.code ?? '');
  const [name, setName] = useState(item?.name ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const save = () => {
    if (!code.trim() || !name.trim()) return;
    update(d => {
      if (item) {
        const r = d.ledgers.find(x => x.id === item.id);
        if (r) { r.code = code.trim(); r.name = name.trim(); r.description = description.trim(); }
      } else {
        d.ledgers.push({ id: nextId(d.ledgers), code: code.trim(), name: name.trim(), description: description.trim() });
      }
    });
    onClose();
  };
  return (
    <Dialog title={item ? `Edit ledger ${item.name}` : 'Add ledger'} onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!code.trim() || !name.trim()} onClick={save}>Save</button></>}>
      <div className="form-grid">
        <div className="f"><label>Code</label><input value={code} onChange={e => setCode(e.target.value)} placeholder="e.g. 3" /></div>
        <div className="f"><label>Name</label><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. IFRS" /></div>
        <div className="f full"><label>Description</label><input value={description} onChange={e => setDescription(e.target.value)} /></div>
      </div>
    </Dialog>
  );
}

export function CoaSettings() {
  const { data } = useStore();
  const [coaId, setCoaId] = useState(2);
  const nodes = useMemo(() => data.coaNodes.filter(n => n.coaId === coaId), [data.coaNodes, coaId]);
  const childrenOf = (parentId: number | null) => nodes.filter(n => (n.parentId ?? null) === parentId);

  const renderNode = (node: CoaNode): React.ReactNode => (
    <div key={node.id} style={{ marginLeft: node.depth * 22 }}>
      <div className="node">
        <span className="toggle" />
        <span className="ord">{node.order}</span>
        <span style={{ fontWeight: node.depth === 0 ? 700 : node.depth === 1 ? 600 : 400 }}>{node.name}</span>
        {node.description && <span className="desc">{node.description}</span>}
      </div>
      {childrenOf(node.id).map(renderNode)}
    </div>
  );

  return (
    <div>
      <div className="pagelike-title">Chart of account templates</div>
      <div className="f" style={{ maxWidth: 320, marginBottom: 14 }}>
        <label>Template</label>
        <select value={coaId} onChange={e => setCoaId(Number(e.target.value))}>
          {data.chartOfAccounts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="card tree">
        {nodes.length === 0 && <div className="empty">No template rows defined for this chart of account.</div>}
        {childrenOf(null).map(renderNode)}
      </div>
    </div>
  );
}

export function ExtAccountValueSettings() {
  const { data, update } = useStore();
  return (
    <div>
      <div className="pagelike-title">External account values</div>
      <p className="muted" style={{ maxWidth: 720 }}>
        Base records from the contract domain that can be used in the external account string
        sent to an external General Ledger. The data type tells the ledger how to interpret the
        dimension; the <b>source</b> tells the domain where to read the value from when building
        the account string — the pseudo account, a field on the message, or the AccountValues list
        carried with the message. This mapping is configurable per customer setup.
      </p>
      <div className="grid-wrap" style={{ maxWidth: 820 }}>
        <table className="grid">
          <thead><tr><th>ID</th><th>Name</th><th>Level</th><th style={{ width: 150 }}>Data type</th><th style={{ width: 180 }}>Source</th></tr></thead>
          <tbody>
            {data.extAccountValues.map(v => {
              const selectStyle = {
                border: '1px solid var(--line-strong)', borderRadius: 7,
                padding: '4px 8px', fontSize: 12.5, background: 'var(--card)', width: '100%',
              } as const;
              return (
                <tr key={v.id}>
                  <td>{v.id}</td>
                  <td style={{ fontWeight: v.name === 'Account' ? 600 : 400 }}>{v.name}</td>
                  <td>{v.level}</td>
                  <td>
                    <select
                      value={v.dataType}
                      onChange={e => update(d => {
                        const row = d.extAccountValues.find(x => x.id === v.id);
                        if (row) row.dataType = e.target.value as ExtValueDataType;
                      })}
                      style={selectStyle}
                    >
                      {extValueDataTypes.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </td>
                  <td>
                    <select
                      value={v.source}
                      onChange={e => update(d => {
                        const row = d.extAccountValues.find(x => x.id === v.id);
                        if (row) row.source = e.target.value as DimensionSource;
                      })}
                      style={selectStyle}
                    >
                      {dimensionSources.map(s => <option key={s} value={s}>{sourceLabel[s]}</option>)}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AccountingEventSettings() {
  const { data, update } = useStore();
  const [dialog, setDialog] = useState<AccountingEvent | 'new' | null>(null);
  return (
    <div>
      <ListHeader title="Accounting events" onAdd={() => setDialog('new')} />
      <p className="muted" style={{ maxWidth: 720, marginTop: -6 }}>
        The <b>posting</b> column controls when an event books. <b>Immediate</b> events are booked
        as the message arrives; <b>End of Month</b> events (e.g. Monthly Booking) are held Pending
        and released by the entity’s End of Month run, so the accountant controls the timing.
      </p>
      <div className="grid-wrap" style={{ maxWidth: 1080 }}>
        <table className="grid">
          <thead>
            <tr><th>ID</th><th>Name</th><th>Description</th><th>Code</th><th>Category</th><th>Reverses</th><th style={{ width: 150 }}>Posting</th><th style={{ width: 160 }}>Booking date</th><th style={{ width: 40 }} /></tr>
          </thead>
          <tbody>
            {data.accountingEvents.map(ev => {
              const cat = data.eventCategories.find(c => c.id === ev.eventCategoryId);
              const orig = ev.originalEventId ? data.accountingEvents.find(o => o.id === ev.originalEventId) : null;
              const inRules = data.accountingRules.filter(r => r.accountingEventId === ev.id).length;
              const reversedBy = data.accountingEvents.filter(o => o.originalEventId === ev.id).length;
              const inJournals = data.journals.some(j => j.accountingEvent === ev.name);
              const reasons = [
                inRules ? `used in ${inRules} accounting rule${inRules === 1 ? '' : 's'}` : '',
                reversedBy ? 'reversed by another event' : '',
                inJournals ? 'used in journals' : '',
              ].filter(Boolean);
              return (
                <tr key={ev.id}>
                  <td>{ev.id}</td>
                  <td style={{ fontWeight: 600 }}>{ev.name}</td>
                  <td>{ev.description}</td>
                  <td>{ev.code}</td>
                  <td>{cat?.name === 'Reversal' ? <span className="pill inactive">Reversal</span> : <span className="pill">Normal</span>}</td>
                  <td>{orig?.name ?? ''}</td>
                  <td>
                    <select
                      value={ev.postingMode}
                      onChange={e => update(d => {
                        const row = d.accountingEvents.find(x => x.id === ev.id);
                        if (row) row.postingMode = e.target.value as PostingMode;
                      })}
                      style={fieldStyle}
                    >
                      {postingModes.map(m => <option key={m} value={m}>{m === 'EndOfMonth' ? 'End of Month' : m}</option>)}
                    </select>
                  </td>
                  <td>
                    <select
                      value={ev.bookingDate}
                      onChange={e => update(d => {
                        const row = d.accountingEvents.find(x => x.id === ev.id);
                        if (row) row.bookingDate = Number(e.target.value);
                      })}
                      style={fieldStyle}
                    >
                      <option value={0}>Calculation Date</option>
                      <option value={1}>Event Date</option>
                    </select>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <EditButton label={`event ${ev.name}`} onEdit={() => setDialog(ev)} />
                    <RemoveButton label={`event ${ev.name}`} reasons={reasons} onRemove={() => update(d => { d.accountingEvents = d.accountingEvents.filter(x => x.id !== ev.id); })} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {dialog && <AccountingEventDialog item={dialog === 'new' ? undefined : dialog} onClose={() => setDialog(null)} />}
    </div>
  );
}

function AccountingEventDialog({ item, onClose }: { item?: AccountingEvent; onClose: () => void }) {
  const { data, update } = useStore();
  const [name, setName] = useState(item?.name ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [code, setCode] = useState(item?.code ?? '');
  const [categoryId, setCategoryId] = useState(item?.eventCategoryId ?? data.eventCategories[0]?.id ?? 1);
  const [postingMode, setPostingMode] = useState<PostingMode>(item?.postingMode ?? 'Immediate');
  const [bookingBasis, setBookingBasis] = useState<number>(item?.bookingDate ?? 1);
  const save = () => {
    if (!name.trim()) return;
    update(d => {
      if (item) {
        const r = d.accountingEvents.find(x => x.id === item.id);
        if (r) { r.name = name.trim(); r.description = description.trim(); r.code = code.trim(); r.eventCategoryId = categoryId; r.postingMode = postingMode; r.bookingDate = bookingBasis; }
      } else {
        d.accountingEvents.push({ id: nextId(d.accountingEvents), name: name.trim(), description: description.trim(), code: code.trim(), bookingDate: bookingBasis, eventCategoryId: categoryId, originalEventId: null, postingMode });
      }
    });
    onClose();
  };
  return (
    <Dialog title={item ? `Edit accounting event ${item.id}` : 'Add accounting event'} onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!name.trim()} onClick={save}>Save</button></>}>
      <div className="form-grid">
        <div className="f"><label>Name</label><input value={name} onChange={e => setName(e.target.value)} /></div>
        <div className="f"><label>Code</label><input value={code} onChange={e => setCode(e.target.value)} placeholder="short code" /></div>
        <div className="f"><label>Category</label><select value={categoryId} onChange={e => setCategoryId(Number(e.target.value))} style={fieldStyle}>{data.eventCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div className="f"><label>Posting</label><select value={postingMode} onChange={e => setPostingMode(e.target.value as PostingMode)} style={fieldStyle}>{postingModes.map(m => <option key={m} value={m}>{m === 'EndOfMonth' ? 'End of Month' : m}</option>)}</select></div>
        <div className="f"><label>Booking date basis</label><select value={bookingBasis} onChange={e => setBookingBasis(Number(e.target.value))} style={fieldStyle}><option value={0}>Calculation Date</option><option value={1}>Event Date</option></select></div>
        <div className="f full"><label>Description</label><input value={description} onChange={e => setDescription(e.target.value)} /></div>
      </div>
    </Dialog>
  );
}

// ---- Message attribute codes (allowed values per condition value) ----------------------------
// Define the codes (+ descriptions) a message attribute can carry: Amount Code, Payment Method, Term
// Reason, … The CODE is what the message sends / a condition matches on; the description is shown in
// pickers. One list serves every attribute.
export function AttributeCodeSettings() {
  const { data, update } = useStore();
  const [cvId, setCvId] = useState<number>(18); // default: Amount Code
  const [dialog, setDialog] = useState<ConditionValueOption | 'new' | null>(null);
  const options = (data.conditionValueOptions ?? []).filter(o => o.conditionValueId === cvId);
  const attrName = data.conditionValues.find(v => v.id === cvId)?.name ?? '';

  return (
    <div>
      <ListHeader title="Message attribute codes" onAdd={() => setDialog('new')}>
        <select value={cvId} onChange={e => setCvId(Number(e.target.value))} style={{ ...fieldStyle, width: 'auto', marginLeft: 14 }}>
          {data.conditionValues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </ListHeader>
      <p className="muted" style={{ fontSize: 12, marginTop: -4, maxWidth: 640 }}>
        The <b>code</b> is what the message carries and what a condition matches on; the <b>description</b> is shown
        beside it in the message simulator and formula-condition pickers. Values here feed <b>{attrName}</b>.
      </p>
      <div className="grid-wrap" style={{ maxWidth: 620 }}>
        <table className="grid">
          <thead><tr><th style={{ width: 160 }}>Code</th><th>Description</th><th style={{ width: 80 }} /></tr></thead>
          <tbody>
            {options.map(o => (
              <tr key={o.id}>
                <td style={{ fontWeight: 600 }}>{o.code}</td>
                <td>{o.description}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <EditButton onEdit={() => setDialog(o)} label={o.code} />
                  <RemoveButton reasons={[]} onRemove={() => update(d => { d.conditionValueOptions = (d.conditionValueOptions ?? []).filter(x => x.id !== o.id); })} label={o.code} />
                </td>
              </tr>
            ))}
            {options.length === 0 && <tr><td colSpan={3} className="empty">No codes for {attrName} yet — add one.</td></tr>}
          </tbody>
        </table>
      </div>
      {dialog && <AttributeCodeDialog cvId={cvId} attrName={attrName} existing={dialog === 'new' ? undefined : dialog} onClose={() => setDialog(null)} />}
    </div>
  );
}

function AttributeCodeDialog({ cvId, attrName, existing, onClose }: { cvId: number; attrName: string; existing?: ConditionValueOption; onClose: () => void }) {
  const { update } = useStore();
  const [code, setCode] = useState(existing?.code ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const save = () => {
    if (!code.trim()) return;
    update(d => {
      d.conditionValueOptions ??= [];
      if (existing) {
        const o = d.conditionValueOptions.find(x => x.id === existing.id);
        if (o) { o.code = code.trim(); o.description = description.trim(); }
      } else {
        d.conditionValueOptions.push({ id: nextId(d.conditionValueOptions), conditionValueId: cvId, code: code.trim(), description: description.trim() });
      }
    });
    onClose();
  };
  return (
    <Dialog title={`${existing ? 'Edit' : 'Add'} ${attrName} code`} onClose={onClose} footer={<>
      <button className="btn ghost" onClick={onClose}>Cancel</button>
      <button className="btn primary" disabled={!code.trim()} onClick={save}>Save</button>
    </>}>
      <div className="form-grid">
        <div className="f"><label>Code <span className="muted" style={{ fontWeight: 400 }}>· sent in the message</span></label><input value={code} onChange={e => setCode(e.target.value)} placeholder="e.g. DD" /></div>
        <div className="f full"><label>Description</label><input value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Direct debit" /></div>
      </div>
    </Dialog>
  );
}
