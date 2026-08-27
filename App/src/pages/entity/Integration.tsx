import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useStore, formatAmount } from '../../store';
import { Icon } from '../../components/Icon';
import { buildExportPreview, commitExportInDraft, sendBatchInDraft, resolveExportFileName, DEFAULT_FILENAME_PATTERN, FILENAME_TOKENS, toCsv, toJson } from '../../glexport';
import type { LegalEntity, ExportBatch, Integration } from '../../types';

// Join a directory and file name with a backslash (the paths are Windows/UNC style).
const joinPath = (dir: string, file: string) => (dir ? `${dir.replace(/[\\/]+$/, '')}\\${file}` : file);

const statusPill = (b: ExportBatch) => (
  b.status === 'Acknowledged' ? <span className="pill">Acknowledged</span>
    : b.status === 'Failed' ? <span className="badge-diff">Failed</span>
      : <span className="pill inactive">Exported</span>
);

const execLabel = (t: string) => (t === 'EndOfMonth' ? 'End of Month' : t === 'Recurring' ? 'End of Month' : 'Manual');

// The accounting ledgers configured for a legal entity (via its accounting classes → ledgers).
function entityLedgers(data: ReturnType<typeof useStore>['data'], entityId: number): string[] {
  const classIds = new Set(data.legalAccountingClasses.filter(c => c.legalEntityId === entityId).map(c => c.id));
  const ledgerIds = new Set(data.legalAccountingLedgers.filter(l => classIds.has(l.legalAccountingClassId)).map(l => l.ledgerId));
  const configured = data.ledgers.filter(l => ledgerIds.has(l.id)).map(l => l.description || l.name);
  return configured.length ? [...new Set(configured)] : data.ledgers.map(l => l.description || l.name);
}

type SummarizationMode = Integration['summarization'];
const modeLabel: Record<SummarizationMode, string> = {
  Full: 'Full detail', Summarized: 'Summarised (all accounts)', PerAccount: 'Per-account',
};

function download(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

const fileBase = (b: ExportBatch, ownerCode: string) =>
  b.fileName || `GL_${ownerCode}_${b.ledger.replace(/\s+/g, '')}_${b.period}_${b.id}`;

// The entity's GL integration(s) — one record per target GL that holds both the delivery config
// (file/location/schedule) and the export-content config (format, transport, summarisation). The
// manual End of Month run maps pseudo → external accounts, applies the exported-booking-date rule,
// summarises per the integration, and produces a balanced batch + file, stamping exportDate.
export default function Integration() {
  const entity = useOutletContext<LegalEntity>();
  const { data, update } = useStore();
  const [openId, setOpenId] = useState<number | null>(null);

  const ledgerOptions = entityLedgers(data, entity.id);
  const rows = data.integrations.filter(i => i.legalEntityId === entity.id);
  const open = rows.find(r => r.id === openId);

  const [selectedId, setSelectedId] = useState<number | null>(rows[0]?.id ?? null);
  const [ledgerSel, setLedgerSel] = useState(''); // '' = follow the integration's configured ledger
  const [period, setPeriod] = useState(entity.openPeriod);
  const [override, setOverride] = useState<'' | SummarizationMode>('');
  const [preview, setPreview] = useState<ReturnType<typeof buildExportPreview> | null>(null);
  const [doneBatchId, setDoneBatchId] = useState<number | null>(null);

  const config = rows.find(r => r.id === selectedId) ?? rows[0]; // the integration the manual run targets
  const ledger = ledgerSel || config?.ledger || 'ALL'; // run-time ledger (defaults to the integration's)
  const batches = data.exportBatches.filter(b => b.legalEntityId === entity.id);
  const doneBatch = batches.find(b => b.id === doneBatchId);

  // The run reads the selected integration's configured summarisation; override is a test lever.
  const mode: SummarizationMode = (override || config?.summarization || 'Full') as SummarizationMode;
  const policy = { mode, defaultKeepPartIds: config?.defaultKeepPartIds ?? [] };
  const resetRun = () => { setPreview(null); setDoneBatchId(null); };

  const runPreview = () => {
    setDoneBatchId(null);
    setPreview(buildExportPreview(data, entity.id, ledger, period, policy));
  };

  const confirmExport = () => {
    if (!config) return;
    let newId: number | null = null;
    update(d => {
      const cfg = d.integrations.find(i => i.id === config.id);
      if (!cfg) return;
      const res = commitExportInDraft(d, cfg, ledger, period, policy, 'Rikard Krameus');
      newId = res ? res.batchId : null;
    });
    if (newId != null) { setPreview(null); setDoneBatchId(newId); }
  };

  const sendBatch = (batchId: number, fail: boolean) => update(d => sendBatchInDraft(d, batchId, fail));

  // Delivery controls for a batch: File is delivered as the file itself; API/Queue can be sent to
  // the GL, then Acknowledged (with a reference) or Failed (with a reason, re-sendable).
  const deliveryControls = (b: ExportBatch) => {
    if (b.transport === 'File') return <span className="muted" style={{ fontSize: 11 }}>delivered as file</span>;
    if (b.status === 'Acknowledged') {
      return (
        <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
          <span className="muted" style={{ fontSize: 11 }}>{b.deliveryRef} · {b.deliveredAt}</span>
          <button className="btn small ghost" onClick={() => sendBatch(b.id, false)} title="Send again">Re-send</button>
        </span>
      );
    }
    return (
      <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn small" onClick={() => sendBatch(b.id, false)}><Icon name="swap" size={12} /> {b.status === 'Failed' ? 'Re-send' : `Send (${b.transport})`}</button>
        {b.status !== 'Failed' && <button className="btn small ghost" onClick={() => sendBatch(b.id, true)} title="Simulate a transport failure">Simulate fail</button>}
        {b.status === 'Failed' && <span className="badge-diff" style={{ fontSize: 11 }}>{b.deliveryError}</span>}
      </span>
    );
  };

  const addIntegration = () => {
    const newId = Math.max(0, ...data.integrations.map(i => i.id)) + 1;
    update(d => {
      d.integrations.push({
        id: newId, legalEntityId: entity.id, name: 'GL export', description: '',
        fileName: '', fileLocation: '', archiveLocation: '', status: 'Active', executionType: 'EndOfMonth',
        nextSequence: 1, lastExecution: '', lastExecutionBy: '', records: 0,
        targetGl: 'Generic', format: 'JSON', transport: 'File', ledger: 'ALL', summarization: 'PerAccount', defaultKeepPartIds: [],
      });
    });
    setOpenId(newId);
  };

  if (open) {
    return <IntegrationDetail entity={entity} integration={open} ledgerOptions={ledgerOptions} onBack={() => setOpenId(null)} />;
  }

  return (
    <div>
      {/* ---- End of Month export run ---- */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="pagelike-title" style={{ marginTop: 0 }}><Icon name="swap" size={16} /> Export to general ledger</div>
        <p className="muted" style={{ marginTop: 0, fontSize: 12.5 }}>
          Manually run one of this entity's integrations. Un-exported journals booked in the period (or earlier — a
          closed-period entry rolls forward to the first day of the current period) are mapped from pseudo to external
          accounts and written to a balanced batch, summarised as the integration configures. End-of-Month integrations
          also run automatically as part of the entity's End of Month.
        </p>
        {config && (
          <>
            <div className="field-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', marginBottom: 8, alignItems: 'center' }}>
              <div className="field"><label>Target GL</label><div className="val">{config.targetGl}</div></div>
              <div className="field"><label>Format · transport</label><div className="val">{config.format} · {config.transport}</div></div>
              <div className="field"><label>Ledger</label><div className="val">{config.ledger === 'ALL' ? 'ALL (every ledger)' : config.ledger}</div></div>
              <div className="field"><label>Summarisation</label><div className="val">{modeLabel[config.summarization]}{config.summarization === 'Summarized' && config.defaultKeepPartIds.length > 0 && <span className="muted" style={{ fontSize: 11 }}> · keeps {config.defaultKeepPartIds.length} dim</span>}</div></div>
              <div className="field"><label>&nbsp;</label><button className="btn small ghost" onClick={() => setOpenId(config.id)}><Icon name="pencil" size={13} /> Edit configuration</button></div>
            </div>
            <p className="muted" style={{ marginTop: 0, marginBottom: 12, fontSize: 12 }}>
              Execution type: <b>{execLabel(config.executionType)}</b> — {execLabel(config.executionType) === 'End of Month'
                ? 'runs automatically at End of Month, and can also be run manually here.'
                : 'only runs manually here — the End of Month run does not export it.'}
            </p>
          </>
        )}
        <div className="form-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', maxWidth: 900, alignItems: 'end' }}>
          <div className="f">
            <label>Integration to run</label>
            <select value={config?.id ?? ''} onChange={e => { setSelectedId(Number(e.target.value)); setLedgerSel(''); resetRun(); }}>
              {rows.map(r => <option key={r.id} value={r.id}>{r.name} · {r.targetGl} · {r.ledger}</option>)}
            </select>
          </div>
          <div className="f">
            <label>Ledger <span className="muted" style={{ fontWeight: 400, fontSize: 11 }}>· defaults to the integration's</span></label>
            <select value={ledger} onChange={e => { setLedgerSel(e.target.value); resetRun(); }}>
              <option value="ALL">ALL (every ledger)</option>
              {ledgerOptions.filter(l => l !== 'ALL').map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div className="f"><label>Period</label><input value={period} onChange={e => { setPeriod(e.target.value); resetRun(); }} placeholder="YYYYMM" inputMode="numeric" /></div>
          <div className="f">
            <label>Summarisation <span className="muted" style={{ fontWeight: 400, fontSize: 11 }}>· test override</span></label>
            <select value={override} onChange={e => { setOverride(e.target.value as '' | SummarizationMode); resetRun(); }}>
              <option value="">Use configuration ({modeLabel[config?.summarization ?? 'Full']})</option>
              <option value="Full">Full detail</option>
              <option value="Summarized">Summarised (all accounts)</option>
              <option value="PerAccount">Per-account</option>
            </select>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <button className="btn primary" onClick={runPreview} disabled={!config}>Preview export</button>
        </div>

        {preview && (
          <div style={{ marginTop: 14 }}>
            {preview.heldBack.length > 0 && (
              <div className="info-card" style={{ borderLeftColor: 'var(--amber-text)', fontSize: 12.5, marginBottom: 10 }}>
                {preview.heldBack.length} journal{preview.heldBack.length === 1 ? '' : 's'} held back — not balanced, must be corrected before export: journal {preview.heldBack.join(', ')}.
              </div>
            )}
            {preview.lines.length === 0 ? (
              <div className="info-card" style={{ fontSize: 13 }}>Nothing to export — no balanced, un-exported {ledger} journals in period {period} or earlier.</div>
            ) : (
              <>
                <div className="field-grid" style={{ gridTemplateColumns: 'repeat(6, 1fr)', marginBottom: 10 }}>
                  <div className="field"><label>Journals</label><div className="val">{preview.gliList.length}</div></div>
                  <div className="field"><label>Source lines</label><div className="val">{preview.sourceLineCount}</div></div>
                  <div className="field"><label>Export lines</label><div className="val">{preview.lines.length}{mode !== 'Full' && <span className="muted" style={{ fontSize: 11 }}> · {modeLabel[mode].toLowerCase()}</span>}</div></div>
                  <div className="field"><label>Total debit / credit</label><div className="val">{formatAmount(preview.totalDebit)} / {formatAmount(preview.totalCredit)}</div></div>
                  <div className="field"><label>Base ({preview.baseCurrency}) Dr / Cr</label><div className="val">{formatAmount(preview.totalBaseDebit)} / {formatAmount(preview.totalBaseCredit)}</div></div>
                  <div className="field"><label>Balanced</label><div className="val">{preview.balanced ? <span className="pill">Yes</span> : <span className="badge-diff">No</span>}</div></div>
                </div>
                {preview.roundingTotal > 0 && (
                  <div className="info-card" style={{ fontSize: 12.5, marginBottom: 10, borderLeftColor: preview.missingExchangeAccount ? 'var(--amber-text)' : undefined }}>
                    {preview.missingExchangeAccount
                      ? <>Base-currency rounding of {formatAmount(preview.roundingTotal)} {preview.baseCurrency} cannot be booked — no <b>Exchange difference account</b> is set on this legal entity, so the batch does not balance in {preview.baseCurrency}.</>
                      : <>Base-currency rounding of {formatAmount(preview.roundingTotal)} {preview.baseCurrency} booked to the exchange difference account so the batch balances in {preview.baseCurrency}.</>}
                  </div>
                )}
                <div className="grid-wrap" style={{ maxHeight: 300 }}>
                  <table className="grid">
                    <thead>
                      <tr><th>Voucher</th><th>Ext. account</th><th>Description</th><th>Ledger</th><th>Booking date</th><th>Cur</th><th className="num">Debit</th><th className="num">Credit</th><th className="num">Base Dr</th><th className="num">Base Cr</th><th>Dimensions</th><th className="num">Src journal</th></tr>
                    </thead>
                    <tbody>
                      {preview.lines.map((l, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 600 }}>{l.voucherNo ?? '—'}</td>
                          <td style={{ fontWeight: 600 }}>{l.externalAccount}</td>
                          <td>{l.externalDescription}</td>
                          <td>{l.ledger}</td>
                          <td>{l.bookingDate}</td>
                          <td>{l.currency}</td>
                          <td className="num">{l.debit ? formatAmount(l.debit) : ''}</td>
                          <td className="num">{l.credit ? formatAmount(l.credit) : ''}</td>
                          <td className="num">{l.baseDebit ? formatAmount(l.baseDebit) : ''}</td>
                          <td className="num">{l.baseCredit ? formatAmount(l.baseCredit) : ''}</td>
                          <td style={{ fontFamily: 'Consolas, monospace', fontSize: 12 }}>{l.dimensions || '—'}</td>
                          <td className="num">{l.sourceGli ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
                  <button className="btn primary" disabled={!preview.balanced} onClick={confirmExport}><Icon name="check" size={14} /> Confirm export</button>
                  <button className="btn ghost" onClick={() => setPreview(null)}>Cancel</button>
                  <span className="muted" style={{ fontSize: 12 }}>Stamps export date on {preview.gliList.length} journal{preview.gliList.length === 1 ? '' : 's'} and files the batch.</span>
                </div>
              </>
            )}
          </div>
        )}

        {doneBatch && (
          <div className="info-card" style={{ marginTop: 14, borderLeftColor: 'var(--green, #16a34a)', fontSize: 13 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <b>Batch #{doneBatch.id} exported</b> — {doneBatch.lineCount} lines · {formatAmount(doneBatch.totalDebit)} balanced · {doneBatch.gliList.length} journals stamped.
              {statusPill(doneBatch)}<span className="muted" style={{ fontSize: 11 }}>via {doneBatch.transport}</span>
            </div>
            {doneBatch.outboundPath && (
              <div style={{ marginTop: 6, fontSize: 11.5, fontFamily: 'Consolas, monospace' }}>
                <div>Outbound: {doneBatch.outboundPath}</div>
                {doneBatch.status === 'Acknowledged' && doneBatch.archivePath && <div className="muted">Archived: {doneBatch.archivePath}</div>}
              </div>
            )}
            <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn small" onClick={() => download(`${fileBase(doneBatch, entity.ownerCode)}.${(config?.format ?? 'JSON').toLowerCase()}`, config?.format === 'CSV' ? toCsv(doneBatch) : toJson(doneBatch), config?.format === 'CSV' ? 'text/csv' : 'application/json')}><Icon name="download" size={13} /> {config?.format ?? 'JSON'}</button>
              <button className="btn small ghost" onClick={() => download(`${fileBase(doneBatch, entity.ownerCode)}.csv`, toCsv(doneBatch), 'text/csv')}>CSV</button>
              <button className="btn small ghost" onClick={() => download(`${fileBase(doneBatch, entity.ownerCode)}.json`, toJson(doneBatch), 'application/json')}>JSON</button>
              <span style={{ marginLeft: 6 }}>{deliveryControls(doneBatch)}</span>
            </div>
          </div>
        )}
      </div>

      {/* ---- Configured integrations ---- */}
      <div className="toolbar">
        <div className="pagelike-title" style={{ margin: 0, fontSize: 15 }}>Integrations</div>
        <div className="spacer" />
        <button className="btn" onClick={addIntegration}><Icon name="plus" size={14} /> Add integration</button>
      </div>
      <div className="grid-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th style={{ width: 30 }} />
              <th>Name</th>
              <th>Target GL</th>
              <th>Format</th>
              <th>Ledger</th>
              <th>Execution</th>
              <th>Summarisation</th>
              <th>Last execution</th>
              <th className="num">Records</th>
              <th style={{ width: 110 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="clickable" onClick={() => setOpenId(r.id)}>
                <td><button className="expander">+</button></td>
                <td>{r.name}</td>
                <td>{r.targetGl}</td>
                <td>{r.format}</td>
                <td>{r.ledger === 'ALL' ? 'ALL' : r.ledger}</td>
                <td>{execLabel(r.executionType)}</td>
                <td>{modeLabel[r.summarization]}</td>
                <td>{r.lastExecution || '—'}</td>
                <td className="num">{r.records.toLocaleString('sv-SE')}</td>
                <td onClick={e => e.stopPropagation()}>
                  <button className="btn small" onClick={() => { setSelectedId(r.id); resetRun(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} title="Select this integration in the run panel">Run…</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={10} className="empty">No integrations configured.</td></tr>}
          </tbody>
        </table>
      </div>

      <VoucherSeriesCard entity={entity} ledgerOptions={ledgerOptions.filter(l => l !== 'ALL')} />

      {/* ---- Export history ---- */}
      {batches.length > 0 && (
        <div className="grid-wrap" style={{ marginTop: 16 }}>
          <div className="pagelike-title" style={{ marginTop: 0, fontSize: 15 }}>Export history</div>
          <table className="grid">
            <thead>
              <tr><th className="num">Batch</th><th>Generated</th><th>Ledger</th><th>Period</th><th className="num">Lines</th><th>Transport</th><th>Status</th><th>Files</th><th>Delivery</th></tr>
            </thead>
            <tbody>
              {batches.map(b => (
                <tr key={b.id}>
                  <td className="num">#{b.id}</td>
                  <td>{b.generatedAt} · {b.generatedBy}</td>
                  <td>{b.ledger}</td>
                  <td>{b.period}</td>
                  <td className="num">{b.lineCount}</td>
                  <td>{b.transport}</td>
                  <td>{statusPill(b)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn small ghost" onClick={() => download(`${fileBase(b, entity.ownerCode)}.csv`, toCsv(b), 'text/csv')}>CSV</button>
                      <button className="btn small ghost" onClick={() => download(`${fileBase(b, entity.ownerCode)}.json`, toJson(b), 'application/json')}>JSON</button>
                    </div>
                  </td>
                  <td>{deliveryControls(b)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Per-ledger export voucher series: each ledger can have its own gapless sequence (prefix + next
// number) so the target GL gets a hole-free run; a ledger without one falls back to the entity GLI
// number. Editable inline; saving upserts / removes the LedgerSerie rows.
function VoucherSeriesCard({ entity, ledgerOptions }: { entity: LegalEntity; ledgerOptions: string[] }) {
  const { data, update } = useStore();
  const existing = data.ledgerSeries.filter(s => s.legalEntityId === entity.id);
  type Row = { ledger: string; own: boolean; prefix: string; nextNumber: string };
  const [rows, setRows] = useState<Row[]>(() => ledgerOptions.map(l => {
    const s = existing.find(x => x.ledger === l);
    return { ledger: l, own: !!s, prefix: s?.prefix ?? '', nextNumber: s ? String(s.nextNumber) : '' };
  }));
  const patch = (ledger: string, p: Partial<Row>) => setRows(prev => prev.map(r => (r.ledger === ledger ? { ...r, ...p } : r)));

  const save = () => {
    update(d => {
      let nextId = Math.max(0, ...d.ledgerSeries.map(s => s.id));
      for (const r of rows) {
        const cur = d.ledgerSeries.find(s => s.legalEntityId === entity.id && s.ledger === r.ledger);
        if (r.own) {
          const n = Number(r.nextNumber) || 1;
          if (cur) { cur.prefix = r.prefix.trim() || undefined; cur.nextNumber = n; }
          else d.ledgerSeries.push({ id: ++nextId, legalEntityId: entity.id, ledger: r.ledger, prefix: r.prefix.trim() || undefined, nextNumber: n });
        } else if (cur) {
          d.ledgerSeries = d.ledgerSeries.filter(s => s.id !== cur.id);
        }
      }
    });
  };

  if (ledgerOptions.length === 0) return null;
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="pagelike-title" style={{ marginTop: 0, fontSize: 15 }}>Export voucher number series</div>
      <p className="muted" style={{ marginTop: 0, fontSize: 12.5 }}>
        Give a ledger its own gapless voucher series so the target GL receives a hole-free sequence (an audit
        requirement in some countries). A ledger without its own series falls back to the entity's journal number.
      </p>
      <table className="cond-table" style={{ maxWidth: 620 }}>
        <thead>
          <tr><th>Ledger</th><th style={{ width: 110, textAlign: 'center' }}>Own series</th><th style={{ width: 120 }}>Prefix</th><th style={{ width: 140 }}>Next number</th></tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.ledger}>
              <td style={{ fontWeight: 600 }}>{r.ledger}</td>
              <td style={{ textAlign: 'center' }}><input type="checkbox" checked={r.own} onChange={e => patch(r.ledger, { own: e.target.checked })} /></td>
              <td>{r.own ? <input value={r.prefix} onChange={e => patch(r.ledger, { prefix: e.target.value })} placeholder="e.g. LL-" /> : <span className="muted" style={{ fontSize: 12 }}>uses entity journal number</span>}</td>
              <td>{r.own && <input value={r.nextNumber} onChange={e => patch(r.ledger, { nextNumber: e.target.value })} placeholder="5001" inputMode="numeric" />}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 12 }}><button className="btn primary" onClick={save}>Save series</button></div>
    </div>
  );
}

// Editable GL04 integration detail: delivery config (name/file/location/schedule) + export-content
// config (target GL, format, transport, ledger, summarisation, kept dimensions).
function IntegrationDetail({ entity, integration, ledgerOptions, onBack }: {
  entity: LegalEntity; integration: Integration; ledgerOptions: string[]; onBack: () => void;
}) {
  const { data, update } = useStore();
  const [f, setF] = useState<Integration>({ ...integration });
  const set = <K extends keyof Integration>(k: K, v: Integration[K]) => setF(prev => ({ ...prev, [k]: v }));

  const dims = data.extAccountParts.filter(p => p.legalEntityId === entity.id).sort((a, b) => a.partNumber - b.partNumber);
  const toggleKeep = (id: number) => set('defaultKeepPartIds', f.defaultKeepPartIds.includes(id) ? f.defaultKeepPartIds.filter(x => x !== id) : [...f.defaultKeepPartIds, id]);
  // Live example of the file name the next run would produce (pattern + entity + sequence + now).
  const nextBatchId = Math.max(0, ...data.exportBatches.map(b => b.id)) + 1;
  const sampleName = resolveExportFileName(
    { ...f, fileNamePattern: f.fileNamePattern || DEFAULT_FILENAME_PATTERN },
    entity.ownerCode,
    { seq: f.nextSequence, when: new Date(), period: entity.openPeriod, ledger: f.ledger, batch: nextBatchId },
  ) + '.' + f.format.toLowerCase();

  const save = () => {
    update(d => {
      const i = d.integrations.find(x => x.id === integration.id);
      if (!i) return;
      Object.assign(i, {
        name: f.name.trim() || i.name, description: f.description, fileName: f.fileName,
        fileNamePattern: (f.fileNamePattern ?? '').trim() || DEFAULT_FILENAME_PATTERN,
        fileLocation: f.fileLocation, archiveLocation: f.archiveLocation, nextSequence: Number(f.nextSequence) || i.nextSequence,
        status: f.status, executionType: f.executionType,
        targetGl: f.targetGl.trim() || 'Generic', format: f.format, transport: f.transport,
        ledger: f.ledger, summarization: f.summarization, defaultKeepPartIds: f.defaultKeepPartIds,
      });
    });
    onBack();
  };

  return (
    <div>
      <div className="pagelike-title">
        <button className="btn small ghost" onClick={onBack} style={{ marginRight: 10 }}>← Back</button>
        Integration {integration.name} — {entity.ownerCode}
      </div>

      <div className="card">
        <div className="section-strip" style={{ marginTop: 0 }}>Delivery</div>
        <div className="form-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div className="f"><label>Name</label><input value={f.name} onChange={e => set('name', e.target.value)} /></div>
          <div className="f full" style={{ gridColumn: 'span 2' }}><label>Description</label><input value={f.description} onChange={e => set('description', e.target.value)} /></div>
          <div className="f"><label>Logical file name <span className="muted" style={{ fontWeight: 400, fontSize: 11 }}>· {'{logical}'}</span></label><input value={f.fileName} onChange={e => set('fileName', e.target.value)} placeholder="PF201" /></div>
          <div className="f"><label>Next sequence <span className="muted" style={{ fontWeight: 400, fontSize: 11 }}>· {'{seq}'}</span></label><input value={String(f.nextSequence)} onChange={e => set('nextSequence', Number(e.target.value) || 0)} inputMode="numeric" /></div>
          <div className="f" />
          <div className="f" style={{ gridColumn: 'span 3' }}>
            <label>File name pattern</label>
            <input value={f.fileNamePattern ?? DEFAULT_FILENAME_PATTERN} onChange={e => set('fileNamePattern', e.target.value)} style={{ fontFamily: 'Consolas, monospace' }} />
            <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>Tokens: {FILENAME_TOKENS.map(x => `{${x}}`).join(' ')} — extension added from the format.</div>
            <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
              Kept short on purpose: the folder path already carries entity and interface, and the payload header carries the full
              metadata. {'{seq}'} is fixed when the batch is created, so a re-send reproduces the same file name instead of a duplicate.
            </div>
          </div>
          <div className="f" style={{ gridColumn: 'span 3' }}><label>File location <span className="muted" style={{ fontWeight: 400, fontSize: 11 }}>· outbound path</span></label><input value={f.fileLocation} onChange={e => set('fileLocation', e.target.value)} /></div>
          <div className="f" style={{ gridColumn: 'span 3' }}><label>Archive location <span className="muted" style={{ fontWeight: 400, fontSize: 11 }}>· moved here once delivered / imported</span></label><input value={f.archiveLocation} onChange={e => set('archiveLocation', e.target.value)} /></div>
          <div className="f" style={{ gridColumn: 'span 3' }}>
            <label>Resolved file (next run)</label>
            <div className="val" style={{ fontFamily: 'Consolas, monospace', fontSize: 12.5, color: 'var(--ink)' }}>{sampleName}</div>
            <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>Outbound: {joinPath(f.fileLocation, sampleName) || '—'}</div>
            <div className="muted" style={{ fontSize: 11 }}>Archive: {joinPath(f.archiveLocation, sampleName) || '—'}</div>
            <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>
              Written atomically: staged as <b>{sampleName}.tmp</b> and renamed to the final name once complete, so the GL never
              picks up a half-written file. Moved to the archive path once imported / acknowledged.
            </div>
          </div>
          <div className="f">
            <label>Status</label>
            <select value={f.status} onChange={e => set('status', e.target.value)}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          <div className="f">
            <label>Execution type</label>
            <select value={f.executionType === 'Recurring' ? 'EndOfMonth' : f.executionType} onChange={e => set('executionType', e.target.value)}>
              <option value="EndOfMonth">End of Month (+ manual)</option>
              <option value="Manual">Manual only</option>
            </select>
            <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>
              {(f.executionType === 'EndOfMonth' || f.executionType === 'Recurring')
                ? 'Runs automatically at End of Month; a manual run is always available too.'
                : 'Only manual runs — not fired by the End of Month run.'}
            </div>
          </div>
        </div>

        <div className="section-strip" style={{ marginTop: 18 }}>Export content</div>
        <p className="muted" style={{ fontSize: 12.5, marginTop: 0 }}>
          What the End of Month run produces for this GL: the file format/transport and how much detail is sent.
          Per-account summarisation is driven by each pseudo account's “Summarise to GL” flag.
        </p>
        <div className="form-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div className="f"><label>Target general ledger</label><input value={f.targetGl} onChange={e => set('targetGl', e.target.value)} placeholder="Generic / Visma / SAP…" /></div>
          <div className="f">
            <label>File format</label>
            <select value={f.format} onChange={e => set('format', e.target.value as Integration['format'])}>
              <option value="JSON">JSON</option>
              <option value="CSV">CSV</option>
            </select>
          </div>
          <div className="f">
            <label>Transport</label>
            <select value={f.transport} onChange={e => set('transport', e.target.value as Integration['transport'])}>
              <option value="File">File</option>
              <option value="API">API</option>
              <option value="Queue">Queue</option>
            </select>
          </div>
          <div className="f">
            <label>Ledger</label>
            <select value={f.ledger} onChange={e => set('ledger', e.target.value)}>
              <option value="ALL">ALL (every ledger)</option>
              {[...new Set([f.ledger, ...ledgerOptions])].filter(l => l && l !== 'ALL').map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>ALL includes every accounting ledger on this entity in one run.</div>
          </div>
          <div className="f" style={{ gridColumn: 'span 2' }}>
            <label>Summarisation</label>
            <select value={f.summarization} onChange={e => set('summarization', e.target.value as SummarizationMode)}>
              <option value="Full">Full detail — every subledger line</option>
              <option value="Summarized">Summarised — net all accounts</option>
              <option value="PerAccount">Per-account — each pseudo account's own setting</option>
            </select>
          </div>
        </div>

        {f.summarization === 'Summarized' && dims.length > 0 && (
          <>
            <div className="section-strip" style={{ marginTop: 16 }}>Dimensions kept in the summary</div>
            <table className="cond-table" style={{ maxWidth: 480 }}>
              <thead><tr><th style={{ width: 30 }}>#</th><th>Dimension</th><th style={{ width: 70, textAlign: 'center' }}>Keep</th></tr></thead>
              <tbody>
                {dims.map(d => (
                  <tr key={d.id}>
                    <td className="muted" style={{ fontWeight: 600 }}>{d.partNumber}</td>
                    <td>{d.name}</td>
                    <td style={{ textAlign: 'center' }}><input type="checkbox" checked={f.defaultKeepPartIds.includes(d.id)} onChange={() => toggleKeep(d.id)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
          <button className="btn primary" onClick={save}>Save</button>
          <button className="btn ghost" onClick={onBack}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
