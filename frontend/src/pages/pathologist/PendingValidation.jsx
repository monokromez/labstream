import { useState } from 'react'
import TablePagination from '../../components/data/TablePagination.jsx'
import { apiRequest } from '../../lib/api.js'
import PathologistSummary from './PathologistSummary.jsx'
import {
  formatPathologistDate,
  getReferenceRange,
  getResultValue,
  usePathologistWorklist,
} from './usePathologistData.js'
import './PendingValidation.css'
import { resultValueForDisplay } from '../../utils/resultValue.js'

const PAGE_SIZE = 10

export default function PendingValidation() {
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [remarks, setRemarks] = useState('')
  const [interpretations, setInterpretations] = useState({})
  const [recollectionItems, setRecollectionItems] = useState([])
  const [notice, setNotice] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [refreshKey, setRefreshKey] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const { items, total, loading, error } = usePathologistWorklist('pending', query, currentPage, refreshKey)
  const selectedCase = items.find((item) => item.id === selectedId) ?? items[0]

  async function completeReview(decision) {
    if (!selectedCase || isSaving) return
    if (decision === 'returned' && !remarks.trim()) {
      setNotice('Add a remark before returning this result for correction.')
      return
    }

    setIsSaving(true)
    setNotice('')
    try {
      await apiRequest(`/api/pathologist/requests/${selectedCase.id}/review`, {
        method: 'POST',
        body: JSON.stringify({ decision, comments: remarks }),
      })
      setNotice(`${selectedCase.requestNumber} was ${decision === 'approved' ? 'approved and released' : 'returned for correction'}.`)
      setRemarks('')
      setSelectedId('')
      if (currentPage > 1 && items.length === 1) setCurrentPage((current) => current - 1)
      setRefreshKey((current) => current + 1)
    } catch (reviewError) {
      setNotice(reviewError.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="admin-page pathologist-page" aria-label="Pending validation worklist">
      <PathologistSummary refreshKey={refreshKey} />
      {notice && <p className="pathologist-page__notice" role="status">{notice}</p>}
      {error && <p className="pathologist-page__notice pathologist-page__notice--error" role="alert">{error}</p>}

      <section className="admin-panel pathologist-panel" aria-labelledby="pending-list-title">
        <div className="admin-panel__heading">
          <div><h2 id="pending-list-title">Results awaiting review</h2><p>Check patient details and result values before approving or returning.</p></div>
          <label className="admin-toolbar__field admin-toolbar__field--search">Search pending results<input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setCurrentPage(1); setSelectedId('') }} placeholder="Patient or request number" /></label>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th scope="col">Request / Patient</th><th scope="col">Tests</th><th scope="col">Submitted</th><th scope="col"><span className="visually-hidden">Review</span></th></tr></thead>
            <tbody>
              {items.map((item) => <tr key={item.id} className={selectedCase?.id === item.id ? 'is-selected' : ''}>
                <td><button className="admin-table__primary pathologist-table__patient" type="button" onClick={() => { setSelectedId(item.id); setRemarks(''); setNotice('') }}>{item.patient.name}<span className="admin-table__secondary">{item.requestNumber} · {item.patient.pid}</span></button></td>
                <td>{item.results.map((result) => result.testName).join(', ')}</td>
                <td>{formatPathologistDate(item.submittedAt)}</td>
                <td><button className="admin-button admin-button--secondary admin-button--small" type="button" onClick={() => { setSelectedId(item.id); setRemarks(''); setNotice('') }}>Review <span aria-hidden="true">→</span></button></td>
              </tr>)}
              {!loading && items.length === 0 && <tr><td className="admin-empty" colSpan="4">{error ? 'The worklist could not be loaded.' : 'No pending results match your search.'}</td></tr>}
              {loading && <tr><td className="admin-empty" colSpan="4">Loading validation worklist…</td></tr>}
            </tbody>
          </table>
          <TablePagination currentPage={currentPage} pageSize={PAGE_SIZE} totalItems={total} onPageChange={setCurrentPage} />
        </div>
        <div className="pathologist-table-scroll"><table className="admin-table pathologist-list-table">
          <thead><tr><th scope="col">Request</th><th scope="col">Patient</th><th scope="col">Test</th><th scope="col">Submitted</th><th scope="col">Priority</th><th scope="col"><span className="visually-hidden">Review action</span></th></tr></thead>
          <tbody>{visibleCases.map((item) => <tr key={item.id}>
            <td className="admin-table__primary">{item.id}</td><td>{item.patient}</td><td>{item.test}</td><td>{item.submitted}</td>
            <td><span className={`admin-badge ${item.priority === 'Urgent' ? 'admin-badge--warning' : 'admin-badge--muted'}`}>{item.priority}</span></td>
            <td><button className="admin-button admin-button--positive admin-button--small" type="button" onClick={() => openReview(item)}>Review <span aria-hidden="true">→</span></button></td>
          </tr>)}
          {visibleCases.length === 0 && <tr><td className="admin-empty" colSpan="6">{result ? 'No pending results match your filters.' : 'Loading pending results…'}</td></tr>}</tbody>
        </table></div>
        <TablePagination currentPage={currentPage} pageSize={pageSize} totalItems={filteredCases.length} onPageChange={setCurrentPage} />
      </section>

      {selectedCase && <section className="admin-panel pathologist-review" aria-labelledby="review-title">
        <div className="pathologist-review__top"><div><span className="pathologist-eyebrow">Selected case · {selectedCase.requestNumber}</span><h2 id="review-title">{selectedCase.patient.name}</h2><p>{selectedCase.patient.pid} <span aria-hidden="true">·</span> {selectedCase.results.map((result) => result.testName).join(', ')}</p></div><span className="pathologist-review__submitted">Submitted {formatPathologistDate(selectedCase.submittedAt)}</span></div>
        <div className="pathologist-review__content">
          <div className="pathologist-review__results"><h3>Result values</h3><div className="admin-table-wrap"><table className="admin-table pathologist-table--results"><thead><tr><th scope="col">Test</th><th scope="col">Result</th><th scope="col">Reference range</th><th scope="col">Review</th></tr></thead><tbody>{selectedCase.results.map((result) => <tr key={result.requestItemId}><td>{result.testName}</td><td className="pathologist-result-value">{getResultValue(result)}</td><td>{getReferenceRange(result)}</td><td><span className={`admin-badge ${result.abnormal ? 'admin-badge--warning' : 'admin-badge--success'}`}>{result.abnormal ? 'Abnormal' : 'Within range'}</span></td></tr>)}</tbody></table></div></div>
          <form className="pathologist-review__form" onSubmit={(event) => { event.preventDefault(); completeReview('approved') }}>
            <label htmlFor="pathologist-remarks">Pathologist remarks <span>Optional for approval</span></label>
            <textarea id="pathologist-remarks" value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder="Add an interpretation or instructions for the technologist…" rows="4" maxLength="2000" />
            <div className="pathologist-review__actions"><button className="admin-button admin-button--secondary pathologist-button--return" type="button" disabled={isSaving} onClick={() => completeReview('returned')}>Return for correction</button><button className="admin-button" type="submit" disabled={isSaving}>{isSaving ? 'Saving…' : 'Approve result'} <span aria-hidden="true">→</span></button></div>
            <p className="pathologist-review__hint">Approval releases all results in this request to the patient portal.</p>
          </form>
        </div>
      </section>}
      {!loading && !error && total === 0 && <div className="admin-panel pathologist-all-done"><span aria-hidden="true">✓</span><div><strong>Worklist clear</strong><p>There are no results awaiting validation.</p></div></div>}
    </section>
  )
}
