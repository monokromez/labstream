import { useState } from 'react'
import TablePagination from '../../components/data/TablePagination.jsx'
import PathologistSummary from './PathologistSummary.jsx'
import { formatPathologistDate, usePathologistWorklist } from './usePathologistData.js'
import './ReturnedResults.css'
<<<<<<< HEAD

const PAGE_SIZE = 10
=======
>>>>>>> parent of c6490db (feat: add structured results and workflow improvements)

export default function ReturnedResults() {
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
<<<<<<< HEAD
  const { items, total, loading, error } = usePathologistWorklist('returned', query, currentPage)
  const selectedCase = items.find((item) => item.id === selectedId) ?? items[0]
=======
  const pageSize = 10
  const { result, error } = useApiResource(() => api.pathologist.returned({ page: 1, pageSize: 100 }), [])
  const returned = (result?.data ?? []).map((request) => {
    const tests = (request.tests ?? []).map((test) => ({ ...test, testName: test.testName, results: (test.values ?? []).map((value) => ({ name: `${test.testName} · ${value.label}`, value: [value.numericValue, value.textValue, value.selectValue, value.booleanValue].find((entry) => entry != null) ?? '—', range: value.lowerLimit != null || value.upperLimit != null ? `${value.lowerLimit ?? '—'} – ${value.upperLimit ?? '—'}` : '—', flag: value.isAbnormal ? 'Abnormal' : '' })) }))
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
>>>>>>> parent of c6490db (feat: add structured results and workflow improvements)

  return (
    <section className="admin-page pathologist-page" aria-label="Returned results">
      <PathologistSummary />
      {error && <p className="pathologist-page__notice pathologist-page__notice--error" role="alert">{error}</p>}
      <section className="admin-panel pathologist-panel" aria-labelledby="returned-title">
        <div className="admin-panel__heading"><div><h2 id="returned-title">Returned to technologist</h2><p>Review feedback and follow each result through resubmission.</p></div><label className="admin-toolbar__field admin-toolbar__field--search">Search returned results<input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setCurrentPage(1); setSelectedId('') }} placeholder="Patient or request number" /></label></div>
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th scope="col">Request / Patient</th><th scope="col">Tests</th><th scope="col">Returned</th><th scope="col">Status</th><th scope="col"><span className="visually-hidden">Details</span></th></tr></thead><tbody>
          {items.map((item) => <tr key={item.id} className={selectedCase?.id === item.id ? 'is-selected' : ''}><td><button className="admin-table__primary pathologist-table__patient" type="button" onClick={() => setSelectedId(item.id)}>{item.patient.name}<span className="admin-table__secondary">{item.requestNumber} · {item.patient.pid}</span></button></td><td>{item.results.map((result) => result.testName).join(', ')}</td><td>{formatPathologistDate(item.latestReview?.reviewedAt)}</td><td><span className="admin-badge admin-badge--warning">Returned</span></td><td><button className="admin-button admin-button--secondary admin-button--small" type="button" onClick={() => setSelectedId(item.id)}>View feedback <span aria-hidden="true">→</span></button></td></tr>)}
          {!loading && items.length === 0 && <tr><td className="admin-empty" colSpan="5">{error ? 'Returned results could not be loaded.' : 'No returned results match your search.'}</td></tr>}
          {loading && <tr><td className="admin-empty" colSpan="5">Loading returned results…</td></tr>}
        </tbody></table><TablePagination currentPage={currentPage} pageSize={PAGE_SIZE} totalItems={total} onPageChange={setCurrentPage} /></div>
      </section>
      {selectedCase && <section className="admin-panel pathologist-feedback" aria-live="polite"><div className="pathologist-feedback__icon" aria-hidden="true">↩</div><div><span className="pathologist-eyebrow">Feedback · {selectedCase.requestNumber}</span><h2>{selectedCase.patient.name} <span>· {selectedCase.results.map((result) => result.testName).join(', ')}</span></h2><p>{selectedCase.latestReview?.comments || 'No return comments were recorded.'}</p><small>Returned {formatPathologistDate(selectedCase.latestReview?.reviewedAt)} by {selectedCase.latestReview?.reviewedBy || 'Pathologist'}</small></div><span className="pathologist-feedback__awaiting">Awaiting correction</span></section>}
    </section>
  )
}
