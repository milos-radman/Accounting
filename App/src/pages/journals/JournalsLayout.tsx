import { Outlet } from 'react-router-dom';
import { Breadcrumb, SidePanel, MenuItem } from '../../components/Chrome';

// Journals area with its own side menu (slides 5 + 39-40)
export default function JournalsLayout() {
  return (
    <>
      <Breadcrumb />
      <div className="workspace">
        <SidePanel caption="Journal menu">
          <MenuItem to="/journals" icon="search" label="Journal search" end />
          <MenuItem to="/journals/transactions" icon="swap" label="Transaction search" />
          <MenuItem to="/journals/manual" icon="pencil" label="Manual journal" />
          <MenuItem to="/journals/simulator" icon="zap" label="Message simulator" />
          <MenuItem to="/journals/pending" icon="calendar" label="Pending messages" />
          <MenuItem to="/journals/events" icon="plug" label="Published events" />
          <MenuItem to="/journals/revaluation" icon="scale" label="Revaluation" />
        </SidePanel>
        <main>
          <Outlet />
        </main>
      </div>
    </>
  );
}
