import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import PptxGenJS from 'pptxgenjs';
import Anthropic from '@anthropic-ai/sdk';
import { useStore } from '../store';
import { Icon } from './Icon';
import { simulateMessage, resolveFormulaAccount, fiscalYearOf, type EventMessage } from '../engine';
import type { AppData, LegalEntity } from '../types';

// ────────────────────────────────────────────────────────────────────────────
// "Ask Claude" — an in-app chat panel that lets Claude work against THIS app's
// live data. It runs a small agentic tool loop in the browser: the tools below
// read the store and run the real booking engine (read-only — simulate_message
// computes journal lines but posts nothing). This is the same tool surface you
// would later expose from an MCP server; here it executes client-side so the
// prototype can illustrate the idea with no backend.
//
// DEMO-GRADE AUTH: the Anthropic key is read from localStorage (or a Vite env
// var) and calls go straight from the browser to the API with
// dangerouslyAllowBrowser. That exposes the key to anyone using this browser —
// fine for a local illustration, NOT for anything shared or deployed.
// ────────────────────────────────────────────────────────────────────────────

const MODEL = 'claude-opus-5'; // swap to 'claude-sonnet-5' for an even faster/cheaper demo
// Reasoning effort: 'low' is much faster (fewer, more consolidated tool calls, less
// preamble) and is plenty for these config-analysis questions. Raise to 'medium'/'high'
// if answers start feeling shallow.
const EFFORT = 'low';
// (assistant replies render as Markdown — tables, headings, lists)
const KEY_STORAGE = 'oce-anthropic-api-key';

type UIMsg =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string }
  | { role: 'tool'; name: string; ok: boolean }
  | { role: 'error'; text: string };

// ── Tool schemas (custom tools). These are plain JSON Schema — the same shape
//    you'd hand an MCP server. ────────────────────────────────────────────────
const TOOLS: Anthropic.Tool[] = [
  {
    name: 'list_legal_entities',
    description: 'List the legal entities configured in the app (everything is configured per legal entity).',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'list_formulas',
    description: 'List booking formulas. A formula has a header debit/credit account plus optional conditions.',
    input_schema: {
      type: 'object',
      properties: { search: { type: 'string', description: 'Optional case-insensitive filter on name/description/code.' } },
    },
  },
  {
    name: 'get_formula',
    description: 'Get one formula with its full condition tree (branches and nested overrides) and the accounts each resolves to.',
    input_schema: {
      type: 'object',
      properties: { formulaId: { type: 'number', description: 'The formula id (e.g. the row id, not the display code).' } },
      required: ['formulaId'],
    },
  },
  {
    name: 'list_accounting_rules',
    description: 'List the accounting rules for a legal entity: which formula books for which accounting event / ledger.',
    input_schema: {
      type: 'object',
      properties: {
        entity: { type: 'string', description: 'Legal entity owner code (e.g. "ALS NLD") or numeric id.' },
        event: { type: 'string', description: 'Optional accounting event name filter (e.g. "Invoicing").' },
      },
      required: ['entity'],
    },
  },
  {
    name: 'resolve_account',
    description: 'Resolve the account a formula would book to, given condition inputs. Returns the account and a trace of how it was chosen (header default → branch → override).',
    input_schema: {
      type: 'object',
      properties: {
        entity: { type: 'string', description: 'Legal entity owner code or id.' },
        formulaId: { type: 'number' },
        side: { type: 'string', enum: ['D', 'C'], description: 'Debit or Credit side. Defaults to C.' },
        inputs: {
          type: 'object',
          description: 'Condition field name → value, e.g. {"Accounting Type":"DL","Amount Code":"IFE"}.',
          additionalProperties: { type: 'string' },
        },
      },
      required: ['entity', 'formulaId'],
    },
  },
  {
    name: 'profit_and_loss',
    description: 'Compute a legal entity\'s profit for a fiscal year from posted journals: revenue, expenses and net profit on P&L (Result) accounts. Needs no opening balances (P&L opens at zero each year).',
    input_schema: {
      type: 'object',
      properties: {
        entity: { type: 'string', description: 'Legal entity owner code or id.' },
        fiscalYear: { type: 'number', description: 'Fiscal year (label year). Defaults to the latest year with journals.' },
        ledger: { type: 'string', description: 'Optional ledger name (e.g. "Local Legal"). Omit for all ledgers.' },
      },
      required: ['entity'],
    },
  },
  {
    name: 'monthly_profit',
    description: 'Net profit per month across a fiscal year (P&L movements on Result accounts, balanced journals only). Returns one figure per month, in fiscal-year order. Ideal for a monthly-profit trend chart.',
    input_schema: {
      type: 'object',
      properties: {
        entity: { type: 'string', description: 'Legal entity owner code or id.' },
        fiscalYear: { type: 'number', description: 'Fiscal year. Defaults to (and falls back to) the latest year that actually has journals.' },
        ledger: { type: 'string', description: 'Optional ledger name. Omit for all ledgers.' },
      },
      required: ['entity'],
    },
  },
  {
    name: 'export_deck',
    description: 'Build and download a PowerPoint (.pptx) deck with native, editable charts from data you provide. Use after a reporting tool to visualise its numbers (e.g. monthly profit as a column chart). The file downloads in the user\'s browser; nothing is posted.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Deck title (also the file name).' },
        slides: {
          type: 'array',
          description: 'Slides in order. Each may carry a chart and/or bullet points.',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              subtitle: { type: 'string' },
              bullets: { type: 'array', items: { type: 'string' } },
              chart: {
                type: 'object',
                description: 'A chart for this slide.',
                properties: {
                  type: { type: 'string', enum: ['column', 'bar', 'line', 'pie'], description: 'column = vertical bars (good for monthly trend).' },
                  categories: { type: 'array', items: { type: 'string' }, description: 'X-axis labels, e.g. the months.' },
                  series: {
                    type: 'array',
                    description: 'One or more data series.',
                    items: {
                      type: 'object',
                      properties: { name: { type: 'string' }, data: { type: 'array', items: { type: 'number' } } },
                      required: ['name', 'data'],
                    },
                  },
                },
                required: ['type', 'categories', 'series'],
              },
            },
            required: ['title'],
          },
        },
      },
      required: ['title', 'slides'],
    },
  },
  {
    name: 'trial_balance',
    description: 'Trial balance for a legal entity + fiscal year: per-account closing balance = opening balance + journal movements. Totals of debit and credit balances should be equal.',
    input_schema: {
      type: 'object',
      properties: {
        entity: { type: 'string', description: 'Legal entity owner code or id.' },
        fiscalYear: { type: 'number', description: 'Fiscal year. Defaults to the latest year with journals.' },
        ledger: { type: 'string', description: 'Optional ledger name. Omit for all ledgers.' },
      },
      required: ['entity'],
    },
  },
  {
    name: 'balance_sheet',
    description: 'Balance sheet for a legal entity + fiscal year: Balance-account closing positions (opening + movements), split into assets and liabilities/equity, plus the result for the year. Uses opening balances.',
    input_schema: {
      type: 'object',
      properties: {
        entity: { type: 'string', description: 'Legal entity owner code or id.' },
        fiscalYear: { type: 'number', description: 'Fiscal year. Defaults to the latest year with journals.' },
        ledger: { type: 'string', description: 'Optional ledger name. Omit for all ledgers.' },
      },
      required: ['entity'],
    },
  },
  {
    name: 'simulate_message',
    description: 'Simulate booking a business-event message (as another domain would send it) and return the resulting journal lines. READ-ONLY: nothing is posted.',
    input_schema: {
      type: 'object',
      properties: {
        entity: { type: 'string', description: 'Legal entity owner code or id.' },
        event: { type: 'string', description: 'Accounting event name (e.g. "Invoicing") or id.' },
        accountingClass: { type: 'string', description: 'Optional accounting class name; defaults to one that has rules for the event.' },
        conditionInputs: {
          type: 'object',
          description: 'Message attribute values by field name, e.g. {"Accounting Type":"DL","Amount Code":"IFE"}.',
          additionalProperties: { type: 'string' },
        },
        amounts: {
          type: 'object',
          description: 'Amounts by amount-type name, e.g. {"Rent":875,"Added Cost":125}.',
          additionalProperties: { type: 'number' },
        },
      },
      required: ['entity', 'event'],
    },
  },
];

// Plain-language labels for the tool chips, so the panel says what it is doing
// rather than showing raw tool names like "simulate_message".
const TOOL_LABELS: Record<string, string> = {
  list_legal_entities: 'Looked up legal entities',
  list_formulas: 'Searched formulas',
  get_formula: 'Read a formula',
  list_accounting_rules: 'Read accounting rules',
  resolve_account: 'Resolved an account',
  simulate_message: 'Ran a simulation',
  profit_and_loss: 'Calculated profit & loss',
  monthly_profit: 'Calculated monthly profit',
  trial_balance: 'Built a trial balance',
  balance_sheet: 'Built a balance sheet',
  export_deck: 'Built a PowerPoint deck',
};

// Fold consecutive identical tool chips into one with a count, so eight
// simulate_message calls read as a single "Ran a simulation ×8".
type RenderItem = UIMsg | { role: 'toolgroup'; name: string; ok: boolean; count: number };
function collapse(messages: UIMsg[]): RenderItem[] {
  const out: RenderItem[] = [];
  for (const m of messages) {
    const prev = out[out.length - 1];
    if (m.role === 'tool' && prev && prev.role === 'toolgroup' && prev.name === m.name && prev.ok === m.ok) {
      prev.count += 1;
    } else if (m.role === 'tool') {
      out.push({ role: 'toolgroup', name: m.name, ok: m.ok, count: 1 });
    } else {
      out.push(m);
    }
  }
  return out;
}

// ── Reporting helpers (profit / trial balance / balance sheet) ───────────────
// Base-currency assumption: line amounts are converted with the line's own currencyRate
// (value of 1 unit in the reporting currency). Correct for base-EUR entities in the demo.
const r2 = (n: number) => Math.round(n * 100) / 100;
function acctKindOf(d: AppData, entityCode: string, code: string): 'Result' | 'Balance' {
  const p = d.pseudoAccounts.find(x => x.entityCode === entityCode && x.pseudo === code) ?? d.pseudoAccounts.find(x => x.pseudo === code);
  return p?.accountKind ?? 'Balance';
}
function acctDescOf(d: AppData, entityCode: string, code: string): string {
  const p = d.pseudoAccounts.find(x => x.entityCode === entityCode && x.pseudo === code) ?? d.pseudoAccounts.find(x => x.pseudo === code);
  return p?.description ?? code;
}
// Journal movements per account for an entity, optionally scoped to a ledger and fiscal year.
function journalMovements(d: AppData, entity: LegalEntity, opts: { ledger?: string; fiscalYear?: number }) {
  const fyStart = entity.fiscalYearStartMonth ?? 1;
  const acc = new Map<string, { debit: number; credit: number }>();
  for (const j of d.journals) {
    if (j.legalEntityId !== entity.id) continue;
    if (opts.fiscalYear != null && fiscalYearOf(j.bookingDate, fyStart) !== opts.fiscalYear) continue;
    if (j.difference || j.broughtForward) continue; // differences held out; brought-forward is the opening (already counted)
    for (const l of j.lines) {
      if (opts.ledger && l.ledger !== opts.ledger) continue;
      const rate = l.currencyRate ?? 1;
      const cur = acc.get(l.pseudoAccount) ?? { debit: 0, credit: 0 };
      cur.debit += (l.debit || 0) * rate;
      cur.credit += (l.credit || 0) * rate;
      acc.set(l.pseudoAccount, cur);
    }
  }
  return acc;
}
// Out-of-balance ("difference") journals excluded from the statements, for disclosure.
function differenceInfo(d: AppData, entity: LegalEntity, opts: { ledger?: string; fiscalYear?: number }) {
  const fyStart = entity.fiscalYearStartMonth ?? 1;
  let count = 0, netImbalance = 0;
  for (const j of d.journals) {
    if (j.legalEntityId !== entity.id || !j.difference) continue;
    if (opts.fiscalYear != null && fiscalYearOf(j.bookingDate, fyStart) !== opts.fiscalYear) continue;
    const inScope = j.lines.filter(l => !opts.ledger || l.ledger === opts.ledger);
    if (inScope.length === 0) continue;
    count += 1;
    for (const l of inScope) netImbalance += ((l.debit || 0) - (l.credit || 0)) * (l.currencyRate ?? 1);
  }
  return { count, netImbalance: r2(netImbalance) };
}
function openingFor(d: AppData, entity: LegalEntity, fiscalYear: number, ledger?: string) {
  const acc = new Map<string, { debit: number; credit: number }>();
  for (const o of (d.openingBalances ?? [])) {
    if (o.entityCode !== entity.ownerCode || o.fiscalYear !== fiscalYear) continue;
    if (ledger && o.ledger !== ledger) continue;
    const cur = acc.get(o.pseudoAccount) ?? { debit: 0, credit: 0 };
    cur.debit += o.debit; cur.credit += o.credit;
    acc.set(o.pseudoAccount, cur);
  }
  return acc;
}
// Fiscal year to default to: the latest one that has journals for the entity, else the current one.
function defaultFiscalYear(d: AppData, entity: LegalEntity): number {
  const fyStart = entity.fiscalYearStartMonth ?? 1;
  const years = d.journals.filter(j => j.legalEntityId === entity.id).map(j => fiscalYearOf(j.bookingDate, fyStart));
  return years.length ? Math.max(...years) : fiscalYearOf(new Date().toISOString().slice(0, 10), fyStart);
}

export function AskClaude() {
  const { data } = useStore();
  const dataRef = useRef<AppData>(data);
  useEffect(() => { dataRef.current = data; }, [data]);

  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<UIMsg[]>([]);
  const [apiKey, setApiKey] = useState<string>(() => {
    try { return localStorage.getItem(KEY_STORAGE) || (import.meta.env.VITE_ANTHROPIC_API_KEY ?? ''); } catch { return ''; }
  });
  const [keyDraft, setKeyDraft] = useState('');
  const [editingKey, setEditingKey] = useState(false);
  const [drag, setDrag] = useState({ x: 0, y: 0 }); // offset from the centered position
  const dragStart = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  // The multi-turn API transcript (separate from the UI list, which also shows tool chips).
  const apiMessages = useRef<Anthropic.MessageParam[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open]);

  // ── Which entity is the user looking at? Used as a hint so Claude scopes to it. ──
  const currentEntity = (): LegalEntity | undefined => {
    const m = location.pathname.match(/\/legal-entity\/(\d+)/) || location.hash.match(/\/legal-entity\/(\d+)/);
    return m ? dataRef.current.legalEntities.find(e => e.id === Number(m[1])) : undefined;
  };

  // ── Tool executors (read the live store, run the real engine) ──────────────
  const entityOf = (d: AppData, s: string) =>
    d.legalEntities.find(e => e.ownerCode.toLowerCase() === String(s).toLowerCase() || String(e.id) === String(s));
  const inputsById = (d: AppData, byName: Record<string, string> = {}) => {
    const out: Record<number, string> = {};
    for (const [k, v] of Object.entries(byName)) {
      const cv = d.conditionValues.find(c => c.name.toLowerCase() === k.toLowerCase());
      if (cv) out[cv.id] = String(v);
    }
    return out;
  };
  const pseudoNameById = (d: AppData, entityCode: string, id: number | null) =>
    id == null ? null : (d.pseudoAccounts.find(p => p.entityCode === entityCode && p.id === id)?.pseudo
      ?? d.pseudoAccounts.find(p => p.id === id)?.pseudo ?? String(id));

  const classFor = (d: AppData, entity: LegalEntity, eventId: number, name?: string): number | undefined => {
    if (name) {
      const c = d.accountingClasses.find(a => a.name.toLowerCase() === name.toLowerCase());
      if (c) return c.id;
    }
    for (const lac of d.legalAccountingClasses.filter(c => c.legalEntityId === entity.id)) {
      const ledgers = d.legalAccountingLedgers.filter(l => l.legalAccountingClassId === lac.id).map(l => l.id);
      if (d.accountingRules.some(r => r.entityCode === entity.ownerCode && ledgers.includes(r.legalAccountingLedgerId) && r.accountingEventId === eventId))
        return lac.accountingClassId;
    }
    return d.accountingClasses[0]?.id;
  };

  const execTool = async (name: string, raw: unknown): Promise<unknown> => {
    const d = dataRef.current;
    const input = (raw ?? {}) as Record<string, unknown>;
    if (name === 'list_legal_entities') {
      return d.legalEntities.map(e => ({ id: e.id, ownerCode: e.ownerCode, name: e.name }));
    }
    if (name === 'list_formulas') {
      const q = String(input.search ?? '').toLowerCase();
      return d.formulas
        .filter(f => !q || f.name.toLowerCase().includes(q) || f.description.toLowerCase().includes(q))
        .map(f => ({
          id: f.id, name: f.name, description: f.description,
          debitAccount: f.debitAccount, creditAccount: f.creditAccount,
          hasConditions: f.formulaConditionId != null,
        }));
    }
    if (name === 'get_formula') {
      const f = d.formulas.find(x => x.id === Number(input.formulaId));
      if (!f) return { error: `No formula with id ${input.formulaId}.` };
      const conds = f.formulaConditionId == null ? [] : d.conditions.filter(c => c.formulaConditionId === f.formulaConditionId);
      return {
        id: f.id, name: f.name, description: f.description,
        headerDebitAccount: f.debitAccount, headerCreditAccount: f.creditAccount,
        conditions: conds.map(c => ({
          level: c.level ?? 0,
          role: (c.level ?? 0) === 0 ? 'branch' : 'override',
          field: d.conditionValues.find(v => v.id === c.conditionValueId)?.name ?? c.conditionValueId,
          value: c.value,
          debitAccount: pseudoNameById(d, '', c.debitPseudoAccountId),
          creditAccount: pseudoNameById(d, '', c.creditPseudoAccountId),
        })),
        note: 'Branches are checked top to bottom; the most specific matching override wins, else the branch account, else the header account.',
      };
    }
    if (name === 'list_accounting_rules') {
      const entity = entityOf(d, String(input.entity));
      if (!entity) return { error: `Unknown entity "${input.entity}".` };
      const evFilter = String(input.event ?? '').toLowerCase();
      const classIds = d.legalAccountingClasses.filter(c => c.legalEntityId === entity.id).map(c => c.id);
      const myLedgers = d.legalAccountingLedgers.filter(l => classIds.includes(l.legalAccountingClassId)).map(l => l.id);
      const eventName = (id: number) => d.accountingEvents.find(e => e.id === id)?.name ?? String(id);
      const ledgerName = (lid: number) => {
        const lal = d.legalAccountingLedgers.find(l => l.id === lid);
        return d.ledgers.find(l => l.id === lal?.ledgerId)?.description ?? '';
      };
      return d.accountingRules
        .filter(r => r.entityCode === entity.ownerCode && myLedgers.includes(r.legalAccountingLedgerId))
        .filter(r => !evFilter || eventName(r.accountingEventId).toLowerCase().includes(evFilter))
        .map(r => {
          const f = d.formulas.find(x => x.id === r.formulaId);
          return {
            ruleId: r.id, event: eventName(r.accountingEventId), ledger: ledgerName(r.legalAccountingLedgerId),
            formulaId: r.formulaId, formula: f?.name, debitCredit: r.debitCredit,
          };
        });
    }
    if (name === 'resolve_account') {
      const entity = entityOf(d, String(input.entity));
      if (!entity) return { error: `Unknown entity "${input.entity}".` };
      const f = d.formulas.find(x => x.id === Number(input.formulaId));
      if (!f) return { error: `No formula with id ${input.formulaId}.` };
      const side = input.side === 'D' ? 'D' : 'C';
      const account = resolveFormulaAccount(d, entity.ownerCode, f, side, inputsById(d, input.inputs as Record<string, string>));
      return { entity: entity.ownerCode, formula: f.name, side, inputs: input.inputs ?? {}, account: account ?? '(nothing resolved)' };
    }
    if (name === 'profit_and_loss') {
      const entity = entityOf(d, String(input.entity));
      if (!entity) return { error: `Unknown entity "${input.entity}".` };
      const fy = input.fiscalYear != null ? Number(input.fiscalYear) : defaultFiscalYear(d, entity);
      const ledger = input.ledger as string | undefined;
      const mov = journalMovements(d, entity, { ledger, fiscalYear: fy });
      const byAccount: { account: string; description: string; net: number }[] = [];
      for (const [code, m] of mov) {
        if (acctKindOf(d, entity.ownerCode, code) !== 'Result') continue;
        const net = r2(m.credit - m.debit); // revenue is credit-positive
        if (net !== 0) byAccount.push({ account: code, description: acctDescOf(d, entity.ownerCode, code), net });
      }
      byAccount.sort((a, b) => b.net - a.net);
      const revenue = r2(byAccount.filter(a => a.net > 0).reduce((s, a) => s + a.net, 0));
      const expenses = r2(byAccount.filter(a => a.net < 0).reduce((s, a) => s - a.net, 0));
      const netProfit = r2(revenue - expenses);
      return {
        entity: entity.ownerCode, fiscalYear: fy, ledger: ledger ?? 'all ledgers',
        revenue, expenses, netProfit, byAccount,
        excludedDifferenceJournals: differenceInfo(d, entity, { ledger, fiscalYear: fy }),
        note: byAccount.length === 0 ? 'No P&L movements for this entity/year.' : 'Profit = revenue − expenses on Result accounts (balanced journals only); opening balances not needed. Out-of-balance "difference" journals are excluded.',
      };
    }
    if (name === 'monthly_profit') {
      const entity = entityOf(d, String(input.entity));
      if (!entity) return { error: `Unknown entity "${input.entity}".` };
      const fyStart = entity.fiscalYearStartMonth ?? 1;
      const hasJournals = (y: number) => d.journals.some(j => j.legalEntityId === entity.id && !j.difference && !j.broughtForward && fiscalYearOf(j.bookingDate, fyStart) === y);
      let fy = input.fiscalYear != null ? Number(input.fiscalYear) : defaultFiscalYear(d, entity);
      let fellBack = false;
      if (!hasJournals(fy)) { const alt = defaultFiscalYear(d, entity); if (alt !== fy && hasJournals(alt)) { fy = alt; fellBack = true; } }
      const ledger = input.ledger as string | undefined;
      const months: { key: string; label: string; profit: number }[] = [];
      for (let i = 0; i < 12; i++) {
        const m0 = (fyStart - 1) + i;
        const year = fy + Math.floor(m0 / 12);
        const month = (m0 % 12) + 1;
        const label = new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'short' }) + (fyStart === 1 ? '' : ` ${String(year).slice(2)}`);
        months.push({ key: `${year}-${String(month).padStart(2, '0')}`, label, profit: 0 });
      }
      const idx = new Map(months.map((m, i) => [m.key, i]));
      for (const j of d.journals) {
        if (j.legalEntityId !== entity.id || j.difference || j.broughtForward) continue;
        const i = idx.get(j.bookingDate.slice(0, 7));
        if (i == null) continue;
        for (const l of j.lines) {
          if (ledger && l.ledger !== ledger) continue;
          if (acctKindOf(d, entity.ownerCode, l.pseudoAccount) !== 'Result') continue;
          months[i].profit += ((l.credit || 0) - (l.debit || 0)) * (l.currencyRate ?? 1);
        }
      }
      return {
        entity: entity.ownerCode, fiscalYear: fy, ledger: ledger ?? 'all ledgers',
        months: months.map(m => ({ month: m.label, profit: r2(m.profit) })),
        total: r2(months.reduce((s, m) => s + m.profit, 0)),
        note: fellBack ? `The requested year had no journals; showing FY ${fy} (the latest year with data).` : undefined,
      };
    }
    if (name === 'export_deck') {
      const inp = input as { title?: string; slides?: unknown[] };
      const pptx = new PptxGenJS();
      pptx.layout = 'LAYOUT_WIDE'; // 13.3 x 7.5 in
      pptx.title = String(inp.title ?? 'Accounting deck');
      const NAVY = '00395D', MUTED = '5A6472', INK = '1F2430';
      const cover = pptx.addSlide();
      cover.background = { color: 'FFFFFF' };
      cover.addText(String(inp.title ?? 'Accounting deck'), { x: 0.6, y: 2.6, w: 12.1, h: 1.1, fontSize: 34, bold: true, color: NAVY });
      cover.addText('One Credit Engine — Accounting Domain', { x: 0.6, y: 3.7, w: 12, h: 0.5, fontSize: 16, color: MUTED });
      for (const raw of (Array.isArray(inp.slides) ? inp.slides : [])) {
        const sl = raw as { title?: string; subtitle?: string; bullets?: string[]; chart?: { type?: string; categories?: string[]; series?: { name?: string; data?: number[] }[] } };
        const s = pptx.addSlide();
        s.addText(String(sl.title ?? ''), { x: 0.6, y: 0.35, w: 12.1, h: 0.7, fontSize: 24, bold: true, color: NAVY });
        if (sl.subtitle) s.addText(String(sl.subtitle), { x: 0.6, y: 1.05, w: 12.1, h: 0.4, fontSize: 13, color: MUTED });
        const c = sl.chart;
        if (c && Array.isArray(c.categories) && Array.isArray(c.series)) {
          const data = c.series.map(ser => ({ name: String(ser.name ?? 'Series'), labels: c.categories!.map(String), values: (ser.data ?? []).map(Number) }));
          const chartType = c.type === 'line' ? 'line' : c.type === 'pie' ? 'pie' : 'bar';
          const opts: Record<string, unknown> = {
            x: 0.6, y: 1.5, w: 12.1, h: 5.4, showLegend: (c.series.length > 1), legendPos: 'b', showTitle: false,
            chartColors: ['00395D', '0E6BA8', '8AB6D6', 'C0392B', '2E8B57'],
            catAxisLabelColor: INK, valAxisLabelColor: INK, catAxisLabelFontSize: 11, valAxisLabelFontSize: 11,
          };
          if (chartType === 'bar') opts.barDir = (c.type === 'bar') ? 'bar' : 'col';
          if (chartType !== 'pie') opts.showValue = false;
          s.addChart(chartType as never, data as never, opts as never);
        } else if (Array.isArray(sl.bullets) && sl.bullets.length) {
          s.addText(sl.bullets.map(b => ({ text: String(b), options: { bullet: true, color: INK, fontSize: 15, paraSpaceAfter: 8 } })) as never, { x: 0.7, y: 1.6, w: 12, h: 5 });
        }
      }
      const fileName = (String(inp.title ?? 'deck').replace(/[^\w -]+/g, '').trim().replace(/\s+/g, '-').slice(0, 48) || 'deck') + '.pptx';
      await pptx.writeFile({ fileName });
      return { ok: true, fileName, slides: Array.isArray(inp.slides) ? inp.slides.length : 0, note: 'A .pptx download has started in the browser. If you are viewing inside the embedded preview, open http://localhost:5174 in your own browser (Chrome) to save the file.' };
    }
    if (name === 'trial_balance') {
      const entity = entityOf(d, String(input.entity));
      if (!entity) return { error: `Unknown entity "${input.entity}".` };
      const fy = input.fiscalYear != null ? Number(input.fiscalYear) : defaultFiscalYear(d, entity);
      const ledger = input.ledger as string | undefined;
      const opening = openingFor(d, entity, fy, ledger);
      const mov = journalMovements(d, entity, { ledger, fiscalYear: fy });
      const codes = new Set([...opening.keys(), ...mov.keys()]);
      const rows = [...codes].map(code => {
        const o = opening.get(code) ?? { debit: 0, credit: 0 };
        const m = mov.get(code) ?? { debit: 0, credit: 0 };
        const net = r2((o.debit - o.credit) + (m.debit - m.credit)); // debit-positive
        return {
          account: code, description: acctDescOf(d, entity.ownerCode, code),
          kind: acctKindOf(d, entity.ownerCode, code),
          debit: net > 0 ? net : 0, credit: net < 0 ? r2(-net) : 0,
        };
      }).filter(r => r.debit || r.credit).sort((a, b) => a.account.localeCompare(b.account));
      const totalDebit = r2(rows.reduce((s, r) => s + r.debit, 0));
      const totalCredit = r2(rows.reduce((s, r) => s + r.credit, 0));
      return {
        entity: entity.ownerCode, fiscalYear: fy, ledger: ledger ?? 'all ledgers',
        rows, totalDebit, totalCredit, balanced: r2(totalDebit - totalCredit) === 0,
        excludedDifferenceJournals: differenceInfo(d, entity, { ledger, fiscalYear: fy }),
        note: 'Closing balance = opening balance + journal movements (balanced journals only), per account. Out-of-balance "difference" journals are excluded.',
      };
    }
    if (name === 'balance_sheet') {
      const entity = entityOf(d, String(input.entity));
      if (!entity) return { error: `Unknown entity "${input.entity}".` };
      const fy = input.fiscalYear != null ? Number(input.fiscalYear) : defaultFiscalYear(d, entity);
      const ledger = input.ledger as string | undefined;
      const opening = openingFor(d, entity, fy, ledger);
      const mov = journalMovements(d, entity, { ledger, fiscalYear: fy });
      const codes = new Set([...opening.keys(), ...mov.keys()]);
      const assets: { account: string; description: string; amount: number }[] = [];
      const liabilitiesEquity: { account: string; description: string; amount: number }[] = [];
      let resultForYear = 0;
      for (const code of codes) {
        const o = opening.get(code) ?? { debit: 0, credit: 0 };
        const m = mov.get(code) ?? { debit: 0, credit: 0 };
        const kind = acctKindOf(d, entity.ownerCode, code);
        const net = (o.debit - o.credit) + (m.debit - m.credit); // debit-positive
        if (kind === 'Result') { resultForYear += (o.credit - o.debit) + (m.credit - m.debit); continue; }
        if (r2(net) === 0) continue;
        const entry = { account: code, description: acctDescOf(d, entity.ownerCode, code), amount: r2(Math.abs(net)) };
        if (net > 0) assets.push(entry); else liabilitiesEquity.push(entry);
      }
      assets.sort((a, b) => b.amount - a.amount);
      liabilitiesEquity.sort((a, b) => b.amount - a.amount);
      resultForYear = r2(resultForYear);
      const totalAssets = r2(assets.reduce((s, a) => s + a.amount, 0));
      const totalLiabEquity = r2(liabilitiesEquity.reduce((s, a) => s + a.amount, 0) + resultForYear);
      return {
        entity: entity.ownerCode, fiscalYear: fy, ledger: ledger ?? 'all ledgers',
        assets, totalAssets,
        liabilitiesEquity, resultForYear, totalLiabilitiesEquity: totalLiabEquity,
        balanced: r2(totalAssets - totalLiabEquity) === 0,
        excludedDifferenceJournals: differenceInfo(d, entity, { ledger, fiscalYear: fy }),
        note: 'Assets = liabilities + equity + result for the year. Uses opening balances + balanced journal movements. Out-of-balance "difference" journals are excluded and reported under excludedDifferenceJournals; any residual imbalance means opening balances are incomplete for this ledger/year.',
      };
    }
    if (name === 'simulate_message') {
      const entity = entityOf(d, String(input.entity));
      if (!entity) return { error: `Unknown entity "${input.entity}".` };
      const evStr = String(input.event);
      const event = d.accountingEvents.find(e => String(e.id) === evStr || e.name.toLowerCase().includes(evStr.toLowerCase()));
      if (!event) return { error: `Unknown accounting event "${input.event}".` };
      const classId = classFor(d, entity, event.id, input.accountingClass as string | undefined);
      if (classId == null) return { error: 'No accounting class available for this entity.' };
      const amounts: Record<number, number> = {};
      for (const [n, v] of Object.entries((input.amounts as Record<string, number>) ?? {})) {
        const at = d.amountTypes.find(a => a.name.toLowerCase() === n.toLowerCase());
        if (at) amounts[at.id] = Number(v);
      }
      const msg: EventMessage = {
        legalEntityId: entity.id, accountingClassId: classId, accountingEventId: event.id,
        bookingDate: new Date().toISOString().slice(0, 10),
        agreement: 'SIM', agreementLine: '1', portfolio: '', invoice: 'SIM-1',
        conditionInputs: inputsById(d, input.conditionInputs as Record<string, string>), amounts,
      };
      const lines = simulateMessage(d, msg);
      const totalD = lines.filter(l => l.debitCredit === 'D').reduce((s, l) => s + l.amount, 0);
      const totalC = lines.filter(l => l.debitCredit === 'C').reduce((s, l) => s + l.amount, 0);
      // Which rules matched this event, the amount type each needs, and whether this message
      // actually carried an amount for it. A formula only books when its amount type is supplied —
      // a missing amount means "not provided in the simulation", NOT "the formula is misconfigured".
      const myClassIds = d.legalAccountingClasses.filter(c => c.legalEntityId === entity.id && c.accountingClassId === classId).map(c => c.id);
      const myLedgers = d.legalAccountingLedgers.filter(l => myClassIds.includes(l.legalAccountingClassId)).map(l => l.id);
      const expectedAmountTypes = d.accountingRules
        .filter(r => r.entityCode === entity.ownerCode && myLedgers.includes(r.legalAccountingLedgerId) && r.accountingEventId === event.id)
        .map(r => {
          const f = d.formulas.find(x => x.id === r.formulaId);
          const at = f?.amountTypeId != null ? d.amountTypes.find(a => a.id === f.amountTypeId) : undefined;
          return {
            formula: f?.name, debitCredit: r.debitCredit, amountType: at?.name ?? null,
            amountProvided: f?.amountTypeId != null && amounts[f.amountTypeId] != null,
          };
        });
      const missing = expectedAmountTypes.filter(e => !e.amountProvided && e.amountType);
      return {
        entity: entity.ownerCode, event: event.name,
        amountsProvided: Object.fromEntries(Object.entries((input.amounts as Record<string, number>) ?? {})),
        lines: lines.map(l => ({
          debitCredit: l.debitCredit, amount: l.amount, account: l.account,
          accountDescription: l.accountDescription, formula: l.formulaName, trace: l.trace,
          externalAccount: l.externalAccount,
        })),
        totalDebit: Math.round(totalD * 100) / 100, totalCredit: Math.round(totalC * 100) / 100,
        balanced: Math.round((totalD - totalC) * 100) / 100 === 0,
        expectedAmountTypes,
        note: missing.length
          ? `A formula books a line only when its amount type is present in this message. These rules got no amount and so produced no line (supply those amounts to see their legs): ${missing.map(m => `${m.formula} needs "${m.amountType}"`).join('; ')}. Nothing was posted.`
          : (lines.length === 0 ? 'No lines — no rule matched for this event/ledger.' : 'Simulation only — nothing was posted.'),
      };
    }
    return { error: `Unknown tool ${name}.` };
  };

  const systemPrompt = () => {
    const ent = currentEntity();
    return [
      'You are an assistant embedded in the One Credit Engine – Accounting Domain prototype (a Tieto product).',
      'You help the user understand and query this app\'s per-legal-entity accounting configuration and simulate how business-event messages would be booked.',
      '',
      'Use the tools to read LIVE data from the running app. Every tool is READ-ONLY — simulate_message computes journal lines but posts nothing. Never claim you created, posted, or changed data.',
      '',
      'Domain model:',
      '- Everything is configured per legal entity.',
      '- A formula has a header debit/credit account (the default used when nothing matches). Conditions form branches, checked top to bottom; each branch can carry its own default account, and overrides nest under a branch to any depth. The most specific match wins, falling back up to the branch account and then the formula header account.',
      '- Common condition fields: Accounting Type (DL, MG, HP, …), Product, Amount Code (IFE, OPC, …).',
      '- simulate_message is deterministic: message in → journal lines out.',
      '- Reporting: profit_and_loss (net profit from Result-account journal movements — needs no opening balances), monthly_profit (profit per month across a year), trial_balance and balance_sheet (opening balances + journal movements). Amounts are in the entity base currency. If a fiscal year is not given these default to the latest year with journals. Fiscal years may be non-calendar (broken) — the tools handle that via the entity fiscal-year start month.',
      '- PowerPoint: export_deck builds and downloads a real .pptx with native, editable charts. To chart monthly profit, first call monthly_profit, then call export_deck with a slide whose chart type is "column", categories = the month labels, and one series (name "Profit", data = the monthly figures). After it runs, tell the user the file name and that the download started (and, if they are in the embedded preview, to open http://localhost:5174 in their own browser to save it). Note in passing which year the data is for if it differs from the one they named.',
      '',
      'IMPORTANT about simulate_message: a formula books a line ONLY for amount types you actually put in the "amounts" argument. If a rule produces no line, check the tool result\'s "expectedAmountTypes"/"note": a missing line almost always means you did not supply that amount type in THIS simulation — it does NOT mean the formula is misconfigured or "not wired". Never conclude a formula is unwired from a missing line. To judge whether an invoice balances, supply every relevant leg — including the total/receivable amount type (e.g. "Total Amount") and any rent — not just a subset like Added Cost/Tax. If you are unsure which amounts to send, say so or list expectedAmountTypes rather than asserting the entry is unbalanced.',
      '',
      ent ? `The user is currently viewing legal entity "${ent.ownerCode}" (${ent.name}, id ${ent.id}). Prefer it when the entity is unspecified.` : 'No specific legal entity is open; ask or use list_legal_entities.',
      '',
      'Be concise. Show account codes from the data. If a name is ambiguous, list the candidates rather than guessing.',
      'Work efficiently — the user values a quick answer. When you need several independent simulations (e.g. one per Accounting Type), issue them as parallel tool calls in a SINGLE turn rather than one at a time across many turns. Do not re-run a simulation just to double-check a result you already have. Read the tool result once and draw the conclusion; only call more tools if you are genuinely missing data.',
      'Your replies are rendered as Markdown. Present journal lines, account lists, and any row/column data as a Markdown table (GitHub-flavored, with a header row) rather than pipe-separated text in a sentence.',
    ].join('\n');
  };

  const saveKey = () => {
    const k = keyDraft.trim();
    setApiKey(k);
    try { if (k) localStorage.setItem(KEY_STORAGE, k); else localStorage.removeItem(KEY_STORAGE); } catch { /* ignore */ }
    setEditingKey(false);
    setKeyDraft('');
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy || !apiKey) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', text }]);
    apiMessages.current.push({ role: 'user', content: text });
    setBusy(true);

    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

    try {
      for (let guard = 0; guard < 12; guard++) {
        // A fresh placeholder for whatever this assistant turn streams as text.
        let assistantIdx = -1;
        setMessages(m => { assistantIdx = m.length; return [...m, { role: 'assistant', text: '' }]; });

        const stream = client.messages.stream({
          model: MODEL,
          max_tokens: 4096,
          output_config: { effort: EFFORT },
          system: systemPrompt(),
          tools: TOOLS,
          messages: apiMessages.current,
        });
        stream.on('text', delta => {
          setMessages(m => {
            const copy = m.slice();
            const last = copy[assistantIdx];
            if (last && last.role === 'assistant') copy[assistantIdx] = { role: 'assistant', text: last.text + delta };
            return copy;
          });
        });
        const msg = await stream.finalMessage();
        apiMessages.current.push({ role: 'assistant', content: msg.content });

        // Drop the placeholder if this turn produced no visible text (pure tool call).
        const hadText = msg.content.some(b => b.type === 'text' && b.text.trim());
        if (!hadText) setMessages(m => m.filter((_, i) => i !== assistantIdx));

        if (msg.stop_reason !== 'tool_use') break;

        const toolUses = msg.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
        const results: Anthropic.ToolResultBlockParam[] = [];
        for (const tu of toolUses) {
          let ok = true;
          let payload: unknown;
          try { payload = await execTool(tu.name, tu.input); if (payload && typeof payload === 'object' && 'error' in payload) ok = false; }
          catch (e) { ok = false; payload = { error: (e as Error).message }; }
          setMessages(m => [...m, { role: 'tool', name: tu.name, ok }]);
          results.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(payload), is_error: !ok });
        }
        apiMessages.current.push({ role: 'user', content: results });
      }
    } catch (e) {
      let text = (e as Error).message;
      if (e instanceof Anthropic.AuthenticationError) text = 'Authentication failed — check your API key.';
      else if (e instanceof Anthropic.RateLimitError) text = 'Rate limited — try again shortly.';
      setMessages(m => [...m, { role: 'error', text }]);
    } finally {
      setBusy(false);
    }
  };

  // Drag the panel by its header. Buttons inside the header keep working.
  const onHeaderDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    dragStart.current = { sx: e.clientX, sy: e.clientY, ox: drag.x, oy: drag.y };
    const move = (ev: MouseEvent) => {
      const d = dragStart.current;
      if (d) setDrag({ x: d.ox + ev.clientX - d.sx, y: d.oy + ev.clientY - d.sy });
    };
    const up = () => {
      dragStart.current = null;
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    document.body.style.userSelect = 'none';
  };

  const suggestions = [
    'Make a PowerPoint with ALS NLD monthly profit as a column chart',
    "What is ALS NLD's profit for the latest year?",
    'Show the balance sheet for ALS NLD (Local Legal)',
  ];

  if (!open) {
    return createPortal(
      <>
        <style>{PANEL_CSS}</style>
        <button className="askc-fab" onClick={() => setOpen(true)} title="Ask the Accountant about this app">
          <Icon name="zap" size={18} /> Ask Accountant
        </button>
      </>,
      document.body,
    );
  }

  return createPortal(
    <div className="askc-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false); }}>
      <style>{PANEL_CSS}</style>
      <div className="askc-panel" style={{ transform: `translate(${drag.x}px, ${drag.y}px)` }}>
      <div className="askc-head" onMouseDown={onHeaderDown}>
        <span className="askc-title"><Icon name="zap" size={16} /> Ask Accountant</span>
        <span className="askc-sub">reads this app · read-only</span>
        <span style={{ flex: 1 }} />
        <button className="askc-icon" title="API key" onClick={() => { setKeyDraft(''); setEditingKey(v => !v); }}><Icon name="sliders" size={15} /></button>
        <button className="askc-icon" title="Close" onClick={() => setOpen(false)}><Icon name="x" size={16} /></button>
      </div>

      {(editingKey || !apiKey) && (
        <div className="askc-key">
          <div className="askc-note">
            Paste an Anthropic API key. It is stored in this browser and calls go directly to the API — fine for a local demo, not for anything shared.
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="password" placeholder="sk-ant-…" value={keyDraft}
              onChange={e => setKeyDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveKey(); }}
              style={{ flex: 1 }}
            />
            <button className="askc-btn" onClick={saveKey} disabled={!keyDraft.trim()}>Save</button>
            {apiKey && <button className="askc-btn ghost" onClick={() => { setApiKey(''); try { localStorage.removeItem(KEY_STORAGE); } catch { /* */ } }}>Clear</button>}
          </div>
        </div>
      )}

      <div className="askc-body" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="askc-empty">
            <p>Ask about this legal entity's formulas, accounting rules, or simulate how a message books.</p>
            {suggestions.map(s => (
              <button key={s} className="askc-chip" onClick={() => setInput(s)}>{s}</button>
            ))}
          </div>
        )}
        {collapse(messages).map((m, i) => {
          if (m.role === 'toolgroup') return (
            <div key={i} className="askc-tool">
              <Icon name={m.ok ? 'check' : 'x'} size={12} /> {TOOL_LABELS[m.name] ?? m.name}{m.count > 1 ? ` ×${m.count}` : ''}
            </div>
          );
          if (m.role === 'error') return <div key={i} className="askc-err">{m.text}</div>;
          if (m.role === 'assistant') return (
            <div key={i} className="askc-msg assistant askc-md">
              {m.text ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text}</ReactMarkdown> : (busy ? '…' : '')}
            </div>
          );
          return <div key={i} className="askc-msg user">{m.text}</div>;
        })}
        {busy && <div className="askc-working">Working…</div>}
      </div>

      <div className="askc-input">
        <textarea
          rows={2} placeholder={apiKey ? 'Ask about formulas, rules, or a simulation…' : 'Add an API key above to start'}
          value={input} disabled={!apiKey || busy}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
        />
        <button className="askc-send" onClick={send} disabled={!apiKey || busy || !input.trim()} title="Send">
          <Icon name="arrowRight" size={18} />
        </button>
      </div>
      </div>
    </div>,
    document.body,
  );
}

const PANEL_CSS = `
.askc-fab{position:fixed;left:32px;bottom:20px;z-index:900;display:flex;align-items:center;gap:7px;
  background:#00395D;color:#fff;border:0;border-radius:22px;padding:10px 16px;font-size:13px;font-weight:600;
  cursor:pointer;box-shadow:0 6px 20px rgba(0,57,93,.28)}
.askc-fab:hover{background:#004b78}
.askc-backdrop{position:fixed;inset:0;z-index:900;background:rgba(0,20,40,.38);
  display:flex;align-items:center;justify-content:center;padding:24px}
.askc-panel{width:min(1040px,95vw);height:min(82vh,780px);display:flex;flex-direction:column;
  background:var(--card,#fff);border:1px solid var(--line,#e3e3e8);border-radius:16px;
  box-shadow:0 24px 70px rgba(0,20,40,.35);overflow:hidden}
.askc-head{display:flex;align-items:center;gap:8px;padding:10px 12px;background:#00395D;color:#fff;cursor:move;user-select:none}
.askc-title{display:flex;align-items:center;gap:6px;font-weight:600;font-size:14px}
.askc-sub{font-size:10.5px;opacity:.7}
.askc-icon{background:rgba(255,255,255,.12);border:0;color:#fff;width:26px;height:26px;border-radius:7px;
  display:grid;place-items:center;cursor:pointer}
.askc-icon:hover{background:rgba(255,255,255,.24)}
.askc-key{padding:10px 12px;border-bottom:1px solid var(--line,#e3e3e8);background:var(--card,#fff)}
.askc-note{font-size:11px;color:var(--muted,#6b7280);margin-bottom:7px;line-height:1.4}
.askc-key input{border:1px solid var(--line,#d7d7de);border-radius:7px;padding:6px 9px;font-size:12px}
.askc-btn{background:#00395D;color:#fff;border:0;border-radius:7px;padding:6px 12px;font-size:12px;cursor:pointer}
.askc-btn.ghost{background:transparent;color:var(--muted,#6b7280);border:1px solid var(--line,#d7d7de)}
.askc-btn:disabled{opacity:.5;cursor:default}
.askc-body{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;background:var(--bg,#faf9fc)}
.askc-empty{color:var(--muted,#6b7280);font-size:12.5px;display:flex;flex-direction:column;gap:7px}
.askc-empty p{margin:0 0 3px}
.askc-chip{text-align:left;background:var(--card,#fff);border:1px solid var(--line,#e3e3e8);border-radius:9px;
  padding:8px 10px;font-size:12px;color:var(--text,#222);cursor:pointer}
.askc-chip:hover{border-color:#00395D}
.askc-msg{font-size:13.5px;line-height:1.55;white-space:pre-wrap;word-break:break-word;border-radius:10px;padding:9px 13px;max-width:min(860px,92%)}
.askc-msg.user{align-self:flex-end;background:#00395D;color:#fff}
.askc-msg.assistant{align-self:flex-start;background:var(--card,#fff);border:1px solid var(--line,#e3e3e8);color:var(--text,#1c1c22)}
.askc-md{white-space:normal}
.askc-md>*:first-child{margin-top:0}
.askc-md>*:last-child{margin-bottom:0}
.askc-md p{margin:6px 0}
.askc-md h1,.askc-md h2,.askc-md h3,.askc-md h4{margin:12px 0 5px;font-size:13.5px;font-weight:700;color:#00395D}
.askc-md ul,.askc-md ol{margin:6px 0;padding-left:20px}
.askc-md li{margin:2px 0}
.askc-md code{background:var(--bg,#f2f1f6);border:1px solid var(--line,#e6e6ec);border-radius:4px;padding:1px 4px;font-size:12px}
.askc-md pre{background:var(--bg,#f2f1f6);border:1px solid var(--line,#e6e6ec);border-radius:8px;padding:9px 11px;overflow-x:auto}
.askc-md pre code{background:none;border:0;padding:0}
.askc-md table{border-collapse:collapse;margin:8px 0;font-size:12.5px;display:block;overflow-x:auto;max-width:100%}
.askc-md th,.askc-md td{border:1px solid var(--line,#dcdce3);padding:5px 9px;text-align:left;white-space:nowrap}
.askc-md thead th{background:#eef1f6;color:#00395D;font-weight:600}
.askc-md tbody tr:nth-child(even){background:var(--bg,#faf9fc)}
.askc-md a{color:#00395D;text-decoration:underline}
.askc-md blockquote{margin:6px 0;padding-left:10px;border-left:3px solid var(--line,#dcdce3);color:var(--muted,#6b7280)}
.askc-tool{align-self:flex-start;display:flex;align-items:center;gap:5px;font-size:11px;color:var(--muted,#6b7280);
  background:var(--card,#fff);border:1px solid var(--line,#ececf1);border-radius:20px;padding:3px 9px}
.askc-err{align-self:flex-start;font-size:12px;color:#b3261e;background:#fdecea;border:1px solid #f5c6c2;border-radius:9px;padding:7px 10px}
.askc-working{font-size:11px;color:var(--muted,#6b7280);align-self:flex-start}
.askc-input{display:flex;gap:7px;padding:10px;border-top:1px solid var(--line,#e3e3e8);background:var(--card,#fff)}
.askc-input textarea{flex:1;resize:none;border:1px solid var(--line,#d7d7de);border-radius:9px;padding:8px 10px;
  font-size:13px;font-family:inherit;outline:none}
.askc-input textarea:focus{border-color:#00395D}
.askc-send{background:#00395D;color:#fff;border:0;border-radius:9px;width:40px;display:grid;place-items:center;cursor:pointer}
.askc-send:disabled{opacity:.4;cursor:default}
`;
