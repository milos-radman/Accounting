/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { AppData, SeedData, CoaNode, EntityCoaNode, AccountKind, PseudoAccount, Party, PartyRef, LegalEntity, Integration, JournalPostedEvent } from './types';
import seedJson from './data/seed.json';
import {
  extAccountValues, extAccountParts, journals, integrations, pseudoAccountCoaLinks, dimensionSeparators, accrualCodes,
  basChartOfAccount, basCoaNodes, BAS_COA_ID,
} from './data/extras';
import {
  recognitionAmountTypes, recognitionPseudoAccounts, recognitionCategories, recognitionPlans, recognitionDemoJournals,
  recognitionFormulas, recognitionRules,
} from './data/recognition';
import { importedPlans } from './data/importedPlans';
import { openingBalances as seedOpeningBalances, openingPseudoAccounts } from './data/openingBalances';
import { reconcileGliSerie } from './engine';

const STORAGE_KEY = 'accounting-domain-data-v1';

// Copy a chart-of-account template into an entity-owned chart.
// Node ids get a per-entity base offset so the template node numbering stays readable.
export function copyCoaTemplate(templateNodes: CoaNode[], coaId: number, legalEntityId: number, idBase: number): EntityCoaNode[] {
  return templateNodes
    .filter(n => n.coaId === coaId)
    .map(n => ({
      id: idBase + n.id,
      legalEntityId,
      name: n.name,
      description: n.description,
      order: n.order,
      depth: n.depth,
      parentId: n.parentId == null ? null : idBase + n.parentId,
      accountFrom: n.accountFrom,
      accountTo: n.accountTo,
    }));
}

// Suggest the chart-of-account node an account number belongs on: the deepest node whose
// account range contains the number (narrowest range wins on a tie). Null when nothing matches.
export function suggestCoaNode(pseudo: string, nodes: EntityCoaNode[]): EntityCoaNode | null {
  const n = parseInt(pseudo, 10);
  if (Number.isNaN(n)) return null;
  const hits = nodes.filter(x => x.accountFrom != null && x.accountTo != null && n >= x.accountFrom && n <= x.accountTo);
  if (hits.length === 0) return null;
  return hits.sort((a, b) =>
    (b.depth - a.depth) || ((a.accountTo! - a.accountFrom!) - (b.accountTo! - b.accountFrom!)),
  )[0];
}

export function nextCoaIdBase(existing: EntityCoaNode[]): number {
  const max = Math.max(0, ...existing.map(n => n.id));
  return (Math.floor(max / 1000) + 1) * 1000;
}

function buildEntityCharts(seed: SeedData): { nodes: EntityCoaNode[]; linkBase: Record<string, number> } {
  const nodes: EntityCoaNode[] = [];
  const linkBase: Record<string, number> = {};
  for (const e of seed.legalEntities) {
    const base = e.id * 1000;
    linkBase[e.ownerCode] = base;
    nodes.push(...copyCoaTemplate(seed.coaNodes, e.coaId, e.id, base));
  }
  return { nodes, linkBase };
}

// Default account type from the account number series: revenue/expense series are
// profit & loss accounts, the rest balance sheet accounts. Editable per account.
export function defaultAccountKind(account: Pick<PseudoAccount, 'pseudo'>): AccountKind {
  return /^(42|13|EK|EG|I6|FP)/i.test(account.pseudo) ? 'Result' : 'Balance';
}

// Capture a reference + display snapshot of a party at assignment time.
export function toPartyRef(party: Party, asOf = new Date().toISOString().slice(0, 10)): PartyRef {
  return {
    partyId: party.id,
    kind: party.kind,
    name: party.name,
    fullName: party.fullName,
    reference: party.orgNumber,
    address: [party.address1, party.address2].filter(Boolean).join(', '),
    city: `${party.zip} ${party.city}`.trim(),
    country: party.country,
    email: party.email,
    phone: party.phone,
    asOf,
  };
}

// Derive owner / responsible / controller snapshots for a legal entity from party ids.
function withPartyRefs(entity: LegalEntity, parties: Party[]): LegalEntity {
  const ref = (id?: number) => {
    const p = id == null ? undefined : parties.find(x => x.id === id);
    return p ? toPartyRef(p) : undefined;
  };
  return {
    ...entity,
    owner: entity.owner ?? ref(entity.ownerPartyId),
    responsibleRef: entity.responsibleRef ?? ref(entity.responsiblePartyId),
    controllerRef: entity.controllerRef ?? ref(entity.controllerPartyId),
  };
}

// A couple of inbound messages that could NOT be booked (no rule matched / nothing resolved), so they
// produced no journal — surfaced on the dashboard and the Published events page (status = Rejected).
const demoJournalEvents: JournalPostedEvent[] = [
  { id: 1, publishedAt: '2024-10-01 08:42', legalEntityId: 1, entityCode: 'ALS NLD', correlationId: 'AP-40217', accountingEvent: 'AP Definite Posting', status: 'Rejected', journalNumber: null, bookingDate: '2024-10-01', agreement: '700500', agreementLines: [1], invoices: ['SINV-88213'], references: ['SUP-55012'], lineCount: 0, totalDebit: 0, totalCredit: 0, difference: false, source: 'Payables domain' },
  { id: 2, publishedAt: '2024-10-01 09:15', legalEntityId: 1, entityCode: 'ALS NLD', correlationId: 'AR-77190', accountingEvent: 'AR Payment', status: 'Rejected', journalNumber: null, bookingDate: '2024-10-01', agreement: '4002', agreementLines: [1], invoices: ['INV-70061'], references: [], lineCount: 0, totalDebit: 0, totalCredit: 0, difference: false, source: 'Receivables domain' },
];

function buildInitialData(): AppData {
  const seed = seedJson as unknown as SeedData;
  const { nodes, linkBase } = buildEntityCharts(seed);
  const links = pseudoAccountCoaLinks.map(l => ({ ...l, coaNodeId: (linkBase[l.entityCode] ?? 0) + l.coaNodeId }));
  const entities = seed.legalEntities.map(e =>
    withPartyRefs({ ...e, dimensionSeparator: dimensionSeparators[e.id] ?? '', revaluationResultAccount: '420420' }, seed.parties));
  const accounts = [...seed.pseudoAccounts.map(p => ({ ...p, accountKind: defaultAccountKind(p) })), ...recognitionPseudoAccounts, ...openingPseudoAccounts];
  const allJournals = [...recognitionDemoJournals, ...journals];
  // Each entity's GLI series starts at the latest number used by its seeded journals.
  entities.forEach(e => reconcileGliSerie(e, allJournals));
  // Journal differences is derived — set it from the actual journals so the stored counter is truthful
  // (the seed carried a placeholder). It's recomputed on every booking, and the dashboard also counts live.
  entities.forEach(e => { e.journalDifferences = allJournals.filter(j => j.legalEntityId === e.id && j.difference).length; });
  return {
    ...seed, legalEntities: entities, pseudoAccounts: accounts,
    formulas: [...seed.formulas, ...recognitionFormulas],
    accountingRules: [...seed.accountingRules, ...recognitionRules],
    chartOfAccounts: [...seed.chartOfAccounts, basChartOfAccount],
    coaNodes: [...seed.coaNodes, ...basCoaNodes],
    currencies: seed.currencies.map(c => ({ ...c, rate: defaultCurrencyRate(c.code), asOf: '2024-10-01' })),
    amountTypes: [...seed.amountTypes.map(a => ({ ...a, allowsMultipleCodes: a.id === 39 })), ...recognitionAmountTypes],
    accountingEvents: seed.accountingEvents.map(e => ({ ...e, postingMode: defaultPostingMode(e.id), usesAccountingRules: defaultUsesAccountingRules(e.id, e.eventCategoryId), reverseMatchBy: defaultReverseMatchBy(e.id, e.eventCategoryId) })),
    extAccountValues, extAccountParts, journals: allJournals, integrations,
    pseudoAccountCoaLinks: links, entityCoaNodes: nodes, pseudoAccountExtParts: [],
    accrualCodes, accrualItems: [], accrualScheduleLines: [], pendingMessages: [],
    revalueAccounts: [], revalueTransactions: [], exportBatches: [],
    ledgerSeries: seedLedgerSeries(), journalEvents: [...demoJournalEvents],
    recognitionCategories, recognitionPlans: [...recognitionPlans, ...importedPlans], recognitionStates: [],
    openingBalances: seedOpeningBalances,
  };
}

// Demo per-ledger export voucher series for ALS NLD: Local Legal + US GAAP each get their own
// gapless sequence. Other entities/ledgers fall back to the entity GLI number until configured.
function seedLedgerSeries() {
  return [
    { id: 1, legalEntityId: 1, ledger: 'Local Legal', prefix: 'LL-', nextNumber: 5001 },
    { id: 2, legalEntityId: 1, ledger: 'US GAAP', prefix: 'US-', nextNumber: 3001 },
  ];
}

// Default export-content config for a GL integration that predates it (Per-account summarisation,
// generic JSON over file). Applied to old saved integrations during migration.
function withExportDefaults(i: Integration): Integration {
  return {
    ...i,
    targetGl: i.targetGl ?? 'Generic',
    format: i.format ?? 'JSON',
    transport: i.transport ?? 'File',
    ledger: i.ledger ?? 'ALL',
    summarization: i.summarization ?? 'PerAccount',
    defaultKeepPartIds: i.defaultKeepPartIds ?? [],
  };
}

// A default GL integration for an entity that has none yet (e.g. newly created).
function defaultIntegration(entity: LegalEntity, id: number): Integration {
  return {
    id, legalEntityId: entity.id, name: 'GL04 - Export GL Transactions',
    description: `GL04 - Export GL Transactions (${entity.ownerCode})`,
    fileName: 'PF201', fileLocation: '', archiveLocation: '',
    status: 'Active', executionType: 'EndOfMonth',
    nextSequence: 1, lastExecution: '', lastExecutionBy: '', records: 0,
    targetGl: 'Generic', format: 'JSON', transport: 'File', ledger: 'ALL',
    summarization: 'PerAccount', defaultKeepPartIds: [],
  };
}

// Monthly Booking (event 21) is held for the End of Month run; everything else posts at once.
function defaultPostingMode(eventId: number): 'Immediate' | 'EndOfMonth' {
  return eventId === 21 ? 'EndOfMonth' : 'Immediate';
}

// Which events book through user-configured accounting rules. Reversal events (category 2) mirror
// the original journal; Interest Adjustment (18) and Agreement Change (19) flow through the
// recognition-plan change; the revaluation events (26, 27) are posted by the revaluation engine.
function defaultUsesAccountingRules(eventId: number, eventCategoryId: number): boolean {
  if (eventCategoryId === 2) return false;
  return ![18, 19, 26, 27].includes(eventId);
}

// How each reversal event finds the original to mirror, from the message's Reversal Reference.
// Credit Invoicing → the original AR invoice number; AP reversals → the reference (supplier
// invoice / payment) number; the agreement-driven reversals → agreement line (+ period).
function defaultReverseMatchBy(eventId: number, eventCategoryId: number): 'InvoiceNumber' | 'ReferenceNumber' | 'PaymentId' | 'AgreementLine' | 'AgreementLinePeriod' | undefined {
  if (eventCategoryId !== 2) return undefined;
  if (eventId === 17) return 'InvoiceNumber'; // Credit Invoicing → our AR invoice number
  if (eventId === 9) return 'ReferenceNumber'; // AP Definite Posting - Rev → our unique supplier-invoice id
  if (eventId === 12 || eventId === 28) return 'PaymentId'; // AP / AR Undo Payment → the specific payment
  if (eventId === 16) return 'AgreementLine'; // Undo Activation
  if (eventId === 22 || eventId === 25) return 'AgreementLinePeriod'; // Monthly Booking reversal / Undo Monthly Booking
  return 'InvoiceNumber';
}

// Illustrative exchange rates: value of 1 unit of the currency in EUR (the reporting currency).
function defaultCurrencyRate(code: string): number {
  const rates: Record<string, number> = {
    EUR: 1, SEK: 0.087, RSD: 0.0085, USD: 0.92, GBP: 1.17, NOK: 0.086, DKK: 0.134,
  };
  return rates[code] ?? 1;
}

function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppData;
      // migration: older saved data predates the PseudoAccountCOA link table
      if (!parsed.pseudoAccountCoaLinks) parsed.pseudoAccountCoaLinks = pseudoAccountCoaLinks;
      // migration: older saved data shared the COA template between entities —
      // give each entity its own copy and remap links from template node ids
      if (!parsed.entityCoaNodes) {
        const { nodes, linkBase } = buildEntityCharts(parsed);
        parsed.entityCoaNodes = nodes;
        parsed.pseudoAccountCoaLinks = parsed.pseudoAccountCoaLinks.map(l => ({
          ...l,
          coaNodeId: (linkBase[l.entityCode] ?? 0) + l.coaNodeId,
        }));
      }
      // migration: accounting dimensions — 'Account' as a selectable source value,
      // a required flag per dimension and a separator per legal entity
      if (!parsed.extAccountValues.some(v => v.name === 'Account')) {
        parsed.extAccountValues = [
          { id: 27, name: 'Account', level: 'Account', dataType: 'Text', source: 'PseudoAccount' },
          ...parsed.extAccountValues,
        ];
      }
      // migration: data type + dimension source per external account value (defaults by name)
      parsed.extAccountValues = parsed.extAccountValues.map(v => {
        const seed = extAccountValues.find(s => s.name === v.name);
        return {
          ...v,
          dataType: v.dataType ?? seed?.dataType ?? 'Text',
          source: v.source ?? seed?.source ?? 'AccountValuesList',
          messageField: v.messageField ?? seed?.messageField,
        };
      });
      parsed.extAccountParts = parsed.extAccountParts.map(p => ({
        ...p,
        required: p.required ?? p.partNumber === 1,
      }));
      // migration: dimension values / parts added to the seed since this store was saved
      // (e.g. Supplier identity, and the asset/supplier dimensions on ALS NLD)
      for (const v of extAccountValues) {
        if (!parsed.extAccountValues.some(x => x.id === v.id || x.name === v.name)) parsed.extAccountValues.push(v);
      }
      for (const p of extAccountParts) {
        if (!parsed.extAccountParts.some(x => x.id === p.id)) parsed.extAccountParts.push(p);
      }
      // migration: canonical ALS NLD (entity 1) dimension layout — inserts Product and
      // re-numbers the following parts so existing stores match the seed order.
      for (const sp of extAccountParts.filter(p => p.legalEntityId === 1)) {
        const existing = parsed.extAccountParts.find(x => x.id === sp.id);
        if (existing) existing.partNumber = sp.partNumber;
      }
      // migration: drop the retired generic Table 1-6 / Text 1-6 dimension values, unless a
      // configured part still references one (keep those to avoid orphaning a used dimension)
      const retiredDims = new Set(['Table 1', 'Table 2', 'Table 3', 'Table 4', 'Table 5', 'Table 6', 'Text 1', 'Text 2', 'Text 3', 'Text 4', 'Text 5', 'Text 6']);
      const usedValueIds = new Set(parsed.extAccountParts.map(p => p.extAccountValueId));
      parsed.extAccountValues = parsed.extAccountValues.filter(v => !retiredDims.has(v.name) || usedValueIds.has(v.id));
      parsed.legalEntities = parsed.legalEntities.map(e => ({
        ...e,
        dimensionSeparator: e.dimensionSeparator ?? dimensionSeparators[e.id] ?? '',
      }));
      // migration: account type (balance/result) and per-account dimension usage
      parsed.pseudoAccounts = parsed.pseudoAccounts.map(p => ({
        ...p,
        accountKind: p.accountKind ?? defaultAccountKind(p),
      }));
      parsed.pseudoAccountExtParts ??= [];
      // migration: pull in any accounting events added to the seed (matched by code)
      // that the saved data does not have yet — so reference-data additions show up
      const seedEvents = (seedJson as unknown as SeedData).accountingEvents;
      const knownCodes = new Set(parsed.accountingEvents.map(e => e.code));
      for (const ev of seedEvents) {
        if (!knownCodes.has(ev.code)) parsed.accountingEvents.push(ev);
      }
      // migration: pull in chart-of-account template nodes added to the seed for a
      // template that has none yet (e.g. the IFRS template) without touching edited ones
      const seedNodes = (seedJson as unknown as SeedData).coaNodes;
      const templateHasNodes = new Set(parsed.coaNodes.map(n => n.coaId));
      for (const node of seedNodes) {
        if (!templateHasNodes.has(node.coaId)) parsed.coaNodes.push(node);
      }
      // migration: party directory — mark existing parties as organizations, pull in the
      // person parties from the seed, and derive owner/responsible/controller snapshots
      const seedParties = (seedJson as unknown as SeedData).parties;
      parsed.parties = parsed.parties.map(p => ({ ...p, kind: p.kind ?? 'Organization' }));
      const knownPartyIds = new Set(parsed.parties.map(p => p.id));
      for (const p of seedParties) {
        if (!knownPartyIds.has(p.id)) parsed.parties.push(p);
      }
      parsed.legalEntities = parsed.legalEntities.map(e => {
        const seedEntity = (seedJson as unknown as SeedData).legalEntities.find(s => s.id === e.id);
        return withPartyRefs({
          ...e,
          responsiblePartyId: e.responsiblePartyId ?? seedEntity?.responsiblePartyId,
          controllerPartyId: e.controllerPartyId ?? seedEntity?.controllerPartyId,
        }, parsed.parties);
      });
      // migration: amount groups on amount types + insurance type, and the accrual tables
      const seedAmountTypes = (seedJson as unknown as SeedData).amountTypes;
      parsed.amountTypes = parsed.amountTypes.map(a => ({
        ...a,
        amountGroup: a.amountGroup ?? seedAmountTypes.find(s => s.id === a.id)?.amountGroup ?? 'Message',
        // Added Cost (39) can carry several amount codes on one message.
        allowsMultipleCodes: a.allowsMultipleCodes ?? a.id === 39,
      }));
      const knownAmountTypeIds = new Set(parsed.amountTypes.map(a => a.id));
      for (const a of seedAmountTypes) {
        if (!knownAmountTypeIds.has(a.id)) parsed.amountTypes.push(a);
      }
      parsed.accrualCodes ??= accrualCodes;
      // migration: backfill the message trigger on codes stored before it existed
      parsed.accrualCodes = parsed.accrualCodes.map(c => ({
        ...c,
        triggerAmountTypeId: c.triggerAmountTypeId
          ?? accrualCodes.find(s => s.entityCode === c.entityCode && s.code === c.code)?.triggerAmountTypeId
          ?? null,
      }));
      // migration: merge in accrual codes added to the seed since this store was saved
      let maxAccrualCodeId = Math.max(0, ...parsed.accrualCodes.map(c => c.id));
      for (const seedCode of accrualCodes) {
        if (!parsed.accrualCodes.some(c => c.entityCode === seedCode.entityCode && c.code === seedCode.code)) {
          parsed.accrualCodes.push({ ...seedCode, id: ++maxAccrualCodeId });
        }
      }
      parsed.accrualItems ??= [];
      parsed.accrualScheduleLines ??= [];
      // migration: posting mode per accounting event + the pending-message inbox
      parsed.accountingEvents = parsed.accountingEvents.map(e => ({
        ...e,
        postingMode: e.postingMode ?? defaultPostingMode(e.id),
        usesAccountingRules: e.usesAccountingRules ?? defaultUsesAccountingRules(e.id, e.eventCategoryId),
        reverseMatchBy: e.reverseMatchBy ?? defaultReverseMatchBy(e.id, e.eventCategoryId),
      }));
      parsed.pendingMessages ??= [];
      parsed.revalueAccounts ??= [];
      parsed.revalueTransactions ??= [];
      parsed.exportBatches ??= [];
      parsed.journalEvents ??= [];
      for (const ev of demoJournalEvents) if (!parsed.journalEvents.some(x => x.id === ev.id)) parsed.journalEvents.push(ev);
      // migration: transport + delivery lifecycle on batches produced before Phase 3
      parsed.exportBatches.forEach(b => { b.status ??= 'Exported'; b.transport ??= 'File'; });
      // migration: add the Swedish BAS-plan chart of account + its nodes (with account ranges)
      if (!parsed.chartOfAccounts.some(c => c.id === BAS_COA_ID)) parsed.chartOfAccounts.push(basChartOfAccount);
      if (!parsed.coaNodes.some(n => n.coaId === BAS_COA_ID)) parsed.coaNodes.push(...basCoaNodes);
      parsed.ledgerSeries ??= seedLedgerSeries();
      // migration: the export-content config is now unified onto the integration (was a separate
      // IntegrationProfile). Backfill defaults, fold any Phase-2 profile settings onto the
      // entity's integration, and make sure every entity has an integration to run.
      type OldProfile = Partial<Integration> & { legalEntityId: number };
      const oldProfiles: OldProfile[] = (parsed as { integrationProfiles?: OldProfile[] }).integrationProfiles ?? [];
      parsed.integrations = parsed.integrations.map(i => {
        // executionType is now Manual | EndOfMonth (the old 'Recurring' means run at End of Month).
        const base = withExportDefaults({ ...i, executionType: i.executionType === 'Recurring' ? 'EndOfMonth' : i.executionType });
        const prof = oldProfiles.find(p => p.legalEntityId === i.legalEntityId);
        if (!prof) return base;
        return {
          ...base,
          targetGl: prof.targetGl ?? base.targetGl, format: prof.format ?? base.format,
          transport: prof.transport ?? base.transport, ledger: prof.ledger ?? base.ledger,
          summarization: prof.summarization ?? base.summarization,
          defaultKeepPartIds: prof.defaultKeepPartIds ?? base.defaultKeepPartIds,
        };
      });
      for (const e of parsed.legalEntities) {
        if (!parsed.integrations.some(i => i.legalEntityId === e.id)) {
          parsed.integrations.push(defaultIntegration(e, Math.max(0, ...parsed.integrations.map(i => i.id)) + 1));
        }
      }
      delete (parsed as { integrationProfiles?: unknown }).integrationProfiles;
      // migration: (re)seed the demo journals — 124843 unbalanced (View Differences Only),
      // 124842 consolidated invoice + 124841 credit invoice (Reversed / reversal reference).
      // Refreshed from seed each load so corrections propagate to existing stores.
      for (const gli of [124843, 124842, 124841, 124840, 124839]) {
        parsed.journals = parsed.journals.filter(j => j.gliNumber !== gli);
        const demo = journals.find(j => j.gliNumber === gli);
        if (demo) parsed.journals.unshift(demo);
      }
      // migration: Accounting Recognition Plan — system cutoff amount types, ALS NLD cutoff
      // accounts + categories, and the demo quarterly-in-arrears plan (+ its arrears invoice).
      for (const at of recognitionAmountTypes) {
        if (!parsed.amountTypes.some(a => a.id === at.id)) parsed.amountTypes.push(at);
      }
      for (const pa of recognitionPseudoAccounts) {
        if (!parsed.pseudoAccounts.some(p => p.entityCode === pa.entityCode && p.pseudo === pa.pseudo)) parsed.pseudoAccounts.push(pa);
      }
      // Monthly Booking formulas + accounting rules that map the system amount types to accounts.
      for (const f of recognitionFormulas) {
        if (!parsed.formulas.some(x => x.id === f.id)) parsed.formulas.push(f);
      }
      for (const r of recognitionRules) {
        if (!parsed.accountingRules.some(x => x.id === r.id)) parsed.accountingRules.push(r);
      }
      // migration: message-attribute allowed values (code + description), the Payment Method attribute,
      // and the demo AR Payment payment-method routing (formula 17 → condition set 64).
      const sj = seedJson as unknown as { conditionValues: AppData['conditionValues']; conditionValueOptions: AppData['conditionValueOptions']; conditions: AppData['conditions'] };
      parsed.conditionValueOptions ??= [];
      for (const o of sj.conditionValueOptions) if (!parsed.conditionValueOptions.some(x => x.id === o.id)) parsed.conditionValueOptions.push(o);
      for (const v of sj.conditionValues) if (!parsed.conditionValues.some(x => x.id === v.id)) parsed.conditionValues.push(v);
      // Payment-method routing on formula 17 was removed: in this app AR sends DD as paid-and-applied
      // (reversed via Undo Payment on rejection), so payments book to Bank, not a Cash Contra. Drop
      // any previously-migrated fc64 routing rows so old localStorage matches the current model.
      const f17 = parsed.formulas.find(f => f.id === 17);
      if (f17 && f17.formulaConditionId === 64) f17.formulaConditionId = null;
      parsed.conditions = parsed.conditions.filter(c => c.formulaConditionId !== 64);
      // migration: normalize condition levels to tree depth (branch = 0, overrides = 1…) so the
      // override resolver reads them correctly. Depth = order the condition field first appears
      // within the group (Accounting Type → 0, Amount Code → 1), matching the seed.
      {
        const byFc = new Map<number, AppData['conditions']>();
        for (const c of parsed.conditions) { const a = byFc.get(c.formulaConditionId) ?? []; a.push(c); byFc.set(c.formulaConditionId, a); }
        for (const arr of byFc.values()) {
          if (arr.some(c => (c.level ?? 0) === 0)) continue; // already tree-leveled (seed / UI-managed) — leave user branches intact
          const rank = new Map<number, number>();
          for (const c of arr) if (c.conditionValueId != null && !rank.has(c.conditionValueId)) rank.set(c.conditionValueId, rank.size);
          for (const c of arr) c.level = c.conditionValueId != null ? (rank.get(c.conditionValueId) ?? 0) : 0;
        }
      }
      parsed.recognitionCategories ??= recognitionCategories;
      // migration: categories predating rule-based accounts / the Cutoff-vs-Straight kind — ensure
      // kind + the system amount type names are present (accounts live on the Monthly Booking rules).
      parsed.recognitionCategories = parsed.recognitionCategories.map(c => {
        const seed = recognitionCategories.find(s => s.entityCode === c.entityCode && s.name === c.name);
        return { ...c, kind: c.kind ?? seed?.kind ?? 'Cutoff', incomeAmountType: c.incomeAmountType ?? seed?.incomeAmountType ?? `Recognised ${c.name}` };
      });
      // migration: merge in categories added to the seed (e.g. the Straight Depreciation category).
      for (const sc of recognitionCategories) {
        if (!parsed.recognitionCategories.some(c => c.entityCode === sc.entityCode && c.name === sc.name)) parsed.recognitionCategories.push(sc);
      }
      parsed.recognitionPlans ??= recognitionPlans;
      // migration: refresh the old-system imported plans (read-only reference data) from seed, so a
      // changed export or structure propagates. Only drops plans marked imported; keeps live plans.
      const seededImportAgreements = new Set(importedPlans.map(p => p.agreement));
      parsed.recognitionPlans = parsed.recognitionPlans.filter(p => !p.imported || !seededImportAgreements.has(p.agreement));
      parsed.recognitionPlans.push(...importedPlans);
      // migration: hand-entered / activated plans recognise going-forward (older saves predate the flag);
      // seeded old-system imports stay historical (watermark). Backfill by source.
      for (const p of parsed.recognitionPlans) {
        if (p.goingForward === undefined && (p.source === 'Manual entry' || p.source === 'Activation')) p.goingForward = true;
      }
      parsed.recognitionStates ??= [];
      // migration: opening balances + the equity account they carry the brought-forward figure on
      parsed.openingBalances ??= seedOpeningBalances;
      for (const pa of openingPseudoAccounts) {
        if (!parsed.pseudoAccounts.some(p => p.entityCode === pa.entityCode && p.pseudo === pa.pseudo)) parsed.pseudoAccounts.push(pa);
      }
      for (const j of recognitionDemoJournals) {
        if (!parsed.journals.some(x => x.gliNumber === j.gliNumber)) parsed.journals.unshift(j);
      }
      parsed.legalEntities = parsed.legalEntities.map(e => ({ ...e, revaluationResultAccount: e.revaluationResultAccount ?? '420420' }));
      // migration: journal differences is derived — recompute from actual journals (older saves / seed placeholder).
      parsed.legalEntities.forEach(e => { e.journalDifferences = parsed.journals.filter(j => j.legalEntityId === e.id && j.difference).length; });
      // migration: keep each entity's GLI series at the latest number used by its journals, so a
      // new journal continues the entity's own series (older saves left gliNumberSerie stale).
      parsed.legalEntities.forEach(e => reconcileGliSerie(e, parsed.journals));
      // migration: exchange rate per currency (value of 1 unit in EUR, the reporting currency)
      parsed.currencies = parsed.currencies.map(c => ({
        ...c,
        rate: c.rate ?? defaultCurrencyRate(c.code),
        asOf: c.asOf ?? '2024-10-01',
      }));
      // migration: merge in currencies added to the seed (USD, GBP, NOK, …)
      const knownCurrencyIds = new Set(parsed.currencies.map(c => c.id));
      for (const c of (seedJson as unknown as SeedData).currencies) {
        if (!knownCurrencyIds.has(c.id)) parsed.currencies.push({ ...c, rate: defaultCurrencyRate(c.code), asOf: '2024-10-01' });
      }
      return parsed;
    }
  } catch {
    // corrupted storage — fall back to seed
  }
  return buildInitialData();
}

// ---- Activity log --------------------------------------------------------------------------------
// A live audit feed of things happening in the system — not just journals. Any item ADDED to one of
// the watched collections (a pseudo account, a formula, an attribute code, a recognition plan, a
// journal, …) is detected by diffing before/after each update() and appended here.
export interface ActivityEntry { id: string; ts: number; kind: string; title: string; detail: string; entity?: string; to?: string }

const ownerOf = (d: AppData, id: number) => d.legalEntities.find(e => e.id === id)?.ownerCode;

interface Watch {
  name: keyof AppData; key: (x: any) => string | number; kind: string; title: string;
  detail: (x: any, d: AppData) => string; entity?: (x: any, d: AppData) => string | undefined; to?: (x: any) => string;
}
const WATCHES: Watch[] = [
  { name: 'journals', key: j => j.gliNumber, kind: 'journal', title: 'Journal posted', detail: j => `${j.gliPrefix ?? ''}${j.gliNumber} · ${j.accountingEvent} · ${j.lineCount} rows`, entity: (j, d) => ownerOf(d, j.legalEntityId), to: j => `/journals/gli/${j.gliNumber}` },
  { name: 'pseudoAccounts', key: p => `${p.entityCode}:${p.id}`, kind: 'pseudo', title: 'Pseudo account added', detail: p => p.description ? `${p.pseudo} — ${p.description}` : `${p.pseudo}`, entity: p => p.entityCode },
  { name: 'formulas', key: f => f.id, kind: 'formula', title: 'Formula added', detail: f => f.name },
  { name: 'amountTypes', key: a => a.id, kind: 'amountType', title: 'Amount type added', detail: a => a.name },
  { name: 'conditionValueOptions', key: o => o.id, kind: 'attrCode', title: 'Attribute code added', detail: o => `${o.code} — ${o.description}` },
  { name: 'accountingRules', key: r => r.id, kind: 'rule', title: 'Accounting rule added', detail: (r, d) => d.formulas.find(f => f.id === r.formulaId)?.name ?? `rule ${r.id}`, entity: r => r.entityCode },
  { name: 'recognitionPlans', key: p => p.id, kind: 'plan', title: 'Recognition plan added', detail: p => `Agreement ${p.agreement} · ${p.status}`, entity: (p, d) => ownerOf(d, p.legalEntityId), to: p => `/legal-entity/${p.legalEntityId}/recognition/${p.agreement}` },
  { name: 'recognitionCategories', key: c => `${c.entityCode}:${c.id}`, kind: 'category', title: 'Recognition category added', detail: c => c.name, entity: c => c.entityCode },
  { name: 'accrualCodes', key: c => c.id, kind: 'accrual', title: 'Accrual code added', detail: c => `${c.code} — ${c.name}`, entity: c => c.entityCode },
  { name: 'ledgers', key: l => l.id, kind: 'ledger', title: 'Ledger added', detail: l => l.description || l.name },
  { name: 'currencies', key: c => c.id, kind: 'currency', title: 'Currency added', detail: c => `${c.code} — ${c.name}` },
  { name: 'legalEntities', key: e => e.id, kind: 'entity', title: 'Legal entity added', detail: e => `${e.ownerCode} — ${e.name}`, entity: e => e.ownerCode },
];

function diffActivity(prev: AppData, next: AppData): ActivityEntry[] {
  const out: ActivityEntry[] = [];
  let seq = 0;
  for (const w of WATCHES) {
    const before = new Set((prev[w.name] as unknown as any[]).map(w.key));
    for (const item of (next[w.name] as unknown as any[])) {
      if (before.has(w.key(item))) continue;
      out.push({ id: `${Date.now()}-${w.kind}-${w.key(item)}-${seq++}`, ts: Date.now(), kind: w.kind, title: w.title, detail: w.detail(item, next), entity: w.entity?.(item, next), to: w.to?.(item) });
    }
  }
  return out;
}

function seedActivity(d: AppData): ActivityEntry[] {
  return d.journals.slice(0, 24).map((j, i) => ({
    id: `seed-${j.gliNumber}`, ts: Date.now() - (i + 1) * 41000, kind: 'journal', title: 'Journal posted',
    detail: `${j.gliPrefix ?? ''}${j.gliNumber} · ${j.accountingEvent} · ${j.lineCount} rows`, entity: ownerOf(d, j.legalEntityId), to: `/journals/gli/${j.gliNumber}`,
  }));
}

interface Store {
  data: AppData;
  update: (mutate: (draft: AppData) => void) => void;
  reset: () => void;
  activityLog: ActivityEntry[];
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(loadData);
  const dataRef = useRef(data);
  useEffect(() => { dataRef.current = data; }, [data]);
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>(() => seedActivity(data));

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // storage full — ignore, app keeps working in memory
    }
  }, [data]);

  const update = (mutate: (draft: AppData) => void) => {
    const prev = dataRef.current;
    const draft: AppData = JSON.parse(JSON.stringify(prev));
    mutate(draft);
    const added = diffActivity(prev, draft); // anything new appears in the activity feed
    dataRef.current = draft;
    setData(draft);
    if (added.length) setActivityLog(log => [...added, ...log].slice(0, 200));
  };

  const reset = () => {
    localStorage.removeItem(STORAGE_KEY);
    const fresh = buildInitialData();
    dataRef.current = fresh;
    setData(fresh);
    setActivityLog(seedActivity(fresh));
  };

  return <StoreContext.Provider value={{ data, update, reset, activityLog }}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}

// ---- lookup helpers ----
export function useLookups() {
  const { data } = useStore();

  const entityByCode = (code: string) => data.legalEntities.find(e => e.ownerCode === code);
  const entityById = (id: number) => data.legalEntities.find(e => e.id === id);

  const ledgerName = (legalAccountingLedgerId: number) => {
    const lal = data.legalAccountingLedgers.find(l => l.id === legalAccountingLedgerId);
    if (!lal) return '';
    const ledger = data.ledgers.find(l => l.id === lal.ledgerId);
    return ledger?.description ?? '';
  };

  const classNameOf = (legalAccountingLedgerId: number) => {
    const lal = data.legalAccountingLedgers.find(l => l.id === legalAccountingLedgerId);
    if (!lal) return '';
    const lac = data.legalAccountingClasses.find(c => c.id === lal.legalAccountingClassId);
    if (!lac) return '';
    const cls = data.accountingClasses.find(c => c.id === lac.accountingClassId);
    return cls?.name ?? '';
  };

  const entityOfLedger = (legalAccountingLedgerId: number) => {
    const lal = data.legalAccountingLedgers.find(l => l.id === legalAccountingLedgerId);
    if (!lal) return undefined;
    const lac = data.legalAccountingClasses.find(c => c.id === lal.legalAccountingClassId);
    if (!lac) return undefined;
    return entityById(lac.legalEntityId);
  };

  const eventName = (id: number) => data.accountingEvents.find(e => e.id === id)?.name ?? '';
  const amountTypeName = (id: number | null) => (id == null ? '' : data.amountTypes.find(a => a.id === id)?.name ?? '');
  const formulaById = (id: number) => data.formulas.find(f => f.id === id);
  const conditionValueName = (id: number | null) => (id == null ? '' : data.conditionValues.find(c => c.id === id)?.name ?? '');

  const pseudoName = (entityCode: string, pseudoId: number | null) => {
    if (pseudoId == null) return '';
    const p = data.pseudoAccounts.find(a => a.entityCode === entityCode && a.id === pseudoId);
    return p ? p.pseudo : String(pseudoId);
  };

  const conditionsOf = (formulaConditionId: number | null) =>
    formulaConditionId == null ? [] : data.conditions.filter(c => c.formulaConditionId === formulaConditionId);

  return {
    entityByCode, entityById, ledgerName, classNameOf, entityOfLedger,
    eventName, amountTypeName, formulaById, conditionValueName, pseudoName, conditionsOf,
  };
}

export function formatAmount(n: number): string {
  if (n === 0) return '0,00';
  return n.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/ /g, ' ');
}
