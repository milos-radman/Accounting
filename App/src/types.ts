// Domain types for the Accounting domain, mirroring the entity model
// (Accounting entity model.png + Accounting Domain specification v0.9)

export interface Currency {
  id: number;
  code: string;
  name: string;
  // Value of 1 unit of this currency in the reporting currency (EUR = 1.0). A transaction in
  // currency C is converted to an entity's base currency B by amount × rate[C] ÷ rate[B].
  rate: number;
  asOf?: string; // date the rate was set (YYYY-MM-DD)
}

// Organizations own legal entities; persons act as responsible / controller.
export type PartyKind = 'Organization' | 'Person';

// A party in the Interested Party domain. In this prototype the `parties` collection
// stands in for that domain — accounting never owns parties, it only references them.
export interface Party {
  id: number;
  kind: PartyKind;
  name: string; // short code e.g. ALS NLD
  fullName: string;
  orgNumber: string;
  address1: string;
  address2: string;
  zip: string;
  city: string;
  countyState: string;
  country: string;
  taxCountry: string;
  phone: string;
  email: string;
}

// Reference + denormalized snapshot of a party, captured on the legal entity when the
// party is assigned. This is how accounting keeps a soft link to the party domain:
// the stable partyId is the only real reference; the rest is a display copy taken at
// assignment time (so nothing breaks if the party domain is unavailable).
export interface PartyRef {
  partyId: number;
  kind: PartyKind;
  name: string;
  fullName: string;
  reference: string; // registration / person number
  address: string;
  city: string;
  country: string;
  email: string;
  phone: string;
  asOf: string; // date the snapshot was taken (YYYY-MM-DD)
}

export interface OrganizationUnit {
  id: number;
  partyId: number;
  legalEntityId: number;
}

export interface LegalEntity {
  id: number;
  name: string;
  description: string;
  ownerPartyId: number;
  ownerCode: string; // the entity's short code, used as the key across config data
  // Reference + snapshot of the owning organization from the party domain.
  owner?: PartyRef;
  // Reference + snapshot of the responsible / controller persons.
  responsibleRef?: PartyRef;
  controllerRef?: PartyRef;
  baseCurrencyId: number;
  revaluation: boolean;
  // P&L account the currency gain/loss is posted to during revaluation (default set on setup).
  revaluationResultAccount?: string;
  // Pseudo account that absorbs the base-currency rounding residual. Converting each line to base
  // currency rounds to 2 decimals, so a journal that balances in transaction currency (same rate)
  // can still be a cent out in base currency. That technical difference is booked here — kept
  // separate from revaluationResultAccount, which holds real FX gain/loss.
  exchangeDifferenceAccount?: string;
  gliNumberSerie: number;
  // Optional display prefix concatenated in front of new GLI numbers (e.g. "2026/"). Stamped onto
  // each journal at creation; change it at year rollover and the running number just continues.
  gliPrefix?: string;
  coaId: number;
  responsible: string; // legacy display string, superseded by responsibleRef
  responsiblePartyId?: number;
  controllerPartyId?: number;
  // Month (1-12) the financial year starts in. 1 = calendar year. Reports group by this.
  fiscalYearStartMonth?: number;
  endOfMonth: string; // YYYYMM
  closedPeriod: string; // YYYYMM
  glInterfaceDate: string; // YYYY-MM-DD
  openPeriod: string; // YYYYMM
  journalDifferences: number;
  nextGli: number;
  // Separator between accounting dimensions in the external account string.
  // Empty string = no separator: each dimension occupies a fixed number of positions.
  dimensionSeparator?: string;
  // Opt-in: show this entity as a one-click tab in the legal-entity workspace, for quick switching
  // between the handful of entities you work in. Off = reachable only via the entity list, as before.
  showInTabs?: boolean;
}

export interface AccountingClass {
  id: number;
  code: string;
  name: string;
  description: string;
}

export interface LegalAccountingClass {
  id: number;
  legalEntityId: number;
  accountingClassId: number;
}

export interface Ledger {
  id: number;
  code: string;
  name: string;
  description: string;
}

// Optional gapless export-voucher series for one (legal entity, ledger). When a journal for that
// ledger is exported it takes the next number here, giving each target GL a hole-free sequence
// (audit requirement in some countries). Ledgers without a row fall back to the entity's GLI
// number, so a single per-entity series is the default.
export interface LedgerSerie {
  id: number;
  legalEntityId: number;
  ledger: string;
  prefix?: string;
  nextNumber: number; // the next number to assign
}

export interface LegalAccountingLedger {
  id: number;
  legalAccountingClassId: number;
  ledgerId: number;
}

// How an amount is treated when it arrives (spec: AmountGroup).
// Message = book now from the message; Accrual = accounting holds the total and spreads it;
// Monthly = the source domain sends each month's amount.
export type AmountGroup = 'Message' | 'Accrual' | 'Monthly';

export interface AmountType {
  id: number;
  name: string;
  description: string;
  amountGroup: AmountGroup;
  // When true, one message can carry several amounts of this type distinguished by amount code
  // (e.g. Added Cost = a parking ticket + a gas bill). The type's value is the sum of the codes.
  allowsMultipleCodes?: boolean;
  // When true this amount type is produced by the accounting domain itself (not carried on an
  // inbound message) — e.g. the recognition cutoff buckets computed by Monthly Booking. Users can
  // reference it in formulas/reports but cannot hand-enter it on a manual message.
  system?: boolean;
}

// ---- Accruals ----

export type AccrualDirection = 'Cost' | 'Income';

// Configuration of how an accrual is recognized ("the different accrual codes").
export interface AccrualCode {
  id: number;
  entityCode: string;
  code: string;
  name: string;
  direction: AccrualDirection; // Cost = prepaid→expense; Income = unearned→revenue
  months: number; // straight-line recognition over N months
  deferralAccount: string; // balance sheet — where the total parks
  counterAccount: string; // the other side of the initial deferral booking
  recognitionAccount: string; // P&L — where each monthly slice lands (fallback / default)
  // Optional: resolve the recognition (P&L) account through this formula's conditions instead of
  // the fixed recognitionAccount — e.g. a different account per Accounting Type (DL vs MG). The
  // fixed recognitionAccount is used as the fallback when no formula is set or no condition matches.
  recognitionFormulaId?: number | null;
  // When a message carries an amount for this amount type, an accrual of this code is
  // created automatically. Null = the code is only used for manual creation.
  triggerAmountTypeId?: number | null;
}

export type AccrualStatus = 'Active' | 'Completed' | 'Terminated';

// A runtime accrual: the total to spread and its progress (accrued so far / remaining).
export interface AccrualItem {
  id: number;
  entityCode: string;
  accrualCodeId: number;
  accrualCode: string; // snapshot for display
  accrualName: string; // snapshot for display
  agreement: string;
  agreementLine: number | null;
  totalAmount: number;
  currency: string;
  startPeriod: string; // YYYYMM
  endPeriod: string; // YYYYMM
  amountAccrued: number;
  amountRemaining: number;
  status: AccrualStatus;
  createdDate: string;
  sourceGli: number | null;
  // Snapshot of the message attributes at creation (keyed by ConditionValue id), so the monthly
  // recognition run resolves the same condition-routed account every month.
  conditionInputs?: Record<number, string>;
  // Snapshot of the message dimensions at creation (customer, product, asset bag, …) so the monthly
  // recognition lines can rebuild the external account string and carry customer/supplier.
  messageContext?: {
    portfolio?: string;
    product?: string;
    customer?: string;
    supplier?: string;
    accountValues?: Record<string, string>;
  };
}

// ---- Accounting Recognition Plan ----
// The earning schedule the agreement domain sends at Activation (and re-sends on Agreement
// Change). The accounting domain treats it as its local read-model of the agreement: it drives
// the monthly revenue recognition and carries the descriptions reused across reports. Recognition
// (earned) and invoicing (billed) are two independent timelines; Monthly Booking reconciles them
// into the accrued / deferred cutoff buckets.

export type LeaseClassification = 'Finance' | 'Operating';

// One period's planned recognition for one category (Rent / Interest) on one agreement line.
export interface RecognitionScheduleRow {
  period: string; // YYYYMM the amount is earned in
  categoryId: number; // RecognitionCategory (Rent / Interest)
  amount: number; // planned amount to recognise in this period
}

// One month of an imported (old-system) recognition table. `period` is the accounting month
// (recognition is monthly); `invoicingPeriod` is the 1-based billing-period index the month's
// amounts belong to — kept separate because billing periods can be broken (start mid-month), so a
// period is not a calendar month. amortization + interest are the earned rent split; depreciation
// is only carried when the depreciation type is Annuity (else the asset domain sends it).
export interface ImportedScheduleRow {
  period: string; // YYYYMM — accounting month
  invoicingPeriod: number; // 1-based billing-period index (may be a broken period, not a month)
  amortization: number;
  interest: number;
  depreciation: number | null; // null = asset-domain sourced (non-annuity)
}

// An imported agreement line carries the old system's monthly recognition table plus its two
// watermarks. They are in different units: booking (recognition) is per calendar month, invoicing
// is per billing-period index. The cutoff position is read from the gap between them — recognised
// summed by month up to bookedToPeriod, invoiced summed by period index up to invoicedToPeriod.
export interface ImportedLine {
  bookedToPeriod: string; // YYYYMM — recognition (monthly booking) watermark
  invoicedToPeriod: number; // billing-period index invoiced to (NOT a month — periods can be broken)
  depreciationType: string; // Annuity | Straight Line | Sum of years | variable declining
  rows: ImportedScheduleRow[];
}

// One agreement line = one asset. `schedule` drives live (demo) plans through the engine;
// `imported` holds an old-system line's historical table + watermarks (read-only, watermark-based).
export interface RecognitionPlanLine {
  agreementLine: number;
  assetDescription: string;
  schedule: RecognitionScheduleRow[];
  imported?: ImportedLine;
}

// Header of a recognition plan: one per agreement, received at Activation.
export interface RecognitionPlan {
  id: number;
  legalEntityId: number;
  entityCode: string;
  agreement: string;
  agreementDescription: string;
  customer: string;
  currency: string;
  classification: LeaseClassification;
  status: 'Proposed' | 'Active' | 'Terminated'; // Proposed = entered/received but not yet activated
  // Going-forward = recognise up to the current period and net against real invoicing (an activated,
  // live agreement). Undefined/false = a historical old-system import, frozen at its watermarks.
  goingForward?: boolean;
  receivedDate: string; // when the plan arrived (Activation / change)
  source: string; // which domain / message sent it
  sourceGli: number | null;
  // True for plans imported from the old system: historical, read-only, watermark-based (their
  // lines carry `imported` data instead of running live through the engine).
  imported?: boolean;
  lines: RecognitionPlanLine[];
}

// How a recognition category books at Monthly Booking:
//   Cutoff   — accrue-and-reverse timing bridge (Rent / Interest): reversible.
//   Straight — a permanent monthly posting from the plan (e.g. Depreciation): never reversed.
export type RecognitionKind = 'Cutoff' | 'Straight';

// A recognition category for a legal entity. It names the system amount types its posting books
// through; the actual accounts are NOT held here — they live in the entity's Monthly Booking
// accounting rules, whose formulas reference these system amount types (so "Accrued Rent Not
// Invoiced" is mapped to an account like any other posting, and can be picked up by reports).
export interface RecognitionCategory {
  id: number;
  entityCode: string;
  name: string; // Rent / Interest / Depreciation
  kind: RecognitionKind;
  // Cutoff categories (reversible accrue-and-reverse):
  invoicedAmountType?: string; // journal amount type that counts as "invoiced" here (e.g. Rent)
  accruedAmountType?: string; // system amount type — earned not yet invoiced (asset)
  deferredAmountType?: string; // system amount type — invoiced not yet earned (liability)
  incomeAmountType?: string; // system amount type — the recognised P&L counter-leg
  // Straight categories (permanent, non-reversible): a two-legged monthly entry from the plan.
  debitAmountType?: string; // system amount type booked on the debit leg (e.g. Monthly Depreciation)
  creditAmountType?: string; // system amount type booked on the credit leg (e.g. Accumulated Depreciation)
}

// Running reconciliation state per agreement line + category: the cumulative earned vs invoiced
// and the last booked cutoff position, so an accrue-and-reverse Monthly Booking can reverse the
// prior month and re-book the current position. Also the source the reports read the four buckets
// from. position > 0 = accrued (asset); position < 0 = deferred (liability).
export interface RecognitionState {
  id: number;
  entityCode: string;
  agreement: string;
  agreementLine: number;
  categoryId: number;
  lastPeriod: string; // last period Monthly Booking ran for this line + category
  recognizedToDate: number; // cumulative planned recognition through lastPeriod
  invoicedToDate: number; // cumulative invoiced (bill raised) through lastPeriod
  position: number; // last booked cutoff position (+accrued / -deferred)
  lastGli: number | null; // the cutoff journal that booked `position` (reversed next period)
}

// ---- Revaluation ----

// One month's revaluation balance for a revaluation account + transaction currency. Holds the
// opening (brought-forward) balance, the rate revaluation booked this month, the month's new
// bookings, and the carried-forward closing that becomes next month's opening.
export interface RevalueAccount {
  id: number;
  entityCode: string;
  account: string;         // pseudo account
  period: string;          // YYYYMM
  currency: string;        // transaction currency being revalued
  ratePrev: number;        // rate the opening balance was last valued at
  rate: number;            // current rate used this run
  currencyValueBF: number; // opening balance in transaction currency (brought forward)
  baseValueBF: number;     // opening balance in base currency = currencyValueBF × ratePrev
  revaluation: number;     // the mrb booking = baseValueCF − baseValueBF
  newBookingsBase: number; // base value of this month's new movements (at current rate)
  baseValueCF: number;     // revalued opening in base = currencyValueBF × rate
  closingAmount: number;   // baseValueCF + newBookingsBase (base) — next month's base opening
  currencyClosing: number; // closing balance in transaction currency — next month's BF
  revalueGli: number | null;
}

// One booked line on a revaluation account, captured for a period and revalued to the current
// rate (mrt). revalue = false for lines from a formula excluded from revaluation.
export interface RevalueTransaction {
  id: number;
  entityCode: string;
  account: string;
  period: string;
  currency: string;
  sourceGli: number;
  sourceLine: number;
  revalue: boolean;
  bookingRate: number;     // rate the line was booked at
  currentRate: number;     // rate at revaluation
  transactionAmount: number; // in transaction currency
  bookedAmount: number;      // base at booking rate
  revaluation: number;       // mrt adjustment = txn × (currentRate − bookingRate); 0 if no-revalue
  revalueGli: number | null; // the mrt journal that booked it
  newBookedAmount: number;   // bookedAmount + revaluation
}

export type AccrualLineStatus = 'Pending' | 'Recognized';

// One period of an accrual's recognition plan.
export interface AccrualScheduleLine {
  id: number;
  accrualItemId: number;
  period: string; // YYYYMM
  plannedAmount: number;
  recognizedAmount: number;
  recognizedGli: number | null;
  status: AccrualLineStatus;
}

export interface ConditionValue {
  id: number;
  name: string;
}

// A configured allowed value for a message attribute (condition value): the CODE is what the message
// carries / a condition matches on; the DESCRIPTION is shown next to it in pickers. One list serves
// Amount Code, Payment Method, Term Reason, and any other attribute.
export interface ConditionValueOption {
  id: number;
  conditionValueId: number; // which attribute this belongs to (e.g. 18 Amount Code, 19 Payment Method)
  code: string;
  description: string;
}

export interface EventCategory {
  id: number;
  name: string;
  description: string;
}

// When the event is booked. Immediate = as soon as the message arrives; EndOfMonth = the
// message is held Pending and released by the End of Month run (e.g. Monthly Booking), so the
// accountant controls when several systems' monthly amounts are accounted for.
export type PostingMode = 'Immediate' | 'EndOfMonth';

export const postingModes: PostingMode[] = ['Immediate', 'EndOfMonth'];

// How a reversal event finds the original booking to mirror. The single Reversal Reference on the
// message is interpreted per event: an invoice number (our AR invoice), a reference number (our
// unique id for a supplier invoice), a payment id (one specific payment among several against an
// invoice), or — when no document id applies — the agreement line (+ period) already on the message.
export type ReverseMatchBy = 'InvoiceNumber' | 'ReferenceNumber' | 'PaymentId' | 'AgreementLine' | 'AgreementLinePeriod';

export interface AccountingEvent {
  id: number;
  name: string;
  description: string;
  code: string;
  bookingDate: number; // 0 = CalculationDate, 1 = EventDate
  eventCategoryId: number; // 1 Normal, 2 Reversal
  originalEventId: number | null;
  postingMode: PostingMode;
  // For a reversal event: how it locates the original booking from the message's Reversal Reference
  // (and agreement/line/period). Absent for normal events.
  reverseMatchBy?: ReverseMatchBy;
  // Whether this event books through user-configured accounting rules (formulas). False for events
  // that don't: reversal events mirror the original journal; revaluation is posted by the
  // revaluation engine; Interest Adjustment / Agreement Change flow through the recognition-plan
  // change (Undo Monthly Booking + re-derive). Such events are hidden from the formula/rule pickers.
  usesAccountingRules?: boolean;
}

// A received message for an EndOfMonth event, held until the End of Month run books it.
export type PendingMessageStatus = 'Pending' | 'Released';

export interface PendingMessage {
  id: number;
  legalEntityId: number;
  accountingClassId: number;
  accountingEventId: number;
  eventName: string; // snapshot for display
  period: string; // YYYYMM the amount belongs to (derived from the message date)
  invoicingPeriod?: number; // billing period the event relates to (a number, not a month)
  bookingDate: string;
  calculationDate?: string;
  agreement: string;
  agreementLine: string;
  portfolio: string;
  product: string;
  customer: string;
  supplier: string;
  invoice: string;
  referenceNumber?: string;
  conditionInputs: Record<number, string>;
  amounts: Record<number, number>;
  accountValues: Record<string, string>;
  currency: string;
  currencyRate?: number;
  status: PendingMessageStatus;
  receivedDate: string;
  releasedGli: number | null;
  source: string; // which system sent it
}

export interface Formula {
  id: number;
  name: string;
  description: string;
  amountTypeId: number | null;
  debitAccount: string | null; // direct pseudo account (when no condition)
  creditAccount: string | null;
  formulaConditionId: number | null;
  category: string; // grouping label from config (Activation, Invoicing...)
  // Optional, advisory: accounting events this formula is intended for. Used only to prioritise
  // the formula list when building an accounting rule — never a hard restriction, since the rule
  // itself is the real event↔formula connection and a formula may legitimately span events.
  appliesToEvents?: number[];
  // When true the formula's bookings keep their historical rate and are excluded from
  // revaluation (e.g. fixed asset / depreciation at the contract-registration rate).
  excludeFromRevaluation?: boolean;
  // When true this formula's Monthly Booking posting is part of the accrue-and-reverse cutoff:
  // it is mirrored (D↔C) by the Monthly Booking reversal and Undo Monthly Booking events. When
  // false/absent the posting is permanent (e.g. Monthly Depreciation) and never reversed — this
  // is what makes month-end reversal selective rather than a blanket flip of the whole journal.
  reverseMonthly?: boolean;
}

export interface FormulaCondition {
  id: number;
  name: string;
}

export interface Condition {
  id: number;
  formulaConditionId: number;
  level: number | null;
  conditionValueId: number | null;
  value: string;
  debitPseudoAccountId: number | null;
  creditPseudoAccountId: number | null;
  operator: string | null; // AND / OR
}

export interface AccountingRule {
  id: number;
  entityCode: string;
  legalAccountingLedgerId: number;
  accountingEventId: number;
  formulaId: number;
  debitCredit: 'D' | 'C';
}

// Account type: balance sheet account (balanskonto) or profit & loss account (resultatkonto)
export type AccountKind = 'Balance' | 'Result';

export interface PseudoAccount {
  entityCode: string;
  id: number;
  pseudo: string;
  description: string;
  extPseudo: string;
  extDescription: string;
  revaluation: boolean;
  accountKind: AccountKind;
  // GL export summarisation (used when the integration profile is in Per-account mode): net this
  // account's movements to one GL line, keeping only the dimensions in summaryKeepPartIds.
  summarizeToGl?: boolean;
  summaryKeepPartIds?: number[]; // ExtAccountPart ids that survive summarisation (others collapse)
}

// PseudoAccountExtParts from the entity model: which accounting dimensions are in use
// for a specific pseudo account. Only opt-out rows are stored — a dimension without a
// row (or a required dimension) is in use. The transaction line's account dimension
// string includes only the in-use dimensions.
export interface PseudoAccountExtPart {
  id: number;
  entityCode: string;
  pseudoAccountId: number;
  extAccountPartId: number;
  inUse: boolean;
}

export interface ChartOfAccount {
  id: number;
  name: string;
  description: string;
}

// A legal entity's own copy of the chart of account, created from a template
// when the entity is set up. Structural edits only affect this entity.
export interface EntityCoaNode {
  id: number;
  legalEntityId: number;
  name: string;
  description: string;
  order: string;
  depth: number;
  parentId: number | null;
  // Optional inclusive account-number range this node covers. Used to suggest where an imported
  // pseudo account belongs. The deepest node whose range contains the number wins.
  accountFrom?: number;
  accountTo?: number;
}

// Link table PseudoAccountCOA from the entity model:
// places a pseudo account on a chart-of-account node for a legal entity
export interface PseudoAccountCoaLink {
  id: number;
  entityCode: string;
  pseudoAccountId: number;
  coaNodeId: number; // references EntityCoaNode.id
}

export interface CoaNode {
  id: number;
  coaId: number;
  name: string;
  description: string;
  order: string;
  depth: number;
  parentId: number | null;
  accountFrom?: number; // inclusive account-number range this node covers (for placement suggestions)
  accountTo?: number;
}

// Data type of an external account value, so the general ledger knows how to
// interpret the dimension (parse dates, validate numbers, treat as text...).
export type ExtValueDataType = 'Text' | 'Integer' | 'Decimal' | 'Money' | 'Date' | 'Boolean';

export const extValueDataTypes: ExtValueDataType[] = ['Text', 'Integer', 'Decimal', 'Money', 'Date', 'Boolean'];

// Where the accounting domain reads a dimension's value from when it builds the external
// account string. Configurable per deployment — the shipped mapping is one reference setup.
//   PseudoAccount     — the account's own external account (the account segment)
//   Message           — a named field on the inbound message envelope (see messageField)
//   AccountValuesList — the extensible name/value list carried alongside the message
export type DimensionSource = 'PseudoAccount' | 'Message' | 'AccountValuesList';

export const dimensionSources: DimensionSource[] = ['PseudoAccount', 'Message', 'AccountValuesList'];

// External account values available from the contract domain (spec ch. Legal Entity)
export interface ExtAccountValue {
  id: number;
  name: string;
  level: string;
  dataType: ExtValueDataType;
  // How the value is sourced when assembling the dimension string.
  source: DimensionSource;
  // Which message envelope field to read when source === 'Message' (defaults to name).
  messageField?: string;
}

// Accounting dimensions (external account parts) configured for a legal entity.
// Together they define the external account string written on every transaction line.
export interface ExtAccountPart {
  id: number;
  legalEntityId: number;
  extAccountValueId: number;
  partNumber: number; // position of the dimension in the external account string
  name: string;
  length: number; // fixed positions; only relevant when the entity uses no separator
  required: boolean;
}

export interface JournalLine {
  line: number;
  pseudoAccount: string;
  description: string;
  agreement: string;
  agreementLine: number | null;
  // Accounting period (YYYYMM) the amount belongs to — DERIVED from the message date, not typed in.
  // One agreement + line can appear for several periods on the same invoice, and a credit can target
  // a single agreement+line+period.
  period?: string;
  // Billing/invoicing period the event relates to — a NUMBER, not a month (e.g. which installment an
  // invoice bills). Matches the recognition plan's invoicing-period index.
  invoicingPeriod?: number;
  // Customer / supplier the line relates to (AR / AP). Also feed the dimension string via the
  // Customer identity / Supplier identity external account values.
  customer?: string;
  supplier?: string;
  invoice: string;
  refNo: string;
  // Unique id of the payment this line belongs to (AR/AP payments). A supplier/customer invoice can
  // be settled by several partial payments, each with its own paymentId — so an Undo Payment can
  // target exactly one of them, which Reference Number (the invoice id) cannot.
  paymentId?: string;
  debit: number;
  credit: number;
  ledger: string;
  currency: string;
  // Rate from the line's transaction currency to the entity's base currency, captured at
  // booking. Optional; when absent the current master rate is used for display.
  currencyRate?: number;
  // True when the line has been reversed (offset by a Credit Invoicing / reversal journal),
  // or when the line itself belongs to a reversal journal. Not about debit=credit balance.
  reversed?: boolean;
  // On a reversal line: the line number on the reversed (original) journal that this line
  // offsets. The reversal line keeps its own (credit-note) invoice number in `invoice`.
  reversesLine?: number;
  formula: string;
  externalAccountString: string;
  amountType: string;
  // Sub-classifier within an amount type (e.g. Added Cost → document fee = 10). Together with
  // the amount type it selects the pseudo account in the accounting rules, and it is the lowest
  // level a credit can target: agreement + line + period + amount type + amount code.
  amountCode?: string;
  conditionValue: string;
}

export interface Journal {
  gliNumber: number;
  // Prefix stamped from the entity's gliPrefix at creation (e.g. "2026/"). The displayed GLI is
  // gliPrefix + gliNumber; the numeric gliNumber stays the routing / lookup key. Held per journal
  // so a year rollover of the entity's prefix never rewrites historical GLI labels.
  gliPrefix?: string;
  legalEntityId: number;
  accountingEvent: string;
  lines: JournalLine[];
  lineCount: number;
  bookingDate: string;
  createDate: string;
  exportDate: string | null;
  // The gapless per-ledger voucher number stamped when the journal was exported (or the entity
  // GLI number when the ledger has no dedicated series). Blank until exported.
  exportVoucher?: string;
  difference: boolean;
  createdBy: string;
  manual?: boolean;
  // For a reversal journal (e.g. Credit Invoicing): the GLI of the journal it reverses. The
  // original journal is "reversed by" whichever journal points at it.
  reversesGli?: number;
}

// One GL integration for a legal entity: both the delivery config (file/location/schedule) and
// the export-content config (target GL, format, transport, ledger, summarisation). The manual
// End of Month run and any scheduled run read this record.
export interface Integration {
  id: number;
  legalEntityId: number;
  name: string;
  description: string;
  fileName: string; // logical interface code / prefix (the {logical} token), e.g. PF201
  // Template the export file name is built from. Tokens: {logical} {entity} {ledger} {period}
  // {seq} {batch} {yyyymmdd} {hhmmss}. The extension is added from the format.
  // Default keeps the name short and stable — the folder path already carries entity/interface,
  // and the payload header carries the full metadata.
  fileNamePattern?: string;
  fileLocation: string; // outbound path the file is written to
  archiveLocation: string; // path the file is moved to once delivered/imported
  status: string;
  executionType: string; // 'Manual' (only manual runs) | 'EndOfMonth' (also run at End of Month)
  nextSequence: number;
  lastExecution: string;
  lastExecutionBy: string;
  records: number;
  // Export-content config (was the separate IntegrationProfile — now unified onto the integration).
  targetGl: string;
  format: 'CSV' | 'JSON';
  transport: 'File' | 'API' | 'Queue';
  ledger: string; // 'ALL' (every ledger on the entity) or a specific accounting ledger
  summarization: 'Full' | 'Summarized' | 'PerAccount';
  defaultKeepPartIds: number[]; // dimensions kept when summarising in 'Summarized' mode
}

// One line of a GL export batch: the external (GL) account the internal pseudo account maps to,
// the amount, and the accounting-string dimensions. When the batch is summarised, several
// subledger lines collapse into one and sourceGli is null.
export interface ExportBatchLine {
  externalAccount: string;
  externalDescription: string;
  ledger: string; // the accounting ledger this line comes from (kept even when 'ALL' is exported)
  voucherNo?: string; // gapless per-ledger export voucher of the source journal (full-detail lines)
  baseDebit?: number; // amount converted to the entity's base currency, rounded to 2 decimals
  baseCredit?: number;
  debit: number;
  credit: number;
  currency: string;
  bookingDate: string; // exported booking date (closed-period adjusted)
  period: string;
  dimensions: string; // externalAccountString; blank when summarised away
  text: string;
  sourceGli: number | null; // null when several journals are summarised into this line
}

// Delivery lifecycle of a batch: Exported (produced) → Acknowledged (GL confirmed) or Failed
// (transport error, can re-send). File transport stays Exported (delivered as the file itself).
export type BatchStatus = 'Exported' | 'Acknowledged' | 'Failed';

// A balanced batch of journal lines transformed into the GL's external accounts, ready to be
// rendered to a target format (CSV/JSON/SIE/…) and transported. Produced by an End of Month or
// scheduled export run; the journals it covers get their exportDate stamped.
export interface ExportBatch {
  id: number;
  legalEntityId: number;
  ledger: string;
  period: string;
  generatedAt: string;
  generatedBy: string;
  summarized: boolean;
  gliList: number[];
  lines: ExportBatchLine[];
  lineCount: number;
  totalDebit: number;
  totalCredit: number;
  // Base-currency control totals (include the exchange rounding line, so these balance).
  baseCurrency?: string;
  totalBaseDebit?: number;
  totalBaseCredit?: number;
  // Transport + delivery lifecycle (Phase 3): how the batch is sent and where it stands.
  transport: string; // File | API | Queue (snapshot of the integration at export time)
  status: BatchStatus;
  fileName?: string; // resolved export file name (without extension), fixed at creation
  sequence?: number; // the file sequence number used ({seq} token)
  outboundPath?: string; // full path the file was written to (snapshot for audit)
  archivePath?: string; // full path the file is archived to once delivered
  attempts?: number;
  deliveredAt?: string;
  deliveryRef?: string; // GL acknowledgement / message id on success
  deliveryError?: string; // reason on failure
}

// Lifecycle of an outbound journal event. Posted = a journal was booked; AcceptedPending = a held
// (End of Month) message was accepted and will post later; Rejected = could not be booked.
export type JournalEventStatus = 'Posted' | 'AcceptedPending' | 'Rejected';

// An outbound domain event the accounting domain publishes when a journal is created. Downstream
// domains (agreement, asset, AR/AP, BI) subscribe to correlate their records with the accounting
// journal number. In this prototype it's an outbox log rather than a real message bus.
export interface JournalPostedEvent {
  id: number;
  publishedAt: string;
  legalEntityId: number;
  entityCode: string;
  correlationId?: string; // echoed from the inbound message id, when there was one
  accountingEvent: string;
  status: JournalEventStatus;
  journalNumber: number | null; // the journal (GLI) number; null for AcceptedPending before booking
  gliPrefix?: string;
  reversesGli?: number; // for a reversal event — the original journal it reverses
  bookingDate: string;
  agreement: string; // distinct agreements on the journal (usually one)
  agreementLines: number[]; // distinct agreement lines the journal covers
  invoices: string[]; // distinct invoice numbers
  references: string[]; // distinct reference numbers
  lineCount: number;
  totalDebit: number;
  totalCredit: number;
  difference: boolean;
  source: string;
}

export interface SeedData {
  currencies: Currency[];
  parties: Party[];
  organizationUnits: OrganizationUnit[];
  legalEntities: LegalEntity[];
  accountingClasses: AccountingClass[];
  legalAccountingClasses: LegalAccountingClass[];
  ledgers: Ledger[];
  legalAccountingLedgers: LegalAccountingLedger[];
  amountTypes: AmountType[];
  conditionValues: ConditionValue[];
  conditionValueOptions: ConditionValueOption[];
  eventCategories: EventCategory[];
  accountingEvents: AccountingEvent[];
  formulas: Formula[];
  formulaConditions: FormulaCondition[];
  conditions: Condition[];
  accountingRules: AccountingRule[];
  pseudoAccounts: PseudoAccount[];
  chartOfAccounts: ChartOfAccount[];
  coaNodes: CoaNode[];
}

export interface AppData extends SeedData {
  extAccountValues: ExtAccountValue[];
  extAccountParts: ExtAccountPart[];
  journals: Journal[];
  integrations: Integration[];
  pseudoAccountCoaLinks: PseudoAccountCoaLink[];
  entityCoaNodes: EntityCoaNode[];
  pseudoAccountExtParts: PseudoAccountExtPart[];
  accrualCodes: AccrualCode[];
  accrualItems: AccrualItem[];
  accrualScheduleLines: AccrualScheduleLine[];
  pendingMessages: PendingMessage[];
  revalueAccounts: RevalueAccount[];
  revalueTransactions: RevalueTransaction[];
  exportBatches: ExportBatch[];
  ledgerSeries: LedgerSerie[];
  journalEvents: JournalPostedEvent[];
  recognitionCategories: RecognitionCategory[];
  recognitionPlans: RecognitionPlan[];
  recognitionStates: RecognitionState[];
}
