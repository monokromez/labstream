import { useMemo, useState } from 'react'
import SearchInput from '../../components/data/SearchInput.jsx'
import TablePagination from '../../components/data/TablePagination.jsx'
import { api } from '../../api/client.js'
import useApiResource from '../../api/useApiResource.js'
import { formatDateTime } from '../../utils/dateFormat.js'
import './AuditLog.css'

const PAGE_SIZE = 10

export default function AuditLog() {
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('All activity')
  const [roleFilter, setRoleFilter] = useState('All roles')
  const [currentPage, setCurrentPage] = useState(1)
  const { result, loading, error } = useApiResource(() => api.administrator.auditLogs({ page: 1, pageSize: 100, role: roleFilter === 'All roles' ? '' : roleFilter.toLowerCase().replaceAll(' ', '_') }), [roleFilter])
  const auditEvents = (result?.data ?? []).map((event) => ({
    id: event.id,
    timestamp: formatDateTime(event.createdAt),
    user: event.actor,
    role: (event.role ?? 'system').replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
    action: event.action,
    record: `${event.entityType}${event.entityId ? ` · ${event.entityId}` : ''}`,
  }))

  const visibleEvents = useMemo(() => auditEvents.filter((event) => {
    const matchesSearch = `${event.user} ${event.role} ${event.action} ${event.record}`.toLowerCase().includes(search.toLowerCase())
    return matchesSearch
      && (actionFilter === 'All activity' || event.action === actionFilter)
      && (roleFilter === 'All roles' || event.role === roleFilter)
  }), [actionFilter, roleFilter, search])

  const pagedEvents = visibleEvents.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  return (
    <section className="admin-page" aria-label="Audit log">
      {error && <p role="alert">{error}</p>}
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
              <tr><td className="admin-empty" colSpan="5">{loading ? 'Loading activity…' : 'No audit events match these filters.'}</td></tr>
            )}
          </tbody>
        </table>
      </div></section>
      <TablePagination
        currentPage={currentPage}
        pageSize={PAGE_SIZE}
        totalItems={result?.pagination?.total ?? visibleEvents.length}
        onPageChange={setCurrentPage}
      />
    </section>
  )
}
