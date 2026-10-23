import { useEffect, useMemo, useState } from 'react'
import SearchInput from '../../components/data/SearchInput.jsx'
import AdminDialog from '../../components/data/AdminDialog.jsx'
import SummaryCard from '../../components/reports/SummaryCard.jsx'
import TablePagination from '../../components/data/TablePagination.jsx'
import PathologistResultTable from './PathologistResultTable.jsx'
import { readCatalog, subscribeCatalog } from '../../data/administratorCatalog.js'
import './ReturnedResults.css'

const returned = [
  { id: 'REQ-2026-0137', patient: 'Lara Villanueva', test: 'Complete Blood Count (CBC)', date: '10/23/2026 08:42 AM', priority: 'Routine', reason: 'Please verify the platelet count and repeat the manual differential.', results: [{ name: 'Hemoglobin', value: '12.4 g/dL', range: '12.0–16.0', flag: '' }, { name: 'Platelets', value: '118 ×10⁹/L', range: '150–400', flag: 'Low' }] },
  { id: 'REQ-2026-0129', patient: 'Paolo Garcia', test: 'Urinalysis', date: '10/22/2026 04:16 PM', priority: 'Urgent', reason: 'Please confirm the specimen notes and review the reported protein value.', results: [{ name: 'Protein', value: '2+', range: 'Negative', flag: 'High' }, { name: 'Glucose', value: 'Negative', range: 'Negative', flag: '' }] },
  { id: 'REQ-2026-0124', patient: 'Ava Ramos', test: 'Fasting Blood Sugar', date: '10/22/2026 02:08 PM', priority: 'Routine', reason: 'Result is missing the collection time. Please complete and resubmit.', results: [{ name: 'Glucose', value: '104 mg/dL', range: '70–99', flag: 'High' }] },
]

export default function ReturnedResults() {
  const [query, setQuery] = useState('')
  const [testFilter, setTestFilter] = useState('All tests')
  const [priorityFilter, setPriorityFilter] = useState('All priorities')
  const [activeResult, setActiveResult] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [catalog, setCatalog] = useState(readCatalog)
  const pageSize = 10
  useEffect(() => subscribeCatalog(() => setCatalog(readCatalog())), [])
  const testOptions = [...new Set(catalog.tests.filter((test) => test.availability === 'Available').map((test) => test.name))].sort()

  const filtered = useMemo(() => returned.filter((item) => {
    const matchesSearch = `${item.id} ${item.patient} ${item.test}`.toLowerCase().includes(query.toLowerCase())
    return matchesSearch && (testFilter === 'All tests' || item.test === testFilter)
      && (priorityFilter === 'All priorities' || item.priority === priorityFilter)
  }), [priorityFilter, query, testFilter])
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <section className="admin-page pathologist-page" aria-label="Returned results">
      <div className="admin-dashboard__summary"><SummaryCard title="Returned for correction" value={String(returned.length).padStart(2, '0')} helperText="Awaiting technologist updates" /><SummaryCard title="Resubmitted today" value="03" helperText="Ready for another review" /><SummaryCard title="Reviewed today" value="12" helperText="Across all result types" /><SummaryCard title="Urgent reviews" value={String(returned.filter((item) => item.priority === 'Urgent').length).padStart(2, '0')} helperText="Prioritize these cases" /></div>

      <section className="pathologist-list" aria-labelledby="returned-title">
        <div className="pathologist-list__heading"><div><h2 id="returned-title">For Review</h2><p>Review results returned to the technologist and check their correction status.</p></div><span className="pathologist-list__count">{filtered.length} {filtered.length === 1 ? 'result' : 'results'}</span></div>
        <hr className="pathologist-list__divider" />
        <div className="pathologist-toolbar">
          <SearchInput className="pathologist-toolbar__search" label="Search returned results" value={query} onChange={(event) => { setQuery(event.target.value); setCurrentPage(1) }} placeholder="Patient or request number" />
          <label className="pathologist-filter">Test<select value={testFilter} onChange={(event) => { setTestFilter(event.target.value); setCurrentPage(1) }}><option>All tests</option>{testOptions.map((test) => <option key={test}>{test}</option>)}</select></label>
          <label className="pathologist-filter">Priority<select value={priorityFilter} onChange={(event) => { setPriorityFilter(event.target.value); setCurrentPage(1) }}><option>All priorities</option><option>Routine</option><option>Urgent</option></select></label>
        </div>
        <div className="pathologist-table-scroll"><table className="admin-table pathologist-list-table">
          <thead><tr><th scope="col">Request</th><th scope="col">Patient</th><th scope="col">Test</th><th scope="col">Returned</th><th scope="col">Priority</th><th scope="col"><span className="visually-hidden">Result action</span></th></tr></thead>
          <tbody>{visible.map((item) => <tr key={item.id}>
            <td className="admin-table__primary">{item.id}</td><td>{item.patient}</td><td>{item.test}</td><td>{item.date}</td>
            <td><span className={`admin-badge ${item.priority === 'Urgent' ? 'admin-badge--warning' : 'admin-badge--muted'}`}>{item.priority}</span></td>
            <td><button className="admin-button admin-button--positive admin-button--small" type="button" onClick={() => setActiveResult(item)}>View Results <span aria-hidden="true">→</span></button></td>
          </tr>)}
          {visible.length === 0 && <tr><td className="admin-empty" colSpan="6">No returned results match your filters.</td></tr>}</tbody>
        </table></div>
        <TablePagination currentPage={currentPage} pageSize={pageSize} totalItems={filtered.length} onPageChange={setCurrentPage} />
      </section>

      {activeResult && <AdminDialog className="pathologist-dialog" title="Returned test results" description="Review the reported values and the note that was sent to the technologist." onClose={() => setActiveResult(null)} size="large" footer={<button className="admin-button" type="button" onClick={() => setActiveResult(null)}>Done</button>}>
        <div className="pathologist-dialog__details"><div><span>Request</span><strong>{activeResult.id}</strong></div><div><span>Patient</span><strong>{activeResult.patient}</strong></div><div><span>Test</span><strong>{activeResult.test}</strong></div><div><span>Returned</span><strong>{activeResult.date}</strong></div><div><span>Priority</span><strong>{activeResult.priority}</strong></div><div><span>Status</span><strong>Awaiting technologist correction</strong></div></div>
        <div className="pathologist-dialog__note"><h3>Previous review note</h3><p>{activeResult.reason}</p></div>
        <PathologistResultTable results={activeResult.results} />
      </AdminDialog>}
    </section>
  )
}
