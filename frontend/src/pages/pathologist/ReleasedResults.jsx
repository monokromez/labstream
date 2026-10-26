import { useMemo, useState } from 'react'
import SearchInput from '../../components/data/SearchInput.jsx'
import AdminDialog from '../../components/data/AdminDialog.jsx'
import SummaryCard from '../../components/reports/SummaryCard.jsx'
import TablePagination from '../../components/data/TablePagination.jsx'
import PathologistResultTable from './PathologistResultTable.jsx'
import { api } from '../../api/client.js'
import useApiResource from '../../api/useApiResource.js'
import useTestCatalog from '../../data/useTestCatalog.js'
import { formatDateTime } from '../../utils/dateFormat.js'
import './ReleasedResults.css'
import { resultValueForDisplay } from '../../utils/resultValue.js'

export default function ReleasedResults() {
  const [query, setQuery] = useState('')
  const [testFilter, setTestFilter] = useState('All tests')
  const [priorityFilter, setPriorityFilter] = useState('All priorities')
  const [activeRequest, setActiveRequest] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10
  const { result, error } = useApiResource(() => api.pathologist.released({ page: 1, pageSize: 100 }), [])
  const myReleased = (result?.data ?? []).map((request) => {
    const tests = (request.tests ?? []).map((test) => ({ ...test, testName: test.testName, results: (test.values ?? []).map((value) => ({ name: `${test.testName} · ${value.label}`, value: Array.isArray(value.structuredValue) ? null : resultValueForDisplay(value), structuredValue: value.structuredValue, range: value.lowerLimit != null || value.upperLimit != null ? `${value.lowerLimit ?? '—'} – ${value.upperLimit ?? '—'}` : '—', flag: value.isAbnormal ? 'Abnormal' : '' })) }))
    return { ...request, id: request.requestNumber, patient: request.patientName, priority: request.priority.replace(/\b\w/g, (char) => char.toUpperCase()), test: tests.map((test) => test.testName).join(', '), released: formatDateTime(request.releasedAt), technologist: request.technologist, results: tests.flatMap((test) => test.results), remarks: tests.map((test) => test.pathologistInterpretation).filter(Boolean).join('; ') }
  })
  const { catalog } = useTestCatalog({ availableOnly: true })
  const testOptions = [...new Set(catalog.tests.map((test) => test.name))].sort()
  const filtered = useMemo(() => myReleased.filter((item) => {
    const matchesSearch = `${item.id} ${item.patient} ${item.test}`.toLowerCase().includes(query.toLowerCase())
    return matchesSearch && (testFilter === 'All tests' || item.test.split(', ').includes(testFilter))
      && (priorityFilter === 'All priorities' || item.priority === priorityFilter)
  }), [myReleased, priorityFilter, query, testFilter])
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <section className="admin-page pathologist-page" aria-label="Released results">
      {error && <p role="alert">{error}</p>}
      <div className="admin-dashboard__summary"><SummaryCard title="Released today" value="00" helperText="Approved and available to patients" /><SummaryCard title="Released this week" value="00" helperText="Across all test types" /><SummaryCard title="Latest release" value="—" helperText="No results released yet" /><SummaryCard title="Reviewed today" value="00" helperText="Across all result types" /></div>

      <section className="pathologist-list" aria-label="Released results">
        <div className="pathologist-list__heading"><div><h2>Released Results</h2><p>Results you validated and released to patients.</p></div><span className="pathologist-list__count">{filtered.length} {filtered.length === 1 ? 'result' : 'results'}</span></div>
        <hr className="pathologist-list__divider" />
        <div className="pathologist-toolbar">
          <SearchInput className="pathologist-toolbar__search" label="Search released results" value={query} onChange={(event) => { setQuery(event.target.value); setCurrentPage(1) }} placeholder="Patient or request number" />
          <label className="pathologist-filter">Test<select value={testFilter} onChange={(event) => { setTestFilter(event.target.value); setCurrentPage(1) }}><option>All tests</option>{testOptions.map((test) => <option key={test}>{test}</option>)}</select></label>
          <label className="pathologist-filter">Priority<select value={priorityFilter} onChange={(event) => { setPriorityFilter(event.target.value); setCurrentPage(1) }}><option>All priorities</option><option>Routine</option><option>Urgent</option></select></label>
        </div>
        <div className="pathologist-table-scroll"><table className="admin-table pathologist-list-table">
          <thead><tr><th scope="col">Request</th><th scope="col">Patient</th><th scope="col">Test</th><th scope="col">Released</th><th scope="col">Priority</th><th scope="col">Technologist</th><th scope="col"><span className="visually-hidden">Request details</span></th></tr></thead>
          <tbody>{visible.map((item) => <tr key={item.id}>
            <td className="admin-table__primary">{item.id}</td><td>{item.patient}</td><td>{item.test}</td><td>{item.released}</td>
            <td><span className={`admin-badge ${item.priority === 'Urgent' ? 'admin-badge--warning' : 'admin-badge--muted'}`}>{item.priority}</span></td><td>{item.technologist}</td>
            <td><button className="admin-button admin-button--positive admin-button--small" type="button" onClick={() => setActiveRequest(item)}>View Request <span aria-hidden="true">→</span></button></td>
          </tr>)}
          {visible.length === 0 && <tr><td className="admin-empty" colSpan="7">{result ? 'No released results match your filters.' : 'Loading released results…'}</td></tr>}</tbody>
        </table></div>
        <TablePagination currentPage={currentPage} pageSize={pageSize} totalItems={filtered.length} onPageChange={setCurrentPage} />
      </section>

      {activeRequest && <AdminDialog className="pathologist-dialog" title="Released request details" description="Request information and result values currently available to the patient." onClose={() => setActiveRequest(null)} size="large" footer={<button className="admin-button" type="button" onClick={() => setActiveRequest(null)}>Done</button>}>
        <div className="pathologist-dialog__details"><div><span>Request</span><strong>{activeRequest.id}</strong></div><div><span>Patient</span><strong>{activeRequest.patient}</strong></div><div><span>Test</span><strong>{activeRequest.test}</strong></div><div><span>Released</span><strong>{activeRequest.released}</strong></div><div><span>Priority</span><strong>{activeRequest.priority}</strong></div><div><span>Technologist</span><strong>{activeRequest.technologist}</strong></div><div><span>Availability</span><strong>Released to patient portal</strong></div></div>
        <PathologistResultTable results={activeRequest.results} title="Released result values" />
        <div className="pathologist-dialog__note"><h3>Pathologist remarks</h3><p>{activeRequest.remarks}</p></div>
      </AdminDialog>}
    </section>
  )
}
