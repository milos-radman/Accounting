import { useRef, useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { useStore, defaultAccountKind } from '../../store';
import { Dialog } from '../../components/Chrome';
import { Icon } from '../../components/Icon';
import type { AccountKind, LegalEntity, PseudoAccount } from '../../types';

interface ImportRow {
  pseudo: string;
  description: string;
  extPseudo: string;
  extDescription: string;
  status: 'new' | 'duplicate' | 'invalid';
}

// Pseudo account register: add, import from GL file (csv/xlsx), delete when not placed on the COA
export default function PseudoAccounts() {
  const entity = useOutletContext<LegalEntity>();
  const { data, update } = useStore();
  const [filter, setFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editAccount, setEditAccount] = useState<PseudoAccount | null>(null);
  const [importRows, setImportRows] = useState<ImportRow[] | null>(null);
  const [importFileName, setImportFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const myAccounts = data.pseudoAccounts.filter(p => p.entityCode === entity.ownerCode);
  const myLinks = data.pseudoAccountCoaLinks.filter(l => l.entityCode === entity.ownerCode);
  const nodeOf = (pseudoId: number) => {
    const link = myLinks.find(l => l.pseudoAccountId === pseudoId);
    return link ? data.entityCoaNodes.find(n => n.id === link.coaNodeId) : undefined;
  };

  const rows = myAccounts.filter(p =>
    !filter ||
    p.pseudo.toLowerCase().includes(filter.toLowerCase()) ||
    p.description.toLowerCase().includes(filter.toLowerCase()),
  );

  const parseFile = async (file: File) => {
    const wb = XLSX.read(await file.arrayBuffer());
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (raw.length === 0) { setImportRows([]); return; }

    const str = (v: unknown) => String(v ?? '').trim();
    // header detection: map columns by name when a header row is present, otherwise positional
    const first = raw[0].map(c => str(c).toLowerCase());
    const looksLikeHeader = first.some(c => /pseudo|account|desc|name|extern/.test(c));
    const findCol = (patterns: RegExp[], fallback: number) => {
      for (const p of patterns) {
        const idx = first.findIndex(c => p.test(c));
        if (idx >= 0) return idx;
      }
      return fallback;
    };
    const colPseudo = looksLikeHeader ? findCol([/pseudo(?! *ext)/, /account.*(number|no|code)/, /^account$/, /number/], 0) : 0;
    const colDesc = looksLikeHeader ? findCol([/^desc/, /^name$/], 1) : 1;
    const colExt = looksLikeHeader ? findCol([/ext.*(account|pseudo|number|no)/, /^external$/], 2) : 2;
    const colExtDesc = looksLikeHeader ? findCol([/ext.*desc/], 3) : 3;

    const body = looksLikeHeader ? raw.slice(1) : raw;
    const existing = new Set(myAccounts.map(p => p.pseudo.toLowerCase()));
    const seen = new Set<string>();
    const parsed: ImportRow[] = body
      .filter(r => r.some(c => str(c) !== ''))
      .map(r => {
        const pseudo = str(r[colPseudo]);
        const description = str(r[colDesc]);
        let status: ImportRow['status'] = 'new';
        if (!pseudo) status = 'invalid';
        else if (existing.has(pseudo.toLowerCase()) || seen.has(pseudo.toLowerCase())) status = 'duplicate';
        if (pseudo) seen.add(pseudo.toLowerCase());
        return {
          pseudo, description,
          extPseudo: str(r[colExt]) || pseudo,
          extDescription: str(r[colExtDesc]) || description,
          status,
        };
      });
    setImportRows(parsed);
  };

  const onFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImportFileName(file.name);
    try {
      await parseFile(file);
    } catch {
      setImportRows([]);
    }
  };

  const doImport = () => {
    if (!importRows) return;
    const newRows = importRows.filter(r => r.status === 'new');
    update(d => {
      let nextId = Math.max(0, ...d.pseudoAccounts.filter(p => p.entityCode === entity.ownerCode).map(p => p.id));
      for (const r of newRows) {
        nextId += 1;
        d.pseudoAccounts.push({
          entityCode: entity.ownerCode, id: nextId,
          pseudo: r.pseudo, description: r.description,
          extPseudo: r.extPseudo, extDescription: r.extDescription,
          revaluation: false,
          accountKind: defaultAccountKind({ pseudo: r.pseudo }),
        });
      }
    });
    setImportRows(null);
  };

  const downloadTemplate = () => {
    const csv = 'Pseudo account,Description,External account,External description\n140000,Equipment Purchases,140000,Equipment Purchases\n';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'pseudo-accounts-template.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const removeAccount = (id: number) => {
    update(d => {
      d.pseudoAccounts = d.pseudoAccounts.filter(p => !(p.entityCode === entity.ownerCode && p.id === id));
    });
  };

  const unplaced = myAccounts.filter(p => !nodeOf(p.id)).length;

  return (
    <div>
      <div className="toolbar">
        <input
          placeholder="Filter account / description…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
        <div className="spacer" />
        {unplaced > 0 && (
          <span className="muted" style={{ fontSize: 12 }}>
            {unplaced} account{unplaced === 1 ? '' : 's'} not yet placed on the{' '}
            <Link to={`/legal-entity/${entity.id}/chart-of-account`}>chart of account</Link>
          </span>
        )}
        <button className="btn" onClick={downloadTemplate} title="Download an import template (CSV)">
          <Icon name="file" size={14} /> Template
        </button>
        <button className="btn" onClick={() => fileRef.current?.click()} title="Import pseudo accounts from a CSV or Excel file exported from your general ledger">
          <Icon name="swap" size={14} /> Import
        </button>
        <input ref={fileRef} type="file" accept=".csv,.txt,.xlsx,.xls" style={{ display: 'none' }} onChange={onFilePicked} />
        <button className="btn" onClick={() => setShowAdd(true)}><Icon name="plus" size={14} /> Add</button>
      </div>
      <div className="grid-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th>ID</th>
              <th>Pseudo account</th>
              <th>Description</th>
              <th>External account</th>
              <th>External description</th>
              <th>Type</th>
              <th>Chart of account</th>
              <th style={{ width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map(p => {
              const node = nodeOf(p.id);
              return (
                <tr key={p.id} className="clickable" onClick={() => setEditAccount(p)} title="Edit pseudo account">
                  <td>{p.id}</td>
                  <td style={{ fontWeight: 600 }}>{p.pseudo}</td>
                  <td>{p.description}</td>
                  <td>{p.extPseudo || '—'}</td>
                  <td>{p.extDescription}</td>
                  <td>{p.accountKind === 'Result' ? 'Profit & loss' : 'Balance sheet'}</td>
                  <td>
                    {node
                      ? (
                        <Link
                          to={`/legal-entity/${entity.id}/chart-of-account`}
                          title={node.description}
                          onClick={e => e.stopPropagation()}
                        >{node.order} {node.name}</Link>
                      )
                      : <span className="muted">Not placed</span>}
                  </td>
                  <td>
                    <button
                      className="icon-btn del"
                      title={node
                        ? `Cannot remove — placed on chart of account node ${node.order} ${node.name}`
                        : 'Remove pseudo account'}
                      disabled={!!node}
                      onClick={e => { e.stopPropagation(); removeAccount(p.id); }}
                    ><Icon name="trash" size={15} /></button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={8} className="empty">No pseudo accounts.</td></tr>}
          </tbody>
        </table>
      </div>

      {editAccount && (
        <EditPseudoDialog
          entity={entity}
          account={editAccount}
          onClose={() => setEditAccount(null)}
        />
      )}

      {showAdd && (
        <AddPseudoDialog onClose={() => setShowAdd(false)} onSave={(pseudo, description, ext) => {
          update(d => {
            const mine = d.pseudoAccounts.filter(p => p.entityCode === entity.ownerCode);
            const nextId = Math.max(0, ...mine.map(p => p.id)) + 1;
            d.pseudoAccounts.push({
              entityCode: entity.ownerCode, id: nextId, pseudo, description,
              extPseudo: ext || pseudo, extDescription: description, revaluation: false,
              accountKind: defaultAccountKind({ pseudo }),
            });
          });
          setShowAdd(false);
        }} />
      )}

      {importRows !== null && (
        <Dialog title={`Import pseudo accounts — ${importFileName}`} wide onClose={() => setImportRows(null)} footer={
          <>
            <button className="btn ghost" onClick={() => setImportRows(null)}>Cancel</button>
            <button className="btn primary" disabled={importRows.filter(r => r.status === 'new').length === 0} onClick={doImport}>
              Import {importRows.filter(r => r.status === 'new').length} accounts
            </button>
          </>
        }>
          {importRows.length === 0 ? (
            <div className="empty">Could not read any rows from the file. Expected columns: Pseudo account, Description, External account, External description.</div>
          ) : (
            <>
              <p className="muted" style={{ marginTop: 0, fontSize: 12.5 }}>
                {importRows.filter(r => r.status === 'new').length} new ·{' '}
                {importRows.filter(r => r.status === 'duplicate').length} already registered (skipped) ·{' '}
                {importRows.filter(r => r.status === 'invalid').length} invalid (skipped)
              </p>
              <div className="grid-wrap" style={{ maxHeight: 340, boxShadow: 'none' }}>
                <table className="grid">
                  <thead>
                    <tr><th>Pseudo account</th><th>Description</th><th>External account</th><th>External description</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {importRows.map((r, i) => (
                      <tr key={i} style={r.status !== 'new' ? { opacity: 0.5 } : undefined}>
                        <td style={{ fontWeight: 600 }}>{r.pseudo || '—'}</td>
                        <td>{r.description}</td>
                        <td>{r.extPseudo}</td>
                        <td>{r.extDescription}</td>
                        <td>
                          {r.status === 'new' && <span className="pill">New</span>}
                          {r.status === 'duplicate' && <span className="badge-yes">Exists</span>}
                          {r.status === 'invalid' && <span className="badge-diff">No account</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Dialog>
      )}
    </div>
  );
}

// Edit a pseudo account: fields + which of the legal entity's accounting dimensions
// are in use for this account (PseudoAccountExtParts). Required dimensions are locked.
function EditPseudoDialog({ entity, account, onClose }: {
  entity: LegalEntity;
  account: PseudoAccount;
  onClose: () => void;
}) {
  const { data, update } = useStore();
  const [pseudo, setPseudo] = useState(account.pseudo);
  const [description, setDescription] = useState(account.description);
  const [extPseudo, setExtPseudo] = useState(account.extPseudo);
  const [extDescription, setExtDescription] = useState(account.extDescription);
  const [revaluation, setRevaluation] = useState(account.revaluation);
  const [accountKind, setAccountKind] = useState<AccountKind>(account.accountKind);
  const [summarizeToGl, setSummarizeToGl] = useState(account.summarizeToGl ?? false);
  const [keep, setKeep] = useState<number[]>(account.summaryKeepPartIds ?? []);
  const toggleKeep = (id: number) => setKeep(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  const [error, setError] = useState('');

  const dimensions = data.extAccountParts
    .filter(p => p.legalEntityId === entity.id)
    .sort((a, b) => a.partNumber - b.partNumber);

  const initialUsage = Object.fromEntries(dimensions.map(p => {
    const row = data.pseudoAccountExtParts.find(
      x => x.entityCode === entity.ownerCode && x.pseudoAccountId === account.id && x.extAccountPartId === p.id,
    );
    return [p.id, p.required || (row ? row.inUse : true)];
  }));
  const [usage, setUsage] = useState<Record<number, boolean>>(initialUsage);

  const save = () => {
    const code = pseudo.trim();
    if (!code) {
      setError('The pseudo account must have an account code.');
      return;
    }

    const duplicate = data.pseudoAccounts.some(
      p => p.entityCode === entity.ownerCode && p.id !== account.id
        && p.pseudo.toLowerCase() === code.toLowerCase(),
    );
    if (duplicate) {
      setError(`Pseudo account '${code}' already exists for this legal entity.`);
      return;
    }

    update(d => {
      const p = d.pseudoAccounts.find(x => x.entityCode === entity.ownerCode && x.id === account.id);
      if (!p) return;
      p.pseudo = code;
      p.description = description.trim();
      p.extPseudo = extPseudo.trim() || code;
      p.extDescription = extDescription.trim() || description.trim();
      p.revaluation = revaluation;
      p.accountKind = accountKind;
      // GL export summarisation: keep only the dimensions that are both ticked and in use.
      const inUseIds = dimensions.filter(x => x.required || usage[x.id]).map(x => x.id);
      p.summarizeToGl = summarizeToGl;
      p.summaryKeepPartIds = keep.filter(id => inUseIds.includes(id));

      // dimension usage: only opt-out rows are stored — in-use is the default
      for (const dim of dimensions.filter(x => !x.required)) {
        const existing = d.pseudoAccountExtParts.find(
          x => x.entityCode === entity.ownerCode && x.pseudoAccountId === account.id && x.extAccountPartId === dim.id,
        );
        if (usage[dim.id]) {
          if (existing) {
            d.pseudoAccountExtParts = d.pseudoAccountExtParts.filter(x => x.id !== existing.id);
          }
        } else if (existing) {
          existing.inUse = false;
        } else {
          d.pseudoAccountExtParts.push({
            id: Math.max(0, ...d.pseudoAccountExtParts.map(x => x.id)) + 1,
            entityCode: entity.ownerCode,
            pseudoAccountId: account.id,
            extAccountPartId: dim.id,
            inUse: false,
          });
        }
      }
    });
    onClose();
  };

  return (
    <Dialog title={`Pseudo account ${account.pseudo}`} wide onClose={onClose} footer={
      <>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={save}>Save</button>
      </>
    }>
      <div className="form-grid">
        <div className="f">
          <label>Pseudo account</label>
          <input value={pseudo} onChange={e => { setPseudo(e.target.value); setError(''); }} />
          <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>
            Formulas and conditions reference this code — renaming does not update them.
          </div>
        </div>
        <div className="f"><label>External account</label><input value={extPseudo} onChange={e => setExtPseudo(e.target.value)} /></div>
        <div className="f"><label>Description</label><input value={description} onChange={e => setDescription(e.target.value)} /></div>
        <div className="f"><label>External description</label><input value={extDescription} onChange={e => setExtDescription(e.target.value)} /></div>
        <div className="f">
          <label>Account type</label>
          <select value={accountKind} onChange={e => setAccountKind(e.target.value as AccountKind)}>
            <option value="Balance">Balance sheet account (balanskonto)</option>
            <option value="Result">Profit &amp; loss account (resultatkonto)</option>
          </select>
        </div>
        <div className="f" style={{ alignSelf: 'end' }}>
          <label className="checkbox-inline" style={{ marginBottom: 8 }}>
            <input type="checkbox" checked={revaluation} onChange={e => setRevaluation(e.target.checked)} />
            Include in revaluation
          </label>
        </div>
        <div className="f" style={{ alignSelf: 'end' }}>
          <label className="checkbox-inline" style={{ marginBottom: 8 }}>
            <input type="checkbox" checked={summarizeToGl} onChange={e => setSummarizeToGl(e.target.checked)} />
            Summarise to GL
          </label>
          <div className="muted" style={{ fontSize: 11 }}>Net to one GL line (when the integration profile is Per-account).</div>
        </div>
      </div>

      <div className="section-strip" style={{ marginTop: 18 }}>Accounting dimensions in use</div>
      {dimensions.length === 0 ? (
        <p className="muted" style={{ fontSize: 12.5 }}>
          No accounting dimensions are defined for {entity.ownerCode} yet — set them up under{' '}
          <Link to={`/legal-entity/${entity.id}/dimensions`} onClick={onClose}>Accounting Dimensions</Link>.
        </p>
      ) : (
        <>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 0 }}>
            The account dimension on transaction lines for this account only includes the
            dimensions in use here — even when the message carries other values.
            {summarizeToGl && ' “Keep” chooses which of them survive when this account is summarised to the GL.'}
          </p>
          <table className="cond-table" style={{ maxWidth: 640 }}>
            <thead>
              <tr>
                <th style={{ width: 30 }}>#</th>
                <th>Dimension</th>
                <th style={{ width: 80, textAlign: 'center' }}>In use</th>
                <th style={{ width: 130, textAlign: 'center' }} title="Kept when this account is summarised to the GL">Keep in summary</th>
                <th style={{ width: 80 }} />
              </tr>
            </thead>
            <tbody>
              {dimensions.map(dim => {
                const inUse = usage[dim.id] ?? true;
                return (
                  <tr key={dim.id}>
                    <td className="muted" style={{ fontWeight: 600 }}>{dim.partNumber}</td>
                    <td>{dim.name}</td>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={inUse}
                        disabled={dim.required}
                        title={dim.required ? 'Required on the legal entity — always in use' : undefined}
                        onChange={e => setUsage(prev => ({ ...prev, [dim.id]: e.target.checked }))}
                      />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={keep.includes(dim.id)}
                        disabled={!summarizeToGl || !inUse}
                        title={!summarizeToGl ? 'Enable “Summarise to GL” to keep dimensions' : (!inUse ? 'Not in use for this account' : undefined)}
                        onChange={() => toggleKeep(dim.id)}
                      />
                    </td>
                    <td>{dim.required && <span className="pill">Required</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
      {error && <p className="badge-diff" style={{ display: 'inline-block', marginTop: 14 }}>{error}</p>}
    </Dialog>
  );
}

function AddPseudoDialog({ onClose, onSave }: {
  onClose: () => void;
  onSave: (pseudo: string, description: string, ext: string) => void;
}) {
  const [pseudo, setPseudo] = useState('');
  const [description, setDescription] = useState('');
  const [ext, setExt] = useState('');
  return (
    <Dialog title="Add pseudo account" onClose={onClose} footer={
      <>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!pseudo.trim()} onClick={() => onSave(pseudo.trim(), description.trim(), ext.trim())}>Save</button>
      </>
    }>
      <div className="form-grid">
        <div className="f"><label>Pseudo account</label><input value={pseudo} onChange={e => setPseudo(e.target.value)} /></div>
        <div className="f"><label>External account</label><input value={ext} onChange={e => setExt(e.target.value)} placeholder="Same as pseudo if empty" /></div>
        <div className="f full"><label>Description</label><input value={description} onChange={e => setDescription(e.target.value)} /></div>
      </div>
    </Dialog>
  );
}
