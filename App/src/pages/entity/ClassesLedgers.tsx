import { useOutletContext } from 'react-router-dom';
import { useStore } from '../../store';
import type { LegalEntity } from '../../types';

// Explicit per-entity setup: which top-level accounting classes this legal entity uses, and which
// ledger(s) it books each class to. A ticked cell is a legalAccountingClass + legalAccountingLedger
// link — the same thing the accounting-rule dialog would otherwise create implicitly. A cell that
// an accounting rule already relies on is locked (can't untick until the rule is removed).
export default function ClassesLedgers() {
  const entity = useOutletContext<LegalEntity>();
  const { data, update } = useStore();

  const classes = data.accountingClasses;
  const ledgers = data.ledgers;

  const lacOf = (classId: number) => data.legalAccountingClasses.find(c => c.legalEntityId === entity.id && c.accountingClassId === classId);
  const lalOf = (classId: number, ledgerId: number) => {
    const lac = lacOf(classId);
    return lac ? data.legalAccountingLedgers.find(l => l.legalAccountingClassId === lac.id && l.ledgerId === ledgerId) : undefined;
  };
  const rulesUsing = (lalId: number | undefined) =>
    lalId == null ? 0 : data.accountingRules.filter(r => r.entityCode === entity.ownerCode && r.legalAccountingLedgerId === lalId).length;

  const toggle = (classId: number, ledgerId: number) => {
    update(d => {
      const existingLac = d.legalAccountingClasses.find(c => c.legalEntityId === entity.id && c.accountingClassId === classId);
      const existing = existingLac ? d.legalAccountingLedgers.find(l => l.legalAccountingClassId === existingLac.id && l.ledgerId === ledgerId) : undefined;
      if (existing && existingLac) {
        // remove — but never while an accounting rule depends on it
        if (d.accountingRules.some(r => r.entityCode === entity.ownerCode && r.legalAccountingLedgerId === existing.id)) return;
        d.legalAccountingLedgers = d.legalAccountingLedgers.filter(l => l.id !== existing.id);
        if (!d.legalAccountingLedgers.some(l => l.legalAccountingClassId === existingLac.id)) {
          d.legalAccountingClasses = d.legalAccountingClasses.filter(c => c.id !== existingLac.id);
        }
      } else {
        const lac = existingLac ?? { id: Math.max(0, ...d.legalAccountingClasses.map(x => x.id)) + 1, legalEntityId: entity.id, accountingClassId: classId };
        if (!existingLac) d.legalAccountingClasses.push(lac);
        d.legalAccountingLedgers.push({ id: Math.max(0, ...d.legalAccountingLedgers.map(x => x.id)) + 1, legalAccountingClassId: lac.id, ledgerId });
      }
    });
  };

  const usedClassCount = classes.filter(c => lacOf(c.id)).length;

  return (
    <div>
      <div className="pagelike-title">Accounting classes &amp; ledgers</div>
      <p className="muted" style={{ maxWidth: 720, marginTop: -6 }}>
        Tick which accounting classes {entity.ownerCode} uses and which ledger(s) it books each one to. This is what makes a
        class + ledger selectable when you register an accounting rule. A cell an accounting rule already relies on is locked
        until that rule is removed.
      </p>

      <div className="grid-wrap" style={{ maxWidth: 640 }}>
        <table className="grid">
          <thead>
            <tr>
              <th>Accounting class</th>
              {ledgers.map(l => <th key={l.id} className="num" style={{ textAlign: 'center' }}>{l.description || l.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {classes.map(c => (
              <tr key={c.id}>
                <td style={{ fontWeight: 600 }}>{c.name} <span className="muted" style={{ fontWeight: 400, fontSize: 11 }}>· {c.code}</span></td>
                {ledgers.map(l => {
                  const lal = lalOf(c.id, l.id);
                  const on = !!lal;
                  const ruleCount = rulesUsing(lal?.id);
                  const locked = on && ruleCount > 0;
                  return (
                    <td key={l.id} style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={locked}
                        title={locked ? `In use by ${ruleCount} accounting rule${ruleCount === 1 ? '' : 's'} — remove those first` : on ? 'Booked to this ledger' : 'Not used'}
                        onChange={() => toggle(c.id, l.id)}
                      />
                      {locked && <div className="muted" style={{ fontSize: 10 }}>{ruleCount} rule{ruleCount === 1 ? '' : 's'}</div>}
                    </td>
                  );
                })}
              </tr>
            ))}
            {classes.length === 0 && <tr><td colSpan={ledgers.length + 1} className="empty">No accounting classes defined — add them under Settings.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
        {usedClassCount} of {classes.length} classes in use. Manage the master lists of classes and ledgers under Settings.
      </p>
    </div>
  );
}
