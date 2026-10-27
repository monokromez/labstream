import { useState } from 'react'
import { api } from '../api/client.js'
import useApiResource from '../api/useApiResource.js'
import SummaryCard from '../components/reports/SummaryCard.jsx'
import { formatDate, formatDateTime } from '../utils/dateFormat.js'
import './PatientPortal.css'

const describeStatus = (status = '') => String(status).replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase())

export default function PatientPortal({ onNavigate }) {
  const { result, loading, error, setResult } = useApiResource(() => api.patient.results({ page: 1, pageSize: 8 }), [])
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [profileFieldErrors, setProfileFieldErrors] = useState({})
  const [profileNotice, setProfileNotice] = useState('')
  const [profileForm, setProfileForm] = useState({ firstName: '', middleName: '', lastName: '', email: '', phone: '' })
  const requests = result?.data ?? []
  const patient = result?.patient
  const clinic = result?.clinic
  const summary = result?.summary ?? {}
  const releasedRequests = requests.filter((request) => request.resultVisibility === 'released').slice(0, 4)
  const pendingRequests = requests.filter((request) => request.resultVisibility !== 'released').slice(0, 4)
  const totalTests = Number(summary.totalTests ?? 0)
  const releasedTests = Number(summary.releasedTests ?? 0)
  const unreleasedTests = Number(summary.unreleasedTests ?? 0)

  function openProfileEditor() {
    setProfileForm({
      firstName: patient?.firstName ?? '',
      middleName: patient?.middleName ?? '',
      lastName: patient?.lastName ?? '',
      email: patient?.email ?? '',
      phone: patient?.phone ?? '',
    })
    setProfileError('')
    setProfileFieldErrors({})
    setProfileNotice('')
    setEditingProfile(true)
  }

  async function saveProfile(event) {
    event.preventDefault()
    if (profileSaving) return
    setProfileSaving(true)
    setProfileError('')
    setProfileFieldErrors({})
    try {
      const response = await api.patient.updateProfile(profileForm)
      const updated = response.data
      setResult((current) => ({
        ...current,
        patient: {
          ...current.patient,
          ...updated,
          name: [updated.firstName, updated.middleName, updated.lastName].filter(Boolean).join(' '),
        },
      }))
      setEditingProfile(false)
      setProfileNotice('Your profile was updated.')
    } catch (requestError) {
      setProfileError(requestError.message || 'Unable to update your profile.')
      setProfileFieldErrors(requestError.details?.fields ?? {})
    } finally {
      setProfileSaving(false)
    }
  }

  return (
    <section className="patient-portal" aria-label="Patient portal overview">
      {error && <p className="patient-portal__error" role="alert">{error}</p>}
      {profileNotice && <p className="patient-portal__success" role="status">{profileNotice}</p>}

      <header className="patient-portal__welcome">
        <div>
          <p className="patient-portal__eyebrow">{clinic?.name || 'Patient portal'}</p>
          <h2>Welcome back{patient?.name ? `, ${patient.name}` : ''}</h2>
          <p className="patient-portal__identity">
            PID <strong>{patient?.pid || '—'}</strong>
            {patient?.dateOfBirth ? <> · Born {formatDate(patient.dateOfBirth)}</> : null}
            {patient?.sex ? <> · {patient.sex}</> : null}
          </p>
        </div>
        <div className="patient-portal__welcome-actions">
          <button className="patient-portal__button" type="button" onClick={openProfileEditor} disabled={!patient}>
            Edit profile
          </button>
          <button className="patient-portal__button patient-portal__button--primary" type="button" onClick={() => onNavigate?.('my-results')}>
            My results
          </button>
          <button className="patient-portal__button" type="button" onClick={() => onNavigate?.('test-history')}>
            Test history
          </button>
        </div>
      </header>

      <div className="patient-portal__summary">
        <SummaryCard title="Released results" value={String(releasedTests).padStart(2, '0')} helperText="Tests you can open and download" />
        <SummaryCard title="Awaiting release" value={String(unreleasedTests).padStart(2, '0')} helperText="Tests still being processed or reviewed" />
        <SummaryCard title="Total tests" value={String(totalTests).padStart(2, '0')} helperText="All tests in your requests" />
      </div>

      <div className="patient-portal__columns">
        <section className="patient-portal__panel" aria-labelledby="patient-portal-released-title">
          <header className="patient-portal__panel-heading">
            <div>
              <h3 id="patient-portal-released-title">Latest released results</h3>
              <p>Requests where every test has been approved by the pathologist.</p>
            </div>
            <span>{releasedRequests.length}</span>
          </header>
          <ul className="patient-portal__list">
            {releasedRequests.map((request) => (
              <li className="patient-portal__item" key={request.id}>
                <div>
                  <strong className="patient-portal__item-title">{request.requestNumber}</strong>
                  <p>{request.testCount} {Number(request.testCount) === 1 ? 'test' : 'tests'} · Released {formatDate(request.releasedAt)}</p>
                </div>
                <button className="patient-portal__button" type="button" onClick={() => onNavigate?.('my-results')}>
                  View
                </button>
              </li>
            ))}
            {!loading && releasedRequests.length === 0 && (
              <li className="patient-portal__empty">No released results yet. Results appear here once the laboratory releases them.</li>
            )}
            {loading && <li className="patient-portal__empty">Loading your results…</li>}
          </ul>
        </section>

        <section className="patient-portal__panel" aria-labelledby="patient-portal-progress-title">
          <header className="patient-portal__panel-heading">
            <div>
              <h3 id="patient-portal-progress-title">In progress</h3>
              <p>Requests still moving through specimens, results, or review.</p>
            </div>
            <span>{pendingRequests.length}</span>
          </header>
          <ul className="patient-portal__list">
            {pendingRequests.map((request) => (
              <li className="patient-portal__item" key={request.id}>
                <div>
                  <strong className="patient-portal__item-title">{request.requestNumber}</strong>
                  <p>{request.testCount} {Number(request.testCount) === 1 ? 'test' : 'tests'} · Requested {formatDateTime(request.requestedAt)}</p>
                </div>
                <span className="patient-portal__status">{describeStatus(request.status)}</span>
              </li>
            ))}
            {!loading && pendingRequests.length === 0 && (
              <li className="patient-portal__empty">Nothing is in progress right now.</li>
            )}
            {loading && <li className="patient-portal__empty">Loading your requests…</li>}
          </ul>
        </section>
      </div>

      <p className="patient-portal__notice">
        For your privacy, results are only shown after the pathologist approves and releases them. Test details are never included in email.
      </p>

      {editingProfile && (
        <div className="patient-portal__profile-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !profileSaving) setEditingProfile(false)
        }}>
          <section className="patient-portal__profile-dialog" role="dialog" aria-modal="true" aria-labelledby="patient-profile-title">
            <header className="patient-portal__profile-heading">
              <div>
                <h2 id="patient-profile-title">Edit profile</h2>
                <p>Update your name and contact details. Your PID, birth date, sex, and ID information cannot be changed here.</p>
              </div>
              <button className="patient-portal__profile-close" type="button" aria-label="Close profile editor" disabled={profileSaving} onClick={() => setEditingProfile(false)}>×</button>
            </header>
            <form className="patient-portal__profile-form" onSubmit={saveProfile}>
              {profileError && <p className="patient-portal__error" role="alert">{profileError}</p>}
              <label>First name
                <input name="firstName" autoComplete="given-name" required minLength={2} maxLength={50} value={profileForm.firstName} aria-invalid={Boolean(profileFieldErrors.firstName)} onChange={(event) => setProfileForm((current) => ({ ...current, firstName: event.target.value }))} />
                {profileFieldErrors.firstName && <span className="patient-portal__field-error">{profileFieldErrors.firstName}</span>}
              </label>
              <label>Middle name
                <input name="middleName" autoComplete="additional-name" maxLength={50} value={profileForm.middleName} aria-invalid={Boolean(profileFieldErrors.middleName)} onChange={(event) => setProfileForm((current) => ({ ...current, middleName: event.target.value }))} />
                {profileFieldErrors.middleName && <span className="patient-portal__field-error">{profileFieldErrors.middleName}</span>}
              </label>
              <label>Last name
                <input name="lastName" autoComplete="family-name" required minLength={2} maxLength={50} value={profileForm.lastName} aria-invalid={Boolean(profileFieldErrors.lastName)} onChange={(event) => setProfileForm((current) => ({ ...current, lastName: event.target.value }))} />
                {profileFieldErrors.lastName && <span className="patient-portal__field-error">{profileFieldErrors.lastName}</span>}
              </label>
              <label>Email address
                <input name="email" type="email" autoComplete="email" maxLength={254} value={profileForm.email} aria-invalid={Boolean(profileFieldErrors.email)} onChange={(event) => setProfileForm((current) => ({ ...current, email: event.target.value }))} />
                {profileFieldErrors.email && <span className="patient-portal__field-error">{profileFieldErrors.email}</span>}
              </label>
              <label>Phone number
                <input name="phone" type="tel" autoComplete="tel" inputMode="tel" required maxLength={32} placeholder="+63..." value={profileForm.phone} aria-invalid={Boolean(profileFieldErrors.phone)} onChange={(event) => setProfileForm((current) => ({ ...current, phone: event.target.value }))} />
                {profileFieldErrors.phone && <span className="patient-portal__field-error">{profileFieldErrors.phone}</span>}
              </label>
              <p className="patient-portal__profile-hint">Enter the phone number with its country code, for example +63.</p>
              <div className="patient-portal__profile-actions">
                <button className="patient-portal__button" type="button" disabled={profileSaving} onClick={() => setEditingProfile(false)}>Cancel</button>
                <button className="patient-portal__button patient-portal__button--primary" type="submit" disabled={profileSaving}>{profileSaving ? 'Saving…' : 'Save changes'}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  )
}
