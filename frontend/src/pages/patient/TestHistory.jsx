import { useMemo, useState } from 'react'
import SearchInput from '../../components/data/SearchInput.jsx'
import TablePagination from '../../components/data/TablePagination.jsx'
import { api } from '../../api/client.js'
import useApiResource from '../../api/useApiResource.js'
import { formatDateTime } from '../../utils/dateFormat.js'
import './TestHistory.css'

export default function TestHistory() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('All statuses')
  const [page, setPage] = useState(1)
  const { result, loading, error } = useApiResource(() => api.patient.testHistory({ page, pageSize: 10, q: query, status: status === 'All statuses' ? '' : status.toLowerCase().replaceAll(' ', '_') }), [page, query, status])
  const history = (result?.data ?? []).map((item) => ({
    id: item.requestNumber,
    test: item.testName,
    requested: formatDateTime(item.requestedAt),
    status: item.status.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
    updated: formatDateTime(item.releasedAt ?? item.requestedAt),
  }))
  const filtered = useMemo(() => history.filter((item) => (
    (status === 'All statuses' || item.status === status)
      && `${item.id} ${item.test}`.toLowerCase().includes(query.trim().toLowerCase())
  )), [history, query, status])
  const rows = filtered
  return (
    <section className="patient-records" aria-label="Test history">
      {error && <p role="alert">{error}</p>}
      <div className="patient-records__toolbar"><SearchInput className="patient-records__search" label="Search test history" placeholder="Test name or request number" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} /><label className="patient-records__filter"><span>Status</span><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}><option>All statuses</option><option>Processing</option><option>For validation</option><option>Returned</option><option>Released</option><option>Cancelled</option></select></label></div>
      <section className="patient-records__table-card" aria-labelledby="patient-history-title">
        <header className="patient-records__heading"><div><h2 id="patient-history-title">Test History</h2><p>One row per test, including tests grouped under the same request.</p></div><span>{filtered.length} {filtered.length === 1 ? 'test' : 'tests'}</span></header>
        <div className="patient-records__scroll" role="region" aria-label="Test history table" tabIndex="0"><table className="patient-records__table"><thead><tr><th>Request</th><th>Test</th><th>Requested</th><th>Status</th><th>Last updated</th></tr></thead><tbody>
          {rows.map((item, index) => <tr key={`${item.id}-${item.test}-${index}`}><td className="patient-records__primary">{item.id}</td><td>{item.test}</td><td>{item.requested}</td><td><span className={`patient-records__status patient-records__status--${item.status.toLowerCase().replaceAll(' ', '-')}`}>{item.status}</span></td><td>{item.updated}</td></tr>)}
          {(loading || !rows.length) && <tr><td className="patient-records__empty" colSpan="5">{loading ? 'Loading test history…' : 'No tests match your search or status filter.'}</td></tr>}
        </tbody></table></div>
        <TablePagination currentPage={page} pageSize={10} totalItems={result?.pagination?.total ?? filtered.length} onPageChange={setPage} />
      </section>
    </section>
  )
}
