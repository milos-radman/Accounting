import type { AppData, ExportBatch, ExportBatchLine, ExtAccountPart, Integration } from './types';
import { exportBookingDate, inUseParts, gliLabel } from './engine';

// Resolve the export voucher number for each journal: the next number in its (single) ledger's
// gapless series, or the entity GLI number when that ledger has no series. Read-only — returns the
// mapping plus the resulting next number per series, so callers can persist the advance.
export function assignVouchers(data: AppData, gliList: number[]): { byGli: Map<number, string>; seriesEnd: Map<number, number> } {
  const journals = gliList
    .map(g => data.journals.find(j => j.gliNumber === g))
    .filter((j): j is NonNullable<typeof j> => !!j)
    .sort((a, b) => a.gliNumber - b.gliNumber);
  const counters = new Map<number, number>(); // serie id → running next number
  const byGli = new Map<number, string>();
  for (const j of journals) {
    const jLedger = j.lines[0]?.ledger ?? '';
    const serie = data.ledgerSeries.find(s => s.legalEntityId === j.legalEntityId && s.ledger === jLedger);
    if (serie) {
      const c = counters.get(serie.id) ?? serie.nextNumber;
      byGli.set(j.gliNumber, `${serie.prefix ?? ''}${c}`);
      counters.set(serie.id, c + 1);
    } else {
      byGli.set(j.gliNumber, gliLabel(j)); // fallback: the entity-level GLI number
    }
  }
  return { byGli, seriesEnd: counters };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const periodOf = (bookingDate: string) => bookingDate.slice(0, 7).replace('-', '');

// How a run summarises. 'Full' = every line; 'Summarized' = net all accounts (keep the default
// dimensions); 'PerAccount' = each pseudo account decides via its summarizeToGl / keep flags.
export interface SummaryPolicy {
  mode: 'Full' | 'Summarized' | 'PerAccount';
  defaultKeepPartIds: number[];
}

// Split a stored external account string back into its dimension values, keyed by part id. With a
// separator the segments line up with the in-use parts; without one each part is a fixed slice.
function parseExternal(str: string, parts: ExtAccountPart[], separator: string): Map<number, string> {
  const map = new Map<number, string>();
  if (separator) {
    const segs = str.split(separator);
    parts.forEach((p, i) => map.set(p.id, (segs[i] ?? '').trim()));
  } else {
    let off = 0;
    for (const p of parts) {
      const len = Math.max(1, p.length);
      map.set(p.id, str.slice(off, off + len).trim());
      off += len;
    }
  }
  return map;
}

// Rebuild an external account string keeping only the values of the kept parts (others blanked),
// using the entity's join/pad rules — this is the dimension string a summarised line carries.
function maskExternal(values: Map<number, string>, parts: ExtAccountPart[], separator: string, keep: Set<number>): string {
  const out = parts.map(p => {
    const raw = keep.has(p.id) ? (values.get(p.id) ?? '') : '';
    return separator ? raw : raw.padEnd(Math.max(1, p.length), ' ').slice(0, Math.max(1, p.length));
  });
  const joined = out.join(separator);
  return joined.trim() ? joined : '';
}

// Candidate journals for an End of Month / scheduled run for `period`: not yet exported, in this
// entity, booked in this period or earlier (a closed-period catch-up rolls forward to the current
// period at export), carrying at least one line in the target ledger.
export function candidateJournals(data: AppData, entityId: number, ledger: string, period: string) {
  return data.journals.filter(
    j => j.legalEntityId === entityId
      && j.exportDate == null
      && periodOf(j.bookingDate) <= period
      && (ledger === 'ALL' || j.lines.some(l => l.ledger === ledger)),
  );
}

export interface ExportPreview {
  lines: ExportBatchLine[];
  gliList: number[];
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
  sourceLineCount: number;
  heldBack: number[]; // GLIs excluded because the journal is not balanced (needs correction first)
  // Base-currency conversion + the rounding residual it produces (see exchangeDifferenceAccount).
  baseCurrency: string;
  totalBaseDebit: number;
  totalBaseCredit: number;
  roundingTotal: number; // absolute base rounding booked to the exchange difference account
  missingExchangeAccount: boolean; // a residual exists but no exchange difference account is set
}

// Build the export lines for a run without changing any state: map each journal line's pseudo
// account to its external (GL) account, apply the exported-booking-date rule, and summarise per
// the policy — netting summarised accounts per (external account + kept dimensions), while
// non-summarised accounts pass through in full detail.
export function buildExportPreview(
  data: AppData, entityId: number, ledger: string, period: string, policy: SummaryPolicy,
): ExportPreview {
  const entity = data.legalEntities.find(e => e.id === entityId);
  const separator = entity?.dimensionSeparator ?? '';
  const candidates = candidateJournals(data, entityId, ledger, period);
  // Only balanced journals go to the GL; an unbalanced one waits until it is corrected.
  const journals = candidates.filter(j => !j.difference);
  const heldBack = candidates.filter(j => j.difference).map(j => j.gliNumber);
  const gliList = journals.map(j => j.gliNumber);
  const pseudoOf = (code: string) => data.pseudoAccounts.find(p => p.entityCode === entity?.ownerCode && p.pseudo === code);

  // Resolve, per pseudo account, whether to summarise and which dimensions to keep.
  const resolve = (pseudo: ReturnType<typeof pseudoOf>) => {
    if (policy.mode === 'Full') return { summarize: false, keep: new Set<number>() };
    if (policy.mode === 'Summarized') return { summarize: true, keep: new Set(policy.defaultKeepPartIds) };
    return { summarize: pseudo?.summarizeToGl ?? false, keep: new Set(pseudo?.summaryKeepPartIds ?? []) };
  };

  // 'ALL' includes every ledger on the entity; otherwise a specific ledger is filtered.
  const ledgerMatch = (lineLedger: string) => ledger === 'ALL' || lineLedger === ledger;

  // Rate used to convert a line to the entity's base currency (the rate stored on the line at
  // booking, falling back to the current cross-rate).
  const baseCur = data.currencies.find(c => c.id === entity?.baseCurrencyId);
  const baseCurrency = baseCur?.code ?? 'EUR';
  const rateFor = (lineCurrency: string, stored?: number) => {
    if (stored != null) return stored;
    const cur = data.currencies.find(c => c.code.toUpperCase() === lineCurrency.toUpperCase());
    return cur?.rate && baseCur?.rate ? cur.rate / baseCur.rate : 1;
  };

  const detail: ExportBatchLine[] = [];
  const groups = new Map<string, ExportBatchLine>();
  let sourceLineCount = 0;
  for (const j of journals) {
    const bd = entity ? exportBookingDate(entity, j.bookingDate) : j.bookingDate;
    for (const l of j.lines) {
      if (!ledgerMatch(l.ledger)) continue;
      sourceLineCount += 1;
      const p = pseudoOf(l.pseudoAccount);
      const externalAccount = p?.extPseudo || l.pseudoAccount;
      const externalDescription = p?.extDescription || l.description;
      const { summarize, keep } = resolve(p);
      // Convert to base currency per line, rounded to 2 decimals — this per-line rounding is what
      // can leave the batch a cent out in base currency even when it balances in transaction currency.
      const rate = rateFor(l.currency, l.currencyRate);
      const baseDebit = round2(l.debit * rate);
      const baseCredit = round2(l.credit * rate);
      if (!summarize) {
        detail.push({
          externalAccount, externalDescription, ledger: l.ledger, debit: l.debit, credit: l.credit, currency: l.currency,
          baseDebit, baseCredit,
          bookingDate: bd, period: periodOf(bd), dimensions: l.externalAccountString || '',
          text: l.description, sourceGli: j.gliNumber,
        });
        continue;
      }
      // Keep only the selected dimensions, then net into one line per (ledger + account + kept dims).
      const parts = entity ? inUseParts(data, entity, p) : [];
      const maskedDims = keep.size > 0 && l.externalAccountString
        ? maskExternal(parseExternal(l.externalAccountString, parts, separator), parts, separator, keep)
        : '';
      const key = `${l.ledger}|${externalAccount}|${bd}|${l.currency}|${maskedDims}`;
      const g = groups.get(key);
      if (g) {
        g.debit = round2(g.debit + l.debit); g.credit = round2(g.credit + l.credit);
        g.baseDebit = round2((g.baseDebit ?? 0) + baseDebit); g.baseCredit = round2((g.baseCredit ?? 0) + baseCredit);
      } else groups.set(key, {
        externalAccount, externalDescription, ledger: l.ledger, debit: l.debit, credit: l.credit, currency: l.currency,
        baseDebit, baseCredit,
        bookingDate: bd, period: periodOf(bd), dimensions: maskedDims, text: externalDescription, sourceGli: null,
      });
    }
  }

  // Net each summarised group to a single side (positive net → debit, negative → credit).
  const netted = [...groups.values()].map(g => {
    const net = round2(g.debit - g.credit);
    const netBase = round2((g.baseDebit ?? 0) - (g.baseCredit ?? 0));
    return {
      ...g,
      debit: net > 0 ? net : 0, credit: net < 0 ? -net : 0,
      baseDebit: netBase > 0 ? netBase : 0, baseCredit: netBase < 0 ? -netBase : 0,
    };
  }).filter(g => g.debit !== 0 || g.credit !== 0 || g.baseDebit !== 0 || g.baseCredit !== 0);

  const lines = [...detail, ...netted];
  // Stamp each full-detail line with its source journal's export voucher (gapless per ledger).
  const { byGli } = assignVouchers(data, gliList);
  for (const l of lines) if (l.sourceGli != null) l.voucherNo = byGli.get(l.sourceGli);

  // Base-currency rounding residual, per ledger (each ledger is its own book and must balance on
  // its own). Booked to the entity's exchange difference account as a base-only balancing line.
  const exAccount = entity?.exchangeDifferenceAccount;
  const exPseudo = exAccount ? pseudoOf(exAccount) : undefined;
  const roundingLines: ExportBatchLine[] = [];
  let roundingTotal = 0;
  let missingExchangeAccount = false;
  for (const lg of [...new Set(lines.map(l => l.ledger))]) {
    const ls = lines.filter(l => l.ledger === lg);
    const diff = round2(
      round2(ls.reduce((s, l) => s + (l.baseDebit ?? 0), 0)) - round2(ls.reduce((s, l) => s + (l.baseCredit ?? 0), 0)),
    );
    if (diff === 0) continue;
    roundingTotal = round2(roundingTotal + Math.abs(diff));
    if (!exAccount) { missingExchangeAccount = true; continue; }
    const sample = ls[0];
    roundingLines.push({
      externalAccount: exPseudo?.extPseudo || exAccount,
      externalDescription: exPseudo?.extDescription || 'Exchange rounding difference',
      ledger: lg,
      debit: 0, credit: 0, // already balances in transaction currency — this is a base-only plug
      baseDebit: diff < 0 ? -diff : 0,
      baseCredit: diff > 0 ? diff : 0,
      currency: sample.currency, bookingDate: sample.bookingDate, period: sample.period,
      dimensions: '', text: 'Exchange rounding difference', sourceGli: null,
    });
  }

  const all = [...lines, ...roundingLines];
  const totalDebit = round2(all.reduce((s, l) => s + l.debit, 0));
  const totalCredit = round2(all.reduce((s, l) => s + l.credit, 0));
  const totalBaseDebit = round2(all.reduce((s, l) => s + (l.baseDebit ?? 0), 0));
  const totalBaseCredit = round2(all.reduce((s, l) => s + (l.baseCredit ?? 0), 0));
  return {
    lines: all, gliList, totalDebit, totalCredit, balanced: totalDebit === totalCredit,
    sourceLineCount, heldBack, baseCurrency, totalBaseDebit, totalBaseCredit,
    roundingTotal, missingExchangeAccount,
  };
}

// --- Format renderers -------------------------------------------------------

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(batch: ExportBatch): string {
  const head = ['Voucher', 'ExternalAccount', 'Description', 'Ledger', 'BookingDate', 'Period', 'Currency',
    'Debit', 'Credit', 'BaseCurrency', 'BaseDebit', 'BaseCredit', 'Dimensions', 'SourceGLI'];
  const rows = batch.lines.map(l => [
    l.voucherNo ?? '', l.externalAccount, l.externalDescription, l.ledger, l.bookingDate, l.period, l.currency,
    l.debit.toFixed(2), l.credit.toFixed(2),
    batch.baseCurrency ?? '', (l.baseDebit ?? 0).toFixed(2), (l.baseCredit ?? 0).toFixed(2),
    l.dimensions, l.sourceGli ?? '',
  ].map(csvCell).join(';'));
  return [head.join(';'), ...rows].join('\r\n');
}

export function toJson(batch: ExportBatch): string {
  return JSON.stringify({
    batchId: batch.id, legalEntityId: batch.legalEntityId, ledger: batch.ledger, period: batch.period,
    generatedAt: batch.generatedAt, summarized: batch.summarized,
    control: {
      lineCount: batch.lineCount, totalDebit: batch.totalDebit, totalCredit: batch.totalCredit,
      baseCurrency: batch.baseCurrency, totalBaseDebit: batch.totalBaseDebit, totalBaseCredit: batch.totalBaseCredit,
      sourceGliList: batch.gliList,
    },
    lines: batch.lines.map(l => ({
      voucher: l.voucherNo || undefined, account: l.externalAccount, description: l.externalDescription, ledger: l.ledger,
      bookingDate: l.bookingDate, period: l.period, currency: l.currency, debit: l.debit, credit: l.credit,
      baseDebit: l.baseDebit ?? 0, baseCredit: l.baseCredit ?? 0,
      dimensions: l.dimensions || undefined, sourceGli: l.sourceGli ?? undefined,
    })),
  }, null, 2);
}

// --- Commit inside a draft -------------------------------------------------

// Short and stable by design: the folder path already carries entity + interface, and the payload
// header carries the full metadata, so the name only has to be unique, sortable and greppable.
// {seq} is assigned once at batch creation, so a re-send reproduces the same name (no duplicate
// file in the GL's inbound folder).
export const DEFAULT_FILENAME_PATTERN = '{logical}_{period}_{seq}';

// Every token a customer can use if their GL demands more in the name.
export const FILENAME_TOKENS = ['logical', 'entity', 'ledger', 'period', 'seq', 'batch', 'yyyymmdd', 'hhmmss'];

// Resolve the export file name from the integration's pattern (no extension). Spaces are stripped
// so the name is safe for scripts / SFTP / URLs.
export function resolveExportFileName(
  integration: Integration, entityCode: string,
  opts: { seq: number; when: Date; period: string; ledger: string; batch: number },
): string {
  const pad = (n: number, w: number) => String(n).padStart(w, '0');
  const d = opts.when;
  const clean = (s: string) => (s || '').replace(/\s+/g, '');
  const tokens: Record<string, string> = {
    logical: clean(integration.fileName) || 'GL',
    entity: clean(entityCode) || String(integration.legalEntityId),
    ledger: clean(opts.ledger),
    period: opts.period,
    seq: pad(opts.seq, 6),
    batch: String(opts.batch),
    yyyymmdd: `${d.getFullYear()}${pad(d.getMonth() + 1, 2)}${pad(d.getDate(), 2)}`,
    hhmmss: `${pad(d.getHours(), 2)}${pad(d.getMinutes(), 2)}${pad(d.getSeconds(), 2)}`,
  };
  const pattern = integration.fileNamePattern || DEFAULT_FILENAME_PATTERN;
  return pattern.replace(/\{(\w+)\}/g, (_m, k) => tokens[k] ?? '');
}

// Run an export for one integration inside a draft: build the batch (per the supplied policy),
// file it, stamp exportDate on the covered journals, and update the integration's execution log.
// Shared by the manual run and the End of Month run. Returns null if there was nothing to export
// (or the remaining journals do not balance). Deterministic from `d`, so StrictMode-safe.
export function commitExportInDraft(
  d: AppData, integration: Integration, ledger: string, period: string, policy: SummaryPolicy, by: string,
): { batchId: number; lineCount: number; totalDebit: number } | null {
  const pv = buildExportPreview(d, integration.legalEntityId, ledger, period, policy);
  if (pv.lines.length === 0 || !pv.balanced) return null;
  const batchId = Math.max(0, ...d.exportBatches.map(b => b.id)) + 1;
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const seq = integration.nextSequence; // this file's sequence number ({seq}); advanced below
  const entityCode = d.legalEntities.find(e => e.id === integration.legalEntityId)?.ownerCode ?? '';
  const fileName = resolveExportFileName(integration, entityCode, { seq, when: now, period, ledger, batch: batchId });
  const full = `${fileName}.${integration.format.toLowerCase()}`;
  const joinP = (dir: string, file: string) => (dir ? `${dir.replace(/[\\/]+$/, '')}\\${file}` : file);
  d.exportBatches.unshift({
    id: batchId, legalEntityId: integration.legalEntityId, ledger, period, generatedAt: today,
    generatedBy: by, summarized: policy.mode !== 'Full', gliList: pv.gliList, lines: pv.lines,
    lineCount: pv.lines.length, totalDebit: pv.totalDebit, totalCredit: pv.totalCredit,
    baseCurrency: pv.baseCurrency, totalBaseDebit: pv.totalBaseDebit, totalBaseCredit: pv.totalBaseCredit,
    transport: integration.transport, status: 'Exported', attempts: 0, fileName, sequence: seq,
    outboundPath: joinP(integration.fileLocation, full), archivePath: joinP(integration.archiveLocation, full),
  });
  // Assign gapless per-ledger vouchers, stamp them on the journals, and advance each series used.
  const { byGli, seriesEnd } = assignVouchers(d, pv.gliList);
  const covered = new Set(pv.gliList);
  d.journals.forEach(j => { if (covered.has(j.gliNumber)) { j.exportDate = today; j.exportVoucher = byGli.get(j.gliNumber); } });
  for (const [serieId, next] of seriesEnd) {
    const s = d.ledgerSeries.find(x => x.id === serieId);
    if (s) s.nextNumber = next;
  }
  const cfg = d.integrations.find(i => i.id === integration.id);
  if (cfg) { cfg.lastExecution = today; cfg.lastExecutionBy = by; cfg.records += pv.lines.length; cfg.nextSequence += 1; }
  return { batchId, lineCount: pv.lines.length, totalDebit: pv.totalDebit };
}

// Simulate transporting a batch to the GL (Phase 3). API = REST push, Queue = message publish;
// `fail` forces the error path so the failure → re-send lifecycle can be exercised. On success the
// batch is Acknowledged with a reference; on failure it is Failed with a reason (re-sendable).
export function sendBatchInDraft(d: AppData, batchId: number, fail: boolean): void {
  const b = d.exportBatches.find(x => x.id === batchId);
  if (!b) return;
  b.attempts = (b.attempts ?? 0) + 1;
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  if (fail) {
    b.status = 'Failed';
    b.deliveryError = b.transport === 'API' ? 'HTTP 503 — GL endpoint unavailable' : 'Queue publish timed out';
    b.deliveredAt = undefined;
    b.deliveryRef = undefined;
  } else {
    b.status = 'Acknowledged';
    b.deliveredAt = stamp;
    b.deliveryRef = `${b.transport === 'Queue' ? 'MSG' : 'ACK'}-${b.id}-${b.attempts}`;
    b.deliveryError = undefined;
  }
}
