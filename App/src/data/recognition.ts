import type { AmountType, Formula, AccountingRule, Journal, PseudoAccount, RecognitionCategory, RecognitionPlan } from '../types';

// System amount types produced by Monthly Booking: the four recognition cutoff buckets plus the
// recognised-income counter-leg per category. Flagged `system` so they can be referenced in
// formulas / reports (and mapped to accounts in accounting rules) but not hand-entered on a message.
export const recognitionAmountTypes: AmountType[] = [
  { id: 70, name: 'Accrued Rent Not Invoiced', description: 'Rent earned but not yet invoiced (balance-sheet asset).', amountGroup: 'Monthly', system: true },
  { id: 71, name: 'Invoiced Rent Not Accrued', description: 'Rent invoiced in advance of being earned (balance-sheet liability).', amountGroup: 'Monthly', system: true },
  { id: 72, name: 'Accrued Interest Not Invoiced', description: 'Interest earned but not yet invoiced (balance-sheet asset).', amountGroup: 'Monthly', system: true },
  { id: 73, name: 'Invoiced Interest Not Accrued', description: 'Interest invoiced in advance of being earned (balance-sheet liability).', amountGroup: 'Monthly', system: true },
  { id: 74, name: 'Recognised Rent', description: 'Rent recognised in the P&L this period (the recognition counter-leg).', amountGroup: 'Monthly', system: true },
  { id: 75, name: 'Recognised Interest', description: 'Interest recognised in the P&L this period (the recognition counter-leg).', amountGroup: 'Monthly', system: true },
  { id: 76, name: 'Monthly Depreciation', description: 'Depreciation expense recognised each month (permanent — not reversed).', amountGroup: 'Monthly', system: true },
  { id: 77, name: 'Accumulated Depreciation', description: 'Accumulated depreciation (contra-asset) — the credit leg of Monthly Depreciation.', amountGroup: 'Monthly', system: true },
];

// The Monthly Booking accounting setup for ALS NLD: one formula per system amount type mapping it
// to an account, and one accounting rule per formula on the Monthly Booking event. This is the
// entity-level, user-editable place the cutoff accounts live — the recognition engine reads these
// rules to find where each bucket lands. debitCredit is the natural (accrual-case) side; a deferred
// position flips the side automatically.
export const recognitionFormulas: Formula[] = [
  { id: 63, name: 'Accrued Rent Not Invoiced', description: 'Rent earned not yet invoiced', amountTypeId: 70, debitAccount: '179100', creditAccount: null, formulaConditionId: null, category: 'Recognition', reverseMonthly: true },
  { id: 64, name: 'Invoiced Rent Not Accrued', description: 'Rent invoiced not yet earned', amountTypeId: 71, debitAccount: null, creditAccount: '299100', formulaConditionId: null, category: 'Recognition', reverseMonthly: true },
  { id: 65, name: 'Recognised Rent', description: 'Rent recognised in the P&L', amountTypeId: 74, debitAccount: null, creditAccount: 'EG5202', formulaConditionId: null, category: 'Recognition', reverseMonthly: true },
  { id: 66, name: 'Accrued Interest Not Invoiced', description: 'Interest earned not yet invoiced', amountTypeId: 72, debitAccount: '179200', creditAccount: null, formulaConditionId: null, category: 'Recognition', reverseMonthly: true },
  { id: 67, name: 'Invoiced Interest Not Accrued', description: 'Interest invoiced not yet earned', amountTypeId: 73, debitAccount: null, creditAccount: '299200', formulaConditionId: null, category: 'Recognition', reverseMonthly: true },
  { id: 68, name: 'Recognised Interest', description: 'Interest recognised in the P&L', amountTypeId: 75, debitAccount: null, creditAccount: 'I66540', formulaConditionId: null, category: 'Recognition', reverseMonthly: true },
  // Permanent monthly postings — NOT reversed (reverseMonthly absent). Demonstrates selective reversal.
  { id: 69, name: 'Monthly Depreciation', description: 'Depreciation expense for the month', amountTypeId: 76, debitAccount: '780000', creditAccount: null, formulaConditionId: null, category: 'Recognition', reverseMonthly: false },
  { id: 70, name: 'Accumulated Depreciation', description: 'Accumulated depreciation (contra-asset)', amountTypeId: 77, debitAccount: null, creditAccount: '129900', formulaConditionId: null, category: 'Recognition', reverseMonthly: false },
];

// Monthly Booking (event 21) accounting rules on ALS NLD Local Legal (legalAccountingLedgerId 1).
export const recognitionRules: AccountingRule[] = [
  { id: 137, entityCode: 'ALS NLD', legalAccountingLedgerId: 1, accountingEventId: 21, formulaId: 63, debitCredit: 'D' },
  { id: 138, entityCode: 'ALS NLD', legalAccountingLedgerId: 1, accountingEventId: 21, formulaId: 64, debitCredit: 'C' },
  { id: 139, entityCode: 'ALS NLD', legalAccountingLedgerId: 1, accountingEventId: 21, formulaId: 65, debitCredit: 'C' },
  { id: 140, entityCode: 'ALS NLD', legalAccountingLedgerId: 1, accountingEventId: 21, formulaId: 66, debitCredit: 'D' },
  { id: 141, entityCode: 'ALS NLD', legalAccountingLedgerId: 1, accountingEventId: 21, formulaId: 67, debitCredit: 'C' },
  { id: 142, entityCode: 'ALS NLD', legalAccountingLedgerId: 1, accountingEventId: 21, formulaId: 68, debitCredit: 'C' },
  { id: 143, entityCode: 'ALS NLD', legalAccountingLedgerId: 1, accountingEventId: 21, formulaId: 69, debitCredit: 'D' },
  { id: 144, entityCode: 'ALS NLD', legalAccountingLedgerId: 1, accountingEventId: 21, formulaId: 70, debitCredit: 'C' },
];

// Balance-sheet cutoff accounts for ALS NLD (entity 1). Appended to the pseudo-account master;
// ids continue after the entity's existing 32 accounts. accountKind is set explicitly here.
export const recognitionPseudoAccounts: PseudoAccount[] = [
  { entityCode: 'ALS NLD', id: 33, pseudo: '179100', description: 'Accrued Rent Not Invoiced', extPseudo: '179100', extDescription: 'Accrued Rent Not Invoiced', revaluation: false, accountKind: 'Balance' },
  { entityCode: 'ALS NLD', id: 34, pseudo: '179200', description: 'Accrued Interest Not Invoiced', extPseudo: '179200', extDescription: 'Accrued Interest Not Invoiced', revaluation: false, accountKind: 'Balance' },
  { entityCode: 'ALS NLD', id: 35, pseudo: '299100', description: 'Invoiced Rent Not Accrued', extPseudo: '299100', extDescription: 'Invoiced Rent Not Accrued', revaluation: false, accountKind: 'Balance' },
  { entityCode: 'ALS NLD', id: 36, pseudo: '299200', description: 'Invoiced Interest Not Accrued', extPseudo: '299200', extDescription: 'Invoiced Interest Not Accrued', revaluation: false, accountKind: 'Balance' },
  { entityCode: 'ALS NLD', id: 37, pseudo: '780000', description: 'Depreciation expense', extPseudo: '780000', extDescription: 'Depreciation expense', revaluation: false, accountKind: 'Result' },
  { entityCode: 'ALS NLD', id: 38, pseudo: '129900', description: 'Accumulated depreciation', extPseudo: '129900', extDescription: 'Accumulated depreciation', revaluation: false, accountKind: 'Balance' },
];

// Recognition categories for ALS NLD: Rent and Interest, each reconciling its invoiced amount type
// against the plan. The cutoff posts through the three system amount types below — mapped to
// accounts by the Monthly Booking accounting rules, not held here.
export const recognitionCategories: RecognitionCategory[] = [
  { id: 1, entityCode: 'ALS NLD', name: 'Rent', kind: 'Cutoff', invoicedAmountType: 'Rent', accruedAmountType: 'Accrued Rent Not Invoiced', deferredAmountType: 'Invoiced Rent Not Accrued', incomeAmountType: 'Recognised Rent' },
  { id: 2, entityCode: 'ALS NLD', name: 'Interest', kind: 'Cutoff', invoicedAmountType: 'Interest', accruedAmountType: 'Accrued Interest Not Invoiced', deferredAmountType: 'Invoiced Interest Not Accrued', incomeAmountType: 'Recognised Interest' },
  { id: 3, entityCode: 'ALS NLD', name: 'Depreciation', kind: 'Straight', debitAmountType: 'Monthly Depreciation', creditAmountType: 'Accumulated Depreciation' },
];

// Straight-line schedule rows Oct 2024 → Mar 2025 (6 months) for a category.
function months(categoryId: number, amount: number): { period: string; categoryId: number; amount: number }[] {
  const periods = ['202410', '202411', '202412', '202501', '202502', '202503'];
  return periods.map(period => ({ period, categoryId, amount }));
}

// Demo plan: a quarterly-in-arrears finance lease. Rent 100 / Interest 25 earned each month;
// invoiced once a quarter in arrears (see recognitionDemoJournals). Between invoices the earned-
// not-billed sits in Accrued Rent / Accrued Interest Not Invoiced, and the quarter invoice clears it.
export const recognitionPlans: RecognitionPlan[] = [
  {
    id: 1, legalEntityId: 1, entityCode: 'ALS NLD', agreement: '700500',
    agreementDescription: 'Volvo FH truck — 36-month finance lease',
    customer: 'ACME Transport BV', currency: 'EUR', classification: 'Finance',
    status: 'Active', receivedDate: '2024-10-01', source: 'Agreement domain · Activation', sourceGli: null,
    lines: [
      { agreementLine: 1, assetDescription: 'Volvo FH truck (chassis 8842)', schedule: [...months(1, 100), ...months(2, 25), ...months(3, 200)] },
    ],
  },
];

// Quarterly-in-arrears invoice raised at the end of Q4 2024 (period 202412) for Oct–Dec: rent 300
// (3 × 100) + interest 75 (3 × 25) billed to the customer. Keys the recognition reconciliation's
// "invoiced to date" from December onward, so the accrued buckets clear at the quarter close.
export const recognitionDemoJournals: Journal[] = [
  {
    gliNumber: 124875, legalEntityId: 1, accountingEvent: 'Invoicing', lineCount: 3,
    bookingDate: '2024-12-31', createDate: '2024-12-31', exportDate: null, difference: false,
    createdBy: 'Invoicing (demo, quarterly in arrears)', manual: false,
    lines: [
      { line: 1, pseudoAccount: '134200', description: 'Customer receivable', agreement: '700500', agreementLine: 1, period: '202412', customer: 'ACME Transport BV', invoice: 'INV-Q4-700500', refNo: '', debit: 375, credit: 0, ledger: 'Local Legal', currency: 'EUR', currencyRate: 1, formula: 'INV', externalAccountString: '', amountType: 'Total Amount', conditionValue: '' },
      { line: 2, pseudoAccount: 'EG5202', description: 'Rent income (principle)', agreement: '700500', agreementLine: 1, period: '202412', customer: 'ACME Transport BV', invoice: 'INV-Q4-700500', refNo: '', debit: 0, credit: 300, ledger: 'Local Legal', currency: 'EUR', currencyRate: 1, formula: 'INV', externalAccountString: '', amountType: 'Rent', conditionValue: '' },
      { line: 3, pseudoAccount: 'I66540', description: 'Interest revenue', agreement: '700500', agreementLine: 1, period: '202412', customer: 'ACME Transport BV', invoice: 'INV-Q4-700500', refNo: '', debit: 0, credit: 75, ledger: 'Local Legal', currency: 'EUR', currencyRate: 1, formula: 'INV', externalAccountString: '', amountType: 'Interest', conditionValue: '' },
    ],
  },
];
