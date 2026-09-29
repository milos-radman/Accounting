import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { StoreProvider } from './store';
import { TopNav } from './components/Chrome';
import { TrailProvider } from './components/trail';
import { AskClaude } from './components/AskClaude';
import Dashboard from './pages/Dashboard';
import LegalEntityList from './pages/LegalEntityList';
import EntityLayout from './pages/entity/EntityLayout';
import EntityInfo from './pages/entity/EntityInfo';
import Integration from './pages/entity/Integration';
import ChartOfAccountPage from './pages/entity/ChartOfAccountPage';
import PseudoAccounts from './pages/entity/PseudoAccounts';
import OpeningBalances from './pages/entity/OpeningBalances';
import Dimensions from './pages/entity/Dimensions';
import Accruals from './pages/entity/Accruals';
import Formulas, { FormulaDetail } from './pages/entity/Formulas';
import AccountingRules from './pages/entity/AccountingRules';
import ClassesLedgers from './pages/entity/ClassesLedgers';
import Recognition from './pages/entity/Recognition';
import JournalsLayout from './pages/journals/JournalsLayout';
import JournalSearch from './pages/journals/JournalSearch';
import GliDetail from './pages/journals/GliDetail';
import ManualJournal from './pages/journals/ManualJournal';
import TransactionSearch from './pages/journals/TransactionSearch';
import Simulator from './pages/journals/Simulator';
import PendingMessages from './pages/journals/PendingMessages';
import JournalEvents from './pages/journals/JournalEvents';
import RevaluationRecon from './pages/journals/RevaluationRecon';
import SettingsLayout from './pages/settings/SettingsLayout';
import {
  AccountingClassSettings, AmountTypeSettings, LedgerSettings,
  CoaSettings, ExtAccountValueSettings, AccountingEventSettings, CurrencySettings, AttributeCodeSettings,
  ResetDataSettings,
} from './pages/settings/SettingsPages';
import { ReportsLayout, TransactionListReport, ReconciliationReport, AgreementReconciliation } from './pages/reports/Reports';

export default function App() {
  return (
    <StoreProvider>
      <HashRouter>
        <TrailProvider>
        <TopNav />
        <AskClaude />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/legal-entity" element={<LegalEntityList />} />
          <Route path="/legal-entity/:id" element={<EntityLayout />}>
            <Route index element={<EntityInfo />} />
            <Route path="integration" element={<Integration />} />
            <Route path="chart-of-account" element={<ChartOfAccountPage />} />
            <Route path="pseudo-account" element={<PseudoAccounts />} />
            <Route path="opening-balances" element={<OpeningBalances />} />
            <Route path="dimensions" element={<Dimensions />} />
            <Route path="accruals" element={<Accruals />} />
            <Route path="recognition" element={<Recognition />} />
            <Route path="recognition/:agreement" element={<Recognition />} />
            {/* Journal / transaction search scoped to this one legal entity (single-entity daily work) */}
            <Route path="journals" element={<JournalSearch />} />
            <Route path="transactions" element={<TransactionSearch />} />
            {/* old bookmark alias */}
            <Route path="ext-account-parts" element={<Dimensions />} />
            <Route path="formulas" element={<Formulas />} />
            <Route path="formulas/:formulaId" element={<FormulaDetail />} />
            <Route path="classes-ledgers" element={<ClassesLedgers />} />
            <Route path="accounting-rules" element={<AccountingRules />} />
          </Route>
          <Route path="/journals" element={<JournalsLayout />}>
            <Route index element={<JournalSearch />} />
            <Route path="transactions" element={<TransactionSearch />} />
            <Route path="manual" element={<ManualJournal />} />
            <Route path="simulator" element={<Simulator />} />
            <Route path="pending" element={<PendingMessages />} />
            <Route path="events" element={<JournalEvents />} />
            <Route path="revaluation" element={<RevaluationRecon />} />
          </Route>
          <Route path="/journals/gli/:gli" element={<GliDetail />} />
          <Route path="/settings" element={<SettingsLayout />}>
            <Route index element={<AccountingClassSettings />} />
            <Route path="amount-types" element={<AmountTypeSettings />} />
            <Route path="ledgers" element={<LedgerSettings />} />
            <Route path="chart-of-account" element={<CoaSettings />} />
            <Route path="ext-account-values" element={<ExtAccountValueSettings />} />
            <Route path="accounting-events" element={<AccountingEventSettings />} />
            <Route path="attribute-codes" element={<AttributeCodeSettings />} />
            <Route path="currencies" element={<CurrencySettings />} />
            <Route path="reset" element={<ResetDataSettings />} />
          </Route>
          <Route path="/reports" element={<ReportsLayout />}>
            <Route index element={<TransactionListReport />} />
            <Route path="reconciliation" element={<ReconciliationReport />} />
            <Route path="agreement" element={<AgreementReconciliation />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </TrailProvider>
      </HashRouter>
    </StoreProvider>
  );
}
