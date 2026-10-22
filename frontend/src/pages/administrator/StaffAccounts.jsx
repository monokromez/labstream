import { useMemo, useState } from 'react'
import SearchInput from '../../components/data/SearchInput.jsx'
import AdminDialog from '../../components/data/AdminDialog.jsx'
import TablePagination from '../../components/data/TablePagination.jsx'
import { formatDateTime } from '../../utils/dateFormat.js'
import './StaffAccounts.css'

const posts = ['Cashier', 'Medical Technologist', 'Pathologist']
const initialStaff = [
  { id: 1, firstName: 'Mia', middleName: 'Isabel', surname: 'Santos', email: 'mia.santos@labstream.test', post: 'Cashier', status: 'Active', lastSignIn: '2026-10-23T09:56:00' },
  { id: 2, firstName: 'Leo', middleName: 'Miguel', surname: 'Cruz', email: 'leo.cruz@labstream.test', post: 'Medical Technologist', status: 'Active', lastSignIn: '2026-10-23T10:18:00' },
  { id: 3, firstName: 'Ana', middleName: 'Marie', surname: 'Reyes', email: 'ana.reyes@labstream.test', post: 'Pathologist', status: 'Active', lastSignIn: '2026-10-23T10:42:00' },
  { id: 4, firstName: 'Nico', middleName: 'Luis', surname: 'Garcia', email: 'nico.garcia@labstream.test', post: 'Cashier', status: 'Inactive', lastSignIn: '2026-10-18T14:15:00' },
]
const emptyForm = { firstName: '', middleName: '', surname: '', dob: '', country: '', city: '', houseNo: '', street: '', contact: '', email: '', post: 'Cashier' }

function calculateAge(value) {
  if (!value) return ''
  const dob = new Date(`${value}T00:00:00`)
  if (Number.isNaN(dob.getTime())) return ''
  const now = new Date()
  return now.getFullYear() - dob.getFullYear() - (now < new Date(now.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0)
}

function displayName(person) {
  const middleInitial = person.middleName ? ` ${person.middleName.trim().charAt(0).toUpperCase()}.` : ''
  return `${person.firstName}${middleInitial} ${person.surname}`.trim()
}

export default function StaffAccounts() {
  const [staff, setStaff] = useState(initialStaff)
  const [search, setSearch] = useState('')
  const [postFilter, setPostFilter] = useState('All posts')
  const [statusFilter, setStatusFilter] = useState('All statuses')
  const [dialog, setDialog] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [page, setPage] = useState(1)
  const pageSize = 10

  const visibleStaff = useMemo(() => staff.filter((person) => {
    const matchesSearch = `${displayName(person)} ${person.email}`.toLowerCase().includes(search.toLowerCase())
    return matchesSearch && (postFilter === 'All posts' || person.post === postFilter)
      && (statusFilter === 'All statuses' || person.status === statusFilter)
  }), [postFilter, search, staff, statusFilter])
  const pageRows = visibleStaff.slice((page - 1) * pageSize, page * pageSize)

  function openAdd() { setForm(emptyForm); setDialog({ type: 'add' }) }
  function commitAdd() {
    setStaff((current) => [...current, { ...form, id: Date.now(), status: 'Active', lastSignIn: null }])
    setForm(emptyForm)
    setDialog(null)
    setPage(Math.ceil((visibleStaff.length + 1) / pageSize))
  }
  function commitStatus() {
    const { person } = dialog
    setStaff((current) => current.map((item) => item.id === person.id ? { ...item, status: item.status === 'Active' ? 'Inactive' : 'Active' } : item))
    setDialog(null)
  }

  return (
    <section className="admin-page" aria-label="Staff accounts">
      <div className="admin-page__title-row"><div><h2>Staff directory</h2><p>Manage staff access and assigned system roles.</p></div><button className="admin-button" type="button" onClick={openAdd}>Add staff member</button></div>
      <div className="admin-toolbar" role="search">
        <SearchInput className="admin-toolbar__search" label="Search staff" placeholder="Name or email" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} />
        <label className="admin-toolbar__field">Filter by post<select value={postFilter} onChange={(event) => { setPostFilter(event.target.value); setPage(1) }}><option>All posts</option>{posts.map((post) => <option key={post}>{post}</option>)}</select></label>
        <label className="admin-toolbar__field">Filter by account status<select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }}><option>All statuses</option><option>Active</option><option>Inactive</option></select></label>
      </div>
      <div className="admin-table-wrap"><table className="admin-table">
        <thead><tr><th>Name</th><th>Post</th><th>Last sign in</th><th>Account status</th><th><span className="visually-hidden">Account action</span></th></tr></thead>
        <tbody>
          {pageRows.map((person) => <tr key={person.id}>
            <td className="admin-table__primary">{displayName(person)}<span className="admin-table__secondary">{person.email}</span></td>
            <td>{person.post}</td><td>{formatDateTime(person.lastSignIn)}</td>
            <td><span className={`admin-badge ${person.status === 'Active' ? 'admin-badge--success' : 'admin-badge--muted'}`}>{person.status}</span></td>
            <td><button className="admin-button admin-button--secondary admin-button--small" type="button" onClick={() => setDialog({ type: 'status', person })}>{person.status === 'Active' ? 'Deactivate' : 'Activate'}</button></td>
          </tr>)}
          {visibleStaff.length === 0 && <tr><td className="admin-empty" colSpan="5">No staff accounts match your filters.</td></tr>}
        </tbody>
      </table></div>
      <TablePagination currentPage={page} pageSize={pageSize} totalItems={visibleStaff.length} onPageChange={setPage} />

      {dialog?.type === 'add' && <AdminDialog title="Add staff member" description="Enter the staff member’s details and assign an eligible post." onClose={() => setDialog(null)} size="large">
        <form id="staff-add-form" className="admin-dialog__form admin-dialog__form--staff" onSubmit={(event) => { event.preventDefault(); setDialog({ type: 'confirm-add' }) }}>
          <section className="admin-dialog__section" aria-labelledby="staff-personal-heading">
            <h3 className="admin-dialog__section-heading" id="staff-personal-heading">Personal Details</h3>
            <label className="admin-dialog__field">First name<input required autoComplete="given-name" value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} /></label>
            <label className="admin-dialog__field">Middle name<input autoComplete="additional-name" value={form.middleName} onChange={(event) => setForm({ ...form, middleName: event.target.value })} /></label>
            <label className="admin-dialog__field">Surname<input required autoComplete="family-name" value={form.surname} onChange={(event) => setForm({ ...form, surname: event.target.value })} /></label>
            <label className="admin-dialog__field">Date of birth<input required type="date" value={form.dob} onChange={(event) => setForm({ ...form, dob: event.target.value })} /></label>
            <label className="admin-dialog__field">Age (calculated)<input readOnly value={calculateAge(form.dob)} placeholder="Calculated from date of birth" /></label>
          </section>
          <section className="admin-dialog__section" aria-labelledby="staff-contact-heading">
            <h3 className="admin-dialog__section-heading" id="staff-contact-heading">Address and Contact</h3>
            <label className="admin-dialog__field">Country<input required autoComplete="country-name" value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} /></label>
            <label className="admin-dialog__field">City<input required autoComplete="address-level2" value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} /></label>
            <label className="admin-dialog__field">House no.<input required autoComplete="address-line2" value={form.houseNo} onChange={(event) => setForm({ ...form, houseNo: event.target.value })} /></label>
            <label className="admin-dialog__field">Street<input required autoComplete="address-line1" value={form.street} onChange={(event) => setForm({ ...form, street: event.target.value })} /></label>
            <label className="admin-dialog__field">Contact number<input required type="tel" autoComplete="tel" value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} /></label>
            <label className="admin-dialog__field">Email address<input required type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
          </section>
          <section className="admin-dialog__section" aria-labelledby="staff-role-heading">
            <h3 className="admin-dialog__section-heading" id="staff-role-heading">Role</h3>
            <label className="admin-dialog__field">Post / role<select value={form.post} onChange={(event) => setForm({ ...form, post: event.target.value })}>{posts.map((post) => <option key={post}>{post}</option>)}</select></label>
          </section>
        </form>
        <div className="admin-dialog__footer"><button className="admin-button admin-button--secondary" type="button" onClick={() => setDialog(null)}>Cancel</button><button className="admin-button" type="submit" form="staff-add-form">Review account</button></div>
      </AdminDialog>}
      {dialog?.type === 'confirm-add' && <AdminDialog title="Confirm staff account" onClose={() => setDialog(null)} size="small"><p className="admin-dialog__confirm">Add <strong>{form.firstName} {form.surname}</strong> as <strong>{form.post}</strong>?</p><div className="admin-dialog__footer"><button className="admin-button admin-button--secondary" type="button" onClick={() => setDialog({ type: 'add' })}>Back</button><button className="admin-button" type="button" onClick={commitAdd}>Confirm add</button></div></AdminDialog>}
      {dialog?.type === 'status' && <AdminDialog title={`${dialog.person.status === 'Active' ? 'Deactivate' : 'Activate'} account?`} onClose={() => setDialog(null)} size="small"><p className="admin-dialog__confirm">Confirm {dialog.person.status === 'Active' ? 'deactivating' : 'activating'} <strong>{displayName(dialog.person)}</strong>’s staff account?</p><div className="admin-dialog__footer"><button className="admin-button admin-button--secondary" type="button" onClick={() => setDialog(null)}>Cancel</button><button className="admin-button" type="button" onClick={commitStatus}>Confirm</button></div></AdminDialog>}
    </section>
  )
}
