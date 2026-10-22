import { useMemo, useState } from 'react'
import SearchInput from '../../components/data/SearchInput.jsx'
import SummaryCard from '../../components/reports/SummaryCard.jsx'
import TablePagination from '../../components/data/TablePagination.jsx'
import './PendingValidation.css'

const initialCases = [
  { id: 'REQ-2026-0148', patient: 'Elena Cruz', pid: 'PID-002184', test: 'Complete Blood Count', received: 'Today, 10:42 AM', priority: 'Routine', enteredBy: 'A. Rivera', results: [{ name: 'Hemoglobin', value: '10.8 g/dL', range: '12.0–16.0', flag: 'Low' }, { name: 'WBC', value: '7.2 ×10⁹/L', range: '4.0–11.0', flag: '' }, { name: 'Platelets', value: '248 ×10⁹/L', range: '150–400', flag: '' }] },
  { id: 'REQ-2026-0146', patient: 'Rafael Mendoza', pid: 'PID-001906', test: 'Fasting Blood Sugar', received: 'Today, 10:18 AM', priority: 'Urgent', enteredBy: 'M. Flores', results: [{ name: 'Glucose', value: '142 mg/dL', range: '70–99', flag: 'High' }] },
  { id: 'REQ-2026-0142', patient: 'Mika Tan', pid: 'PID-002011', test: 'Urinalysis', received: 'Today, 9:54 AM', priority: 'Routine', enteredBy: 'A. Rivera', results: [{ name: 'Protein', value: 'Trace', range: 'Negative', flag: 'Review' }, { name: 'Glucose', value: 'Negative', range: 'Negative', flag: '' }] },
  { id: 'REQ-2026-0139', patient: 'Noah Lim', pid: 'PID-001772', test: 'Lipid Profile', received: 'Today, 9:21 AM', priority: 'Routine', enteredBy: 'J. Santos', results: [{ name: 'Total cholesterol', value: '186 mg/dL', range: '< 200', flag: '' }, { name: 'LDL cholesterol', value: '116 mg/dL', range: '< 100', flag: 'High' }] },
]

export default function PendingValidation() {
  const [cases, setCases] = useState(initialCases)
  const [selectedId, setSelectedId] = useState(initialCases[0].id)
  const [query, setQuery] = useState('')
  const [remarks, setRemarks] = useState('')
  const [notice, setNotice] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 5
  const filteredCases = useMemo(() => cases.filter((item) => `${item.id} ${item.patient} ${item.pid} ${item.test}`.toLowerCase().includes(query.toLowerCase())), [cases, query])
  const visibleCases = filteredCases.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const selectedCase = cases.find((item) => item.id === selectedId) ?? visibleCases[0]

  function completeReview(action) {
    if (!selectedCase) return
    if (action === 'return' && !remarks.trim()) {
      setNotice('Add a remark before returning this result for correction.')
      return
    }
    const patient = selectedCase.patient
    setCases((current) => current.filter((item) => item.id !== selectedCase.id))
    setSelectedId(cases.find((item) => item.id !== selectedCase.id)?.id ?? '')
    setRemarks('')
    setNotice(`${selectedCase.id} for ${patient} was ${action === 'approve' ? 'approved for release' : 'returned for correction'}.`)
  }

  return (
    <section className="admin-page pathologist-page" aria-label="Pending validation worklist">
      <div className="admin-dashboard__summary">
        <SummaryCard title="Awaiting validation" value={String(cases.length).padStart(2, '0')} helperText="Results ready for your review" />
        <SummaryCard title="Urgent reviews" value={String(cases.filter((item) => item.priority === 'Urgent').length).padStart(2, '0')} helperText="Prioritize these cases" />
        <SummaryCard title="Reviewed today" value="12" helperText="Across all result types" />
        <SummaryCard title="Returned today" value="03" helperText="Sent back for correction" />
      </div>

      {notice && <p className="pathologist-page__notice" role="status">{notice}</p>}

      <section className="admin-panel pathologist-panel" aria-labelledby="pending-list-title">
        <div className="admin-panel__heading">
          <div><h2 id="pending-list-title">Results awaiting review</h2><p>Check patient details and result values before approving or returning.</p></div>
          <SearchInput className="admin-toolbar__search" label="Search pending results" value={query} onChange={(event) => { setQuery(event.target.value); setCurrentPage(1) }} placeholder="Patient or request number" />
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th scope="col">Request / Patient</th><th scope="col">Test</th><th scope="col">Submitted</th><th scope="col">Priority</th><th scope="col"><span className="visually-hidden">Review</span></th></tr></thead>
            <tbody>{visibleCases.map((item) => <tr key={item.id} className={selectedCase?.id === item.id ? 'is-selected' : ''}>
              <td><button className="admin-table__primary pathologist-table__patient" type="button" onClick={() => { setSelectedId(item.id); setRemarks(''); setNotice('') }}>{item.patient}<span className="admin-table__secondary">{item.id} · {item.pid}</span></button></td>
              <td>{item.test}</td><td>{item.received}</td><td><span className={`admin-badge ${item.priority === 'Urgent' ? 'admin-badge--warning' : 'admin-badge--muted'}`}>{item.priority}</span></td>
              <td><button className="admin-button admin-button--secondary admin-button--small" type="button" onClick={() => { setSelectedId(item.id); setRemarks(''); setNotice('') }}>Review <span aria-hidden="true">→</span></button></td>
            </tr>)}</tbody>
          </table>
          {visibleCases.length === 0 && <p className="admin-empty">No pending results match your search.</p>}
          <TablePagination currentPage={currentPage} pageSize={pageSize} totalItems={filteredCases.length} onPageChange={setCurrentPage} />
        </div>
      </section>

      {selectedCase && <section className="admin-panel pathologist-review" aria-labelledby="review-title">
        <div className="pathologist-review__top"><div><span className="pathologist-eyebrow">Selected case · {selectedCase.id}</span><h2 id="review-title">{selectedCase.patient}</h2><p>{selectedCase.pid} <span aria-hidden="true">·</span> {selectedCase.test}</p></div><span className="pathologist-review__submitted">Encoded by {selectedCase.enteredBy}</span></div>
        <div className="pathologist-review__content">
          <div className="pathologist-review__results"><h3>Result values</h3><div className="admin-table-wrap"><table className="admin-table pathologist-table--results"><thead><tr><th scope="col">Analyte</th><th scope="col">Result</th><th scope="col">Reference range</th><th scope="col">Review</th></tr></thead><tbody>{selectedCase.results.map((result) => <tr key={result.name}><td>{result.name}</td><td className="pathologist-result-value">{result.value}</td><td>{result.range}</td><td>{result.flag ? <span className={`admin-badge ${result.flag === 'Low' || result.flag === 'High' ? 'admin-badge--warning' : 'admin-badge--muted'}`}>{result.flag}</span> : <span className="admin-badge admin-badge--success">Within range</span>}</td></tr>)}</tbody></table></div></div>
          <form className="pathologist-review__form" onSubmit={(event) => { event.preventDefault(); completeReview('approve') }}>
            <label htmlFor="pathologist-remarks">Pathologist remarks <span>Optional for approval</span></label>
            <textarea id="pathologist-remarks" value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder="Add an interpretation or instructions for the technologist…" rows="4" />
            <div className="pathologist-review__actions"><button className="admin-button admin-button--secondary pathologist-button--return" type="button" onClick={() => completeReview('return')}>Return for correction</button><button className="admin-button" type="submit">Approve result <span aria-hidden="true">→</span></button></div>
            <p className="pathologist-review__hint">Approval moves this result to Released Results.</p>
          </form>
        </div>
      </section>}
      {cases.length === 0 && <div className="admin-panel pathologist-all-done"><span aria-hidden="true">✓</span><div><strong>Worklist cleared</strong><p>All available results have been reviewed.</p></div></div>}
    </section>
  )
}
