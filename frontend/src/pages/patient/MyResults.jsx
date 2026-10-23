import { useMemo, useState } from 'react'
import AdminDialog from '../../components/data/AdminDialog.jsx'
import SummaryCard from '../../components/reports/SummaryCard.jsx'
import TablePagination from '../../components/data/TablePagination.jsx'
import './MyResults.css'

const requests = [
  { id: 'REQ-2026-0134', requested: '10/22/2026', released: '10/23/2026', status: 'Released', validatedBy: 'Dr. A. Santos', tests: [{ name: 'Lipid Profile', results: [['Total cholesterol', '186 mg/dL', 'Within range'], ['LDL cholesterol', '116 mg/dL', 'High'], ['HDL cholesterol', '52 mg/dL', 'Within range']] }, { name: 'Fasting Blood Sugar', results: [['Glucose', '92 mg/dL', 'Within range']] }], remarks: 'Please discuss these results with your healthcare provider.' },
  { id: 'REQ-2026-0122', requested: '10/21/2026', released: '10/22/2026', status: 'Released', validatedBy: 'Dr. M. Reyes', tests: [{ name: 'Urinalysis', results: [['Protein', 'Negative', 'Within range'], ['Glucose', 'Negative', 'Within range']] }], remarks: 'Results reviewed.' },
  { id: 'REQ-2026-0118', requested: '10/18/2026', released: null, status: 'Processing', validatedBy: null, tests: [{ name: 'Complete Blood Count', results: [] }, { name: 'Creatinine', results: [] }], remarks: '' },
]

export default function MyResults() {
  const [selected, setSelected] = useState(null)
  const [page, setPage] = useState(1)
  const releasedCount = requests.filter((request) => request.status === 'Released').reduce((sum, request) => sum + request.tests.length, 0)
  const unreleasedCount = requests.filter((request) => request.status !== 'Released').reduce((sum, request) => sum + request.tests.length, 0)
  const rows = useMemo(() => requests.slice((page - 1) * 10, page * 10), [page])

  return (
    <section className="patient-records" aria-label="My test results">
      <div className="patient-records__summary">
        <SummaryCard title="Released results" value={String(releasedCount).padStart(2, '0')} helperText="Individual tests available to view" />
        <SummaryCard title="Unreleased results" value={String(unreleasedCount).padStart(2, '0')} helperText="Tests still being processed or reviewed" />
        <SummaryCard title="Total tests" value={String(releasedCount + unreleasedCount).padStart(2, '0')} helperText="Tests across your registered requests" />
      </div>
      <section className="patient-records__table-card" aria-labelledby="patient-results-title">
        <header className="patient-records__heading"><div><h2 id="patient-results-title">My Results</h2><p>Each row represents one request. Released requests include all of their test results.</p></div><span>{requests.length} {requests.length === 1 ? 'request' : 'requests'}</span></header>
        <div className="patient-records__scroll"><table className="patient-records__table"><thead><tr><th>Request</th><th>Requested</th><th>Tests</th><th>Availability</th><th>Action</th></tr></thead><tbody>
          {rows.map((item) => <tr key={item.id}><td className="patient-records__primary">{item.id}</td><td>{item.requested}</td><td>{item.tests.map((test) => test.name).join(', ')}</td><td><span className={`patient-records__status${item.status === 'Released' ? '' : ' patient-records__status--processing'}`}>{item.status}</span></td><td>{item.status === 'Released' ? <button className="patient-records__button" type="button" onClick={() => setSelected(item)}>View results</button> : <span className="patient-records__unavailable">Not available yet</span>}</td></tr>)}
        </tbody></table></div>
        <TablePagination currentPage={page} pageSize={10} totalItems={requests.length} onPageChange={setPage} />
      </section>
      <p className="patient-records__prototype-note">Demonstration records only. A signed-in patient will see requests linked to their account.</p>
      {selected && <AdminDialog title="Request results" description={`${selected.id} · Released ${selected.released}`} onClose={() => setSelected(null)} size="large" footer={<button className="admin-button" type="button" onClick={() => setSelected(null)}>Done</button>}>
        <p className="patient-records__validated">Validated by <strong>{selected.validatedBy}</strong></p>
        {selected.tests.map((test) => <section className="patient-records__request-test" key={test.name}><h3>{test.name}</h3><div className="patient-records__result-list">{test.results.map(([name, value, interpretation]) => <div key={name}><span>{name}</span><strong>{value}</strong><small>{interpretation}</small></div>)}</div></section>)}
        <section className="patient-records__remarks"><h3>Laboratory remarks</h3><p>{selected.remarks || 'No additional remarks.'}</p></section>
      </AdminDialog>}
    </section>
  )
}
