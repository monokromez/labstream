import { useState } from 'react'
import SearchInput from '../../components/data/SearchInput.jsx'
import TablePagination from '../../components/data/TablePagination.jsx'
import { api } from '../../api/client.js'
import useApiResource from '../../api/useApiResource.js'
import { formatDateTime } from '../../utils/dateFormat.js'
import './AuditLog.css'

const PAGE_SIZE = 10
const ROLE_OPTIONS = ['administrator', 'cashier', 'medical_technologist', 'pathologist', 'patient', 'system']

function formatRole(role) {
  return (role ?? 'system').replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

export default function AuditLog() {
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('All activity')
  const [roleFilter, setRoleFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const action = actionFilter === 'All activity' ? '' : actionFilter
  const { result, loading, error } = useApiResource(
    () => api.administrator.auditLogs({ page: currentPage, pageSize: PAGE_SIZE, q: search, action, role: roleFilter }),
    [currentPage, search, action, roleFilter],
  )
  const auditEvents = (result?.data ?? []).map((event) => ({
    id: event.id,
    timestamp: formatDateTime(event.createdAt),
    user: event.actor,
    role: formatRole(event.role),
    action: event.action,
    record: `${event.entityType}${event.entityId ? ` · ${event.entityId}` : ''}`,
  }))

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
            {(result?.actions ?? []).map((eventAction) => <option key={eventAction}>{eventAction}</option>)}
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
            <option value="">All roles</option>
            {ROLE_OPTIONS.map((role) => <option key={role} value={role}>{formatRole(role)}</option>)}
          </select>
        </label>
      </div>

      <section className="admin-list-card" aria-labelledby="audit-log-table-title">
        <header className="admin-list-card__heading"><div><h2 id="audit-log-table-title">AUDIT LOG</h2><p>Review staff actions and the records they changed.</p></div><div><span>{result?.pagination?.total ?? 0} events</span></div></header>
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
            {auditEvents.map((event) => (
              <tr key={event.id}>
                <td>{event.timestamp}</td>
                <td className="admin-table__primary">{event.user}</td>
                <td>{event.role}</td>
                <td><span className="admin-badge">{event.action}</span></td>
                <td>{event.record}</td>
              </tr>
            ))}
            {auditEvents.length === 0 && (
              <tr><td className="admin-empty" colSpan="5">{loading ? 'Loading activity…' : 'No audit events match these filters.'}</td></tr>
            )}
          </tbody>
        </table>
      </div></section>
      <TablePagination
        currentPage={result?.pagination?.page ?? currentPage}
        pageSize={PAGE_SIZE}
        totalItems={result?.pagination?.total ?? 0}
        onPageChange={setCurrentPage}
      />
    </section>
  )
}
