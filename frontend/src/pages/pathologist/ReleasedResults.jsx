import { useState } from 'react'
import TablePagination from '../../components/data/TablePagination.jsx'
import PathologistSummary from './PathologistSummary.jsx'
import { formatPathologistDate, usePathologistWorklist } from './usePathologistData.js'
import './ReleasedResults.css'

const PAGE_SIZE = 10

export default function ReleasedResults() {
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const { items, total, loading, error } = usePathologistWorklist('released', query, currentPage)
  const selectedCase = items.find((item) => item.id === selectedId) ?? items[0]

  return (
    <section className="admin-page pathologist-page" aria-label="Released results">
      <PathologistSummary />
      {error && <p className="pathologist-page__notice pathologist-page__notice--error" role="alert">{error}</p>}
      <section className="admin-panel pathologist-panel" aria-labelledby="released-title">
        <div className="admin-panel__heading"><div><h2 id="released-title">Patient results released</h2><p>Approved results are now available in each patient’s portal.</p></div><label className="admin-toolbar__field admin-toolbar__field--search">Search released results<input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setCurrentPage(1); setSelectedId('') }} placeholder="Patient or request number" /></label></div>
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th scope="col">Request / Patient</th><th scope="col">Tests</th><th scope="col">Released</th><th scope="col">Validated by</th><th scope="col"><span className="visually-hidden">Availability</span></th></tr></thead><tbody>
          {items.map((item) => <tr key={item.id} className={selectedCase?.id === item.id ? 'is-selected' : ''}><td><button className="admin-table__primary pathologist-table__patient" type="button" onClick={() => setSelectedId(item.id)}>{item.patient.name}<span className="admin-table__secondary">{item.requestNumber} · {item.patient.pid}</span></button></td><td>{item.results.map((result) => result.testName).join(', ')}</td><td>{formatPathologistDate(item.releasedAt)}</td><td>{item.latestReview?.reviewedBy || '—'}</td><td><span className="admin-badge admin-badge--success">Released</span></td></tr>)}
          {!loading && items.length === 0 && <tr><td className="admin-empty" colSpan="5">{error ? 'Released results could not be loaded.' : 'No released results match your search.'}</td></tr>}
          {loading && <tr><td className="admin-empty" colSpan="5">Loading released results…</td></tr>}
        </tbody></table><TablePagination currentPage={currentPage} pageSize={PAGE_SIZE} totalItems={total} onPageChange={setCurrentPage} /></div>
      </section>
      {selectedCase && <section className="admin-panel pathologist-feedback pathologist-feedback--released" aria-live="polite"><div className="pathologist-feedback__icon" aria-hidden="true">✓</div><div><span className="pathologist-eyebrow">Release record · {selectedCase.requestNumber}</span><h2>{selectedCase.patient.name} <span>· {selectedCase.results.map((result) => result.testName).join(', ')}</span></h2><p>{selectedCase.latestReview?.comments || 'Result approved and released to the patient portal.'}</p><small>Validated by {selectedCase.latestReview?.reviewedBy || 'Pathologist'} · {formatPathologistDate(selectedCase.releasedAt)}</small></div><span className="admin-badge admin-badge--success">Patient copy available</span></section>}
    </section>
  )
}
