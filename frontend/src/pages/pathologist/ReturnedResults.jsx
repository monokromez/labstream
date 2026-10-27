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
import './ReturnedResults.css'
import { resultValueForDisplay } from '../../utils/resultValue.js'

export default function ReturnedResults() {
  const [query, setQuery] = useState('')
  const [testFilter, setTestFilter] = useState('All tests')
  const [priorityFilter, setPriorityFilter] = useState('All priorities')
  const [activeResult, setActiveResult] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10
  const { result, error } = useApiResource(() => api.pathologist.returned({ page: 1, pageSize: 100 }), [])
  const returned = (result?.data ?? []).map((request) => {
    const tests = (request.tests ?? []).map((test) => ({ ...test, testName: test.testName, results: (test.values ?? []).map((value) => ({ specimenType: value.specimenType, specimenAttempt: value.specimenAttempt, name: `${test.testName} · ${value.label}`, value: Array.isArray(value.structuredValue) ? null : resultValueForDisplay(value), structuredValue: value.structuredValue, range: value.lowerLimit != null || value.upperLimit != null ? `${value.lowerLimit ?? '—'} – ${value.upperLimit ?? '—'}` : '—', flag: value.isAbnormal ? 'Abnormal' : '' })) }))
    return { ...request, id: request.requestNumber, patient: request.patientName, priority: request.priority.replace(/\b\w/g, (char) => char.toUpperCase()), test: tests.map((test) => test.testName).join(', '), date: formatDateTime(request.requestedAt), reason: tests.map((test) => test.reviewRemarks).filter(Boolean).join('; '), results: tests.flatMap((test) => test.results) }
  })
  const { catalog } = useTestCatalog({ availableOnly: true })
  const testOptions = [...new Set(catalog.tests.map((test) => test.name))].sort()

  const filtered = useMemo(() => returned.filter((item) => {
    const matchesSearch = `${item.id} ${item.patient} ${item.test}`.toLowerCase().includes(query.toLowerCase())
    return matchesSearch && (testFilter === 'All tests' || item.test.split(', ').includes(testFilter))
      && (priorityFilter === 'All priorities' || item.priority === priorityFilter)
  }), [returned, priorityFilter, query, testFilter])
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <section className="admin-page pathologist-page" aria-label="Returned results">
      {error && <p role="alert">{error}</p>}
      <div className="admin-dashboard__summary"><SummaryCard title="Returned for correction" value={String(returned.length).padStart(2, '0')} helperText="Awaiting technologist updates" /><SummaryCard title="Resubmitted today" value="00" helperText="Ready for another review" /><SummaryCard title="Reviewed today" value="00" helperText="Across all result types" /><SummaryCard title="Urgent reviews" value={String(returned.filter((item) => item.priority === 'Urgent').length).padStart(2, '0')} helperText="Prioritize these cases" /></div>

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
          {visible.length === 0 && <tr><td className="admin-empty" colSpan="6">{result ? 'No returned results match your filters.' : 'Loading returned results…'}</td></tr>}</tbody>
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
