import type { OpeningBalance, PseudoAccount } from '../types';

// One equity account so the opening balance sheet has somewhere to carry the brought-forward
// result / capital (none existed in the base seed). Balance-kind (code starts with 2).
export const openingPseudoAccounts: PseudoAccount[] = [
  { entityCode: 'ALS NLD', id: 90, pseudo: '2080', description: 'Equity / Retained earnings', extPseudo: '2080', extDescription: 'Equity / Retained earnings', revaluation: false, accountKind: 'Balance' },
];

// Demo opening balances for ALS NLD as of the start of fiscal year 2024 (Local Legal ledger).
// A realistic opening trial balance: assets on debit, liabilities + equity on credit, and it
// balances (sum debit === sum credit). Equity (2080) is the balancing brought-forward figure.
export const openingBalances: OpeningBalance[] = [
  // Assets (debit)
  { id: 1, entityCode: 'ALS NLD', ledger: 'Local Legal', fiscalYear: 2024, pseudoAccount: '4A1544', description: 'Fixed asset', debit: 400000, credit: 0 },
  { id: 2, entityCode: 'ALS NLD', ledger: 'Local Legal', fiscalYear: 2024, pseudoAccount: '5K2060', description: 'Inventory', debit: 80000, credit: 0 },
  { id: 3, entityCode: 'ALS NLD', ledger: 'Local Legal', fiscalYear: 2024, pseudoAccount: '63A003', description: 'AR customer', debit: 120000, credit: 0 },
  { id: 4, entityCode: 'ALS NLD', ledger: 'Local Legal', fiscalYear: 2024, pseudoAccount: '963300', description: 'Bank', debit: 250000, credit: 0 },
  // Contra-asset (credit)
  { id: 5, entityCode: 'ALS NLD', ledger: 'Local Legal', fiscalYear: 2024, pseudoAccount: 'AN3832', description: 'Cum. depreciation', debit: 0, credit: 90000 },
  // Liabilities (credit)
  { id: 6, entityCode: 'ALS NLD', ledger: 'Local Legal', fiscalYear: 2024, pseudoAccount: '8C3000', description: 'VAT Payable', debit: 0, credit: 35000 },
  { id: 7, entityCode: 'ALS NLD', ledger: 'Local Legal', fiscalYear: 2024, pseudoAccount: 'DT4970', description: 'Deposit liability', debit: 0, credit: 25000 },
  // Equity — brought-forward balancing figure (credit)
  { id: 8, entityCode: 'ALS NLD', ledger: 'Local Legal', fiscalYear: 2024, pseudoAccount: '2080', description: 'Equity / Retained earnings', debit: 0, credit: 700000 },
];
