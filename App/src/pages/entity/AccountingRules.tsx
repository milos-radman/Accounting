import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useStore, useLookups } from '../../store';
import { Dialog } from '../../components/Chrome';
import { Icon } from '../../components/Icon';
import type { AccountingRule, LegalEntity } from '../../types';

// Slides 10-19: accounting rules grid with filtering, grouping and expandable conditions
export default function AccountingRules() {
  const entity = useOutletContext<LegalEntity>();
  const { data, update } = useStore();
  const { ledgerName, classNameOf, eventName, formulaById, amountTypeName, conditionValueName, pseudoName, conditionsOf } = useLookups();

  const [filterSource, setFilterSource] = useState('');
  const [filterLedger, setFilterLedger] = useState('');
  const [filterEvent, setFilterEvent] = useState('');
  const [filterText, setFilterText] = useState('');
  const [grouped, setGrouped] = useState(false);
  const [expanded, setExpanded] = useState<number[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editRule, setEditRule] = useState<AccountingRule | null>(null);

  const myLedgerIds = useMemo(() => {
    const classIds = data.legalAccountingClasses.filter(c => c.legalEntityId === entity.id).map(c => c.id);
    return data.legalAccountingLedgers.filter(l => classIds.includes(l.legalAccountingClassId)).map(l => l.id);
  }, [data, entity.id]);

  const rules = data.accountingRules
    .filter(r => r.entityCode === entity.ownerCode && myLedgerIds.includes(r.legalAccountingLedgerId))
    .filter(r => !filterSource || classNameOf(r.legalAccountingLedgerId) === filterSource)
    .filter(r => !filterLedger || ledgerName(r.legalAccountingLedgerId) === filterLedger)
    .filter(r => !filterEvent || eventName(r.accountingEventId) === filterEvent)
    .filter(r => {
      if (!filterText) return true;
      const f = formulaById(r.formulaId);
      const hay = `${f?.name ?? ''} ${f?.description ?? ''} ${amountTypeName(f?.amountTypeId ?? null)}`.toLowerCase();
      return hay.includes(filterText.toLowerCase());
    });

  const sources = [...new Set(rules.map(r => classNameOf(r.legalAccountingLedgerId)))];
  const allSources = [...new Set(data.accountingRules.filter(r => r.entityCode === entity.ownerCode).map(r => classNameOf(r.legalAccountingLedgerId)))];
  const allLedgers = [...new Set(data.accountingRules.filter(r => r.entityCode === entity.ownerCode).map(r => ledgerName(r.legalAccountingLedgerId)))];
  const allEvents = [...new Set(data.accountingRules.filter(r => r.entityCode === entity.ownerCode).map(r => eventName(r.accountingEventId)))];

  const toggleExpand = (id: number) =>
    setExpanded(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  const formulaCode = (r: AccountingRule) => {
    const f = formulaById(r.formulaId);
    if (!f) return String(r.formulaId);
    // formula names look like "014 -Fixed Asset" — the leading token is the formula code
    return f.name.split(' ')[0];
  };

  const renderRuleRow = (r: AccountingRule) => {
    const f = formulaById(r.formulaId);
    const conds = conditionsOf(f?.formulaConditionId ?? null);
    const isOpen = expanded.includes(r.id);
    return (
      <RowGroup key={r.id}>
        <tr className="clickable" onClick={() => setEditRule(r)} title="Edit rule">
          <td>
            <button
              className="expander"
              onClick={e => { e.stopPropagation(); toggleExpand(r.id); }}
              title="Show conditions"
            >
              {isOpen ? '−' : '+'}
            </button>
          </td>
          <td>{classNameOf(r.legalAccountingLedgerId)}</td>
          <td>{ledgerName(r.legalAccountingLedgerId)}</td>
          <td>{eventName(r.accountingEventId)}</td>
          <td>{formulaCode(r)}</td>
          <td>{f?.description}</td>
          <td>{amountTypeName(f?.amountTypeId ?? null)}</td>
          <td style={{ textAlign: 'center', fontWeight: 700 }}>{r.debitCredit}</td>
          <td>{f?.debitAccount ?? f?.creditAccount ?? (conds.length ? 'Per condition' : '–')}</td>
          <td style={{ textAlign: 'center' }}>
            {conds.length > 0 ? <span style={{ color: 'var(--purple)' }}><Icon name="check" size={15} /></span> : <span className="muted">–</span>}
          </td>
          <td style={{ whiteSpace: 'nowrap' }}>
            <button className="icon-btn" title="Edit rule" onClick={e => { e.stopPropagation(); setEditRule(r); }}>
              <Icon name="pencil" size={14} />
            </button>
            <button className="icon-btn del" title="Delete rule" onClick={e => {
              e.stopPropagation();
              update(d => { d.accountingRules = d.accountingRules.filter(x => x.id !== r.id); });
            }}><Icon name="trash" size={15} /></button>
          </td>
        </tr>
        {isOpen && (
          <tr className="detail-row">
            <td />
            <td colSpan={10}>
              {conds.length === 0 ? (
                <span className="muted">No conditions — books on {f?.debitAccount ?? f?.creditAccount ?? 'the formula account'}.</span>
              ) : (
                <table className="cond-table" style={{ maxWidth: 760 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 26 }} />
                      <th>Condition field</th>
                      <th style={{ width: 20 }} />
                      <th>Value</th>
                      <th style={{ width: 40 }} />
                      <th>Debit account</th>
                      <th>Credit account</th>
                      <th style={{ width: 60 }}>Op</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conds.map(c => (
                      <tr key={c.id}>
                        <td className="kw">IF</td>
                        <td>{conditionValueName(c.conditionValueId)}</td>
                        <td className="kw">=</td>
                        <td>{c.value || '—'}</td>
                        <td className="kw">Then</td>
                        <td>{pseudoName(entity.ownerCode, c.debitPseudoAccountId) || '—'}</td>
                        <td>{pseudoName(entity.ownerCode, c.creditPseudoAccountId) || '—'}</td>
                        <td>{c.operator ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </td>
          </tr>
        )}
      </RowGroup>
    );
  };

  return (
    <div>
      <div className="toolbar">
        <button className={'btn small' + (grouped ? ' primary' : '')} onClick={() => setGrouped(g => !g)}>
          {grouped ? 'Ungroup' : 'Group by Source / Ledger / Event'}
        </button>
        <div className="spacer" />
        <button className="btn" onClick={() => setShowAdd(true)}><Icon name="plus" size={14} /> Add</button>
      </div>
      <div className="grid-wrap">
        <div className="grid-toolbar">
          <select value={filterSource} onChange={e => setFilterSource(e.target.value)}>
            <option value="">Source: all</option>
            {allSources.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterLedger} onChange={e => setFilterLedger(e.target.value)}>
            <option value="">Ledger: all</option>
            {allLedgers.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterEvent} onChange={e => setFilterEvent(e.target.value)}>
            <option value="">Event: all</option>
            {allEvents.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <input placeholder="Filter formula…" value={filterText} onChange={e => setFilterText(e.target.value)} />
          <span className="muted">{rules.length} rules</span>
        </div>
        <table className="grid">
          <thead>
            <tr>
              <th style={{ width: 30 }} />
              <th>Source</th>
              <th>Ledger</th>
              <th>Event</th>
              <th>Formula</th>
              <th>Formula name</th>
              <th>Amount type</th>
              <th style={{ textAlign: 'center' }}>Debit/Credit</th>
              <th>Pseudo account</th>
              <th style={{ textAlign: 'center' }}>Condition</th>
              <th style={{ width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {!grouped && rules.map(renderRuleRow)}
            {grouped && sources.map(source => {
              const bySource = rules.filter(r => classNameOf(r.legalAccountingLedgerId) === source);
              const ledgers = [...new Set(bySource.map(r => ledgerName(r.legalAccountingLedgerId)))];
              return (
                <RowGroup key={source}>
                  <tr className="group-header"><td colSpan={11}>Source: {source}</td></tr>
                  {ledgers.map(lg => {
                    const byLedger = bySource.filter(r => ledgerName(r.legalAccountingLedgerId) === lg);
                    const events = [...new Set(byLedger.map(r => eventName(r.accountingEventId)))];
                    return (
                      <RowGroup key={lg}>
                        <tr className="group-header"><td /><td colSpan={10}>Ledger: {lg}</td></tr>
                        {events.map(ev => (
                          <RowGroup key={ev}>
                            <tr className="group-header"><td /><td /><td colSpan={9}>Event: {ev}</td></tr>
                            {byLedger.filter(r => eventName(r.accountingEventId) === ev).map(renderRuleRow)}
                          </RowGroup>
                        ))}
                      </RowGroup>
                    );
                  })}
                </RowGroup>
              );
            })}
            {rules.length === 0 && <tr><td colSpan={11} className="empty">No accounting rules match the filter.</td></tr>}
          </tbody>
        </table>
      </div>
      {showAdd && <RuleDialog entity={entity} onClose={() => setShowAdd(false)} />}
      {editRule && (
        <RuleDialog entity={entity} rule={editRule} onClose={() => setEditRule(null)} />
      )}
    </div>
  );
}

function RowGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

// Slide 51: accounting rule registration — creates a new rule or updates an existing one
function RuleDialog({ entity, rule, onClose }: {
  entity: LegalEntity; rule?: AccountingRule; onClose: () => void;
}) {
  const { data, update } = useStore();

  // Formulas suggested for an event: those tagged for it (appliesToEvents) plus those already used
  // with it in existing rules. Advisory only — every formula stays selectable under "All formulas".
  const usedWith = (evId: number) => new Set(data.accountingRules.filter(r => r.accountingEventId === evId).map(r => r.formulaId));
  const suggestedFor = (evId: number) => {
    const used = usedWith(evId);
    return data.formulas.filter(f => f.appliesToEvents?.includes(evId) || used.has(f.id));
  };

  // Accounting class + ledger are chosen from the global lists; the entity's legalAccountingClass /
  // legalAccountingLedger link is created on save if it doesn't exist yet — so a brand-new entity
  // (no configured combos) is no longer a dead end.
  const initLal = rule ? data.legalAccountingLedgers.find(l => l.id === rule.legalAccountingLedgerId) : undefined;
  const initLac = initLal ? data.legalAccountingClasses.find(c => c.id === initLal.legalAccountingClassId) : undefined;
  const [classId, setClassId] = useState(initLac?.accountingClassId ?? data.accountingClasses[0]?.id ?? 0);
  const [glLedgerId, setGlLedgerId] = useState(initLal?.ledgerId ?? data.ledgers[0]?.id ?? 0);

  const initialEvent = rule?.accountingEventId ?? data.accountingEvents[0]?.id ?? 1;
  const [eventId, setEventId] = useState(initialEvent);
  const [formulaId, setFormulaId] = useState(rule?.formulaId ?? suggestedFor(initialEvent)[0]?.id ?? data.formulas[0]?.id ?? 1);
  const [dc, setDc] = useState<'D' | 'C'>(rule?.debitCredit ?? 'D');

  // On a new rule, follow the event: if the picked formula isn't suggested for the new event, jump
  // to the first suggested one (one-click common case). Editing keeps the rule's own formula.
  const onEventChange = (newEv: number) => {
    setEventId(newEv);
    if (!rule) {
      const sug = suggestedFor(newEv);
      if (sug.length && !sug.some(f => f.id === formulaId)) setFormulaId(sug[0].id);
    }
  };

  const suggested = suggestedFor(eventId);
  const suggestedIds = new Set(suggested.map(f => f.id));
  const otherFormulas = data.formulas.filter(f => !suggestedIds.has(f.id));
  const currentEventName = data.accountingEvents.find(e => e.id === eventId)?.name ?? '';

  const save = () => {
    update(d => {
      // Resolve (create if missing) the entity's accounting-class link and its ledger link.
      let lac = d.legalAccountingClasses.find(c => c.legalEntityId === entity.id && c.accountingClassId === classId);
      if (!lac) {
        lac = { id: Math.max(0, ...d.legalAccountingClasses.map(x => x.id)) + 1, legalEntityId: entity.id, accountingClassId: classId };
        d.legalAccountingClasses.push(lac);
      }
      let lal = d.legalAccountingLedgers.find(l => l.legalAccountingClassId === lac!.id && l.ledgerId === glLedgerId);
      if (!lal) {
        lal = { id: Math.max(0, ...d.legalAccountingLedgers.map(x => x.id)) + 1, legalAccountingClassId: lac.id, ledgerId: glLedgerId };
        d.legalAccountingLedgers.push(lal);
      }
      const legalAccountingLedgerId = lal.id;
      if (rule) {
        const existing = d.accountingRules.find(r => r.id === rule.id);
        if (existing) {
          existing.legalAccountingLedgerId = legalAccountingLedgerId;
          existing.accountingEventId = eventId;
          existing.formulaId = formulaId;
          existing.debitCredit = dc;
        }
      } else {
        const nextId = Math.max(0, ...d.accountingRules.map(r => r.id)) + 1;
        d.accountingRules.push({
          id: nextId, entityCode: entity.ownerCode, legalAccountingLedgerId,
          accountingEventId: eventId, formulaId, debitCredit: dc,
        });
      }
    });
    onClose();
  };

  return (
    <Dialog title={rule ? `Accounting rule ${rule.id}` : 'Accounting rule – registration'} onClose={onClose} footer={
      <>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={save}>Save</button>
      </>
    }>
      <div className="form-grid">
        <div className="f">
          <label>Accounting class</label>
          <select value={classId} onChange={e => setClassId(Number(e.target.value))}>
            {data.accountingClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="f">
          <label>Ledger</label>
          <select value={glLedgerId} onChange={e => setGlLedgerId(Number(e.target.value))}>
            {data.ledgers.map(l => <option key={l.id} value={l.id}>{l.description || l.name}</option>)}
          </select>
        </div>
        <div className="f">
          <label>Accounting event</label>
          <select value={eventId} onChange={e => onEventChange(Number(e.target.value))}>
            {/* Only events that book through accounting rules; keep the current one visible when
                editing a rule that predates the flag. See AccountingEvent.usesAccountingRules. */}
            {data.accountingEvents.filter(ev => ev.usesAccountingRules !== false || ev.id === eventId).map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
          </select>
        </div>
        <div className="f">
          <label>Formula {suggested.length > 0 && <span className="muted" style={{ fontWeight: 400, fontSize: 11 }}>· {suggested.length} suggested for {currentEventName}</span>}</label>
          <select value={formulaId} onChange={e => setFormulaId(Number(e.target.value))}>
            {suggested.length > 0 && (
              <optgroup label={`Suggested for ${currentEventName}`}>
                {suggested.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </optgroup>
            )}
            <optgroup label={suggested.length > 0 ? 'All other formulas' : 'All formulas'}>
              {otherFormulas.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </optgroup>
          </select>
        </div>
        <div className="f">
          <label>Debit/Credit</label>
          <select value={dc} onChange={e => setDc(e.target.value as 'D' | 'C')}>
            <option value="D">Debit</option>
            <option value="C">Credit</option>
          </select>
        </div>
      </div>
    </Dialog>
  );
}
