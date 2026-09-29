import { useState } from 'react';
import { useOutletContext, useParams, useNavigate, Link } from 'react-router-dom';
import { useStore, useLookups } from '../../store';
import { Dialog } from '../../components/Chrome';
import { useDrill } from '../../components/trail';
import { Icon } from '../../components/Icon';
import type { Condition, Formula, LegalEntity, PseudoAccount } from '../../types';

// Slides 9 + 26: formula list with Add dialog
export default function Formulas() {
  const entity = useOutletContext<LegalEntity>();
  const { data, update } = useStore();
  const { amountTypeName, conditionsOf } = useLookups();
  const navigate = useNavigate();
  const drill = useDrill();
  const [filter, setFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const rows = data.formulas.filter(f =>
    !filter ||
    f.name.toLowerCase().includes(filter.toLowerCase()) ||
    f.description.toLowerCase().includes(filter.toLowerCase()) ||
    f.category.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div>
      <div className="toolbar">
        <input
          placeholder="Filter formulas…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={{ border: '1px solid var(--grey-line)', borderRadius: 4, padding: '6px 10px' }}
        />
        <div className="spacer" />
        <button className="btn" onClick={() => setShowAdd(true)}><Icon name="plus" size={14} /> Add</button>
      </div>
      <div className="grid-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th>Formula</th>
              <th>Name</th>
              <th>Description</th>
              <th>Amount type</th>
              <th>Debit</th>
              <th>Credit</th>
              <th style={{ textAlign: 'center' }}>Condition</th>
              <th style={{ width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map(f => {
              const hasCondition = conditionsOf(f.formulaConditionId).length > 0;
              return (
                <tr key={f.id} className="clickable" onClick={() => drill(`/legal-entity/${entity.id}/formulas/${f.id}`, f.name)}>
                  <td>{f.id}</td>
                  <td style={{ fontWeight: 600 }}>{f.name}</td>
                  <td>{f.description}</td>
                  <td>{amountTypeName(f.amountTypeId)}</td>
                  <td>{f.debitAccount ?? '–'}</td>
                  <td>{f.creditAccount ?? '–'}</td>
                  <td style={{ textAlign: 'center' }}>
                    {hasCondition ? <span style={{ color: 'var(--purple)' }}><Icon name="check" size={15} /></span> : <span className="muted">–</span>}
                  </td>
                  <td><span className="arrow-link"><Icon name="arrowRight" size={16} /></span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {showAdd && (
        <AddFormulaDialog
          pseudoOptions={data.pseudoAccounts.filter(p => p.entityCode === entity.ownerCode)}
          onClose={() => setShowAdd(false)}
          onSave={f => {
            update(d => { d.formulas.push(f); });
            setShowAdd(false);
            navigate(`/legal-entity/${entity.id}/formulas/${f.id}`);
          }}
        />
      )}
    </div>
  );
}

// The editable fields of a formula, shared by the Add and Edit dialogs so the two never drift.
interface FormulaFormState {
  name: string;
  amountTypeId: number | '';
  description: string;
  debit: string;
  credit: string;
  excludeFromRevaluation: boolean;
  reverseMonthly: boolean;
  appliesToEvents: number[];
}

const emptyFormulaForm: FormulaFormState = {
  name: '', amountTypeId: '', description: '', debit: '', credit: '',
  excludeFromRevaluation: false, reverseMonthly: false, appliesToEvents: [],
};

function formStateOf(f: Formula): FormulaFormState {
  return {
    name: f.name, amountTypeId: f.amountTypeId ?? '', description: f.description,
    debit: f.debitAccount ?? '', credit: f.creditAccount ?? '',
    excludeFromRevaluation: f.excludeFromRevaluation ?? false,
    reverseMonthly: f.reverseMonthly ?? false,
    appliesToEvents: f.appliesToEvents ?? [],
  };
}

// The one place a formula's fields are laid out. Both dialogs render this, so Add and Edit always
// offer exactly the same inputs.
function FormulaFields({ value, set, pseudoOptions, listId }: {
  value: FormulaFormState;
  set: (patch: Partial<FormulaFormState>) => void;
  pseudoOptions: PseudoAccount[];
  listId: string;
}) {
  const { data } = useStore();
  const toggleEvent = (id: number) => set({
    appliesToEvents: value.appliesToEvents.includes(id)
      ? value.appliesToEvents.filter(x => x !== id)
      : [...value.appliesToEvents, id],
  });
  return (
    <>
      <datalist id={listId}>
        {pseudoOptions.map(p => <option key={p.id} value={p.pseudo}>{p.description}</option>)}
      </datalist>
      <div className="form-grid">
        <div className="f full">
          <label>Name</label>
          <input value={value.name} onChange={e => set({ name: e.target.value })} />
          <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>
            The leading token is shown as the formula code in the rules and journals.
          </div>
        </div>
        <div className="f">
          <label>Amount type</label>
          <select value={value.amountTypeId} onChange={e => set({ amountTypeId: e.target.value === '' ? '' : Number(e.target.value) })}>
            <option value="">—</option>
            {data.amountTypes.map(a => <option key={a.id} value={a.id}>{a.name}{a.system ? ' · system' : ''}</option>)}
          </select>
        </div>
        <div className="f" />
        <div className="f full">
          <label>Description</label>
          <textarea rows={2} maxLength={255} value={value.description} onChange={e => set({ description: e.target.value })} />
        </div>
        <div className="f">
          <label>Debit account <span className="muted" style={{ fontWeight: 400 }}>· default</span></label>
          <input list={listId} value={value.debit} onChange={e => set({ debit: e.target.value })} placeholder="—" />
        </div>
        <div className="f">
          <label>Credit account <span className="muted" style={{ fontWeight: 400 }}>· default</span></label>
          <input list={listId} value={value.credit} onChange={e => set({ credit: e.target.value })} placeholder="—" />
        </div>
        <div className="f full">
          <label className="checkbox-inline" style={{ marginTop: 4 }}>
            <input type="checkbox" checked={value.excludeFromRevaluation} onChange={e => set({ excludeFromRevaluation: e.target.checked })} />
            Exclude from revaluation <span className="muted" style={{ fontWeight: 400 }}>· keeps the historical rate (e.g. fixed asset / depreciation)</span>
          </label>
        </div>
        <div className="f full">
          <label className="checkbox-inline" style={{ marginTop: 4 }}>
            <input type="checkbox" checked={value.reverseMonthly} onChange={e => set({ reverseMonthly: e.target.checked })} />
            Reverses at month-end <span className="muted" style={{ fontWeight: 400 }}>· part of the accrue-and-reverse cutoff (mirrored by Monthly Booking reversal / Undo). Off for permanent postings like depreciation.</span>
          </label>
        </div>
        <div className="f full">
          <label>Applies to events <span className="muted" style={{ fontWeight: 400 }}>· optional — prioritises this formula when building an accounting rule for these events</span></label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', marginTop: 4 }}>
            {/* Only events that book through accounting rules are offered. Excluded: reversal
                events (mirror the original journal), revaluation (posted by the revaluation
                engine), and Interest Adjustment / Agreement Change (flow through the recognition-
                plan change). See AccountingEvent.usesAccountingRules. */}
            {data.accountingEvents.filter(ev => ev.usesAccountingRules !== false).map(ev => (
              <label key={ev.id} className="checkbox-inline" style={{ marginBottom: 0 }}>
                <input type="checkbox" checked={value.appliesToEvents.includes(ev.id)} onChange={() => toggleEvent(ev.id)} /> {ev.name}
              </label>
            ))}
          </div>
          <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>Advisory only — the formula stays selectable for any event; unticked leaves it under “All formulas”.</div>
        </div>
      </div>
    </>
  );
}

// Slide 26: Add formula dialog
function AddFormulaDialog({ pseudoOptions, onClose, onSave }: { pseudoOptions: PseudoAccount[]; onClose: () => void; onSave: (f: Formula) => void }) {
  const { data } = useStore();
  const [form, setForm] = useState<FormulaFormState>(emptyFormulaForm);
  const set = (patch: Partial<FormulaFormState>) => setForm(prev => ({ ...prev, ...patch }));

  const save = () => {
    if (!form.name.trim()) return;
    const nextId = Math.max(...data.formulas.map(f => f.id)) + 1;
    onSave({
      id: nextId, name: form.name.trim(), description: form.description.trim(),
      amountTypeId: form.amountTypeId === '' ? null : form.amountTypeId,
      debitAccount: form.debit.trim() || null, creditAccount: form.credit.trim() || null,
      formulaConditionId: null, category: 'Custom',
      excludeFromRevaluation: form.excludeFromRevaluation || undefined,
      reverseMonthly: form.reverseMonthly || undefined,
      appliesToEvents: form.appliesToEvents.length ? [...form.appliesToEvents].sort((a, b) => a - b) : undefined,
    });
  };

  return (
    <Dialog title="Add formula" onClose={onClose} footer={
      <>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!form.name.trim()} onClick={save}>Save</button>
      </>
    }>
      <FormulaFields value={form} set={set} pseudoOptions={pseudoOptions} listId="pseudo-accounts-new" />
    </Dialog>
  );
}

// Slide 23 + 50: formula detail with IF/THEN condition editor
export function FormulaDetail() {
  const entity = useOutletContext<LegalEntity>();
  const { formulaId } = useParams();
  const { data, update } = useStore();
  const { amountTypeName } = useLookups();

  const [showEdit, setShowEdit] = useState(false);

  const formula = data.formulas.find(f => f.id === Number(formulaId));
  if (!formula) return <div className="empty">Formula not found.</div>;

  // Array order (not id) — the engine reads the conditions in this order, so the form must too.
  const conditions = formula.formulaConditionId == null
    ? []
    : data.conditions.filter(c => c.formulaConditionId === formula.formulaConditionId);

  const pseudoOptions = data.pseudoAccounts.filter(p => p.entityCode === entity.ownerCode);
  const AMOUNT_CODE_CV = 18;

  const ensureConditionGroup = (draftFormulaId: number, d: typeof data): number => {
    const f = d.formulas.find(x => x.id === draftFormulaId)!;
    if (f.formulaConditionId != null) return f.formulaConditionId;
    const nextFc = Math.max(0, ...d.formulaConditions.map(x => x.id)) + 1;
    d.formulaConditions.push({ id: nextFc, name: f.name });
    f.formulaConditionId = nextFc;
    return nextFc;
  };

  const newRow = (d: typeof data, fcId: number, level: number, conditionValueId: number | null): Condition => ({
    id: Math.max(0, ...d.conditions.map(c => c.id)) + 1, formulaConditionId: fcId, level,
    conditionValueId, value: '', debitPseudoAccountId: null, creditPseudoAccountId: null, operator: null,
  });

  // Add a top-level branch (level 0) at the end of this formula's condition group.
  const addBranch = () => update(d => {
    const fcId = ensureConditionGroup(formula.id, d);
    let insertAt = d.conditions.length;
    for (let i = d.conditions.length - 1; i >= 0; i--) if (d.conditions[i].formulaConditionId === fcId) { insertAt = i + 1; break; }
    d.conditions.splice(insertAt, 0, newRow(d, fcId, 0, d.conditionValues[0]?.id ?? null));
  });

  // Add a sub-condition one level deeper than `parentId`, placed after the parent's descendants.
  // Works at any depth: an override under a branch, or a further sub-level under that override.
  const addChild = (parentId: number) => update(d => {
    const pIdx = d.conditions.findIndex(c => c.id === parentId);
    if (pIdx < 0) return;
    const parent = d.conditions[pIdx];
    const fcId = parent.formulaConditionId;
    const parentLevel = parent.level ?? 0;
    let insertAt = pIdx + 1;
    for (let i = pIdx + 1; i < d.conditions.length; i++) {
      const c = d.conditions[i];
      if (c.formulaConditionId !== fcId || (c.level ?? 0) <= parentLevel) break; // past this subtree
      insertAt = i + 1;
    }
    const cvId = d.conditionValues.find(v => v.id === AMOUNT_CODE_CV)?.id ?? d.conditionValues[0]?.id ?? null;
    d.conditions.splice(insertAt, 0, newRow(d, fcId, parentLevel + 1, cvId));
  });

  // Remove a row and everything nested under it (any depth).
  const removeRow = (id: number) => update(d => {
    const idx = d.conditions.findIndex(c => c.id === id);
    if (idx < 0) return;
    const row = d.conditions[idx];
    let end = idx + 1;
    while (end < d.conditions.length && d.conditions[end].formulaConditionId === row.formulaConditionId && (d.conditions[end].level ?? 0) > (row.level ?? 0)) end++;
    d.conditions.splice(idx, end - idx);
  });

  const patchRow = (id: number, patch: Partial<Condition>) => {
    update(d => {
      const row = d.conditions.find(c => c.id === id);
      if (row) Object.assign(row, patch);
    });
  };

  // Shared controls for one condition row (field / value / debit / credit).
  const fieldSelect = (c: Condition) => (
    <select value={c.conditionValueId ?? ''} onChange={e => patchRow(c.id, { conditionValueId: Number(e.target.value) })}>
      {data.conditionValues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
    </select>
  );
  const valueControl = (c: Condition) => {
    const opts = (data.conditionValueOptions ?? []).filter(o => o.conditionValueId === c.conditionValueId);
    return opts.length > 0
      ? (
        <select value={c.value} onChange={e => patchRow(c.id, { value: e.target.value })} style={{ minWidth: 180 }}>
          <option value=""></option>
          {!opts.some(o => o.code === c.value) && c.value && <option value={c.value}>{c.value}</option>}
          {opts.map(o => <option key={o.code} value={o.code}>{o.code} — {o.description}</option>)}
        </select>
      )
      : <input value={c.value} onChange={e => patchRow(c.id, { value: e.target.value })} style={{ minWidth: 140 }} />;
  };
  const acctSelect = (c: Condition, side: 'D' | 'C') => (
    <select
      value={(side === 'D' ? c.debitPseudoAccountId : c.creditPseudoAccountId) ?? ''}
      onChange={e => patchRow(c.id, side === 'D'
        ? { debitPseudoAccountId: e.target.value === '' ? null : Number(e.target.value) }
        : { creditPseudoAccountId: e.target.value === '' ? null : Number(e.target.value) })}
      style={{ minWidth: 150 }}
    >
      <option value="">—</option>
      {pseudoOptions.map(p => <option key={p.id} value={p.id}>{p.pseudo} – {p.description}</option>)}
    </select>
  );
  const condControls = (c: Condition) => (
    <>
      <span className="kw">IF</span>{fieldSelect(c)}<span className="kw">=</span>{valueControl(c)}
      <span className="kw" style={{ marginLeft: 4 }}>Then</span>
      <span className="muted" style={{ fontSize: 11 }}>Dr</span>{acctSelect(c, 'D')}
      <span className="muted" style={{ fontSize: 11 }}>Cr</span>{acctSelect(c, 'C')}
    </>
  );

  return (
    <div>
      <div className="pagelike-title">
        <Link to={`/legal-entity/${entity.id}/formulas`} className="btn small ghost" style={{ marginRight: 10 }}>← Formulas</Link>
        Formula {formula.id} – {formula.name}
        <span className="spacer" style={{ flex: 1 }} />
        <button className="btn" onClick={() => setShowEdit(true)}><Icon name="pencil" size={14} /> Edit</button>
      </div>

      <div className="card">
        <div className="field-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
          <div className="field"><label>Formula</label><div className="val">{formula.id}</div></div>
          <div className="field"><label>Amount type</label><div className="val">{amountTypeName(formula.amountTypeId)}</div></div>
          <div className="field"><label>Name</label><div className="val">{formula.name}</div></div>
          <div className="field"><label>Debit account</label><div className="val">{formula.debitAccount ?? '–'}</div></div>
          <div className="field"><label>Credit account</label><div className="val">{formula.creditAccount ?? '–'}</div></div>
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <label>Description</label>
          <div className="val">{formula.description}</div>
        </div>
      </div>

      <div className="card">
        <h4>Conditions</h4>
        <p className="muted" style={{ marginTop: -4, maxWidth: 780, fontSize: 12.5 }}>
          Branches are checked top to bottom. Within the first branch that matches, each override that
          matches replaces the account — the most specific match wins. If a branch has an account it is
          the branch default; if nothing matches, the formula account below is used.
        </p>

        {conditions.map(c => {
          const depth = c.level ?? 0;
          return (
            <div key={c.id} style={{
              display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4,
              marginLeft: depth * 24, padding: '6px 10px', borderRadius: 8,
              border: '1px solid var(--line)',
              background: depth === 0 ? '#f3f0fb' : 'var(--card, transparent)',
            }}>
              {depth > 0 && <span style={{ color: 'var(--muted)' }}>↳</span>}
              {condControls(c)}
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>{depth === 0 ? 'branch' : `level ${depth}`}</span>
              <button className="btn small ghost" title="Add a sub-condition nested under this row" onClick={() => addChild(c.id)}><Icon name="plus" size={13} /> sub-level</button>
              <button className="icon-btn del" title="Remove this row and anything nested under it" onClick={() => removeRow(c.id)}><Icon name="x" size={15} /></button>
            </div>
          );
        })}

        <button className="btn" onClick={addBranch} style={{ marginTop: 4 }}><Icon name="plus" size={14} /> Add branch</button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, padding: '8px 12px', border: '1px dashed var(--line-strong, var(--line))', borderRadius: 8 }}>
          <span className="kw" style={{ color: 'var(--muted)' }}>OTHERWISE</span>
          <span className="muted" style={{ fontSize: 12.5 }}>no branch matches →</span>
          <span style={{ fontSize: 12.5 }}>Dr <b>{formula.debitAccount ?? '—'}</b> · Cr <b>{formula.creditAccount ?? '—'}</b></span>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>formula account</span>
        </div>
        {conditions.length === 0 && (
          <p className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>No branches yet — the formula books on its account above. Add a branch to route by a condition.</p>
        )}
      </div>

      {showEdit && (
        <FormulaEditDialog
          formula={formula}
          pseudoOptions={pseudoOptions}
          onClose={() => setShowEdit(false)}
        />
      )}
    </div>
  );
}

// Edit a formula's own values: name, amount type, description and the default
// debit/credit accounts (used when no condition matches). Conditions are edited
// directly in the table above.
function FormulaEditDialog({ formula, pseudoOptions, onClose }: {
  formula: Formula;
  pseudoOptions: PseudoAccount[];
  onClose: () => void;
}) {
  const { update } = useStore();
  const [form, setForm] = useState<FormulaFormState>(() => formStateOf(formula));
  const set = (patch: Partial<FormulaFormState>) => setForm(prev => ({ ...prev, ...patch }));

  const save = () => {
    if (!form.name.trim()) return;
    update(d => {
      const f = d.formulas.find(x => x.id === formula.id);
      if (!f) return;
      f.name = form.name.trim();
      f.amountTypeId = form.amountTypeId === '' ? null : form.amountTypeId;
      f.description = form.description.trim();
      f.debitAccount = form.debit.trim() || null;
      f.creditAccount = form.credit.trim() || null;
      f.excludeFromRevaluation = form.excludeFromRevaluation;
      f.reverseMonthly = form.reverseMonthly;
      f.appliesToEvents = form.appliesToEvents.length ? [...form.appliesToEvents].sort((a, b) => a - b) : undefined;
    });
    onClose();
  };

  return (
    <Dialog title={`Edit formula ${formula.id}`} onClose={onClose} footer={
      <>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!form.name.trim()} onClick={save}>Save</button>
      </>
    }>
      <FormulaFields value={form} set={set} pseudoOptions={pseudoOptions} listId={`pseudo-accounts-${formula.id}`} />
      {(formula.formulaConditionId != null) && (
        <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
          This formula has conditions — the default debit/credit accounts above are used only
          when no condition matches. Edit the conditions in the table on the formula page.
        </p>
      )}
    </Dialog>
  );
}
