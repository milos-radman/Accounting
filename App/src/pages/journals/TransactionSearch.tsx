import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useStore, formatAmount } from '../../store';
import { gliLabel } from '../../engine';
import { useDrill } from '../../components/trail';
import { Icon } from '../../components/Icon';
import { SearchCombo, makeColumnSearch } from '../../components/Combo';

// Transaction-level search across all journal lines. Also mounts inside a legal entity
// (/legal-entity/:id/transactions), scoped to that entity with the Legal-entity picker hidden.
export default function TransactionSearch() {
  const { data } = useStore();
  const drill = useDrill();
  const { id: scopedId } = useParams();
  const scoped = !!scopedId;
  const [entityId, setEntityId] = useState('');
  const [account, setAccount] = useState('');
  const [agreement, setAgreement] = useState('');
  const [agreementLine, setAgreementLine] = useState('');
  const [invoice, setInvoice] = useState('');
  const [customer, setCustomer] = useState('');
  const [supplier, setSupplier] = useState('');
  const [refNo, setRefNo] = useState('');
  const effEntityId = scoped ? scopedId! : entityId;

  // All lines for the selected entity — the pool the field suggestions and the results draw from.
  const entityLines = data.journals
    .filter(j => !effEntityId || j.legalEntityId === Number(effEntityId))
    .flatMap(j => j.lines.map(l => ({ journal: j, line: l })));

  // Search-as-you-type queries (stand-ins for backend endpoints). Agreement-line search follows the
  // agreement once one is picked, so a 10-line agreement suggests just its lines.
  const searchAccount = makeColumnSearch(() => entityLines.map(({ line }) => line.pseudoAccount), v => {
    const hit = entityLines.find(({ line }) => line.pseudoAccount === v);
    return hit?.line.description || undefined;
  });
  const searchAgreement = makeColumnSearch(() => entityLines.map(({ line }) => line.agreement));
  const searchInvoice = makeColumnSearch(() => entityLines.map(({ line }) => line.invoice));
  const searchLine = makeColumnSearch(() => entityLines
    .filter(({ line }) => !agreement || line.agreement === agreement)
    .map(({ line }) => line.agreementLine));
  const searchCustomer = makeColumnSearch(() => entityLines.map(({ line }) => line.customer));
  const searchSupplier = makeColumnSearch(() => entityLines.map(({ line }) => line.supplier));
  const searchRef = makeColumnSearch(() => entityLines.map(({ line }) => line.refNo));

  const rows = entityLines
    .filter(({ line }) => !account || line.pseudoAccount.toLowerCase().includes(account.toLowerCase()))
    .filter(({ line }) => !agreement || line.agreement.includes(agreement))
    .filter(({ line }) => !agreementLine || String(line.agreementLine ?? '') === agreementLine)
    .filter(({ line }) => !invoice || line.invoice.includes(invoice))
    .filter(({ line }) => !customer || (line.customer ?? '').toLowerCase().includes(customer.toLowerCase()))
    .filter(({ line }) => !supplier || (line.supplier ?? '').toLowerCase().includes(supplier.toLowerCase()))
    .filter(({ line }) => !refNo || (line.refNo ?? '').toLowerCase().includes(refNo.toLowerCase()))
    .slice(0, 200);

  return (
    <div className="card">
      <div className="pagelike-title">Transaction search</div>
      <div className="searchbar">
        {!scoped && (
          <div className="f">
            <label>Legal entity</label>
            <select value={entityId} onChange={e => setEntityId(e.target.value)}>
              <option value=""></option>
              {data.legalEntities.map(e => <option key={e.id} value={e.id}>{e.ownerCode}</option>)}
            </select>
          </div>
        )}
        <div className="f"><label>Pseudo account</label><SearchCombo value={account} onChange={setAccount} search={searchAccount} placeholder="type to search…" /></div>
        <div className="f"><label>Agreement</label><SearchCombo value={agreement} onChange={setAgreement} search={searchAgreement} placeholder="type to search…" /></div>
        <div className="f"><label>Agreement line</label><SearchCombo value={agreementLine} onChange={setAgreementLine} search={searchLine} placeholder="the asset / line" /></div>
        <div className="f"><label>Invoice</label><SearchCombo value={invoice} onChange={setInvoice} search={searchInvoice} placeholder="type to search…" /></div>
        <div className="f"><label>Customer</label><SearchCombo value={customer} onChange={setCustomer} search={searchCustomer} placeholder="type to search…" /></div>
        <div className="f"><label>Supplier</label><SearchCombo value={supplier} onChange={setSupplier} search={searchSupplier} placeholder="type to search…" /></div>
        <div className="f"><label>Reference</label><SearchCombo value={refNo} onChange={setRefNo} search={searchRef} placeholder="type to search…" /></div>
        <button className="btn primary" style={{ alignSelf: 'center' }}><Icon name="search" size={14} /> Search</button>
      </div>
      <div className="grid-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th>Journal</th>
              <th>Account</th>
              <th>Description</th>
              <th>Agreement</th>
              <th className="num">Line</th>
              <th>Invoice</th>
              <th>Customer / supplier</th>
              <th className="num">Debit</th>
              <th className="num">Credit</th>
              <th>Ledger</th>
              <th>Booking date</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ journal, line }, i) => (
              <tr key={i} className="clickable" onClick={() => drill(`/journals/gli/${journal.gliNumber}`, `Journal ${gliLabel(journal)}`)}>
                <td style={{ color: 'var(--purple)' }}>{gliLabel(journal)}</td>
                <td>{line.pseudoAccount}</td>
                <td>{line.description}</td>
                <td>{line.agreement}</td>
                <td className="num">{line.agreementLine ?? ''}</td>
                <td>{line.invoice}</td>
                <td>{line.customer || line.supplier || ''}</td>
                <td className="num">{formatAmount(line.debit)}</td>
                <td className="num">{formatAmount(line.credit)}</td>
                <td>{line.ledger}</td>
                <td>{journal.bookingDate}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={11} className="empty">No transactions match the search.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
