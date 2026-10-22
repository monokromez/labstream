import { useMemo, useState } from 'react'
import SearchInput from '../../components/data/SearchInput.jsx'
import SummaryCard from '../../components/reports/SummaryCard.jsx'
import TablePagination from '../../components/data/TablePagination.jsx'
import './ReturnedResults.css'

const returned = [
  { id: 'REQ-2026-0137', patient: 'Lara Villanueva', pid: 'PID-001631', test: 'Complete Blood Count', date: 'Today, 8:42 AM', reason: 'Please verify the platelet count and repeat the manual differential.' },
  { id: 'REQ-2026-0129', patient: 'Paolo Garcia', pid: 'PID-001992', test: 'Urinalysis', date: 'Yesterday, 4:16 PM', reason: 'Please confirm the specimen notes and review the reported protein value.' },
  { id: 'REQ-2026-0124', patient: 'Ava Ramos', pid: 'PID-001403', test: 'Fasting Blood Sugar', date: 'Yesterday, 2:08 PM', reason: 'Result is missing the collection time. Please complete and resubmit.' },
]

export default function ReturnedResults() {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(returned[0].id)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 5
  const filtered = useMemo(() => returned.filter((item) => `${item.id} ${item.patient} ${item.pid} ${item.test}`.toLowerCase().includes(query.toLowerCase())), [query])
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const selectedCase = returned.find((item) => item.id === selected)

  return (
    <section className="admin-page pathologist-page" aria-label="Returned results">
      <div className="admin-dashboard__summary"><SummaryCard title="Returned for correction" value={String(returned.length).padStart(2, '0')} helperText="Awaiting technologist updates" /><SummaryCard title="Resubmitted today" value="03" helperText="Ready for another review" /><SummaryCard title="Reviewed today" value="12" helperText="Across all result types" /><SummaryCard title="Urgent reviews" value="01" helperText="Prioritize these cases" /></div>
      <section className="admin-panel pathologist-panel" aria-labelledby="returned-title">
        <div className="admin-panel__heading"><div><h2 id="returned-title">Returned to technologist</h2><p>Review the feedback trail and follow each result through resubmission.</p></div><SearchInput className="admin-toolbar__search" label="Search returned results" value={query} onChange={(event) => { setQuery(event.target.value); setCurrentPage(1) }} placeholder="Patient or request number" /></div>
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th scope="col">Request / Patient</th><th scope="col">Test</th><th scope="col">Returned</th><th scope="col">Status</th><th scope="col"><span className="visually-hidden">Details</span></th></tr></thead><tbody>{visible.map((item) => <tr key={item.id} className={selected === item.id ? 'is-selected' : ''}><td><button className="admin-table__primary pathologist-table__patient" type="button" onClick={() => setSelected(item.id)}>{item.patient}<span className="admin-table__secondary">{item.id} · {item.pid}</span></button></td><td>{item.test}</td><td>{item.date}</td><td><span className="admin-badge admin-badge--warning">Returned</span></td><td><button className="admin-button admin-button--secondary admin-button--small" type="button" onClick={() => setSelected(item.id)}>View feedback <span aria-hidden="true">→</span></button></td></tr>)}</tbody></table>{visible.length === 0 && <p className="admin-empty">No returned results match your search.</p>}<TablePagination currentPage={currentPage} pageSize={pageSize} totalItems={filtered.length} onPageChange={setCurrentPage} /></div>
      </section>
      {selectedCase && <section className="admin-panel pathologist-feedback" aria-live="polite"><div className="pathologist-feedback__icon" aria-hidden="true">↩</div><div><span className="pathologist-eyebrow">Feedback · {selectedCase.id}</span><h2>{selectedCase.patient} <span>· {selectedCase.test}</span></h2><p>{selectedCase.reason}</p></div><span className="pathologist-feedback__awaiting">Awaiting correction</span></section>}
    </section>
  )
}
