import { useMemo, useState } from 'react'
import SearchInput from '../../components/data/SearchInput.jsx'
import CountryCityFields from '../../components/data/CountryCityFields.jsx'
import AdminDialog from '../../components/data/AdminDialog.jsx'
import TablePagination from '../../components/data/TablePagination.jsx'
import PlusIcon from '../../components/data/PlusIcon.jsx'
import { AsYouType, parsePhoneNumberFromString } from 'libphonenumber-js/min'
import { formatDateTime } from '../../utils/dateFormat.js'
import { api } from '../../api/client.js'
import useApiResource from '../../api/useApiResource.js'
import { getPatientCallingCode } from '../cashier/patientValidation.js'
import { getStaffFormErrors } from './staffValidation.js'
import './StaffAccounts.css'

const posts = ['Cashier', 'Medical Technologist', 'Pathologist']
const emptyForm = { firstName: '', middleName: '', surname: '', dob: '', country: '', city: '', countryCode: '', houseNo: '', street: '', contact: '', email: '', post: 'Cashier' }

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
  const { result: staffResult, error: loadError, refresh } = useApiResource(() => api.staff.list({ page: 1, pageSize: 100 }), [])
  const staff = (staffResult?.data ?? []).map((person) => ({
    ...person,
    surname: person.lastName,
    post: person.role.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
    status: person.isActive ? 'Active' : 'Inactive',
    lastSignIn: person.lastSignInAt,
  }))
  const [search, setSearch] = useState('')
  const [postFilter, setPostFilter] = useState('All posts')
  const [statusFilter, setStatusFilter] = useState('All statuses')
  const [dialog, setDialog] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [touched, setTouched] = useState({})
  const [page, setPage] = useState(1)
  const pageSize = 10

  const staffErrors = getStaffFormErrors({
    firstName: form.firstName,
    middleName: form.middleName,
    surname: form.surname,
    dob: form.dob,
    country: form.country,
    city: form.city,
    houseNo: form.houseNo,
    street: form.street,
    contact: form.contact,
    email: form.email,
    post: form.post,
  }, { countryCode: form.countryCode, countryName: form.country })
  const staffCallingCode = getPatientCallingCode(form.countryCode)

  const visibleStaffError = (field) => (touched[field] ? staffErrors[field] : '')
  const markTouched = (field) => setTouched((current) => ({ ...current, [field]: true }))
  const handleStaffPhoneChange = (value) => {
    setForm((current) => ({
      ...current,
      contact: new AsYouType(current.countryCode).input(value.replace(/\D/g, '').slice(0, 15)),
    }))
  }
  const validateStaffForm = (nextForm = form) => {
    const errors = getStaffFormErrors({
      firstName: nextForm.firstName,
      middleName: nextForm.middleName,
      surname: nextForm.surname,
      dob: nextForm.dob,
      country: nextForm.country,
      city: nextForm.city,
      houseNo: nextForm.houseNo,
      street: nextForm.street,
      contact: nextForm.contact,
      email: nextForm.email,
      post: nextForm.post,
    }, { countryCode: nextForm.countryCode, countryName: nextForm.country })
    return Object.values(errors).every((message) => !message)
  }

  const visibleStaff = useMemo(() => staff.filter((person) => {
    const matchesSearch = `${displayName(person)} ${person.email}`.toLowerCase().includes(search.toLowerCase())
    return matchesSearch && (postFilter === 'All posts' || person.post === postFilter)
      && (statusFilter === 'All statuses' || person.status === statusFilter)
  }), [postFilter, search, staff, statusFilter])
  const pageRows = visibleStaff.slice((page - 1) * pageSize, page * pageSize)

  function openAdd() { setForm(emptyForm); setTouched({}); setDialog({ type: 'add' }) }
  async function commitAdd() {
    const nextForm = form
    if (!validateStaffForm(nextForm)) {
      setTouched({
        firstName: true, middleName: true, surname: true, dob: true, country: true,
        city: true, houseNo: true, street: true, contact: true, email: true, post: true,
      })
      setDialog({ type: 'add' })
      return
    }
    const phone = parsePhoneNumberFromString(form.contact, form.countryCode)
    if (!phone?.isValid() || phone.country !== form.countryCode) {
      setTouched((current) => ({ ...current, contact: true }))
      setDialog({ type: 'add' })
      return
    }
    try {
      const result = await api.staff.create({
        firstName: form.firstName, middleName: form.middleName || null, lastName: form.surname,
        dateOfBirth: form.dob, country: form.country, city: form.city, houseNumber: form.houseNo,
        street: form.street, phone: phone.number, email: form.email,
        role: form.post.toLowerCase().replaceAll(' ', '_'),
      })
      setDialog({ type: 'created', username: result.data.username, activationCode: result.activation.code })
      setForm(emptyForm)
      await refresh()
    } catch (error) { setDialog({ type: 'error', message: error.message }) }
  }
  async function commitStatus() {
    const { person } = dialog
    try {
      await api.staff.setActive(person.id, person.status !== 'Active')
      setDialog(null)
      await refresh()
    } catch (error) { setDialog({ type: 'error', message: error.message }) }
  }

  return (
    <section className="admin-page" aria-label="Staff accounts">
      {loadError && <p role="alert">{loadError}</p>}
      <div className="admin-page__controls-row">
        <div className="admin-toolbar" role="search">
          <SearchInput className="admin-toolbar__search" label="Search staff" placeholder="Name or email" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} />
          <label className="admin-toolbar__field">Filter by post<select value={postFilter} onChange={(event) => { setPostFilter(event.target.value); setPage(1) }}><option>All posts</option>{posts.map((post) => <option key={post}>{post}</option>)}</select></label>
          <label className="admin-toolbar__field">Filter by account status<select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }}><option>All statuses</option><option>Active</option><option>Inactive</option></select></label>
        </div>
      </div>
      <section className="admin-list-card" aria-labelledby="staff-table-title">
      <header className="admin-list-card__heading"><div><h2 id="staff-table-title">STAFF ACCOUNTS</h2><p>Manage staff roles, sign-in activity, and access status.</p></div><div><span>{visibleStaff.length} {visibleStaff.length === 1 ? 'staff member' : 'staff members'}</span><button className="admin-button" type="button" onClick={openAdd}><PlusIcon /> STAFF MEMBER</button></div></header>
      <div className="admin-table-wrap"><table className="admin-table">
        <thead><tr><th>Name</th><th>Post</th><th>Last sign in</th><th>Account status</th><th><span className="visually-hidden">Account action</span></th></tr></thead>
        <tbody>
          {pageRows.map((person) => <tr key={person.id}>
            <td className="admin-table__primary">{displayName(person)}<span className="admin-table__secondary">{person.email}</span></td>
            <td>{person.post}</td><td>{formatDateTime(person.lastSignIn)}</td>
            <td><span className={`admin-badge ${person.status === 'Active' ? 'admin-badge--success' : 'admin-badge--muted'}`}>{person.status}</span></td>
            <td><button className={`admin-button admin-button--small ${person.status === 'Active' ? 'admin-button--negative' : 'admin-button--positive'}`} type="button" onClick={() => setDialog({ type: 'status', person })}>{person.status === 'Active' ? 'Deactivate' : 'Activate'}</button></td>
          </tr>)}
          {visibleStaff.length === 0 && <tr><td className="admin-empty" colSpan="5">No staff accounts match your filters.</td></tr>}
        </tbody>
      </table></div></section>
      <TablePagination currentPage={page} pageSize={pageSize} totalItems={visibleStaff.length} onPageChange={setPage} />

      {dialog?.type === 'add' && <AdminDialog title="Add staff member" description="Enter the staff member’s details and assign an eligible post." onClose={() => setDialog(null)} size="large">
        <form id="staff-add-form" className="admin-dialog__form admin-dialog__form--staff" onSubmit={(event) => {
          event.preventDefault()
          const nextTouched = { firstName: true, middleName: true, surname: true, dob: true, country: true, city: true, houseNo: true, street: true, contact: true, email: true, post: true }
          setTouched(nextTouched)
          if (!validateStaffForm()) return
          setDialog({ type: 'confirm-add' })
        }}>
          <section className="admin-dialog__section" aria-labelledby="staff-personal-heading">
            <h3 className="admin-dialog__section-heading" id="staff-personal-heading">Personal Details</h3>
            <label className="admin-dialog__field" htmlFor="staff-first-name">First name
              <input id="staff-first-name" required autoComplete="given-name" aria-invalid={Boolean(visibleStaffError('firstName'))} value={form.firstName} onBlur={() => markTouched('firstName')} onChange={(event) => setForm({ ...form, firstName: event.target.value })} />
              {visibleStaffError('firstName') && <span className="admin-dialog__field-error" role="alert">{visibleStaffError('firstName')}</span>}
            </label>
            <label className="admin-dialog__field" htmlFor="staff-middle-name">Middle name
              <input id="staff-middle-name" autoComplete="additional-name" aria-invalid={Boolean(visibleStaffError('middleName'))} value={form.middleName} onBlur={() => markTouched('middleName')} onChange={(event) => setForm({ ...form, middleName: event.target.value })} />
              {visibleStaffError('middleName') && <span className="admin-dialog__field-error" role="alert">{visibleStaffError('middleName')}</span>}
            </label>
            <label className="admin-dialog__field" htmlFor="staff-surname">Surname
              <input id="staff-surname" required autoComplete="family-name" aria-invalid={Boolean(visibleStaffError('surname'))} value={form.surname} onBlur={() => markTouched('surname')} onChange={(event) => setForm({ ...form, surname: event.target.value })} />
              {visibleStaffError('surname') && <span className="admin-dialog__field-error" role="alert">{visibleStaffError('surname')}</span>}
            </label>
            <label className="admin-dialog__field" htmlFor="staff-dob">Date of birth
              <input id="staff-dob" required type="date" aria-invalid={Boolean(visibleStaffError('dob'))} value={form.dob} onBlur={() => markTouched('dob')} onChange={(event) => setForm({ ...form, dob: event.target.value })} />
              {visibleStaffError('dob') && <span className="admin-dialog__field-error" role="alert">{visibleStaffError('dob')}</span>}
            </label>
            <label className="admin-dialog__field" htmlFor="staff-age">Age (calculated)
              <input id="staff-age" readOnly value={calculateAge(form.dob)} placeholder="Calculated from date of birth" />
            </label>
          </section>
          <section className="admin-dialog__section" aria-labelledby="staff-contact-heading">
            <h3 className="admin-dialog__section-heading" id="staff-contact-heading">Address and Contact</h3>
            <CountryCityFields
              idPrefix="staff-address"
              fieldClassName="admin-dialog__field"
              country={form.country}
              city={form.city}
              countryError={visibleStaffError('country')}
              cityError={visibleStaffError('city')}
              onCountryBlur={() => markTouched('country')}
              onCityBlur={() => markTouched('city')}
              onCountryChange={(country) => setForm((current) => ({ ...current, country, city: '', contact: '', countryCode: '' }))}
              onCountryCodeChange={(countryCode) => setForm((current) => ({ ...current, countryCode }))}
              onCityChange={(city) => setForm((current) => ({ ...current, city }))}
            />
            <label className="admin-dialog__field" htmlFor="staff-house-no">House no.
              <input id="staff-house-no" required autoComplete="address-line2" aria-invalid={Boolean(visibleStaffError('houseNo'))} value={form.houseNo} onBlur={() => markTouched('houseNo')} onChange={(event) => setForm({ ...form, houseNo: event.target.value })} />
              {visibleStaffError('houseNo') && <span className="admin-dialog__field-error" role="alert">{visibleStaffError('houseNo')}</span>}
            </label>
            <label className="admin-dialog__field" htmlFor="staff-street">Street
              <input id="staff-street" required autoComplete="address-line1" aria-invalid={Boolean(visibleStaffError('street'))} value={form.street} onBlur={() => markTouched('street')} onChange={(event) => setForm({ ...form, street: event.target.value })} />
              {visibleStaffError('street') && <span className="admin-dialog__field-error" role="alert">{visibleStaffError('street')}</span>}
            </label>
            <label className="admin-dialog__field" htmlFor="staff-contact">Contact number
              <span className="admin-dialog__phone-field" aria-invalid={Boolean(visibleStaffError('contact'))}>
                <span>+{staffCallingCode}</span>
                <input id="staff-contact" required type="tel" autoComplete="tel-national" inputMode="tel" minLength={7} maxLength={30} placeholder="Mobile number" aria-invalid={Boolean(visibleStaffError('contact'))} value={form.contact} onBlur={() => markTouched('contact')} onChange={(event) => handleStaffPhoneChange(event.target.value)} />
              </span>
              {visibleStaffError('contact') && <span className="admin-dialog__field-error" role="alert">{visibleStaffError('contact')}</span>}
            </label>
            <label className="admin-dialog__field" htmlFor="staff-email">Email address
              <input id="staff-email" required type="email" autoComplete="email" maxLength={254} aria-invalid={Boolean(visibleStaffError('email'))} value={form.email} onBlur={() => markTouched('email')} onChange={(event) => setForm({ ...form, email: event.target.value })} />
              {visibleStaffError('email') && <span className="admin-dialog__field-error" role="alert">{visibleStaffError('email')}</span>}
            </label>
          </section>
          <section className="admin-dialog__section" aria-labelledby="staff-role-heading">
            <h3 className="admin-dialog__section-heading" id="staff-role-heading">Role</h3>
            <label className="admin-dialog__field" htmlFor="staff-post">Post / role
              <select id="staff-post" aria-invalid={Boolean(visibleStaffError('post'))} value={form.post} onBlur={() => markTouched('post')} onChange={(event) => setForm({ ...form, post: event.target.value })}>{posts.map((post) => <option key={post}>{post}</option>)}</select>
              {visibleStaffError('post') && <span className="admin-dialog__field-error" role="alert">{visibleStaffError('post')}</span>}
            </label>
          </section>
        </form>
        <div className="admin-dialog__footer"><button className="admin-button admin-button--secondary" type="button" onClick={() => setDialog(null)}>Cancel</button><button className="admin-button" type="submit" form="staff-add-form">Review account</button></div>
      </AdminDialog>}
      {dialog?.type === 'confirm-add' && <AdminDialog title="Confirm staff account" onClose={() => setDialog(null)} size="small"><p className="admin-dialog__confirm">Add <strong>{form.firstName} {form.surname}</strong> as <strong>{form.post}</strong>?</p><div className="admin-dialog__footer"><button className="admin-button admin-button--secondary" type="button" onClick={() => setDialog({ type: 'add' })}>Back</button><button className="admin-button" type="button" onClick={commitAdd}>Confirm add</button></div></AdminDialog>}
      {dialog?.type === 'created' && <AdminDialog title="Staff account created" onClose={() => setDialog(null)} size="small"><p>Share these one-time activation details with the staff member. The code is shown only now.</p><p>Username: <strong>{dialog.username}</strong></p><p>Activation code: <strong>{dialog.activationCode}</strong></p><div className="admin-dialog__footer"><button className="admin-button" type="button" onClick={() => { setDialog(null); setPage(1) }}>Done</button></div></AdminDialog>}
      {dialog?.type === 'error' && <AdminDialog title="Unable to complete action" onClose={() => setDialog(null)} size="small"><p role="alert">{dialog.message}</p><div className="admin-dialog__footer"><button className="admin-button" type="button" onClick={() => setDialog(null)}>Close</button></div></AdminDialog>}
      {dialog?.type === 'status' && <AdminDialog title={`${dialog.person.status === 'Active' ? 'Deactivate' : 'Activate'} account?`} onClose={() => setDialog(null)} size="small"><p className="admin-dialog__confirm">Confirm {dialog.person.status === 'Active' ? 'deactivating' : 'activating'} <strong>{displayName(dialog.person)}</strong>’s staff account?</p><div className="admin-dialog__footer"><button className="admin-button admin-button--secondary" type="button" onClick={() => setDialog(null)}>Cancel</button><button className={`admin-button ${dialog.person.status === 'Active' ? 'admin-button--negative' : 'admin-button--positive'}`} type="button" onClick={commitStatus}>Confirm</button></div></AdminDialog>}
    </section>
  )
}
