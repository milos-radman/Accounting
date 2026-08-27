import { Outlet } from 'react-router-dom';
import { Breadcrumb, SidePanel, MenuItem } from '../../components/Chrome';

// Settings area with base configuration (slide 37)
export default function SettingsLayout() {
  return (
    <>
      <Breadcrumb />
      <div className="workspace">
        <SidePanel caption="Settings menu">
          <MenuItem to="/settings" icon="tag" label="Accounting Class" end />
          <MenuItem to="/settings/amount-types" icon="coins" label="Amount types" />
          <MenuItem to="/settings/attribute-codes" icon="tag" label="Message attribute codes" />
          <MenuItem to="/settings/ledgers" icon="layers" label="Ledgers" />
          <MenuItem to="/settings/currencies" icon="coins" label="Currencies" />
          <MenuItem to="/settings/chart-of-account" icon="book" label="Chart of account" />
          <MenuItem to="/settings/ext-account-values" icon="puzzle" label="Ext. account values" />
          <MenuItem to="/settings/accounting-events" icon="zap" label="Accounting events" />
          <MenuItem to="/settings/reset" icon="swap" label="Reset data" />
        </SidePanel>
        <main>
          <Outlet />
        </main>
      </div>
    </>
  );
}
