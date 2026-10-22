import { useMemo, useState } from 'react'
import './StaffAccounts.css'

const initialStaff = [
  { id: 1, name: 'Mia Santos', email: 'mia.santos@labstream.test', role: 'Cashier', status: 'Active', lastSignIn: 'Today, 9:56 AM' },
  { id: 2, name: 'Leo Cruz', email: 'leo.cruz@labstream.test', role: 'Medical Technologist', status: 'Active', lastSignIn: 'Today, 10:18 AM' },
  { id: 3, name: 'Dr. Ana Reyes', email: 'ana.reyes@labstream.test', role: 'Pathologist', status: 'Active', lastSignIn: 'Today, 10:42 AM' },
  { id: 4, name: 'Nico Garcia', email: 'nico.garcia@labstream.test', role: 'Cashier', status: 'Inactive', lastSignIn: 'Oct 18, 2026' },
]

export default function StaffAccounts() {
  const [staff, setStaff] = useState(initialStaff)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('All roles')
  const [isAdding, setIsAdding] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', role: 'Cashier' })

  const visibleStaff = useMemo(() => staff.filter((person) => {
    const matchesSearch = `${person.name} ${person.email}`.toLowerCase().includes(search.toLowerCase())
    return matchesSearch && (roleFilter === 'All roles' || person.role === roleFilter)
  }), [roleFilter, search, staff])

  function addStaff(event) {
    event.preventDefault()
    setStaff((current) => [
      ...current,
      { ...form, id: Date.now(), status: 'Active', lastSignIn: 'Never' },
    ])
    setForm({ name: '', email: '', role: 'Cashier' })
    setIsAdding(false)
  }

  function toggleStatus(id) {
    setStaff((current) => current.map((person) => (
      person.id === id
        ? { ...person, status: person.status === 'Active' ? 'Inactive' : 'Active' }
        : person
    )))
  }

  function updateRole(id, role) {
    setStaff((current) => current.map((person) => (
      person.id === id ? { ...person, role } : person
    )))
  }

  return (
    <section className="admin-page" aria-label="Staff accounts">
      <div className="admin-page__title-row">
        <div>
          <h2>Staff directory</h2>
          <p>Manage staff access and assigned system roles.</p>
        </div>
        <button className="admin-button" type="button" onClick={() => setIsAdding((current) => !current)}>
          {isAdding ? 'Close form' : 'Add staff member'}
        </button>
      </div>

      {isAdding && (
        <form className="admin-form" onSubmit={addStaff}>
          <label className="admin-form__field">
            Full name
            <input
              autoComplete="name"
              required
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </label>
          <label className="admin-form__field">
            Email address
            <input
              autoComplete="email"
              type="email"
              required
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
          </label>
          <label className="admin-form__field">
            System role
            <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
              <option>Cashier</option>
              <option>Medical Technologist</option>
              <option>Pathologist</option>
              <option>Administrator</option>
            </select>
          </label>
          <div className="admin-form__actions">
            <button className="admin-button" type="submit">Add account</button>
            <button className="admin-button admin-button--secondary" type="button" onClick={() => setIsAdding(false)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="admin-toolbar" role="search">
        <label className="admin-toolbar__field admin-toolbar__field--search">
          Search staff
          <input
            type="search"
            placeholder="Name or email"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label className="admin-toolbar__field">
          Filter by role
          <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
            <option>All roles</option>
            <option>Cashier</option>
            <option>Medical Technologist</option>
            <option>Pathologist</option>
            <option>Administrator</option>
          </select>
        </label>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">Staff member</th>
              <th scope="col">Role</th>
              <th scope="col">Last sign in</th>
              <th scope="col">Account status</th>
              <th scope="col"><span className="visually-hidden">Account action</span></th>
            </tr>
          </thead>
          <tbody>
            {visibleStaff.map((person) => (
              <tr key={person.id}>
                <td className="admin-table__primary">
                  {person.name}
                  <span className="admin-table__secondary">{person.email}</span>
                </td>
                <td>
                  <select
                    aria-label={`Role for ${person.name}`}
                    value={person.role}
                    onChange={(event) => updateRole(person.id, event.target.value)}
                  >
                    <option>Cashier</option>
                    <option>Medical Technologist</option>
                    <option>Pathologist</option>
                    <option>Administrator</option>
                  </select>
                </td>
                <td>{person.lastSignIn}</td>
                <td><span className={`admin-badge ${person.status === 'Active' ? 'admin-badge--success' : 'admin-badge--muted'}`}>{person.status}</span></td>
                <td>
                  <button
                    className="admin-button admin-button--secondary admin-button--small"
                    type="button"
                    onClick={() => toggleStatus(person.id)}
                    aria-label={`${person.status === 'Active' ? 'Deactivate' : 'Activate'} ${person.name}`}
                  >
                    {person.status === 'Active' ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
            {visibleStaff.length === 0 && (
              <tr><td className="admin-empty" colSpan="5">No staff accounts match your search.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
