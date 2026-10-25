import { useMemo, useState } from 'react'
import SearchInput from '../../components/data/SearchInput.jsx'
import AdminDialog from '../../components/data/AdminDialog.jsx'
import SummaryCard from '../../components/reports/SummaryCard.jsx'
import TablePagination from '../../components/data/TablePagination.jsx'
import PathologistResultTable from './PathologistResultTable.jsx'
import { LimitedTextarea } from '../../components/forms/LimitedInput.jsx'
import { api } from '../../api/client.js'
import useApiResource from '../../api/useApiResource.js'
import useTestCatalog from '../../data/useTestCatalog.js'
import { formatDateTime } from '../../utils/dateFormat.js'
import './PendingValidation.css'


export default function PendingValidation() {
  const [query, setQuery] = useState('')
  const [testFilter, setTestFilter] = useState('All tests')
  const [priorityFilter, setPriorityFilter] = useState('All priorities')
  const [activeCase, setActiveCase] = useState(null)
  const [confirmAction, setConfirmAction] = useState('')
  const [remarks, setRemarks] = useState('')
  const [interpretations, setInterpretations] = useState({})
  const [recollectionItems, setRecollectionItems] = useState([])
  const [notice, setNotice] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10
  const { result, error, refresh } = useApiResource(() => api.pathologist.pending({ page: 1, pageSize: 100 }), [])
  const cases = (result?.data ?? []).map((request) => {
    const tests = (request.tests ?? []).map((test) => ({ ...test, testName: test.testName, results: (test.values ?? []).map((value) => ({ parameter: value.label, value: [value.numericValue, value.textValue, value.selectValue, value.booleanValue].find((entry) => entry != null) ?? '—', unit: value.unit, referenceRange: value.lowerLimit != null || value.upperLimit != null ? `${value.lowerLimit ?? '—'} – ${value.upperLimit ?? '—'}` : '—', flag: value.isAbnormal ? 'Abnormal' : '—' })) }))
    return { ...request, uuid: request.id, id: request.requestNumber, patient: request.patientName, priority: request.priority.replace(/\b\w/g, (char) => char.toUpperCase()), submitted: formatDateTime(request.requestedAt), test: tests.map((test) => test.testName).join(', '), tests, results: tests.flatMap((test) => test.results.map((row) => ({ ...row, name: `${test.testName} · ${row.parameter}`, range: row.referenceRange }))) }
  })
  const { catalog } = useTestCatalog({ availableOnly: true })
  const testOptions = [...new Set(catalog.tests.map((test) => test.name))].sort()

  const filteredCases = useMemo(() => cases.filter((item) => {
    const matchesSearch = `${item.id} ${item.patient} ${item.test}`.toLowerCase().includes(query.toLowerCase())
    return matchesSearch && (testFilter === 'All tests' || item.tests.some((test) => test.testName === testFilter))
      && (priorityFilter === 'All priorities' || item.priority === priorityFilter)
  }), [cases, priorityFilter, query, testFilter])
  const visibleCases = filteredCases.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  function openReview(item) {
    setActiveCase(item)
    setRemarks('')
    setRecollectionItems([])
    setInterpretations(Object.fromEntries((item.tests ?? []).map((test) => [test.requestItemId, test.pathologistInterpretation ?? ''])))
    setNotice('')
  }

  function requestReview(action) {
    if (!activeCase) return
    if (action === 'return' && !remarks.trim()) {
      setNotice('Add a remark before returning this result for correction.')
      return
    }
    if (activeCase.tests.some((test) => !interpretations[test.requestItemId]?.trim())) {
      setNotice(action === 'return'
        ? 'Add a pathologist interpretation for every test before returning the results.'
        : 'Add a pathologist interpretation for every test before approving the results.')
      return
    }
    setConfirmAction(action)
  }

  async function completeReview() {
    if (!activeCase || !confirmAction) return
    const reviewed = activeCase
    const action = confirmAction
    try {
      await api.pathologist.review(reviewed.uuid, reviewed.tests.map((test) => ({
        requestItemId: test.requestItemId,
        decision: action === 'approve' ? 'approved' : 'returned',
        interpretation: interpretations[test.requestItemId] ?? '',
        remarks: action === 'return' ? remarks : '',
        requiresRetest: action === 'return' && recollectionItems.includes(test.requestItemId),
      })))
      setActiveCase(null)
      setConfirmAction('')
      setRemarks('')
      setNotice(`${reviewed.id} for ${reviewed.patient} was ${action === 'approve' ? 'approved for release' : 'returned for correction'}.`)
      await refresh()
    } catch (requestError) { setNotice(requestError.message || 'Unable to submit this review.') }
  }

  return (
    <section className="admin-page pathologist-page" aria-label="Pending validation worklist">
      <div className="admin-dashboard__summary">
        <SummaryCard title="Awaiting validation" value={String(cases.length).padStart(2, '0')} helperText="Results ready for your review" />
        <SummaryCard title="Urgent reviews" value={String(cases.filter((item) => item.priority === 'Urgent').length).padStart(2, '0')} helperText="Prioritize these cases" />
        <SummaryCard title="Reviewed today" value="00" helperText="Across all result types" />
        <SummaryCard title="Returned today" value="00" helperText="Sent back for correction" />
      </div>

      {notice && <p className="pathologist-page__notice" role="status">{notice}</p>}
      {error && <p className="pathologist-page__notice" role="alert">{error}</p>}

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
          {visibleCases.length === 0 && <tr><td className="admin-empty" colSpan="6">{result ? 'No pending results match your filters.' : 'Loading pending results…'}</td></tr>}</tbody>
        </table></div>
        <TablePagination currentPage={currentPage} pageSize={pageSize} totalItems={filteredCases.length} onPageChange={setCurrentPage} />
      </section>

      {activeCase && !confirmAction && <AdminDialog className="pathologist-dialog" title="Review test results" description="Interpret this test, then approve it or return it for correction." onClose={() => setActiveCase(null)} size="large" footer={(
        <><button className="admin-button admin-button--negative" type="button" onClick={() => requestReview('return')}>Return for correction</button><button className="admin-button admin-button--positive" type="button" onClick={() => requestReview('approve')}>Approve result</button></>
      )}>
        <div className="pathologist-dialog__details">
          <div><span>Request</span><strong>{activeCase.id}</strong></div><div><span>Patient</span><strong>{activeCase.patient}</strong></div><div><span>Tests</span><strong>{activeCase.test}</strong></div><div><span>Priority</span><strong>{activeCase.priority}</strong></div><div><span>Submitted</span><strong>{activeCase.submitted}</strong></div>
        </div>
        <PathologistResultTable results={activeCase.results} />
        {notice && <p className="pathologist-page__notice" role="alert">{notice}</p>}
        {activeCase.tests.map((test) => <section className="pathologist-dialog__test-review" key={test.requestItemId}>
          <label className="pathologist-dialog__remarks" htmlFor={`interpretation-${test.requestItemId}`}>{test.testName} · Pathologist interpretation<LimitedTextarea id={`interpretation-${test.requestItemId}`} value={interpretations[test.requestItemId] ?? ''} onChange={(event) => { setInterpretations((current) => ({ ...current, [test.requestItemId]: event.target.value })); setNotice('') }} placeholder={`Interpret ${test.testName} in clinical context…`} rows="3" maxLength={2000} /></label>
          <label className="pathologist-dialog__recollection"><input type="checkbox" checked={recollectionItems.includes(test.requestItemId)} onChange={(event) => setRecollectionItems((current) => event.target.checked ? [...current, test.requestItemId] : current.filter((id) => id !== test.requestItemId))} /><span>If returned: collect a new specimen for this test</span></label>
        </section>)}
        <label className="pathologist-dialog__remarks" htmlFor="pathologist-remarks">Return remark <span>(required only when returning)</span><LimitedTextarea id="pathologist-remarks" value={remarks} onChange={(event) => { setRemarks(event.target.value); setNotice('') }} placeholder="Explain the correction or retest needed…" rows="3" maxLength={1000} /></label>
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
