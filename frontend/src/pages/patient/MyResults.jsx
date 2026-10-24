import { useMemo, useState } from 'react'
import { api } from '../../api/client.js'
import useApiResource from '../../api/useApiResource.js'
import { formatDate, formatDateTime } from '../../utils/dateFormat.js'
import AdminDialog from '../../components/data/AdminDialog.jsx'
import SummaryCard from '../../components/reports/SummaryCard.jsx'
import TablePagination from '../../components/data/TablePagination.jsx'
import './MyResults.css'

export default function MyResults() {
  const [selected, setSelected] = useState(null)
  const [page, setPage] = useState(1)
  const { result, loading, error } = useApiResource(() => api.patient.results({ page, pageSize: 10 }), [page])
  const requests = (result?.data ?? []).map((request) => ({
    ...request,
    id: request.requestNumber,
    requested: formatDateTime(request.requestedAt),
    released: formatDate(request.releasedAt),
    status: request.resultVisibility === 'released' ? 'Released' : 'Unreleased',
    tests: (request.tests ?? []).map((test) => ({
      name: test.testName,
      interpretation: test.pathologistInterpretation,
      results: (test.values ?? []).map((value) => [value.label, [value.numericValue, value.textValue, value.selectValue, value.booleanValue].find((entry) => entry != null) ?? '—', value.isAbnormal ? 'Outside reference range' : '']),
    })),
  }))
  const releasedCount = Number(result?.summary?.releasedTests ?? requests.filter((request) => request.status === 'Released').reduce((sum, request) => sum + request.testCount, 0))
  const unreleasedCount = Number(result?.summary?.unreleasedTests ?? requests.filter((request) => request.status !== 'Released').reduce((sum, request) => sum + request.testCount, 0))
  const rows = useMemo(() => requests, [result])

  return (
    <section className="patient-records" aria-label="My test results">
      {error && <p role="alert">{error}</p>}
      <div className="patient-records__summary">
        <SummaryCard title="Released results" value={String(releasedCount).padStart(2, '0')} helperText="Individual tests available to view" />
        <SummaryCard title="Unreleased results" value={String(unreleasedCount).padStart(2, '0')} helperText="Tests still being processed or reviewed" />
        <SummaryCard title="Total tests" value={String(result?.summary?.totalTests ?? releasedCount + unreleasedCount).padStart(2, '0')} helperText="Tests across your registered requests" />
      </div>
      <section className="patient-records__table-card" aria-labelledby="patient-results-title">
        <header className="patient-records__heading"><div><h2 id="patient-results-title">My Results</h2><p>Each row represents one request. Released requests include all of their test results.</p></div><span>{requests.length} {requests.length === 1 ? 'request' : 'requests'}</span></header>
        <div className="patient-records__scroll"><table className="patient-records__table"><thead><tr><th>Request</th><th>Requested</th><th>Tests</th><th>Availability</th><th>Action</th></tr></thead><tbody>
          {rows.map((item) => <tr key={item.id}><td className="patient-records__primary">{item.id}</td><td>{item.requested}</td><td>{item.testCount} tests</td><td><span className={`patient-records__status${item.status === 'Released' ? '' : ' patient-records__status--processing'}`}>{item.status}</span></td><td>{item.status === 'Released' ? <button className="patient-records__button" type="button" onClick={() => setSelected(item)}>View results</button> : <span className="patient-records__unavailable">Not available yet</span>}</td></tr>)}
          {(loading || rows.length === 0) && <tr><td className="patient-records__empty" colSpan="5">{loading ? 'Loading results…' : 'No results are available yet.'}</td></tr>}
        </tbody></table></div>
        <TablePagination currentPage={page} pageSize={10} totalItems={result?.pagination?.total ?? requests.length} onPageChange={setPage} />
      </section>
      {selected && <AdminDialog title="Request results" description={`${selected.id} · Released ${selected.released}`} onClose={() => setSelected(null)} size="large" footer={<button className="admin-button" type="button" onClick={() => setSelected(null)}>Done</button>}>
        {selected.tests.map((test) => <section className="patient-records__request-test" key={test.name}><h3>{test.name}</h3><p>{test.interpretation}</p><div className="patient-records__result-list">{test.results.map(([name, value, interpretation]) => <div key={name}><span>{name}</span><strong>{value}</strong><small>{interpretation}</small></div>)}</div></section>)}
      </AdminDialog>}
    </section>
  )
}
