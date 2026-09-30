import { useOutletContext } from 'react-router-dom';
import { useStore } from '../../store';
import { Icon } from '../../components/Icon';
import { buildExternalAccountString } from '../../business/engine';
import type { ExtAccountPart, LegalEntity } from '../../types';

const separatorOptions = [
  { value: '', label: 'None — fixed positions' },
  { value: ' ', label: 'Space ( )' },
  { value: '-', label: 'Dash (-)' },
  { value: '.', label: 'Dot (.)' },
  { value: ',', label: 'Comma (,)' },
  { value: ';', label: 'Semicolon (;)' },
  { value: '|', label: 'Pipe (|)' },
];

// Example values per source, used for the live preview of the external account string
const sampleValues: Record<string, string> = {
  'Account': '140000',
  'Company/Tenant': '002',
  'Organization Unit': '0022',
  'Portfolio': '23',
  'Product': 'DL',
  'Agreement Number': '142266',
  'Agreement Line': '1',
  'Customer identity': '10234',
  'Cost Center': '100',
  'Cost Unit': '55',
  'Currency Code': 'EUR',
  'Asset Number': 'A5501',
  'Serial Number': 'SN88',
  'Reg. Number': 'ABC123',
  'Tax Code': '19',
};

// Accounting dimensions: defines the external account string written on every
// transaction line (spec §External Account Parts). Next step: enable/disable
// per pseudo account via PseudoAccountExtParts.
export default function Dimensions() {
  const entity = useOutletContext<LegalEntity>();
  const { data, update } = useStore();

  const separator = entity.dimensionSeparator ?? '';
  const parts = data.extAccountParts
    .filter(p => p.legalEntityId === entity.id)
    .sort((a, b) => a.partNumber - b.partNumber);

  const usedValueIds = new Set(parts.map(p => p.extAccountValueId));
  const optionsFor = (part?: ExtAccountPart) =>
    data.extAccountValues.filter(v => v.id === part?.extAccountValueId || !usedValueIds.has(v.id));

  const setSeparator = (value: string) =>
    update(d => {
      const e = d.legalEntities.find(x => x.id === entity.id);
      if (e) e.dimensionSeparator = value;
    });

  const renumber = (list: ExtAccountPart[]) =>
    list
      .sort((a, b) => a.partNumber - b.partNumber)
      .forEach((p, i) => { p.partNumber = i + 1; });

  const addDimension = () =>
    update(d => {
      const mine = d.extAccountParts.filter(p => p.legalEntityId === entity.id);
      const used = new Set(mine.map(p => p.extAccountValueId));
      // first dimension defaults to the Account itself, required — the common setup
      const account = d.extAccountValues.find(v => v.name === 'Account');
      const source = (mine.length === 0 && account && !used.has(account.id))
        ? account
        : d.extAccountValues.find(v => !used.has(v.id));
      if (!source) return; // every source already used
      d.extAccountParts.push({
        id: Math.max(0, ...d.extAccountParts.map(p => p.id)) + 1,
        legalEntityId: entity.id,
        extAccountValueId: source.id,
        partNumber: mine.length + 1,
        name: source.name,
        length: source.name === 'Account' ? 6 : 4,
        required: mine.length === 0,
      });
    });

  const patch = (id: number, changes: Partial<ExtAccountPart>) =>
    update(d => {
      const p = d.extAccountParts.find(x => x.id === id);
      if (p) Object.assign(p, changes);
    });

  const remove = (id: number) =>
    update(d => {
      d.extAccountParts = d.extAccountParts.filter(p => p.id !== id);
      renumber(d.extAccountParts.filter(p => p.legalEntityId === entity.id));
    });

  const move = (id: number, direction: -1 | 1) =>
    update(d => {
      const mine = d.extAccountParts
        .filter(p => p.legalEntityId === entity.id)
        .sort((a, b) => a.partNumber - b.partNumber);
      const index = mine.findIndex(p => p.id === id);
      const other = mine[index + direction];
      if (!other) return;
      const own = mine[index].partNumber;
      mine[index].partNumber = other.partNumber;
      other.partNumber = own;
    });

  const preview = parts.length === 0
    ? ''
    : buildExternalAccountString(parts, separator, name => sampleValues[name] ?? 'X');

  return (
    <div>
      <div className="pagelike-title">Accounting dimensions</div>
      <p className="muted" style={{ maxWidth: 720, marginTop: -6 }}>
        The dimensions build the external account string written on every transaction line
        and sent to the general ledger. With a separator, the ledger splits the string on it;
        without one, each dimension occupies a fixed number of positions. In the next step the
        dimensions can be switched on or off per pseudo account.
      </p>

      <div className="card">
        <div className="form-grid" style={{ gridTemplateColumns: '260px 1fr', alignItems: 'end' }}>
          <div className="f">
            <label>Separator between dimensions</label>
            <select value={separator} onChange={e => setSeparator(e.target.value)}>
              {separatorOptions.map(o => <option key={o.label} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Example external account string</label>
            <div className="val" style={{ fontFamily: 'Consolas, monospace', fontSize: 15, letterSpacing: 0.5 }}>
              {preview ? preview.replaceAll(' ', '·') : <span className="muted">— add dimensions below —</span>}
            </div>
            {preview && !separator && (
              <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>
                · marks padded positions — total {parts.reduce((s, p) => s + Math.max(1, p.length), 0)} characters
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <h4>Dimensions</h4>
        <table className="cond-table" style={{ maxWidth: 780 }}>
          <thead>
            <tr>
              <th style={{ width: 36 }}>#</th>
              <th>Dimension</th>
              <th style={{ width: 110 }}>Positions</th>
              <th style={{ width: 90, textAlign: 'center' }}>Required</th>
              <th style={{ width: 110 }} />
            </tr>
          </thead>
          <tbody>
            {parts.map((p, i) => (
              <tr key={p.id}>
                <td className="muted" style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{p.partNumber}</td>
                <td>
                  <select
                    value={p.extAccountValueId}
                    onChange={e => {
                      const source = data.extAccountValues.find(v => v.id === Number(e.target.value));
                      if (source) patch(p.id, { extAccountValueId: source.id, name: source.name });
                    }}
                  >
                    {optionsFor(p).map(v => (
                      <option key={v.id} value={v.id}>{v.name}{v.level !== 'Account' ? ` (${v.level})` : ''}</option>
                    ))}
                  </select>
                </td>
                <td>
                  {separator ? (
                    <input value="" disabled title="Not needed — the ledger splits on the separator" />
                  ) : (
                    <input
                      value={p.length || ''}
                      onChange={e => patch(p.id, { length: Number(e.target.value.replace(/\D/g, '')) || 0 })}
                      style={{ textAlign: 'right' }}
                    />
                  )}
                </td>
                <td style={{ textAlign: 'center' }}>
                  <input type="checkbox" checked={p.required} onChange={e => patch(p.id, { required: e.target.checked })} />
                </td>
                <td>
                  <button className="icon-btn" title="Move up" disabled={i === 0} onClick={() => move(p.id, -1)}>
                    <Icon name="chevronDown" size={14} className="rot180" strokeWidth={2} />
                  </button>
                  <button className="icon-btn" title="Move down" disabled={i === parts.length - 1} onClick={() => move(p.id, 1)}>
                    <Icon name="chevronDown" size={14} strokeWidth={2} />
                  </button>
                  <button className="icon-btn del" title="Remove dimension" onClick={() => remove(p.id)}>
                    <Icon name="trash" size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {parts.length === 0 && (
              <tr><td colSpan={5} className="empty">No dimensions yet — add the first one (usually the account itself).</td></tr>
            )}
          </tbody>
        </table>
        <div style={{ marginTop: 14 }}>
          <button className="btn" onClick={addDimension} disabled={parts.length >= data.extAccountValues.length}>
            <Icon name="plus" size={14} /> Add dimension
          </button>
        </div>
      </div>
    </div>
  );
}
