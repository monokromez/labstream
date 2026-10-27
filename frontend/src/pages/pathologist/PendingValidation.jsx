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
import { resultValueForDisplay } from '../../utils/resultValue.js'


export default function PendingValidation() {
  const [query, setQuery] = useState('')
  const [testFilter, setTestFilter] = useState('All tests')
  const [priorityFilter, setPriorityFilter] = useState('All priorities')
  const [activeCase, setActiveCase] = useState(null)
  const [confirmAction, setConfirmAction] = useState('')
  const [reviewDecisions, setReviewDecisions] = useState({})
  const [interpretations, setInterpretations] = useState({})
  const [recollectionItems, setRecollectionItems] = useState([])
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10
  const { result, loading, error, refresh } = useApiResource(() => api.pathologist.pending({ page: 1, pageSize: 100 }), [])
  const cases = (result?.data ?? []).map((request) => {
    const allTests = (request.tests ?? []).map((test) => ({ ...test, testName: test.testName, results: (test.values ?? []).map((value) => ({ parameter: value.label, value: Array.isArray(value.structuredValue) ? null : resultValueForDisplay(value), structuredValue: value.structuredValue, unit: value.unit, referenceRange: value.lowerLimit != null || value.upperLimit != null ? `${value.lowerLimit ?? '—'} – ${value.upperLimit ?? '—'}` : '—', flag: value.isAbnormal ? 'Abnormal' : '' })) }))
    const tests = allTests.filter((test) => test.resultStatus === 'submitted')
    return { ...request, uuid: request.id, id: request.requestNumber, patient: request.patientName, priority: request.priority.replace(/\b\w/g, (char) => char.toUpperCase()), submitted: formatDateTime(request.requestedAt), test: allTests.map((test) => test.testName).join(', '), totalTests: allTests.length, tests, results: tests.flatMap((test) => test.results.map((row) => ({ ...row, name: `${test.testName} · ${row.parameter}`, range: row.referenceRange }))) }
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
    setReviewDecisions(Object.fromEntries((item.tests ?? []).map((test) => [test.requestItemId, ''])))
    setRecollectionItems([])
    setInterpretations(Object.fromEntries((item.tests ?? []).map((test) => [test.requestItemId, test.pathologistInterpretation ?? ''])))
    setNotice('')
  }

  function requestReview() {
    if (!activeCase) return
    const undecided = activeCase.tests.filter((test) => !reviewDecisions[test.requestItemId])
    if (undecided.length) {
        setNotice(`Choose approve or mark for re-analysis for each test. ${undecided.length} ${undecided.length === 1 ? 'test needs' : 'tests need'} a decision.`)
      return
    }
    if (activeCase.tests.some((test) => !interpretations[test.requestItemId]?.trim())) {
      setNotice('Add a pathologist interpretation for every test before submitting this review.')
      return
    }
    const missingRemark = activeCase.tests.find((test) => reviewDecisions[test.requestItemId] === 'returned' && !reviewDecisions[`${test.requestItemId}:remark`]?.trim())
    if (missingRemark) {
      setNotice(`Add a return remark for ${missingRemark.testName}.`)
      return
    }
    setConfirmAction('submit')
  }

  async function completeReview() {
    if (!activeCase || !confirmAction) return
    const reviewed = activeCase
    setSaving(true)
    try {
      const response = await api.pathologist.review(reviewed.uuid, reviewed.tests.map((test) => ({
        requestItemId: test.requestItemId,
        decision: reviewDecisions[test.requestItemId],
        interpretation: interpretations[test.requestItemId] ?? '',
        remarks: reviewDecisions[test.requestItemId] === 'returned' ? reviewDecisions[`${test.requestItemId}:remark`] ?? '' : '',
        requiresRetest: reviewDecisions[test.requestItemId] === 'returned' && recollectionItems.includes(test.requestItemId),
      })))
      setActiveCase(null)
      setConfirmAction('')
      const returnedCount = reviewed.tests.filter((test) => reviewDecisions[test.requestItemId] === 'returned').length
      const approvedCount = reviewed.tests.length - returnedCount
      const actionSummary = returnedCount === 0
        ? 'All tests were approved'
        : approvedCount === 0
          ? 'All tests were marked for re-analysis'
          : `${approvedCount} ${approvedCount === 1 ? 'test was' : 'tests were'} approved and ${returnedCount} marked for re-analysis`
      const emailNotice = response.emailDelivery?.status === 'sent'
        ? ' Patient notification email sent.'
        : response.emailDelivery?.status === 'skipped'
          ? ' No patient email is on file; notification email was skipped.'
          : response.emailDelivery?.status === 'failed'
            ? ' Results were released, but notification email delivery failed.'
            : ''
      setNotice(`${reviewed.id} for ${reviewed.patient}: ${actionSummary}.${returnedCount === 0 ? ' Results reach the patient only when every test in the request is approved.' : ''}${emailNotice}`)
      await refresh()
    } catch (requestError) { setNotice(requestError.message || 'Unable to submit this review.') }
    finally { setSaving(false) }
  }

  const totalTests = cases.reduce((total, item) => total + item.tests.length, 0)

  return (
    <section className="admin-page pathologist-page" aria-label="Pending validation worklist">
      <div className="admin-dashboard__summary">
        <SummaryCard title="Assigned requests" value={String(cases.length).padStart(2, '0')} helperText="Awaiting your review" />
        <SummaryCard title="Urgent requests" value={String(cases.filter((item) => item.priority === 'Urgent').length).padStart(2, '0')} helperText="Prioritize these cases" />
        <SummaryCard title="Tests to review" value={String(totalTests).padStart(2, '0')} helperText="Decide for each test" />
        <SummaryCard title="Patients affected" value={String(new Set(cases.map((item) => item.pid)).size).padStart(2, '0')} helperText="In your assigned worklist" />
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
            <td className="admin-table__primary">{item.id}<span className="pathologist-assignment">Assigned to you</span></td><td>{item.patient}</td><td>{item.tests.length} of {item.totalTests} tests to review<span className="pathologist-test-names">{item.test}</span></td><td>{item.submitted}</td>
            <td><span className={`admin-badge ${item.priority === 'Urgent' ? 'admin-badge--warning' : 'admin-badge--muted'}`}>{item.priority}</span></td>
            <td><button className="admin-button admin-button--positive admin-button--small" type="button" onClick={() => openReview(item)}>Review <span aria-hidden="true">→</span></button></td>
          </tr>)}
          {visibleCases.length === 0 && <tr><td className="admin-empty" colSpan="6">{loading ? 'Loading assigned requests…' : error ? 'Assigned requests could not be loaded.' : cases.length ? 'No pending results match your filters.' : 'No requests are currently assigned. If you expected one, ask the administrator to check its assignment.'}</td></tr>}</tbody>
        </table></div>
        <TablePagination currentPage={currentPage} pageSize={pageSize} totalItems={filteredCases.length} onPageChange={setCurrentPage} />
      </section>

      {activeCase && !confirmAction && <AdminDialog className="pathologist-dialog" title="Review request" description="Review every test, add an interpretation, and choose an outcome for each one." onClose={() => setActiveCase(null)} size="large" footer={(
        <><button className="admin-button admin-button--secondary" type="button" onClick={() => setActiveCase(null)}>Cancel</button><button className="admin-button admin-button--positive" type="button" onClick={requestReview}>Review decisions</button></>
      )}>
        <div className="pathologist-dialog__details">
          <div><span>Request</span><strong>{activeCase.id}</strong></div><div><span>Patient</span><strong>{activeCase.patient}</strong></div><div><span>Reviewing</span><strong>{activeCase.tests.length} of {activeCase.totalTests} tests</strong></div><div><span>Priority</span><strong>{activeCase.priority}</strong></div><div><span>Submitted</span><strong>{activeCase.submitted}</strong></div><div><span>Assignment</span><strong>Assigned to you</strong></div>
        </div>
        <PathologistResultTable results={activeCase.results} />
        {notice && <p className="pathologist-page__notice" role="alert">{notice}</p>}
        {activeCase.tests.map((test) => <section className="pathologist-dialog__test-review" key={test.requestItemId}>
          <header className="pathologist-dialog__test-heading"><div><span>Test review</span><h3>{test.testName}</h3></div><span className={`pathologist-dialog__test-state${reviewDecisions[test.requestItemId] ? ' is-selected' : ''}`}>{reviewDecisions[test.requestItemId] === 'approved' ? 'Approve' : reviewDecisions[test.requestItemId] === 'returned' ? 'Return' : 'Awaiting decision'}</span></header>
          <label className="pathologist-filter" htmlFor={`decision-${test.requestItemId}`}>Decision<select id={`decision-${test.requestItemId}`} value={reviewDecisions[test.requestItemId] ?? ''} onChange={(event) => { const decision = event.target.value; setReviewDecisions((current) => ({ ...current, [test.requestItemId]: decision })); if (decision !== 'returned') setRecollectionItems((current) => current.filter((id) => id !== test.requestItemId)); setNotice('') }}><option value="">Choose an outcome</option><option value="approved">Approve this test</option><option value="returned">Mark for re-analysis</option></select></label>
          <label className="pathologist-dialog__remarks" htmlFor={`interpretation-${test.requestItemId}`}>Pathologist interpretation<LimitedTextarea id={`interpretation-${test.requestItemId}`} value={interpretations[test.requestItemId] ?? ''} onChange={(event) => { setInterpretations((current) => ({ ...current, [test.requestItemId]: event.target.value })); setNotice('') }} placeholder={`Interpret ${test.testName} in clinical context…`} rows="3" maxLength={2000} /></label>
          {reviewDecisions[test.requestItemId] === 'returned' && <>
            <label className="pathologist-dialog__remarks" htmlFor={`remark-${test.requestItemId}`}>Re-analysis remark <span>(required)</span><LimitedTextarea id={`remark-${test.requestItemId}`} value={reviewDecisions[`${test.requestItemId}:remark`] ?? ''} onChange={(event) => { setReviewDecisions((current) => ({ ...current, [`${test.requestItemId}:remark`]: event.target.value })); setNotice('') }} placeholder={`Explain the re-analysis needed for ${test.testName}…`} rows="3" maxLength={1000} /></label>
            <label className="pathologist-dialog__recollection"><input type="checkbox" checked={recollectionItems.includes(test.requestItemId)} onChange={(event) => setRecollectionItems((current) => event.target.checked ? [...current, test.requestItemId] : current.filter((id) => id !== test.requestItemId))} /><span>Request a new specimen / retest for this test</span></label>
          </>}
        </section>)}
        <p className="pathologist-page__return-hint">If any test is marked for re-analysis, the entire request returns to the technologist for review. Select a retest only when a new specimen is needed.</p>
      </AdminDialog>}
      {activeCase && confirmAction && <AdminDialog className="pathologist-dialog" title="Confirm review decisions" onClose={() => setConfirmAction('')} size="small">
        <p className="admin-dialog__confirm">Submit the review for <strong>{activeCase.id}</strong> ({activeCase.patient})?</p>
        <ul className="pathologist-confirm__summary"><li>{activeCase.tests.filter((test) => reviewDecisions[test.requestItemId] === 'approved').length} tests approved</li><li>{activeCase.tests.filter((test) => reviewDecisions[test.requestItemId] === 'returned').length} tests marked for re-analysis</li><li>{recollectionItems.length} retest / recollection requests</li></ul>
        <p>Results reach the patient only when every test in this request is approved.</p>
        <div className="admin-dialog__footer">
          <button className="admin-button admin-button--secondary" type="button" onClick={() => setConfirmAction('')}>Back to review</button>
          <button className="admin-button admin-button--positive" type="button" disabled={saving} onClick={completeReview}>{saving ? 'Submitting…' : 'Submit review'}</button>
        </div>
      </AdminDialog>}
      {!loading && !error && cases.length === 0 && <div className="admin-panel pathologist-all-done"><span aria-hidden="true">✓</span><div><strong>No assigned requests</strong><p>New submissions appear here when assigned to your account. If work is expected or a request cannot be assigned because no Pathologist is available, contact the administrator to review eligibility or reassign it.</p></div></div>}
    </section>
  )
}
