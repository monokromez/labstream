import { useMemo, useState } from 'react'
import SearchInput from '../../components/data/SearchInput.jsx'
import { rejectionReasons } from '../../data/medicalTechnologist.js'
import useTechnologist from './useTechnologist.js'
import TechnologistDialog from './TechnologistDialog.jsx'
import TechnologistStatusBadge from './TechnologistStatusBadge.jsx'
import './Specimens.css'

const statusOptions = ['All', 'Expected', 'Received', 'Accepted', 'Rejected']

function localDateTimeValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function formatDateTime(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function Specimens() {
  const { requests, specimens, specimenSearch, setSpecimenSearch, markSpecimenReceived, acceptSpecimen, rejectSpecimen } = useTechnologist()
  const [status, setStatus] = useState('All')
  const [activeSpecimen, setActiveSpecimen] = useState(null)
  const [collectedAt, setCollectedAt] = useState(localDateTimeValue)
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  const visibleSpecimens = useMemo(() => specimens
    .filter((specimen) => status === 'All' || specimen.status === status)
    .filter((specimen) => {
      const request = requests.find((item) => item.id === specimen.requestId)
      const searchText = `${specimen.label} ${specimen.requestId} ${request?.patient ?? ''}`.toLowerCase()
      return searchText.includes(specimenSearch.trim().toLowerCase())
    }),
  [specimens, requests, status, specimenSearch])

  function closeDialog() {
    setActiveSpecimen(null)
    setError('')
    setReason('')
    setNotes('')
  }

  function openReceiveDialog(specimen) {
    setCollectedAt(localDateTimeValue())
    setError('')
    setActiveSpecimen({ ...specimen, action: 'receive' })
  }

  function openRejectDialog(specimen) {
    setReason('')
    setNotes('')
    setError('')
    setActiveSpecimen({ ...specimen, action: 'reject' })
  }

  function submitReceive(event) {
    event.preventDefault()
    if (!collectedAt) {
      setError('Enter the collection time.')
      return
    }
    markSpecimenReceived(activeSpecimen.label, new Date(collectedAt).toISOString())
    closeDialog()
  }

  function submitReject(event) {
    event.preventDefault()
    if (!reason) {
      setError('Select a rejection reason.')
      return
    }
    if (reason === 'Other' && !notes.trim()) {
      setError('Add a note when the reason is Other.')
      return
    }
    rejectSpecimen(activeSpecimen.label, reason, notes)
    closeDialog()
  }

  return (
    <section className="medtech-page" aria-label="Specimen tracking">
      <section className="medtech-panel" aria-labelledby="specimens-title">
        <div className="medtech-panel__heading">
          <div>
            <h2 id="specimens-title">Specimen tracking</h2>
            <p>Record arrivals, then check specimen quality before processing.</p>
          </div>
        </div>

        <div className="medtech-toolbar">
          <SearchInput
            className="medtech-toolbar__search"
            label="Search specimens"
            placeholder="Specimen label, request ID, or patient"
            value={specimenSearch}
            onChange={(event) => setSpecimenSearch(event.target.value)}
          />
          <label className="medtech-select-field">
            <span>Status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              {statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        </div>

        <p className="medtech-count">
          <strong>{visibleSpecimens.length}</strong> {visibleSpecimens.length === 1 ? 'specimen' : 'specimens'}
        </p>

        <div className="medtech-table-wrap" role="region" aria-label="Specimens" tabIndex="0">
          <table className="medtech-table medtech-table--specimens">
            <thead>
              <tr>
                <th scope="col">Specimen Label</th>
                <th className="medtech-table__request-id" scope="col">Request ID</th>
                <th scope="col">Patient</th>
                <th scope="col">Specimen Type</th>
                <th scope="col">Collection Time</th>
                <th scope="col">Status</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleSpecimens.map((specimen) => {
                const request = requests.find((item) => item.id === specimen.requestId)
                return (
                  <tr key={specimen.label}>
                    <td>
                      <span className="medtech-table__primary">{specimen.label}</span>
                      {specimen.recollectionOf && <span className="medtech-table__note">Recollection of {specimen.recollectionOf}</span>}
                    </td>
                    <td className="medtech-table__request-id">{specimen.requestId}</td>
                    <td>{request?.patient ?? '—'}</td>
                    <td>{specimen.type}</td>
                    <td>{formatDateTime(specimen.collectedAt)}</td>
                    <td><TechnologistStatusBadge status={specimen.status} /></td>
                    <td className="medtech-table__action-cell">
                      {specimen.status === 'Expected' && (
                        <button className="medtech-button medtech-button--secondary medtech-button--small" type="button" onClick={() => openReceiveDialog(specimen)}>
                          Mark as received
                        </button>
                      )}
                      {specimen.status === 'Received' && (
                        <div className="medtech-inline-actions">
                          <button className="medtech-button medtech-button--small" type="button" onClick={() => acceptSpecimen(specimen.label)}>
                            Accept
                          </button>
                          <button className="medtech-button medtech-button--danger medtech-button--small" type="button" onClick={() => openRejectDialog(specimen)}>
                            Reject
                          </button>
                        </div>
                      )}
                      {specimen.status === 'Accepted' && <span className="medtech-table__note">Sent to Results in Progress</span>}
                      {specimen.status === 'Rejected' && <span className="medtech-table__note">{specimen.reason}</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {visibleSpecimens.length === 0 && <p className="medtech-empty">No specimens match your filters.</p>}
        </div>
      </section>

      {activeSpecimen?.action === 'receive' && (
        <TechnologistDialog title="Mark as received" onClose={closeDialog}>
          <form className="medtech-dialog__body medtech-form" onSubmit={submitReceive}>
            <p className="medtech-dialog__context">{activeSpecimen.label} · {activeSpecimen.type} · {requests.find((request) => request.id === activeSpecimen.requestId)?.patient}</p>
            <label className="medtech-form__field" htmlFor="collection-time">
              <span>Collection time</span>
              <input
                id="collection-time"
                type="datetime-local"
                value={collectedAt}
                aria-required="true"
                aria-invalid={error === 'Enter the collection time.'}
                aria-describedby={error ? 'receive-error' : undefined}
                onChange={(event) => {
                  setCollectedAt(event.target.value)
                  setError('')
                }}
              />
            </label>
            {error && <p className="medtech-form__error" id="receive-error" role="alert">{error}</p>}
            <div className="medtech-dialog__actions">
              <button className="medtech-button medtech-button--secondary" type="button" onClick={closeDialog}>Cancel</button>
              <button className="medtech-button" type="submit">Confirm received</button>
            </div>
          </form>
        </TechnologistDialog>
      )}

      {activeSpecimen?.action === 'reject' && (
        <TechnologistDialog title="Reject specimen" onClose={closeDialog}>
          <form className="medtech-dialog__body medtech-form" onSubmit={submitReject}>
            <p className="medtech-dialog__context">{activeSpecimen.label} · {activeSpecimen.type}</p>
            <label className="medtech-form__field" htmlFor="rejection-reason">
              <span>Reason</span>
              <select
                id="rejection-reason"
                value={reason}
                aria-required="true"
                aria-invalid={Boolean(error && !reason)}
                aria-describedby={error ? 'rejection-error' : undefined}
                onChange={(event) => {
                  setReason(event.target.value)
                  setError('')
                }}
              >
                <option value="">Select a reason</option>
                {rejectionReasons.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className="medtech-form__field" htmlFor="rejection-notes">
              <span>Notes <small>{reason === 'Other' ? 'Required for Other' : 'Optional'}</small></span>
              <textarea
                id="rejection-notes"
                rows="3"
                value={notes}
                aria-invalid={error === 'Add a note when the reason is Other.'}
                aria-describedby={error === 'Add a note when the reason is Other.' ? 'rejection-error' : undefined}
                onChange={(event) => {
                  setNotes(event.target.value)
                  setError('')
                }}
              />
            </label>
            <p className="medtech-form__notice">A rejected specimen cannot be processed. A new specimen will be expected from the patient for recollection.</p>
            {error && <p className="medtech-form__error" id="rejection-error" role="alert">{error}</p>}
            <div className="medtech-dialog__actions">
              <button className="medtech-button medtech-button--secondary" type="button" onClick={closeDialog}>Cancel</button>
              <button className="medtech-button medtech-button--danger" type="submit">Reject specimen</button>
            </div>
          </form>
        </TechnologistDialog>
      )}
    </section>
  )
}
