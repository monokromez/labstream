import { useMemo, useState } from 'react'
import SearchInput from '../../components/data/SearchInput.jsx'
import SummaryCard from '../../components/reports/SummaryCard.jsx'
import TablePagination from '../../components/data/TablePagination.jsx'
import './ReleasedResults.css'

const released = [
  { id: 'REQ-2026-0134', patient: 'Gabriel Dizon', pid: 'PID-001823', test: 'Lipid Profile', released: 'Today, 9:12 AM', approvedBy: 'Dr. A. Santos', remarks: 'Values reviewed. Maintain current diet and follow up with your physician.' },
  { id: 'REQ-2026-0131', patient: 'Sofia Bautista', pid: 'PID-002095', test: 'Complete Blood Count', released: 'Today, 8:36 AM', approvedBy: 'Dr. A. Santos', remarks: 'Results reviewed.' },
  { id: 'REQ-2026-0128', patient: 'Ethan Flores', pid: 'PID-001744', test: 'Fasting Blood Sugar', released: 'Yesterday, 3:50 PM', approvedBy: 'Dr. M. Reyes', remarks: 'Please discuss this result with your attending physician.' },
  { id: 'REQ-2026-0122', patient: 'Isabel Co', pid: 'PID-001521', test: 'Urinalysis', released: 'Yesterday, 1:27 PM', approvedBy: 'Dr. M. Reyes', remarks: 'Results reviewed.' },
]

export default function ReleasedResults() {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 5
  const filtered = useMemo(() => released.filter((item) => `${item.id} ${item.patient} ${item.pid} ${item.test}`.toLowerCase().includes(query.toLowerCase())), [query])
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const selectedCase = released.find((item) => item.id === selected)

  return (
    <section className="admin-page pathologist-page" aria-label="Released results">
      <div className="admin-dashboard__summary"><SummaryCard title="Released today" value="08" helperText="Approved and available to patients" /><SummaryCard title="Released this week" value="42" helperText="Across all test types" /><SummaryCard title="Latest release" value="9:12 AM" helperText="Today · Lipid Profile" /><SummaryCard title="Reviewed today" value="12" helperText="Across all result types" /></div>
      <section className="admin-panel pathologist-panel" aria-labelledby="released-title">
        <div className="admin-panel__heading"><div><h2 id="released-title">Patient results released</h2><p>Approved results are now available in each patient’s portal.</p></div><SearchInput className="admin-toolbar__search" label="Search released results" value={query} onChange={(event) => { setQuery(event.target.value); setCurrentPage(1) }} placeholder="Patient or request number" /></div>
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th scope="col">Request / Patient</th><th scope="col">Test</th><th scope="col">Released</th><th scope="col">Validated by</th><th scope="col"><span className="visually-hidden">Details</span></th></tr></thead><tbody>{visible.map((item) => <tr key={item.id} className={selected === item.id ? 'is-selected' : ''}><td><button className="admin-table__primary pathologist-table__patient" type="button" onClick={() => setSelected(selected === item.id ? '' : item.id)}>{item.patient}<span className="admin-table__secondary">{item.id} · {item.pid}</span></button></td><td>{item.test}</td><td>{item.released}</td><td>{item.approvedBy}</td><td><span className="admin-badge admin-badge--success">Released</span></td></tr>)}</tbody></table>{visible.length === 0 && <p className="admin-empty">No released results match your search.</p>}<TablePagination currentPage={currentPage} pageSize={pageSize} totalItems={filtered.length} onPageChange={setCurrentPage} /></div>
      </section>
      {selectedCase && <section className="admin-panel pathologist-feedback pathologist-feedback--released" aria-live="polite"><div className="pathologist-feedback__icon" aria-hidden="true">✓</div><div><span className="pathologist-eyebrow">Release record · {selectedCase.id}</span><h2>{selectedCase.patient} <span>· {selectedCase.test}</span></h2><p>{selectedCase.remarks}</p><small>Validated by {selectedCase.approvedBy} · {selectedCase.released}</small></div><span className="admin-badge admin-badge--success">Patient copy available</span></section>}
    </section>
  )
}
