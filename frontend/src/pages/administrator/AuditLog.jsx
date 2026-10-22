import { useMemo, useState } from 'react'
import TablePagination from '../../components/data/TablePagination.jsx'
import './AuditLog.css'

const PAGE_SIZE = 5

const auditEvents = [
  { id: 1, timestamp: 'Oct 22, 2026 · 10:42 AM', user: 'Dr. Ana Reyes', role: 'Pathologist', action: 'Result released', record: 'REQ-2026-0248' },
  { id: 2, timestamp: 'Oct 22, 2026 · 10:18 AM', user: 'Leo Cruz', role: 'Medical Technologist', action: 'Result encoded', record: 'REQ-2026-0246' },
  { id: 3, timestamp: 'Oct 22, 2026 · 09:56 AM', user: 'Mia Santos', role: 'Cashier', action: 'Payment recorded', record: 'REQ-2026-0247' },
  { id: 4, timestamp: 'Oct 22, 2026 · 09:31 AM', user: 'Dr. Ana Reyes', role: 'Pathologist', action: 'Result returned', record: 'REQ-2026-0244' },
  { id: 5, timestamp: 'Oct 22, 2026 · 09:14 AM', user: 'Nico Garcia', role: 'Cashier', action: 'Request registered', record: 'REQ-2026-0248' },
  { id: 6, timestamp: 'Oct 21, 2026 · 04:46 PM', user: 'Leo Cruz', role: 'Medical Technologist', action: 'Specimen received', record: 'REQ-2026-0246' },
  { id: 7, timestamp: 'Oct 21, 2026 · 04:28 PM', user: 'Mia Santos', role: 'Cashier', action: 'Payment recorded', record: 'REQ-2026-0245' },
  { id: 8, timestamp: 'Oct 21, 2026 · 03:52 PM', user: 'Dr. Ana Reyes', role: 'Pathologist', action: 'Result validated', record: 'REQ-2026-0243' },
]

export default function AuditLog() {
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('All activity')
  const [currentPage, setCurrentPage] = useState(1)

  const visibleEvents = useMemo(() => auditEvents.filter((event) => {
    const matchesSearch = `${event.user} ${event.role} ${event.action} ${event.record}`.toLowerCase().includes(search.toLowerCase())
    return matchesSearch && (actionFilter === 'All activity' || event.action === actionFilter)
  }), [actionFilter, search])

  const pagedEvents = visibleEvents.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  return (
    <section className="admin-page" aria-label="Audit log">
      <div className="admin-page__title-row">
        <div>
          <h2>System activity history</h2>
          <p>Review a traceable record of payments and result workflow events.</p>
        </div>
        <span className="admin-badge">Audit trail</span>
      </div>

      <div className="admin-toolbar" role="search">
        <label className="admin-toolbar__field admin-toolbar__field--search">
          Search activity
          <input
            type="search"
            placeholder="Staff member, request, or activity"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setCurrentPage(1)
            }}
          />
        </label>
        <label className="admin-toolbar__field">
          Filter by event
          <select
            value={actionFilter}
            onChange={(event) => {
              setActionFilter(event.target.value)
              setCurrentPage(1)
            }}
          >
            <option>All activity</option>
            {[...new Set(auditEvents.map((event) => event.action))].map((action) => <option key={action}>{action}</option>)}
          </select>
        </label>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">Date and time</th>
              <th scope="col">Staff member</th>
              <th scope="col">Role</th>
              <th scope="col">Event</th>
              <th scope="col">Related record</th>
            </tr>
          </thead>
          <tbody>
            {pagedEvents.map((event) => (
              <tr key={event.id}>
                <td>{event.timestamp}</td>
                <td className="admin-table__primary">{event.user}</td>
                <td>{event.role}</td>
                <td><span className="admin-badge">{event.action}</span></td>
                <td>{event.record}</td>
              </tr>
            ))}
            {pagedEvents.length === 0 && (
              <tr><td className="admin-empty" colSpan="5">No audit events match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <TablePagination
        currentPage={currentPage}
        pageSize={PAGE_SIZE}
        totalItems={visibleEvents.length}
        onPageChange={setCurrentPage}
      />
    </section>
  )
}
