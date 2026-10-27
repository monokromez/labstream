import { useMemo, useState } from 'react'
import SearchInput from '../../components/data/SearchInput.jsx'
import { LimitedInput, LimitedTextarea } from '../../components/forms/LimitedInput.jsx'
import { rejectionReasons, isLabelRejection } from '../../data/medicalTechnologist.js'
import useTechnologist from './useTechnologist.js'
import TechnologistDialog from './TechnologistDialog.jsx'
import TechnologistStatusBadge from './TechnologistStatusBadge.jsx'
import SummaryCard from '../../components/reports/SummaryCard.jsx'
import TablePagination from '../../components/data/TablePagination.jsx'
import useTablePagination from '../../components/data/useTablePagination.js'
import './Specimens.css'

const statusOptions = ['All', 'Expected', 'Received', 'Accepted', 'Rejected', 'For Recollection']

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
  const { requests, specimens, specimenSearch, setSpecimenSearch, acceptSpecimen, rejectSpecimen, relabelSpecimen, loadError } = useTechnologist()
  const [status, setStatus] = useState('All')
  const [specimenType, setSpecimenType] = useState('All types')
  const [activeSpecimen, setActiveSpecimen] = useState(null)
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [correctedLabel, setCorrectedLabel] = useState('')
  const [relabelNotes, setRelabelNotes] = useState('')
  const [error, setError] = useState('')
  const [confirmReject, setConfirmReject] = useState(false)

  const visibleSpecimens = useMemo(() => specimens
    .filter((specimen) => status === 'All' || specimen.status === status)
    .filter((specimen) => specimenType === 'All types' || specimen.type === specimenType)
    .filter((specimen) => {
      const request = requests.find((item) => item.id === specimen.requestId)
      const searchText = `${specimen.label} ${specimen.requestId} ${specimen.patient || request?.patient || ''}`.toLowerCase()
      return searchText.includes(specimenSearch.trim().toLowerCase())
    }),
  [specimens, requests, status, specimenSearch, specimenType])
  const specimenTypes = [...new Set(specimens.map((specimen) => specimen.type))].sort()
  const recollectionCount = specimens.filter((item) => item.status === 'For Recollection' || (item.recollectionOf && item.status === 'Expected')).length
  const { currentPage, pageSize, setCurrentPage, visibleItems: pageSpecimens } = useTablePagination(visibleSpecimens)

  function closeDialog() {
    setActiveSpecimen(null)
    setError('')
    setReason('')
    setNotes('')
    setCorrectedLabel('')
    setRelabelNotes('')
    setConfirmReject(false)
  }

  function openRejectDialog(specimen) {
    setReason('')
    setNotes('')
    setError('')
    setConfirmReject(false)
    setActiveSpecimen({ ...specimen, action: 'reject' })
  }

  function openRelabelDialog(specimen) {
    setCorrectedLabel('')
    setRelabelNotes('')
    setError('')
    setActiveSpecimen({ ...specimen, action: 'relabel' })
  }

  function submitRelabel(event) {
    event.preventDefault()
    relabelSpecimen(activeSpecimen.label, correctedLabel.trim(), relabelNotes.trim())
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
    setConfirmReject(true)
  }

  function confirmSpecimenRejection() {
    rejectSpecimen(activeSpecimen.label, reason, notes)
    closeDialog()
  }

  return (
    <section className="medtech-page" aria-label="Specimen tracking">
      {loadError && <p className="medtech-page__error" role="alert">{loadError}</p>}
      <div className="medtech-summary-cards">
        <SummaryCard title="Expected" value={String(specimens.filter((item) => item.status === 'Expected').length).padStart(2, '0')} helperText="Awaiting collection" />
        <SummaryCard title="Received" value={String(specimens.filter((item) => item.status === 'Received').length).padStart(2, '0')} helperText="Needs quality check" />
        <SummaryCard title="Accepted" value={String(specimens.filter((item) => item.status === 'Accepted').length).padStart(2, '0')} helperText="Ready for processing" />
        <SummaryCard title="For recollection" value={String(recollectionCount).padStart(2, '0')} helperText="New specimen needed" />
      </div>
      <section className="medtech-panel" aria-labelledby="specimens-title">
        <div className="medtech-panel__heading">
          <div>
            <h2 id="specimens-title">Specimens</h2>
            <p>Review specimens on arrival, then accept or reject after the quality check.</p>
          </div>
          <span className="medtech-panel__count">{visibleSpecimens.length} {visibleSpecimens.length === 1 ? 'specimen' : 'specimens'}</span>
        </div>

        <div className="medtech-toolbar">
          <SearchInput
            className="medtech-toolbar__search"
            label="Search specimens"
            visibleLabel="Search"
            placeholder="Specimen label, request ID, or patient"
            value={specimenSearch}
            onChange={(event) => { setSpecimenSearch(event.target.value); setCurrentPage(1) }}
          />
          <label className="medtech-select-field">
            <span>Status</span>
            <select value={status} onChange={(event) => { setStatus(event.target.value); setCurrentPage(1) }}>
              {statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="medtech-select-field">
            <span>Specimen type</span>
            <select value={specimenType} onChange={(event) => { setSpecimenType(event.target.value); setCurrentPage(1) }}>
              <option>All types</option>
              {specimenTypes.map((type) => <option key={type}>{type}</option>)}
            </select>
          </label>
        </div>

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
              {pageSpecimens.map((specimen) => {
                const request = requests.find((item) => item.id === specimen.requestId)
                return (
                  <tr key={specimen.label}>
                    <td>
                      <span className="medtech-table__primary">{specimen.label}</span>
                      {specimen.recollectionOf && <span className="medtech-table__note">Recollection of {specimen.recollectionOf}</span>}
                    </td>
                    <td className="medtech-table__request-id">{specimen.requestId}</td>
                    <td>{specimen.patient || request?.patient || '—'}</td>
                    <td>{specimen.type}</td>
                    <td>{formatDateTime(specimen.collectedAt)}</td>
                    <td><TechnologistStatusBadge status={specimen.status} /></td>
                    <td className="medtech-table__action-cell">
                      {['Expected', 'For Recollection', 'Received'].includes(specimen.status) && (
                        <div className="medtech-inline-actions">
                          <button className="medtech-button medtech-button--positive medtech-button--small" type="button" onClick={() => setActiveSpecimen({ ...specimen, action: 'accept' })}>
                            Accept
                          </button>
                          <button className="medtech-button medtech-button--danger medtech-button--small" type="button" onClick={() => openRejectDialog(specimen)}>
                            Reject
                          </button>
                        </div>
                      )}
                      {specimen.status === 'Accepted' && <span className="medtech-table__note">Sent to Results in Progress</span>}
                      {specimen.status === 'Rejected' && isLabelRejection(specimen.reason) && (
                        <div className="medtech-inline-actions">
                          <button className="medtech-button medtech-button--secondary medtech-button--small" type="button" onClick={() => openRelabelDialog(specimen)}>
                            Correct label
                          </button>
                        </div>
                      )}
                      {['Rejected', 'For Recollection'].includes(specimen.status) && <span className="medtech-table__note">{specimen.reason}</span>}
                      {specimen.recollectionOf && specimen.status === 'Expected' && <span className="medtech-table__note">Waiting for a new sample. {specimen.reason}</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {visibleSpecimens.length === 0 && <p className="medtech-empty">No specimens match your filters.</p>}
        </div>
        <TablePagination currentPage={currentPage} pageSize={pageSize} totalItems={visibleSpecimens.length} onPageChange={setCurrentPage} />
      </section>

      {activeSpecimen?.action === 'accept' && (
        <TechnologistDialog title="Accept specimen?" onClose={closeDialog}>
          <div className="medtech-dialog__body">
            <p className="medtech-dialog__context">{activeSpecimen.label} · {activeSpecimen.type} · {activeSpecimen.patient || requests.find((request) => request.id === activeSpecimen.requestId)?.patient}</p>
            <p className="medtech-form__notice medtech-form__notice--quiet">Accepting records this specimen as received, confirms it passed the quality check, and sends it to result entry.</p>
            <div className="medtech-dialog__actions">
              <button className="medtech-button medtech-button--secondary" type="button" onClick={closeDialog}>Cancel</button>
              <button className="medtech-button medtech-button--positive" type="button" onClick={() => { acceptSpecimen(activeSpecimen.label); closeDialog() }}>Confirm acceptance</button>
            </div>
          </div>
        </TechnologistDialog>
      )}

      {activeSpecimen?.action === 'reject' && !confirmReject && (
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
              <LimitedTextarea
                id="rejection-notes"
                rows="3"
                value={notes}
                maxLength={500}
                aria-invalid={error === 'Add a note when the reason is Other.'}
                aria-describedby={error === 'Add a note when the reason is Other.' ? 'rejection-error' : undefined}
                onChange={(event) => {
                  setNotes(event.target.value)
                  setError('')
                }}
              />
            </label>
            <p className="medtech-form__notice">{reason === 'Wrong or missing label'
              ? 'You can correct a wrong or missing label on the same tube. After rejecting, use Correct label to reopen the specimen and accept it — no new sample is needed.'
              : 'A rejected specimen cannot be processed. A new specimen will be expected from the patient for recollection.'}</p>
            {error && <p className="medtech-form__error" id="rejection-error" role="alert">{error}</p>}
            <div className="medtech-dialog__actions">
              <button className="medtech-button medtech-button--secondary" type="button" onClick={closeDialog}>Cancel</button>
              <button className="medtech-button medtech-button--danger" type="submit">Reject specimen</button>
            </div>
          </form>
        </TechnologistDialog>
      )}

      {activeSpecimen?.action === 'reject' && confirmReject && (
        <TechnologistDialog title="Confirm specimen rejection?" onClose={() => setConfirmReject(false)}>
          <div className="medtech-dialog__body">
            <p className="medtech-dialog__context">{activeSpecimen.label} · {activeSpecimen.type}</p>
            <p className="medtech-form__notice">Reject this specimen for <strong>{reason}</strong>? {reason === 'Wrong or missing label'
              ? 'You can relabel the same tube and reopen it afterwards.'
              : 'A new specimen will be expected for recollection.'}</p>
            <div className="medtech-dialog__actions">
              <button className="medtech-button medtech-button--secondary" type="button" onClick={() => setConfirmReject(false)}>Back to Details</button>
              <button className="medtech-button medtech-button--danger" type="button" onClick={confirmSpecimenRejection}>Confirm Rejection</button>
            </div>
          </div>
        </TechnologistDialog>
      )}
      {activeSpecimen?.action === 'relabel' && (
        <TechnologistDialog title="Correct specimen label" onClose={closeDialog}>
          <form className="medtech-dialog__body medtech-form" onSubmit={submitRelabel}>
            <p className="medtech-dialog__context">{activeSpecimen.label} · {activeSpecimen.type} · {activeSpecimen.patient || requests.find((request) => request.id === activeSpecimen.requestId)?.patient}</p>
            <p className="medtech-form__notice medtech-form__notice--quiet">Relabel the same tube, then confirm. The specimen reopens as Received so you can accept it; no new sample is created.</p>
            <label className="medtech-form__field" htmlFor="corrected-label">
              <span>Corrected label <small>Optional</small></span>
              <LimitedInput id="corrected-label" value={correctedLabel} maxLength={80} placeholder="e.g., PID-2026-480155 and patient name" onChange={(event) => setCorrectedLabel(event.target.value)} />
            </label>
            <label className="medtech-form__field" htmlFor="relabel-notes">
              <span>What was corrected? <small>Optional</small></span>
              <LimitedTextarea id="relabel-notes" rows="3" value={relabelNotes} maxLength={500} onChange={(event) => setRelabelNotes(event.target.value)} />
            </label>
            <div className="medtech-dialog__actions">
              <button className="medtech-button medtech-button--secondary" type="button" onClick={closeDialog}>Cancel</button>
              <button className="medtech-button medtech-button--positive" type="submit">Reopen specimen</button>
            </div>
          </form>
        </TechnologistDialog>
      )}
    </section>
  )
}
