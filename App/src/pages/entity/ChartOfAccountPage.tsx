import { useMemo, useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { useStore, suggestCoaNode } from '../../store';
import { Dialog } from '../../components/Chrome';
import { Icon } from '../../components/Icon';
import type { EntityCoaNode, LegalEntity, PseudoAccount } from '../../types';

interface NodeDialogState {
  mode: 'add' | 'edit';
  parent?: EntityCoaNode; // for add: undefined = new root node
  node?: EntityCoaNode;   // for edit
}

// Chart of account: each legal entity owns its copy (created from a template).
// Maintain the structure and place pseudo accounts on nodes (PseudoAccountCOA).
export default function ChartOfAccountPage() {
  const entity = useOutletContext<LegalEntity>();
  const { data, update } = useStore();
  const coa = data.chartOfAccounts.find(c => c.id === entity.coaId);
  const nodes = useMemo(
    () => data.entityCoaNodes.filter(n => n.legalEntityId === entity.id),
    [data.entityCoaNodes, entity.id],
  );
  const [collapsed, setCollapsed] = useState<number[]>([]);
  const [nodeDialog, setNodeDialog] = useState<NodeDialogState | null>(null);
  const [assignNode, setAssignNode] = useState<EntityCoaNode | null>(null);
  const [showSuggest, setShowSuggest] = useState(false);

  const myAccounts = data.pseudoAccounts.filter(p => p.entityCode === entity.ownerCode);
  const myLinks = data.pseudoAccountCoaLinks.filter(l => l.entityCode === entity.ownerCode);
  const linksOf = (nodeId: number) => myLinks.filter(l => l.coaNodeId === nodeId);
  const accountOf = (pseudoAccountId: number) => myAccounts.find(p => p.id === pseudoAccountId);
  const unplacedAccounts = myAccounts.filter(p => !myLinks.some(l => l.pseudoAccountId === p.id));

  const childrenOf = (parentId: number | null) => nodes.filter(n => (n.parentId ?? null) === parentId);

  const toggle = (id: number) =>
    setCollapsed(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  const unlink = (linkId: number) =>
    update(d => { d.pseudoAccountCoaLinks = d.pseudoAccountCoaLinks.filter(l => l.id !== linkId); });

  const deleteNode = (node: EntityCoaNode) => {
    update(d => { d.entityCoaNodes = d.entityCoaNodes.filter(n => n.id !== node.id); });
  };

  const canDelete = (node: EntityCoaNode) => {
    const hasChildren = nodes.some(n => n.parentId === node.id);
    const hasLinks = myLinks.some(l => l.coaNodeId === node.id);
    return !hasChildren && !hasLinks;
  };

  const deleteTitle = (node: EntityCoaNode) => {
    if (nodes.some(n => n.parentId === node.id)) return 'Cannot delete — node has sub-nodes';
    if (myLinks.some(l => l.coaNodeId === node.id)) return 'Cannot delete — pseudo accounts are placed on this node';
    return 'Delete node';
  };

  const renderNode = (node: EntityCoaNode): React.ReactNode => {
    const children = childrenOf(node.id);
    const isCollapsed = collapsed.includes(node.id);
    const links = linksOf(node.id);
    return (
      <div key={node.id} style={{ marginLeft: node.depth === 0 ? 0 : 22 }}>
        <div className="node">
          {children.length > 0 ? (
            <button className="toggle" onClick={() => toggle(node.id)} title={isCollapsed ? 'Expand' : 'Collapse'}>
              <Icon name={isCollapsed ? 'chevronRight' : 'chevronDown'} size={13} />
            </button>
          ) : (
            <span className="toggle" />
          )}
          <span className="ord">{node.order}</span>
          <span style={{ fontWeight: node.depth === 0 ? 700 : node.depth === 1 ? 600 : 400 }}>{node.name}</span>
          {node.description && <span className="desc">{node.description}</span>}
          {links.length > 0 && <span className="muted" style={{ fontSize: 11 }}>· {links.length} account{links.length === 1 ? '' : 's'}</span>}
          <span className="node-actions">
            <button className="icon-btn add" title="Place pseudo account on this node" onClick={() => setAssignNode(node)}>
              <Icon name="rows" size={14} />
            </button>
            <button className="icon-btn add" title="Add sub-node" onClick={() => setNodeDialog({ mode: 'add', parent: node })}>
              <Icon name="plus" size={14} />
            </button>
            <button className="icon-btn" title="Edit node" onClick={() => setNodeDialog({ mode: 'edit', node })}>
              <Icon name="pencil" size={13} />
            </button>
            <button className="icon-btn del" title={deleteTitle(node)} disabled={!canDelete(node)} onClick={() => deleteNode(node)}>
              <Icon name="trash" size={13} />
            </button>
          </span>
        </div>
        {links.length > 0 && (
          <div style={{ marginLeft: 90, marginTop: 3, marginBottom: 5, display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-start' }}>
            {links.map(l => {
              const acc = accountOf(l.pseudoAccountId);
              if (!acc) return null;
              return (
                <div key={l.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, border: '1px solid var(--line)', borderRadius: 6, padding: '2px 6px 2px 10px', background: 'var(--card)' }}>
                  <span style={{ fontWeight: 700, color: 'var(--purple)', minWidth: 52 }}>{acc.pseudo}</span>
                  <span style={{ color: 'var(--muted)' }}>{acc.description}</span>
                  <button title="Remove from this node" onClick={() => unlink(l.id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--muted)', display: 'inline-flex', padding: 2, marginLeft: 2 }}>
                    <Icon name="x" size={11} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
        {!isCollapsed && children.map(renderNode)}
      </div>
    );
  };

  return (
    <div>
      <div className="pagelike-title">
        Chart of account
        <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>
          {entity.ownerCode} copy of {coa?.name}
        </span>
        <span className="spacer" style={{ flex: 1 }} />
        {unplacedAccounts.length > 0 && (
          <button className="btn primary" onClick={() => setShowSuggest(true)} title="Match unplaced pseudo accounts to nodes by account number">
            <Icon name="zap" size={14} /> Suggest placement ({unplacedAccounts.length})
          </button>
        )}
        <button className="btn" onClick={() => setNodeDialog({ mode: 'add' })}><Icon name="plus" size={14} /> Add root node</button>
      </div>
      <p className="muted" style={{ maxWidth: 700, marginTop: -6 }}>
        This chart belongs to {entity.ownerCode} — structural changes here do not affect other
        legal entities. Place the pseudo accounts used in this accounting domain on the level
        where they belong. Hover a row for actions.
        {unplacedAccounts.length > 0 && (
          <> · <b>{unplacedAccounts.length}</b> registered pseudo account{unplacedAccounts.length === 1 ? '' : 's'} from{' '}
          <Link to={`/legal-entity/${entity.id}/pseudo-account`}>Pseudo account</Link> not placed yet.</>
        )}
      </p>
      <div className="card tree">
        {childrenOf(null).map(renderNode)}
        {nodes.length === 0 && <div className="empty">The chart of account is empty — add a root node to start.</div>}
      </div>

      {nodeDialog && (
        <NodeDialog
          state={nodeDialog}
          onClose={() => setNodeDialog(null)}
          onSave={(name, description, accountFrom, accountTo) => {
            update(d => {
              if (nodeDialog.mode === 'edit' && nodeDialog.node) {
                const n = d.entityCoaNodes.find(x => x.id === nodeDialog.node!.id);
                if (n) { n.name = name; n.description = description; n.accountFrom = accountFrom; n.accountTo = accountTo; }
              } else {
                const parent = nodeDialog.parent ?? null;
                const mine = d.entityCoaNodes.filter(n => n.legalEntityId === entity.id);
                const siblings = mine.filter(n => (n.parentId ?? null) === (parent?.id ?? null));
                const nextId = Math.max(0, ...d.entityCoaNodes.map(n => n.id)) + 1;
                const rootOrders = mine.filter(n => n.depth === 0)
                  .map(n => parseInt(n.order, 10)).filter(x => !isNaN(x));
                const order = parent
                  ? `${parent.order}.${siblings.length + 1}`
                  : String(Math.max(0, ...rootOrders) + 1);
                d.entityCoaNodes.push({
                  id: nextId, legalEntityId: entity.id, name, description,
                  order, depth: parent ? parent.depth + 1 : 0, parentId: parent?.id ?? null,
                  accountFrom, accountTo,
                });
              }
            });
            setNodeDialog(null);
          }}
        />
      )}

      {showSuggest && (
        <SuggestDialog
          nodes={nodes}
          accounts={unplacedAccounts}
          onClose={() => setShowSuggest(false)}
          onPlace={pairs => {
            update(d => {
              let nextId = Math.max(0, ...d.pseudoAccountCoaLinks.map(l => l.id));
              for (const [pseudoAccountId, coaNodeId] of pairs) {
                nextId += 1;
                d.pseudoAccountCoaLinks.push({ id: nextId, entityCode: entity.ownerCode, pseudoAccountId, coaNodeId });
              }
            });
            setShowSuggest(false);
          }}
        />
      )}

      {assignNode && (
        <AssignDialog
          node={assignNode}
          accounts={unplacedAccounts}
          entityId={entity.id}
          onClose={() => setAssignNode(null)}
          onAssign={ids => {
            update(d => {
              let nextId = Math.max(0, ...d.pseudoAccountCoaLinks.map(l => l.id));
              for (const pseudoAccountId of ids) {
                nextId += 1;
                d.pseudoAccountCoaLinks.push({
                  id: nextId, entityCode: entity.ownerCode, pseudoAccountId, coaNodeId: assignNode.id,
                });
              }
            });
            setAssignNode(null);
          }}
        />
      )}
    </div>
  );
}

function NodeDialog({ state, onClose, onSave }: {
  state: NodeDialogState;
  onClose: () => void;
  onSave: (name: string, description: string, accountFrom?: number, accountTo?: number) => void;
}) {
  const [name, setName] = useState(state.node?.name ?? '');
  const [description, setDescription] = useState(state.node?.description ?? '');
  const [from, setFrom] = useState(state.node?.accountFrom != null ? String(state.node.accountFrom) : '');
  const [to, setTo] = useState(state.node?.accountTo != null ? String(state.node.accountTo) : '');
  const title = state.mode === 'edit'
    ? `Edit node ${state.node?.order}`
    : state.parent
      ? `Add sub-node under ${state.parent.order} ${state.parent.name}`
      : 'Add root node';
  const num = (s: string) => (s.trim() === '' ? undefined : Number(s.trim()));
  return (
    <Dialog title={title} onClose={onClose} footer={
      <>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!name.trim()} onClick={() => onSave(name.trim(), description.trim(), num(from), num(to))}>Save</button>
      </>
    }>
      <div className="form-grid">
        <div className="f full"><label>Name</label><input autoFocus value={name} onChange={e => setName(e.target.value)} /></div>
        <div className="f full"><label>Description</label><input value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. account range" /></div>
        <div className="f"><label>Account from <span className="muted" style={{ fontWeight: 400, fontSize: 11 }}>· for suggestions</span></label><input value={from} onChange={e => setFrom(e.target.value)} placeholder="e.g. 1200" inputMode="numeric" /></div>
        <div className="f"><label>Account to</label><input value={to} onChange={e => setTo(e.target.value)} placeholder="e.g. 1299" inputMode="numeric" /></div>
      </div>
    </Dialog>
  );
}

// Suggest, for each unplaced pseudo account, the node its number falls into — one click to accept.
function SuggestDialog({ nodes, accounts, onClose, onPlace }: {
  nodes: EntityCoaNode[];
  accounts: PseudoAccount[];
  onClose: () => void;
  onPlace: (pairs: [number, number][]) => void;
}) {
  const suggestions = useMemo(
    () => accounts.map(a => ({ account: a, node: suggestCoaNode(a.pseudo, nodes) }))
      .sort((x, y) => x.account.pseudo.localeCompare(y.account.pseudo, undefined, { numeric: true })),
    [accounts, nodes],
  );
  const matched = suggestions.filter(s => s.node);
  const [selected, setSelected] = useState<number[]>(() => matched.map(s => s.account.id));
  const toggle = (id: number) => setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  const place = () => {
    const pairs: [number, number][] = suggestions
      .filter(s => s.node && selected.includes(s.account.id))
      .map(s => [s.account.id, s.node!.id]);
    onPlace(pairs);
  };

  const noMatch = suggestions.length - matched.length;
  return (
    <Dialog title="Suggest placement" wide onClose={onClose} footer={
      <>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={selected.length === 0} onClick={place}>Place {selected.length || ''} account{selected.length === 1 ? '' : 's'}</button>
      </>
    }>
      <p className="muted" style={{ marginTop: 0, fontSize: 12.5 }}>
        Each account is matched to the deepest chart-of-account node whose account-number range contains it.
        Review and untick any you disagree with. {noMatch > 0 && <b>{noMatch} account{noMatch === 1 ? '' : 's'} had no matching range</b>}
        {noMatch > 0 && ' — place those manually, or add a range to the node.'}
      </p>
      <div className="grid-wrap" style={{ maxHeight: 360, boxShadow: 'none' }}>
        <table className="grid">
          <thead>
            <tr><th style={{ width: 30 }} /><th>Pseudo account</th><th>Description</th><th>Suggested node</th></tr>
          </thead>
          <tbody>
            {suggestions.map(({ account, node }) => (
              <tr key={account.id} className={node ? 'clickable' : undefined} onClick={() => node && toggle(account.id)} style={node ? undefined : { opacity: 0.55 }}>
                <td>{node && <input type="checkbox" checked={selected.includes(account.id)} onChange={() => toggle(account.id)} onClick={e => e.stopPropagation()} />}</td>
                <td style={{ fontWeight: 600 }}>{account.pseudo}</td>
                <td>{account.description}</td>
                <td>{node ? <><span className="ord" style={{ marginRight: 6 }}>{node.order}</span>{node.name}</> : <span className="badge-diff">no match</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Dialog>
  );
}

function AssignDialog({ node, accounts, entityId, onClose, onAssign }: {
  node: EntityCoaNode;
  accounts: PseudoAccount[];
  entityId: number;
  onClose: () => void;
  onAssign: (pseudoAccountIds: number[]) => void;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const [filter, setFilter] = useState('');

  const rows = accounts.filter(a =>
    !filter ||
    a.pseudo.toLowerCase().includes(filter.toLowerCase()) ||
    a.description.toLowerCase().includes(filter.toLowerCase()),
  );

  const toggle = (id: number) =>
    setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  return (
    <Dialog title={`Place pseudo accounts on ${node.order} ${node.name}`} onClose={onClose} footer={
      <>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={selected.length === 0} onClick={() => onAssign(selected)}>
          Place {selected.length || ''} account{selected.length === 1 ? '' : 's'}
        </button>
      </>
    }>
      {accounts.length === 0 ? (
        <div className="empty">
          All registered pseudo accounts are already placed.<br />
          <Link to={`/legal-entity/${entityId}/pseudo-account`}>Register or import more in Pseudo account</Link>.
        </div>
      ) : (
        <>
          <div className="f" style={{ marginBottom: 10 }}>
            <input placeholder="Filter…" value={filter} onChange={e => setFilter(e.target.value)} />
          </div>
          <div className="grid-wrap" style={{ maxHeight: 320, boxShadow: 'none' }}>
            <table className="grid">
              <thead>
                <tr><th style={{ width: 30 }} /><th>Pseudo account</th><th>Description</th><th>External account</th></tr>
              </thead>
              <tbody>
                {rows.map(a => (
                  <tr key={a.id} className="clickable" onClick={() => toggle(a.id)}>
                    <td><input type="checkbox" checked={selected.includes(a.id)} onChange={() => toggle(a.id)} onClick={e => e.stopPropagation()} /></td>
                    <td style={{ fontWeight: 600 }}>{a.pseudo}</td>
                    <td>{a.description}</td>
                    <td>{a.extPseudo}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={4} className="empty">No unplaced accounts match the filter.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Dialog>
  );
}
