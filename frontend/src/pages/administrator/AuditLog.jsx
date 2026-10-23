import { useMemo, useState } from 'react'
import SearchInput from '../../components/data/SearchInput.jsx'
import TablePagination from '../../components/data/TablePagination.jsx'
import './AuditLog.css'

const PAGE_SIZE = 10

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
  const [roleFilter, setRoleFilter] = useState('All roles')
  const [currentPage, setCurrentPage] = useState(1)

  const visibleEvents = useMemo(() => auditEvents.filter((event) => {
    const matchesSearch = `${event.user} ${event.role} ${event.action} ${event.record}`.toLowerCase().includes(search.toLowerCase())
    return matchesSearch
      && (actionFilter === 'All activity' || event.action === actionFilter)
      && (roleFilter === 'All roles' || event.role === roleFilter)
  }), [actionFilter, roleFilter, search])

  const pagedEvents = visibleEvents.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  return (
    <section className="admin-page" aria-label="Audit log">
      <div className="admin-page__title-row admin-page__actions-row">
        <span className="admin-badge">Audit trail</span>
      </div>

      <div className="admin-toolbar" role="search">
        <SearchInput
          className="admin-toolbar__search"
          label="Search activity"
          placeholder="Staff member, request, or activity"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setCurrentPage(1)
          }}
        />
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
        <label className="admin-toolbar__field">
          Filter by role
          <select
            value={roleFilter}
            onChange={(event) => {
              setRoleFilter(event.target.value)
              setCurrentPage(1)
            }}
          >
            <option>All roles</option>
            {[...new Set(auditEvents.map((event) => event.role))].sort().map((role) => <option key={role}>{role}</option>)}
          </select>
        </label>
      </div>

      <section className="admin-list-card" aria-labelledby="audit-log-table-title">
        <header className="admin-list-card__heading"><div><h2 id="audit-log-table-title">AUDIT LOG</h2><p>Review staff actions and the records they changed.</p></div><div><span>{visibleEvents.length} {visibleEvents.length === 1 ? 'event' : 'events'}</span></div></header>
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
      </div></section>
      <TablePagination
        currentPage={currentPage}
        pageSize={PAGE_SIZE}
        totalItems={visibleEvents.length}
        onPageChange={setCurrentPage}
      />
    </section>
  )
}
