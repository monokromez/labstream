import { useMemo, useState } from 'react'
import SearchInput from '../../components/data/SearchInput.jsx'
import AdminDialog from '../../components/data/AdminDialog.jsx'
import SummaryCard from '../../components/reports/SummaryCard.jsx'
import TablePagination from '../../components/data/TablePagination.jsx'
import PathologistResultTable from './PathologistResultTable.jsx'
import './ReleasedResults.css'

const released = [
  { id: 'REQ-2026-0134', patient: 'Gabriel Dizon', test: 'Lipid Profile', priority: 'Routine', released: '10/23/2026 09:12 AM', approvedBy: 'Dr. A. Santos', remarks: 'Values reviewed. Maintain current diet and follow up with your physician.', results: [{ name: 'Total cholesterol', value: '186 mg/dL', range: '< 200', flag: '' }, { name: 'LDL cholesterol', value: '116 mg/dL', range: '< 100', flag: 'High' }, { name: 'HDL cholesterol', value: '52 mg/dL', range: '> 40', flag: '' }] },
  { id: 'REQ-2026-0131', patient: 'Sofia Bautista', test: 'Complete Blood Count', priority: 'Urgent', released: '10/23/2026 08:36 AM', approvedBy: 'Dr. A. Santos', remarks: 'Results reviewed.', results: [{ name: 'Hemoglobin', value: '13.4 g/dL', range: '12.0–16.0', flag: '' }, { name: 'WBC', value: '6.8 ×10⁹/L', range: '4.0–11.0', flag: '' }] },
  { id: 'REQ-2026-0128', patient: 'Ethan Flores', test: 'Fasting Blood Sugar', priority: 'Routine', released: '10/22/2026 03:50 PM', approvedBy: 'Dr. M. Reyes', remarks: 'Please discuss this result with your attending physician.', results: [{ name: 'Glucose', value: '112 mg/dL', range: '70–99', flag: 'High' }] },
  { id: 'REQ-2026-0122', patient: 'Isabel Co', test: 'Urinalysis', priority: 'Routine', released: '10/22/2026 01:27 PM', approvedBy: 'Dr. M. Reyes', remarks: 'Results reviewed.', results: [{ name: 'Protein', value: 'Negative', range: 'Negative', flag: '' }, { name: 'Glucose', value: 'Negative', range: 'Negative', flag: '' }] },
]
const testOptions = [...new Set(released.map((item) => item.test))]

export default function ReleasedResults() {
  const [query, setQuery] = useState('')
  const [testFilter, setTestFilter] = useState('All tests')
  const [priorityFilter, setPriorityFilter] = useState('All priorities')
  const [activeRequest, setActiveRequest] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const filtered = useMemo(() => released.filter((item) => {
    const matchesSearch = `${item.id} ${item.patient} ${item.test}`.toLowerCase().includes(query.toLowerCase())
    return matchesSearch && (testFilter === 'All tests' || item.test === testFilter)
      && (priorityFilter === 'All priorities' || item.priority === priorityFilter)
  }), [priorityFilter, query, testFilter])
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <section className="admin-page pathologist-page" aria-label="Released results">
      <div className="admin-dashboard__summary"><SummaryCard title="Released today" value="08" helperText="Approved and available to patients" /><SummaryCard title="Released this week" value="42" helperText="Across all test types" /><SummaryCard title="Latest release" value="9:12 AM" helperText="Today · Lipid Profile" /><SummaryCard title="Reviewed today" value="12" helperText="Across all result types" /></div>

      <section className="pathologist-list" aria-label="Released results">
        <hr className="pathologist-list__divider" />
        <div className="pathologist-toolbar">
          <SearchInput className="pathologist-toolbar__search" label="Search released results" value={query} onChange={(event) => { setQuery(event.target.value); setCurrentPage(1) }} placeholder="Patient or request number" />
          <label className="pathologist-filter">Test<select value={testFilter} onChange={(event) => { setTestFilter(event.target.value); setCurrentPage(1) }}><option>All tests</option>{testOptions.map((test) => <option key={test}>{test}</option>)}</select></label>
          <label className="pathologist-filter">Priority<select value={priorityFilter} onChange={(event) => { setPriorityFilter(event.target.value); setCurrentPage(1) }}><option>All priorities</option><option>Routine</option><option>Urgent</option></select></label>
        </div>
        <div className="pathologist-table-scroll"><table className="admin-table pathologist-list-table">
          <thead><tr><th scope="col">Request</th><th scope="col">Patient</th><th scope="col">Test</th><th scope="col">Released</th><th scope="col">Priority</th><th scope="col">Validated by</th><th scope="col"><span className="visually-hidden">Request details</span></th></tr></thead>
          <tbody>{visible.map((item) => <tr key={item.id}>
            <td className="admin-table__primary">{item.id}</td><td>{item.patient}</td><td>{item.test}</td><td>{item.released}</td>
            <td><span className={`admin-badge ${item.priority === 'Urgent' ? 'admin-badge--warning' : 'admin-badge--muted'}`}>{item.priority}</span></td><td>{item.approvedBy}</td>
            <td><button className="admin-button admin-button--positive admin-button--small" type="button" onClick={() => setActiveRequest(item)}>View Request <span aria-hidden="true">→</span></button></td>
          </tr>)}
          {visible.length === 0 && <tr><td className="admin-empty" colSpan="7">No released results match your filters.</td></tr>}</tbody>
        </table></div>
        <TablePagination currentPage={currentPage} pageSize={pageSize} totalItems={filtered.length} onPageChange={setCurrentPage} />
      </section>

      {activeRequest && <AdminDialog className="pathologist-dialog" title="Released request details" description="Request information and result values currently available to the patient." onClose={() => setActiveRequest(null)} size="large" footer={<button className="admin-button" type="button" onClick={() => setActiveRequest(null)}>Done</button>}>
        <div className="pathologist-dialog__details"><div><span>Request</span><strong>{activeRequest.id}</strong></div><div><span>Patient</span><strong>{activeRequest.patient}</strong></div><div><span>Test</span><strong>{activeRequest.test}</strong></div><div><span>Released</span><strong>{activeRequest.released}</strong></div><div><span>Priority</span><strong>{activeRequest.priority}</strong></div><div><span>Validated by</span><strong>{activeRequest.approvedBy}</strong></div><div><span>Availability</span><strong>Released to patient portal</strong></div></div>
        <PathologistResultTable results={activeRequest.results} title="Released result values" />
        <div className="pathologist-dialog__note"><h3>Pathologist remarks</h3><p>{activeRequest.remarks}</p></div>
      </AdminDialog>}
    </section>
  )
}
