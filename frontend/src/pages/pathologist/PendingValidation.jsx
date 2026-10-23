import { useEffect, useMemo, useState } from 'react'
import SearchInput from '../../components/data/SearchInput.jsx'
import AdminDialog from '../../components/data/AdminDialog.jsx'
import SummaryCard from '../../components/reports/SummaryCard.jsx'
import TablePagination from '../../components/data/TablePagination.jsx'
import PathologistResultTable from './PathologistResultTable.jsx'
import { readCatalog, subscribeCatalog } from '../../data/administratorCatalog.js'
import './PendingValidation.css'

const initialCases = [
  { id: 'REQ-2026-0148', patient: 'Elena Cruz', test: 'Complete Blood Count (CBC)', submitted: '10/23/2026 10:42 AM', priority: 'Routine', enteredBy: 'A. Rivera', results: [{ name: 'Hemoglobin', value: '10.8 g/dL', range: '12.0–16.0', flag: 'Low' }, { name: 'WBC', value: '7.2 ×10⁹/L', range: '4.0–11.0', flag: '' }, { name: 'Platelets', value: '248 ×10⁹/L', range: '150–400', flag: '' }] },
  { id: 'REQ-2026-0146', patient: 'Rafael Mendoza', test: 'Fasting Blood Sugar', submitted: '10/23/2026 10:18 AM', priority: 'Urgent', enteredBy: 'M. Flores', results: [{ name: 'Glucose', value: '142 mg/dL', range: '70–99', flag: 'High' }] },
  { id: 'REQ-2026-0142', patient: 'Mika Tan', test: 'Urinalysis', submitted: '10/23/2026 09:54 AM', priority: 'Routine', enteredBy: 'A. Rivera', results: [{ name: 'Protein', value: 'Trace', range: 'Negative', flag: 'Review' }, { name: 'Glucose', value: 'Negative', range: 'Negative', flag: '' }] },
  { id: 'REQ-2026-0139', patient: 'Noah Lim', test: 'Lipid Profile', submitted: '10/23/2026 09:21 AM', priority: 'Routine', enteredBy: 'J. Santos', results: [{ name: 'Total cholesterol', value: '186 mg/dL', range: '< 200', flag: '' }, { name: 'LDL cholesterol', value: '116 mg/dL', range: '< 100', flag: 'High' }] },
]

export default function PendingValidation() {
  const [cases, setCases] = useState(initialCases)
  const [query, setQuery] = useState('')
  const [testFilter, setTestFilter] = useState('All tests')
  const [priorityFilter, setPriorityFilter] = useState('All priorities')
  const [activeCase, setActiveCase] = useState(null)
  const [confirmAction, setConfirmAction] = useState('')
  const [remarks, setRemarks] = useState('')
  const [interpretation, setInterpretation] = useState('')
  const [notice, setNotice] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [catalog, setCatalog] = useState(readCatalog)
  const pageSize = 10
  useEffect(() => subscribeCatalog(() => setCatalog(readCatalog())), [])
  const testOptions = [...new Set(catalog.tests.filter((test) => test.availability === 'Available').map((test) => test.name))].sort()

  const filteredCases = useMemo(() => cases.filter((item) => {
    const matchesSearch = `${item.id} ${item.patient} ${item.test}`.toLowerCase().includes(query.toLowerCase())
    return matchesSearch && (testFilter === 'All tests' || item.test === testFilter)
      && (priorityFilter === 'All priorities' || item.priority === priorityFilter)
  }), [cases, priorityFilter, query, testFilter])
  const visibleCases = filteredCases.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  function openReview(item) {
    setActiveCase(item)
    setRemarks('')
    setInterpretation('')
    setNotice('')
  }

  function requestReview(action) {
    if (!activeCase) return
    if (action === 'return' && !remarks.trim()) {
      setNotice('Add a remark before returning this result for correction.')
      return
    }
    if (action === 'approve' && !interpretation.trim()) {
      setNotice('Add a pathologist interpretation for this test before approving it.')
      return
    }
    setConfirmAction(action)
  }

  function completeReview() {
    if (!activeCase || !confirmAction) return
    const reviewed = activeCase
    setCases((current) => current.filter((item) => item.id !== reviewed.id))
    setActiveCase(null)
    const action = confirmAction
    setConfirmAction('')
    setRemarks('')
    setInterpretation('')
    setNotice(`${reviewed.id} for ${reviewed.patient} was ${action === 'approve' ? 'approved for release' : 'returned for correction'}.`)
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

      <section className="pathologist-list" aria-label="Pending validation results">
        <div className="pathologist-list__heading"><div><h2>Pending Validation</h2><p>Review submitted results before approving or returning them.</p></div><span className="pathologist-list__count">{filteredCases.length} {filteredCases.length === 1 ? 'result' : 'results'}</span></div>
        <hr className="pathologist-list__divider" />
        <div className="pathologist-toolbar">
          <SearchInput className="pathologist-toolbar__search" label="Search pending results" value={query} onChange={(event) => { setQuery(event.target.value); setCurrentPage(1) }} placeholder="Patient or request number" />
          <label className="pathologist-filter">Test<select value={testFilter} onChange={(event) => { setTestFilter(event.target.value); setCurrentPage(1) }}><option>All tests</option>{testOptions.map((test) => <option key={test}>{test}</option>)}</select></label>
          <label className="pathologist-filter">Priority<select value={priorityFilter} onChange={(event) => { setPriorityFilter(event.target.value); setCurrentPage(1) }}><option>All priorities</option><option>Routine</option><option>Urgent</option></select></label>
        </div>
        <div className="pathologist-table-scroll"><table className="admin-table pathologist-list-table">
          <thead><tr><th scope="col">Request</th><th scope="col">Patient</th><th scope="col">Test</th><th scope="col">Submitted</th><th scope="col">Priority</th><th scope="col"><span className="visually-hidden">Review action</span></th></tr></thead>
          <tbody>{visibleCases.map((item) => <tr key={item.id}>
            <td className="admin-table__primary">{item.id}</td><td>{item.patient}</td><td>{item.test}</td><td>{item.submitted}</td>
            <td><span className={`admin-badge ${item.priority === 'Urgent' ? 'admin-badge--warning' : 'admin-badge--muted'}`}>{item.priority}</span></td>
            <td><button className="admin-button admin-button--positive admin-button--small" type="button" onClick={() => openReview(item)}>Review <span aria-hidden="true">→</span></button></td>
          </tr>)}
          {visibleCases.length === 0 && <tr><td className="admin-empty" colSpan="6">No pending results match your filters.</td></tr>}</tbody>
        </table></div>
        <TablePagination currentPage={currentPage} pageSize={pageSize} totalItems={filteredCases.length} onPageChange={setCurrentPage} />
      </section>

      {activeCase && !confirmAction && <AdminDialog className="pathologist-dialog" title="Review test results" description="Interpret this test, then approve it or return it for correction." onClose={() => setActiveCase(null)} size="large" footer={(
        <><button className="admin-button admin-button--negative" type="button" onClick={() => requestReview('return')}>Return for correction</button><button className="admin-button admin-button--positive" type="button" onClick={() => requestReview('approve')}>Approve result</button></>
      )}>
        <div className="pathologist-dialog__details">
          <div><span>Request</span><strong>{activeCase.id}</strong></div><div><span>Patient</span><strong>{activeCase.patient}</strong></div><div><span>Test</span><strong>{activeCase.test}</strong></div><div><span>Priority</span><strong>{activeCase.priority}</strong></div><div><span>Submitted</span><strong>{activeCase.submitted}</strong></div><div><span>Entered by</span><strong>{activeCase.enteredBy}</strong></div>
        </div>
        <PathologistResultTable results={activeCase.results} />
        {notice && <p className="pathologist-page__notice" role="alert">{notice}</p>}
        <label className="pathologist-dialog__remarks" htmlFor="pathologist-interpretation">Pathologist interpretation<textarea id="pathologist-interpretation" value={interpretation} onChange={(event) => { setInterpretation(event.target.value); setNotice('') }} placeholder={`Interpret ${activeCase.test} in clinical context…`} rows="3" /></label>
        <label className="pathologist-dialog__remarks" htmlFor="pathologist-remarks">Return remark <span>(required only when returning)</span><textarea id="pathologist-remarks" value={remarks} onChange={(event) => { setRemarks(event.target.value); setNotice('') }} placeholder="Explain the correction or retest needed…" rows="3" /></label>
        <p className="pathologist-page__return-hint">A result is released to the patient only after every test in the request is approved.</p>
      </AdminDialog>}
      {activeCase && confirmAction && <AdminDialog className="pathologist-dialog" title={confirmAction === 'approve' ? 'Approve result for release?' : 'Return result for correction?'} onClose={() => setConfirmAction('')} size="small">
        <p className="admin-dialog__confirm">{confirmAction === 'approve'
          ? <>Approve <strong>{activeCase.id}</strong> for release to <strong>{activeCase.patient}</strong>?</>
          : <>Return <strong>{activeCase.id}</strong> to the medical technologist with your remarks?</>}</p>
        <div className="admin-dialog__footer">
          <button className="admin-button admin-button--secondary" type="button" onClick={() => setConfirmAction('')}>Back to review</button>
          <button className={`admin-button ${confirmAction === 'approve' ? 'admin-button--positive' : 'admin-button--negative'}`} type="button" onClick={completeReview}>{confirmAction === 'approve' ? 'Confirm approval' : 'Confirm return'}</button>
        </div>
      </AdminDialog>}
      {cases.length === 0 && <div className="admin-panel pathologist-all-done"><span aria-hidden="true">✓</span><div><strong>Worklist cleared</strong><p>All available results have been reviewed.</p></div></div>}
    </section>
  )
}
