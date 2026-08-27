import type { ExtAccountValue, ExtAccountPart, Journal, JournalLine, Integration, PseudoAccountCoaLink, AccrualCode, ChartOfAccount, CoaNode } from '../types';

// Swedish BAS-plan chart of account (id 3) — the statutory account structure a Swedish leasing
// entity like Marginalen uses. Nodes carry an account-number range so imported pseudo accounts
// can be suggested onto the right group. Kontoklasser 1–8 plus the leasing-relevant kontogrupper.
export const BAS_COA_ID = 3;
export const basChartOfAccount: ChartOfAccount = {
  id: BAS_COA_ID, name: 'Swedish BAS-plan', description: 'Svensk baskontoplan (leasing)',
};

const N = (id: number, order: string, name: string, depth: number, parentId: number | null, accountFrom: number, accountTo: number): CoaNode =>
  ({ id, coaId: BAS_COA_ID, name, description: `Konto ${accountFrom}–${accountTo}`, order, depth, parentId, accountFrom, accountTo });

export const basCoaNodes: CoaNode[] = [
  // classes
  N(600, '0', '0 Systemkonton / noll-kontohantering', 0, null, 0, 99),
  N(601, '1', '1 Tillgångar', 0, null, 1000, 1999),
  N(602, '2', '2 Eget kapital och skulder', 0, null, 2000, 2999),
  N(603, '3', '3 Rörelsens intäkter', 0, null, 3000, 3999),
  N(604, '4', '4 Kostnader för varor, material och leasing', 0, null, 4000, 4999),
  N(605, '5', '5 Övriga externa rörelsekostnader', 0, null, 5000, 5999),
  N(606, '6', '6 Övriga externa rörelsekostnader', 0, null, 6000, 6999),
  N(607, '7', '7 Personalkostnader och avskrivningar', 0, null, 7000, 7999),
  N(608, '8', '8 Finansiella och andra poster', 0, null, 8000, 8999),
  // class 1 groups
  N(610, '1.1', '12 Maskiner, inventarier och leasingtillgångar', 1, 601, 1200, 1299),
  N(611, '1.2', '13 Finansiella anläggningstillgångar', 1, 601, 1300, 1399),
  N(612, '1.3', '15 Kundfordringar', 1, 601, 1500, 1599),
  N(613, '1.4', '17 Förutbetalda kostnader och upplupna intäkter', 1, 601, 1700, 1799),
  N(614, '1.5', '19 Kassa och bank', 1, 601, 1900, 1999),
  // class 2 groups
  N(620, '2.1', '20 Eget kapital', 1, 602, 2000, 2099),
  N(621, '2.2', '24 Kortfristiga skulder', 1, 602, 2400, 2499),
  N(622, '2.3', '26 Moms och särskilda punktskatter', 1, 602, 2600, 2699),
  N(623, '2.4', '29 Upplupna kostnader och förutbetalda intäkter', 1, 602, 2900, 2999),
  // class 3 groups
  N(630, '3.1', '33 Leasing- och hyresintäkter', 1, 603, 3300, 3399),
  N(631, '3.2', '35 Fakturerade avgifter', 1, 603, 3500, 3599),
  N(632, '3.3', '37 Intäktskorrigeringar / öresutjämning', 1, 603, 3700, 3799),
  // class 4 groups
  N(640, '4.1', '43 Avskrivningar leasingtillgångar', 1, 604, 4300, 4399),
];

// Accrual codes per legal entity. Cost codes spread a prepaid charge over its months
// (deferral on the balance, released to a P&L expense); DPMT holds a customer down payment
// as a liability and applies it against the lease/loan balance over the contract term.
// Accounts are illustrative stand-ins from the existing pseudo accounts — reconfigurable.
const accrualEntityCodes = ['ALS NLD', 'ALS SFB', 'ALS ITA'];
const accrualCodeTemplates: Omit<AccrualCode, 'id' | 'entityCode'>[] = [
  {
    code: 'INS', name: 'Asset insurance', direction: 'Cost', months: 12,
    deferralAccount: '192500', counterAccount: '963300', recognitionAccount: '134200',
    // Recognition (P&L) routed by Accounting Type via formula 63's conditions: DL -> 134200, MG -> 420700.
    // The fixed recognitionAccount above is the fallback if no condition matches.
    recognitionFormulaId: 63,
    triggerAmountTypeId: 60, // Insurance
  },
  {
    code: 'PTAX', name: 'Property tax', direction: 'Cost', months: 12,
    deferralAccount: '192500', // prepaid (balance)
    counterAccount: '963300', // bank
    recognitionAccount: '134200', // tax expense (P&L)
    triggerAmountTypeId: 40, // Tax — arrives under a generic Tax line, disambiguated by Amount Code = PTAX
  },
  {
    code: 'VTAX', name: 'Vehicle tax', direction: 'Cost', months: 12,
    deferralAccount: '192500', // prepaid (balance)
    counterAccount: '963300', // bank
    recognitionAccount: '134200', // tax expense (P&L)
    triggerAmountTypeId: 40, // Tax — same amount type as PTAX, disambiguated by Amount Code = VTAX
  },
  {
    code: 'DPMT', name: 'Customer down payment', direction: 'Income', months: 36,
    deferralAccount: 'DT4970', // deposit liability (balance) — the down payment held
    counterAccount: '963300', // bank — cash received at activation
    recognitionAccount: '192101', // lease receivable — applied against the balance
    triggerAmountTypeId: 32, // Deposit
  },
];
export const accrualCodes: AccrualCode[] = accrualEntityCodes.flatMap((entityCode, ei) =>
  accrualCodeTemplates.map((tpl, ti) => ({
    id: ei * accrualCodeTemplates.length + ti + 1,
    entityCode,
    ...tpl,
  })));

// External account values available from the contract domain (spec, ch. External Account Values)
// plus 'Account' — the pseudo account's external account, usually dimension 1.
// The data type tells the general ledger how to interpret each dimension.
// The `source` column is the reference mapping (configurable per deployment): the account
// segment comes from the pseudo account, known envelope fields from the Message, and the rest
// from the extensible AccountValues list.
export const extAccountValues: ExtAccountValue[] = [
  { id: 27, name: 'Account', level: 'Account', dataType: 'Text', source: 'PseudoAccount' },
  { id: 1, name: 'Company/Tenant', level: 'Contract', dataType: 'Text', source: 'Message' },
  { id: 2, name: 'Organization Unit', level: 'Contract', dataType: 'Text', source: 'Message' },
  { id: 3, name: 'Portfolio', level: 'Contract', dataType: 'Integer', source: 'Message' },
  { id: 4, name: 'Product', level: 'Contract', dataType: 'Text', source: 'Message' },
  { id: 5, name: 'Agreement Number', level: 'Contract', dataType: 'Integer', source: 'Message' },
  { id: 6, name: 'Agreement Line', level: 'Contract line', dataType: 'Integer', source: 'Message' },
  { id: 7, name: 'Customer identity', level: 'Contract', dataType: 'Text', source: 'Message' },
  { id: 8, name: 'Cost Center', level: 'Contract', dataType: 'Integer', source: 'AccountValuesList' },
  { id: 9, name: 'Cost Unit', level: 'Contract', dataType: 'Integer', source: 'AccountValuesList' },
  { id: 10, name: 'Currency Code', level: 'Contract', dataType: 'Text', source: 'Message' },
  { id: 11, name: 'Asset Number', level: 'Contract line', dataType: 'Text', source: 'AccountValuesList' },
  { id: 12, name: 'Serial Number', level: 'Contract line', dataType: 'Text', source: 'AccountValuesList' },
  { id: 13, name: 'Reg. Number', level: 'Contract line', dataType: 'Text', source: 'AccountValuesList' },
  { id: 14, name: 'Tax Code', level: 'Contract', dataType: 'Integer', source: 'AccountValuesList' },
  // Supplier identity, for AP (supplier invoice) bookings that have no agreement/line —
  // e.g. an asset going into inventory in the asset domain. Read from the message's Supplier field.
  { id: 28, name: 'Supplier identity', level: 'Supplier', dataType: 'Text', source: 'Message' },
];

// Accounting dimensions per legal entity.
// NLD books "140000 23" (account + portfolio, space separated); SFB uses fixed positions;
// ITA exports dotted strings like "002.0022.140000" (company.OU.account, '.' separator).
export const extAccountParts: ExtAccountPart[] = [
  { id: 1, legalEntityId: 1, extAccountValueId: 27, partNumber: 1, name: 'Account', length: 6, required: true },
  // Product — a message field, part of ALS NLD's account string.
  { id: 11, legalEntityId: 1, extAccountValueId: 4, partNumber: 2, name: 'Product', length: 4, required: false },
  { id: 2, legalEntityId: 1, extAccountValueId: 3, partNumber: 3, name: 'Portfolio', length: 2, required: false },
  // Asset/supplier dimensions on ALS NLD — sourced from the asset/supplier domains, not the
  // agreement. Only in use on the relevant pseudo accounts (e.g. the inventory account); a
  // supplier invoice for an asset carries these instead of an agreement/line.
  { id: 8, legalEntityId: 1, extAccountValueId: 11, partNumber: 4, name: 'Asset Number', length: 10, required: false },
  { id: 9, legalEntityId: 1, extAccountValueId: 13, partNumber: 5, name: 'Reg. Number', length: 10, required: false },
  { id: 10, legalEntityId: 1, extAccountValueId: 28, partNumber: 6, name: 'Supplier identity', length: 8, required: false },
  { id: 3, legalEntityId: 2, extAccountValueId: 27, partNumber: 1, name: 'Account', length: 6, required: true },
  { id: 4, legalEntityId: 2, extAccountValueId: 2, partNumber: 2, name: 'Organization Unit', length: 4, required: false },
  { id: 5, legalEntityId: 3, extAccountValueId: 1, partNumber: 1, name: 'Company/Tenant', length: 3, required: true },
  { id: 6, legalEntityId: 3, extAccountValueId: 2, partNumber: 2, name: 'Organization Unit', length: 4, required: true },
  { id: 7, legalEntityId: 3, extAccountValueId: 27, partNumber: 3, name: 'Account', length: 6, required: true },
];

// Default separator per seeded legal entity (undefined/'' = fixed positions).
export const dimensionSeparators: Record<number, string> = { 1: ' ', 2: '', 3: '.' };

// Journals (GLI) — example data matching the PowerPoint journal search / GLI detail slides
const gli124856Lines: JournalLine[] = [
  { line: 1, pseudoAccount: '140255', description: 'Leasing Income', agreement: '142266-15', agreementLine: 1, invoice: '105255', refNo: '', debit: 148255.0, credit: 0, ledger: 'Local Legal', currency: 'EUR', formula: '200', externalAccountString: '140255 25 66 022', amountType: 'Total amount', conditionValue: 'Accounting type' },
  { line: 2, pseudoAccount: '_1523', description: 'HP Customer Invoices', agreement: '1462', agreementLine: 1, invoice: '1504045', refNo: '', debit: 304.0, credit: 0, ledger: 'Local Legal', currency: 'SEK', formula: '200', externalAccountString: '', amountType: 'Total amount', conditionValue: '' },
  { line: 3, pseudoAccount: '_2611', description: 'HP Outgoing VAT', agreement: '1462', agreementLine: 1, invoice: '1504045', refNo: '', debit: 0, credit: 61.25, ledger: 'Local Legal', currency: 'EUR', formula: '712', externalAccountString: '', amountType: 'Tax', conditionValue: '' },
  { line: 4, pseudoAccount: '_3542', description: 'Charges', agreement: '1462', agreementLine: 1, invoice: '1504045', refNo: '', debit: 0, credit: 10.0, ledger: 'Local Legal', currency: 'EUR', formula: '230', externalAccountString: '', amountType: 'Added Cost', conditionValue: '' },
  { line: 5, pseudoAccount: '_3740', description: 'HP Rounding', agreement: '1462', agreementLine: 1, invoice: '1504045', refNo: '', debit: 0.25, credit: 0, ledger: 'Local Legal', currency: 'EUR', formula: '202', externalAccountString: '', amountType: 'Rounding', conditionValue: '' },
  { line: 6, pseudoAccount: '28522', description: 'Fixed service - Direct', agreement: '1462', agreementLine: 1, invoice: '1504045', refNo: '', debit: 0, credit: 233.0, ledger: 'Local Legal', currency: 'EUR', formula: 'XUK241', externalAccountString: '', amountType: 'Added Cost', conditionValue: '' },
  { line: 7, pseudoAccount: '_1523', description: 'HP Customer Invoices', agreement: '1465', agreementLine: 1, invoice: '1504046', refNo: '', debit: 1319.0, credit: 0, ledger: 'Local Legal', currency: 'EUR', formula: '200', externalAccountString: '', amountType: 'Total amount', conditionValue: '' },
  { line: 8, pseudoAccount: '_2611', description: 'HP Outgoing VAT', agreement: '1465', agreementLine: 1, invoice: '1504046', refNo: '', debit: 0, credit: 219.89, ledger: 'Local Legal', currency: 'EUR', formula: '712', externalAccountString: '', amountType: 'Tax', conditionValue: '' },
  { line: 9, pseudoAccount: '_3341', description: 'Leasing rent', agreement: '1465', agreementLine: 1, invoice: '1504046', refNo: '', debit: 0, credit: 856.47, ledger: 'Local Legal', currency: 'EUR', formula: '222', externalAccountString: '', amountType: 'Rent', conditionValue: '' },
  { line: 10, pseudoAccount: '_3542', description: 'Charges', agreement: '1465', agreementLine: 1, invoice: '1504046', refNo: '', debit: 0, credit: 10.0, ledger: 'Local Legal', currency: 'EUR', formula: '230', externalAccountString: '', amountType: 'Added Cost', conditionValue: '' },
  { line: 11, pseudoAccount: '_3740', description: 'HP Rounding', agreement: '1465', agreementLine: 1, invoice: '1504046', refNo: '', debit: 0.36, credit: 0, ledger: 'Local Legal', currency: 'EUR', formula: '202', externalAccountString: '', amountType: 'Rounding', conditionValue: '' },
  { line: 12, pseudoAccount: '28522', description: 'Fixed service - Direct', agreement: '1465', agreementLine: 1, invoice: '1504046', refNo: '', debit: 0, credit: 233.0, ledger: 'Local Legal', currency: 'EUR', formula: 'XUK241', externalAccountString: '', amountType: 'Added Cost', conditionValue: '' },
];

// Demo journal with four sub-transactions (agreement+invoice); three balance, one (5003) is
// short a 200 credit — so "View Differences Only" collapses 10 lines to the 2 that don't add up.
function dl(line: number, pseudo: string, description: string, agreement: string, period: string, invoice: string, debit: number, credit: number, formula: string, amountType: string): JournalLine {
  return { line, pseudoAccount: pseudo, description, agreement, agreementLine: 1, period, invoice, refNo: '', debit, credit, ledger: 'Local Legal', currency: 'EUR', currencyRate: 1, formula, externalAccountString: '', amountType, conditionValue: '' };
}
// Reversal demo: one consolidated invoice (invoice 1700001) for a customer. Agreement 6002
// line 1 was in dispute and is now invoiced for three back-periods (202401-202403); each period
// carries two amount types — Amortization and a document fee (Added Cost, amount code 10). The
// dispute over the fee for period 202401 is resolved by a partial credit at the lowest level:
// only agreement 6002 / line 1 / period 202401 / Added Cost / 10 is reversed. The Credit
// Invoicing journal (its own credit note 1700050) references those exact lines.
const fee = (l: JournalLine): JournalLine => ({ ...l, amountCode: '10' });
const gli124842Lines: JournalLine[] = [
  dl(1, '63A003', 'AR customer', '6002', '202401', '1700001', 250.0, 0, '200', 'Amortization'),
  dl(2, 'EG5202', 'Rent income (principle)', '6002', '202401', '1700001', 0, 250.0, '222', 'Amortization'),
  { ...fee(dl(3, '63A003', 'AR customer', '6002', '202401', '1700001', 50.0, 0, '200', 'Added Cost')), reversed: true },
  { ...fee(dl(4, '420100', 'Fee Income', '6002', '202401', '1700001', 0, 50.0, '230', 'Added Cost')), reversed: true },
  dl(5, '63A003', 'AR customer', '6002', '202402', '1700001', 250.0, 0, '200', 'Amortization'),
  dl(6, 'EG5202', 'Rent income (principle)', '6002', '202402', '1700001', 0, 250.0, '222', 'Amortization'),
  fee(dl(7, '63A003', 'AR customer', '6002', '202402', '1700001', 50.0, 0, '200', 'Added Cost')),
  fee(dl(8, '420100', 'Fee Income', '6002', '202402', '1700001', 0, 50.0, '230', 'Added Cost')),
  dl(9, '63A003', 'AR customer', '6002', '202403', '1700001', 250.0, 0, '200', 'Amortization'),
  dl(10, 'EG5202', 'Rent income (principle)', '6002', '202403', '1700001', 0, 250.0, '222', 'Amortization'),
  fee(dl(11, '63A003', 'AR customer', '6002', '202403', '1700001', 50.0, 0, '200', 'Added Cost')),
  fee(dl(12, '420100', 'Fee Income', '6002', '202403', '1700001', 0, 50.0, '230', 'Added Cost')),
];
const gli124841Lines: JournalLine[] = [
  { ...fee(dl(1, '63A003', 'AR customer', '6002', '202401', '1700050', 0, 50.0, '609', 'Added Cost')), reversed: true, reversesLine: 3 },
  { ...fee(dl(2, '420100', 'Fee Income', '6002', '202401', '1700050', 50.0, 0, '609', 'Added Cost')), reversed: true, reversesLine: 4 },
];

const gli124843Lines: JournalLine[] = [
  dl(1, '63A003', 'AR customer', '5001', '202406', '1600001', 1250.0, 0, '200', 'Total amount'),
  dl(2, '420005', 'Interest Revenue', '5001', '202406', '1600001', 0, 250.0, '420', 'Interest'),
  dl(3, '192101', 'Lease Rec - Curr Year Volume', '5001', '202406', '1600001', 0, 1000.0, '222', 'Amortization'),
  dl(4, '63A003', 'AR customer', '5002', '202406', '1600002', 875.0, 0, '200', 'Total amount'),
  dl(5, '216505', 'Vat Output', '5002', '202406', '1600002', 0, 175.0, '712', 'Tax'),
  dl(6, '420100', 'Fee Income', '5002', '202406', '1600002', 0, 700.0, '230', 'Fee'),
  dl(7, '63A003', 'AR customer', '5003', '202406', '1600003', 1000.0, 0, '200', 'Total amount'),
  dl(8, '420100', 'Fee Income', '5003', '202406', '1600003', 0, 800.0, '230', 'Fee'),
  dl(9, '192101', 'Lease Rec - Curr Year Volume', '5004', '202406', '1600004', 500.0, 0, '222', 'Amortization'),
  dl(10, '420005', 'Interest Revenue', '5004', '202406', '1600004', 0, 500.0, '420', 'Interest'),
];

function genLines(count: number, event: string): JournalLine[] {
  const accounts = [
    ['63A003', 'AR customer'], ['420005', 'Interest Revenue'], ['192101', 'Lease Rec - Curr Year Volume'],
    ['192401', 'Unearn Inc- Curr Year Volume'], ['216505', 'Vat Output'], ['420100', 'Fee Income'],
    ['192020', 'Unapplied Cash'],
  ];
  const lines: JournalLine[] = [];
  let balance = 0;
  for (let i = 1; i <= count; i++) {
    const [acc, desc] = accounts[i % accounts.length];
    const amt = Math.round((500 + ((i * 137) % 2000) + 0.25 * i) * 100) / 100;
    const isDebit = i % 2 === 1 && i < count;
    const debit = i === count ? 0 : isDebit ? amt : 0;
    const credit = i === count ? Math.round(balance * 100) / 100 : isDebit ? 0 : amt;
    balance += debit - credit;
    lines.push({
      line: i, pseudoAccount: acc, description: desc,
      agreement: String(1400 + (i % 9)), agreementLine: 1, invoice: String(1504000 + i), refNo: '',
      debit, credit, ledger: 'Local Legal', currency: 'EUR',
      formula: event === 'AR Payment' ? '609' : '200', externalAccountString: '',
      amountType: 'Total amount', conditionValue: '',
    });
  }
  return lines;
}

export const journals: Journal[] = [
  // Two partial AR payments against the SAME customer invoice (INV-70055), each with its own
  // payment id. AR Undo Payment can then reverse exactly one of them (e.g. PAY-70019-B) and leave
  // the other — which matching on the invoice reference alone could not do.
  { gliNumber: 124839, legalEntityId: 1, accountingEvent: 'AR Payment', lineCount: 2, bookingDate: '2024-07-04', createDate: '2024-07-04', exportDate: null, difference: false, createdBy: 'Demo (AR payment 1/2)',
    lines: [
      { line: 1, pseudoAccount: '192020', description: 'Bank — customer receipt', agreement: '700500', agreementLine: 1, period: '202412', customer: 'ACME Transport BV', invoice: 'INV-70055', refNo: '', paymentId: 'PAY-70019-A', debit: 5000.00, credit: 0, ledger: 'Local Legal', currency: 'EUR', currencyRate: 1, formula: '609', externalAccountString: '', amountType: 'Total amount', conditionValue: '' },
      { line: 2, pseudoAccount: '134200', description: 'Customer receivable', agreement: '700500', agreementLine: 1, period: '202412', customer: 'ACME Transport BV', invoice: 'INV-70055', refNo: '', paymentId: 'PAY-70019-A', debit: 0, credit: 5000.00, ledger: 'Local Legal', currency: 'EUR', currencyRate: 1, formula: '609', externalAccountString: '', amountType: 'Total amount', conditionValue: '' },
    ],
  },
  { gliNumber: 124840, legalEntityId: 1, accountingEvent: 'AR Payment', lineCount: 2, bookingDate: '2024-07-05', createDate: '2024-07-05', exportDate: null, difference: false, createdBy: 'Demo (AR payment 2/2)',
    lines: [
      { line: 1, pseudoAccount: '192020', description: 'Bank — customer receipt', agreement: '700500', agreementLine: 1, period: '202412', customer: 'ACME Transport BV', invoice: 'INV-70055', refNo: '', paymentId: 'PAY-70019-B', debit: 2903.00, credit: 0, ledger: 'Local Legal', currency: 'EUR', currencyRate: 1, formula: '609', externalAccountString: '', amountType: 'Total amount', conditionValue: '' },
      { line: 2, pseudoAccount: '134200', description: 'Customer receivable', agreement: '700500', agreementLine: 1, period: '202412', customer: 'ACME Transport BV', invoice: 'INV-70055', refNo: '', paymentId: 'PAY-70019-B', debit: 0, credit: 2903.00, ledger: 'Local Legal', currency: 'EUR', currencyRate: 1, formula: '609', externalAccountString: '', amountType: 'Total amount', conditionValue: '' },
    ],
  },
  { gliNumber: 124843, legalEntityId: 1, accountingEvent: 'Invoicing', lines: gli124843Lines, lineCount: 10, bookingDate: '2024-06-21', createDate: '2024-06-21', exportDate: null, difference: true, createdBy: 'Demo (unbalanced)' },
  { gliNumber: 124842, legalEntityId: 1, accountingEvent: 'Invoicing', lines: gli124842Lines, lineCount: 12, bookingDate: '2024-06-20', createDate: '2024-06-20', exportDate: null, difference: false, createdBy: 'Demo (consolidated)' },
  { gliNumber: 124841, legalEntityId: 1, accountingEvent: 'Credit Invoicing', lines: gli124841Lines, lineCount: 2, bookingDate: '2024-06-20', createDate: '2024-06-20', exportDate: null, difference: false, createdBy: 'Demo (credit)', reversesGli: 124842 },
  { gliNumber: 124856, legalEntityId: 1, accountingEvent: 'Invoicing', lines: gli124856Lines, lineCount: 12, bookingDate: '2024-06-22', createDate: '2024-06-22', exportDate: '2024-06-22', difference: true, createdBy: 'Rikard Krameus' },
  { gliNumber: 124855, legalEntityId: 1, accountingEvent: 'AR Payment', lines: genLines(23, 'AR Payment'), lineCount: 23, bookingDate: '2024-06-20', createDate: '2024-06-20', exportDate: null, difference: true, createdBy: 'Rikard Krameus' },
  { gliNumber: 124854, legalEntityId: 1, accountingEvent: 'AR Payment', lines: genLines(25, 'AR Payment'), lineCount: 255, bookingDate: '2024-06-19', createDate: '2024-06-19', exportDate: '2024-06-19', difference: false, createdBy: 'Rikard Krameus' },
  { gliNumber: 124853, legalEntityId: 1, accountingEvent: 'AR Payment', lines: genLines(20, 'AR Payment'), lineCount: 111, bookingDate: '2024-06-19', createDate: '2024-06-19', exportDate: '2024-06-19', difference: false, createdBy: 'Rikard Krameus' },
  { gliNumber: 124852, legalEntityId: 2, accountingEvent: 'AR Payment', lines: genLines(12, 'AR Payment'), lineCount: 12, bookingDate: '2024-06-14', createDate: '2024-06-14', exportDate: '2024-06-14', difference: false, createdBy: 'Pierre Willard' },
  { gliNumber: 124851, legalEntityId: 2, accountingEvent: 'AR Payment', lines: genLines(30, 'AR Payment'), lineCount: 500, bookingDate: '2024-06-13', createDate: '2024-06-13', exportDate: '2024-06-13', difference: false, createdBy: 'Pierre Willard' },
  { gliNumber: 124850, legalEntityId: 2, accountingEvent: 'AR Payment', lines: genLines(18, 'AR Payment'), lineCount: 120, bookingDate: '2024-06-12', createDate: '2024-06-12', exportDate: '2024-06-12', difference: false, createdBy: 'Pierre Willard' },
  { gliNumber: 124849, legalEntityId: 3, accountingEvent: 'Termination Invoicing', lines: genLines(6, 'Invoicing'), lineCount: 6, bookingDate: '2024-06-12', createDate: '2024-06-12', exportDate: '2024-06-12', difference: false, createdBy: 'Rikard Krameus' },
  { gliNumber: 124848, legalEntityId: 3, accountingEvent: 'Termination Asset', lines: genLines(8, 'Invoicing'), lineCount: 8, bookingDate: '2024-06-12', createDate: '2024-06-12', exportDate: null, difference: false, createdBy: 'Rikard Krameus' },
  { gliNumber: 124847, legalEntityId: 1, accountingEvent: 'Invoicing', lines: genLines(24, 'Invoicing'), lineCount: 2375, bookingDate: '2024-06-08', createDate: '2024-06-08', exportDate: '2024-06-08', difference: false, createdBy: 'Rikard Krameus' },
  { gliNumber: 124846, legalEntityId: 2, accountingEvent: 'Invoicing', lines: genLines(16, 'Invoicing'), lineCount: 125, bookingDate: '2024-06-07', createDate: '2024-06-07', exportDate: '2024-06-07', difference: false, createdBy: 'Pierre Willard' },
  { gliNumber: 124845, legalEntityId: 3, accountingEvent: 'Invoicing', lines: genLines(14, 'Invoicing'), lineCount: 133, bookingDate: '2024-06-05', createDate: '2024-06-05', exportDate: '2024-06-05', difference: false, createdBy: 'Rikard Krameus' },
  { gliNumber: 124844, legalEntityId: 3, accountingEvent: 'Activation', lines: genLines(10, 'Activation'), lineCount: 10, bookingDate: '2024-06-05', createDate: '2024-06-05', exportDate: '2024-06-05', difference: false, createdBy: 'Rikard Krameus' },
];

// Initial placement of the seeded pseudo accounts on the US GAAP chart of account,
// derived from account number series and description. Keyed by pseudo account id (1-32,
// identical across the three entities) -> COA node id.
const coaNodeByPseudoId: Record<number, number> = {
  1: 46,   // 216505 Vat Output              -> 2.2.3 Accrued Taxes (Other Than Payroll)
  2: 85,   // 420005 Interest Revenue        -> 4.2.2 Recognized Over Time / Services
  3: 82,   // 420100 Fee Income              -> 4.1.2 Recognized Point Of Time / Services
  4: 108,  // 420420 Gain/Loss Termination   -> 6.2.4 Gain (Loss) On Disposal Of Assets
  5: 99,   // 420700 Bad Debt Expense        -> 5.2.3 Uncollectible Accounts Expense
  6: 3,    // 963300 Bank                    -> 1.1.1 Cash And Cash Equivalents
  7: 47,   // DT4970 Deposit liability       -> 2.2.4 Other Liabilities
  8: 24,   // 4A1544 Fixed asset             -> 1.5.3 Machinery And Equipment
  9: 16,   // 5K2060 Inventory               -> 1.3.5 Other Inventory
  10: 8,   // 63A003 AR customer             -> 1.2.1 Accounts, Notes And Loans Receivable
  11: 102, // EK5250 Other fee income        -> 6.1.1 Other Revenue
  12: 46,  // 8C3000 VAT Payable             -> 2.2.3 Accrued Taxes (Other Than Payroll)
  13: 84,  // EG5202 Rent income (principle) -> 4.2.1 Recognized Over Time / Products
  14: 85,  // I66540 Interest revenue        -> 4.2.2 Recognized Over Time / Services
  15: 95,  // FP5652 Depreciation            -> 5.1.4 Rent, Depreciation, Amortization
  16: 26,  // AN3832 Cum. depreciation       -> 1.5.5 Additional Property, Plant And Equipment
  17: 97,  // 134200 Cost of goods sold      -> 5.2.1 Cost Of Sales
  18: 16,  // 500000 Inventory               -> 1.3.5 Other Inventory
  19: 24,  // 140000 Equipment Purchases     -> 1.5.3 Machinery And Equipment
  20: 42,  // 192020 Unapplied Cash          -> 2.1.4 Other Payables
  22: 9,   // 192101 Lease Rec Curr Volume   -> 1.2.2 Contracts
  23: 9,   // 192102 Lease Rec Curr Collect  -> 1.2.2 Contracts
  24: 9,   // 192103 Lease Rec Curr Chargeo  -> 1.2.2 Contracts
  25: 9,   // 192107 Lease Rec Terminations  -> 1.2.2 Contracts
  26: 10,  // 192200 Unguaranteed Residual   -> 1.2.3 Nontrade And Other Receivables
  27: 45,  // 192401 Unearn Inc Volume       -> 2.2.2 Deferred Income And Refund Liabilities
  28: 45,  // 192402 Unearn Inc Amortiza     -> 2.2.2 Deferred Income And Refund Liabilities
  29: 45,  // 192403 Unearn Inc Chargeof     -> 2.2.2 Deferred Income And Refund Liabilities
  30: 45,  // 192407 Unearn Inc Terminat     -> 2.2.2 Deferred Income And Refund Liabilities
  31: 10,  // 192500 Cust Other Receivable   -> 1.2.3 Nontrade And Other Receivables
  32: 10,  // 192600 Cust Receivable VAT     -> 1.2.3 Nontrade And Other Receivables
};

export const pseudoAccountCoaLinks: PseudoAccountCoaLink[] =
  ['ALS NLD', 'ALS SFB', 'ALS ITA'].flatMap((entityCode, ei) =>
    Object.entries(coaNodeByPseudoId).map(([pseudoId, nodeId], i) => ({
      id: ei * 100 + i + 1,
      entityCode,
      pseudoAccountId: Number(pseudoId),
      coaNodeId: nodeId,
    })),
  );

export const integrations: Integration[] = [
  {
    id: 1, legalEntityId: 1, name: 'GL04 - Export GL Transactions', description: 'GL04 - Export GL Transactions (ALS)',
    fileName: 'PF201', fileLocation: '\\\\AZS-PFBDEV-02\\_Interfaces\\ALS\\NLD\\GL04', archiveLocation: '\\\\AZS-PFBDEV-02\\_Interfacas\\ALS\\NLD\\GL04\\Archive',
    status: 'Active', executionType: 'EndOfMonth',
    nextSequence: 2317, lastExecution: '2024-09-30', lastExecutionBy: 'Rikard Krameus', records: 2452,
    targetGl: 'Generic', format: 'JSON', transport: 'File', ledger: 'ALL', summarization: 'PerAccount', defaultKeepPartIds: [],
  },
  {
    id: 2, legalEntityId: 2, name: 'GL04 - Export GL Transactions', description: 'GL04 - Export GL Transactions (ALS SFB)',
    fileName: 'PF201', fileLocation: '\\\\AZS-PFBDEV-02\\_Interfaces\\ALS\\SFB\\GL04', archiveLocation: '\\\\AZS-PFBDEV-02\\_Interfacas\\ALS\\SFB\\GL04\\Archive',
    status: 'Active', executionType: 'EndOfMonth',
    nextSequence: 1181, lastExecution: '2024-09-30', lastExecutionBy: 'Pierre Willard', records: 1817,
    targetGl: 'Visma', format: 'CSV', transport: 'File', ledger: 'ALL', summarization: 'Summarized', defaultKeepPartIds: [],
  },
  {
    id: 3, legalEntityId: 3, name: 'GL04 - Export GL Transactions', description: 'GL04 - Export GL Transactions (ALS ITA)',
    fileName: 'PF201', fileLocation: '\\\\AZS-PFBDEV-02\\_Interfaces\\ALS\\ITA\\GL04', archiveLocation: '\\\\AZS-PFBDEV-02\\_Interfacas\\ALS\\ITA\\GL04\\Archive',
    status: 'Active', executionType: 'EndOfMonth',
    nextSequence: 908, lastExecution: '2024-09-30', lastExecutionBy: 'Rikard Krameus', records: 1204,
    targetGl: 'SAP', format: 'JSON', transport: 'API', ledger: 'ALL', summarization: 'Full', defaultKeepPartIds: [],
  },
];
