import { Outlet, useParams, useLocation, Link } from 'react-router-dom';
import { Breadcrumb, SidePanel, MenuItem } from '../../components/Chrome';
import { useStore } from '../../store';

// Legal entity workspace with side menu (slide 8)
export default function EntityLayout() {
  const { id } = useParams();
  const { data } = useStore();
  const location = useLocation();
  const entity = data.legalEntities.find(e => e.id === Number(id));

  if (!entity) return <div className="page">Legal entity not found.</div>;

  const base = `/legal-entity/${entity.id}`;

  // Quick-switch tabs: the entities flagged "Show in entity tabs", plus the current one if it isn't
  // flagged (so you stay oriented). Switching keeps the sub-page you're on (Recognition → Recognition).
  const seg = location.pathname.slice(base.length).split('/').filter(Boolean)[0];
  const subPath = seg ? `/${seg}` : '';
  const flagged = data.legalEntities.filter(e => e.showInTabs);
  const tabEntities = flagged.length === 0
    ? []
    : (flagged.some(e => e.id === entity.id) ? [...flagged] : [...flagged, entity]).sort((a, b) => a.id - b.id);

  // Rendered in the side rail between the "Last journal transaction" card and the entity menu.
  const entityTabs = tabEntities.length > 0 ? (
    <div className="entity-tabs">
      <div className="cap">Legal entities</div>
      {tabEntities.map(e => (
        <Link
          key={e.id}
          to={`/legal-entity/${e.id}${subPath}`}
          title={e.name}
          className={'entity-tab' + (e.id === entity.id ? ' active' : '')}
        >
          {e.ownerCode}
        </Link>
      ))}
    </div>
  ) : null;

  return (
    <>
      <Breadcrumb />
      <div className="workspace">
        <SidePanel caption="Legal entity menu" beforeMenu={entityTabs}>
          <MenuItem to={base} icon="building" label="Legal entity" end />
          <MenuItem to={`${base}/journals`} icon="search" label="Journal search" />
          <MenuItem to={`${base}/transactions`} icon="rows" label="Transaction search" />
          <MenuItem to={`${base}/integration`} icon="plug" label="Integration" />
          <MenuItem to={`${base}/chart-of-account`} icon="book" label="Chart of account" />
          <MenuItem to={`${base}/pseudo-account`} icon="rows" label="Pseudo account" />
          <MenuItem to={`${base}/formulas`} icon="sigma" label="Formulas" />
          <MenuItem to={`${base}/classes-ledgers`} icon="coins" label="Classes & ledgers" />
          <MenuItem to={`${base}/accounting-rules`} icon="sliders" label="Accounting rules" />
          <MenuItem to={`${base}/dimensions`} icon="puzzle" label="Accounting Dimensions" />
          <MenuItem to={`${base}/accruals`} icon="layers" label="Accruals" />
          <MenuItem to={`${base}/recognition`} icon="calendar" label="Recognition" />
        </SidePanel>
        <main>
          <Outlet context={entity} />
        </main>
      </div>
    </>
  );
}
