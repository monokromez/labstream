import { useMemo, useState } from 'react'
import SearchInput from '../../components/data/SearchInput.jsx'
import TablePagination from '../../components/data/TablePagination.jsx'
import './TestHistory.css'

const history = [
  { id: 'REQ-2026-0134', requested: '10/22/2026', test: 'Lipid Profile', status: 'Released', updated: '10/23/2026' },
  { id: 'REQ-2026-0134', requested: '10/22/2026', test: 'Fasting Blood Sugar', status: 'Released', updated: '10/23/2026' },
  { id: 'REQ-2026-0122', requested: '10/21/2026', test: 'Urinalysis', status: 'Released', updated: '10/22/2026' },
  { id: 'REQ-2026-0118', requested: '10/18/2026', test: 'Complete Blood Count', status: 'Processing', updated: '10/18/2026' },
  { id: 'REQ-2026-0118', requested: '10/18/2026', test: 'Creatinine', status: 'For validation', updated: '10/23/2026' },
  { id: 'REQ-2026-0109', requested: '10/12/2026', test: 'Fasting Blood Sugar', status: 'Cancelled', updated: '10/12/2026' },
  { id: 'REQ-2026-0109', requested: '10/12/2026', test: 'Creatinine', status: 'Cancelled', updated: '10/12/2026' },
]

export default function TestHistory() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('All statuses')
  const [page, setPage] = useState(1)
  const filtered = useMemo(() => history.filter((item) => (
    (status === 'All statuses' || item.status === status)
      && `${item.id} ${item.test}`.toLowerCase().includes(query.trim().toLowerCase())
  )), [query, status])
  const rows = filtered.slice((page - 1) * 10, page * 10)
  return (
    <section className="patient-records" aria-label="Test history">
      <div className="patient-records__toolbar"><SearchInput className="patient-records__search" label="Search test history" placeholder="Test name or request number" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} /><label className="patient-records__filter"><span>Status</span><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}><option>All statuses</option><option>Processing</option><option>For validation</option><option>Returned</option><option>Released</option><option>Cancelled</option></select></label></div>
      <section className="patient-records__table-card" aria-labelledby="patient-history-title">
        <header className="patient-records__heading"><div><h2 id="patient-history-title">Test History</h2><p>One row per test, including tests grouped under the same request.</p></div><span>{filtered.length} {filtered.length === 1 ? 'test' : 'tests'}</span></header>
        <div className="patient-records__scroll"><table className="patient-records__table"><thead><tr><th>Request</th><th>Test</th><th>Requested</th><th>Status</th><th>Last updated</th></tr></thead><tbody>
          {rows.map((item, index) => <tr key={`${item.id}-${item.test}-${index}`}><td className="patient-records__primary">{item.id}</td><td>{item.test}</td><td>{item.requested}</td><td><span className={`patient-records__status patient-records__status--${item.status.toLowerCase().replaceAll(' ', '-')}`}>{item.status}</span></td><td>{item.updated}</td></tr>)}
          {!rows.length && <tr><td className="patient-records__empty" colSpan="5">No tests match your search or status filter.</td></tr>}
        </tbody></table></div>
        <TablePagination currentPage={page} pageSize={10} totalItems={filtered.length} onPageChange={setPage} />
      </section>
      <p className="patient-records__prototype-note">Demonstration records only. The connected portal will show tests linked to the signed-in patient.</p>
    </section>
  )
}
