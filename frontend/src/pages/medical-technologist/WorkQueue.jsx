import { useMemo, useState } from 'react'
import SearchInput from '../../components/data/SearchInput.jsx'
import useTechnologist from './useTechnologist.js'
import TechnologistDialog from './TechnologistDialog.jsx'
import TechnologistStatusBadge from './TechnologistStatusBadge.jsx'
import './WorkQueue.css'

const statusOptions = ['All', 'Paid', 'Specimen Received', 'Processing']

function formatTime(value) {
  return new Date(value).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function formatDateTime(value) {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function WorkQueue() {
  const { requests, specimens, getRequestStatus, goToSpecimens } = useTechnologist()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('All')
  const [selectedRequestId, setSelectedRequestId] = useState('')

  const visibleRequests = useMemo(() => requests
    .map((request) => ({ ...request, status: getRequestStatus(request) }))
    .filter((request) => ['Paid', 'Specimen Received', 'Processing'].includes(request.status))
    .filter((request) => status === 'All' || request.status === status)
    .filter((request) => {
      const searchText = `${request.id} ${request.patient} ${request.tests.map((test) => test.name).join(' ')}`.toLowerCase()
      return searchText.includes(query.trim().toLowerCase())
    })
    .sort((first, second) => new Date(first.paidAt) - new Date(second.paidAt)),
  [requests, getRequestStatus, query, status])

  const selectedRequest = requests.find((request) => request.id === selectedRequestId)
  const selectedStatus = selectedRequest ? getRequestStatus(selectedRequest) : ''
  const requestSpecimens = selectedRequest
    ? specimens.filter((specimen) => specimen.requestId === selectedRequest.id)
    : []

  function needsRecollection(request) {
    return specimens.some((specimen) =>
      specimen.requestId === request.id
      && specimen.status === 'Rejected'
      && specimens.some((recollection) =>
        recollection.recollectionOf === (specimen.recollectionOf || specimen.label)
        && recollection.status !== 'Accepted',
      ),
    )
  }

  return (
    <section className="medtech-page" aria-label="Medical technologist work queue">
      <section className="medtech-panel" aria-labelledby="work-queue-title">
        <div className="medtech-panel__heading">
          <div>
            <h2 id="work-queue-title">Requests ready for processing</h2>
            <p>Start with the earliest payment. Review details before handling specimens.</p>
          </div>
        </div>

        <div className="medtech-toolbar">
          <SearchInput
            className="medtech-toolbar__search"
            label="Search work queue"
            placeholder="Request ID, patient name, or test"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <label className="medtech-select-field">
            <span>Status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              {statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        </div>

        <p className="medtech-count">
          <strong>{visibleRequests.length}</strong> {visibleRequests.length === 1 ? 'request' : 'requests'}, oldest payment first
        </p>

        <div className="medtech-table-wrap" role="region" aria-label="Work queue requests" tabIndex="0">
          <table className="medtech-table medtech-table--queue">
            <thead>
              <tr>
                <th scope="col">Request ID</th>
                <th scope="col">Queue No.</th>
                <th scope="col">Patient</th>
                <th scope="col">Age / Sex</th>
                <th scope="col">Tests</th>
                <th scope="col">Paid</th>
                <th scope="col">Status</th>
                <th scope="col"><span className="visually-hidden">Details</span></th>
              </tr>
            </thead>
            <tbody>
              {visibleRequests.map((request) => {
                const recollectionNeeded = needsRecollection(request)
                const testSummary = request.tests.slice(0, 2).map((test) => test.name).join(', ')
                const moreTests = request.tests.length > 2 ? ` +${request.tests.length - 2}` : ''
                return (
                  <tr key={request.id}>
                    <td className="medtech-table__primary">{request.id}</td>
                    <td>{request.queueNo}</td>
                    <td>{request.patient}</td>
                    <td>{request.age} / {request.sex}</td>
                    <td title={request.tests.map((test) => test.name).join(', ')}>
                      <span className="medtech-tests-summary">{testSummary}{moreTests}</span>
                    </td>
                    <td>{formatTime(request.paidAt)}</td>
                    <td>
                      <div className="medtech-status-cell">
                        <TechnologistStatusBadge status={request.status} />
                        {recollectionNeeded && <span className="medtech-table__note">Recollection needed</span>}
                      </div>
                    </td>
                    <td>
                      <button
                        className="medtech-button medtech-button--secondary medtech-button--small"
                        type="button"
                        onClick={() => setSelectedRequestId(request.id)}
                      >
                        View details
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {visibleRequests.length === 0 && <p className="medtech-empty">No requests match your filters.</p>}
        </div>
      </section>

      {selectedRequest && (
        <TechnologistDialog title={`Request ${selectedRequest.id}`} onClose={() => setSelectedRequestId('')} className="medtech-dialog--wide">
          <div className="medtech-dialog__body">
            <TechnologistStatusBadge status={selectedStatus} />
            <section className="medtech-detail-section" aria-labelledby="request-patient-title">
              <h3 id="request-patient-title">Patient</h3>
              <dl className="medtech-detail-grid">
                <div><dt>Patient</dt><dd>{selectedRequest.patient}</dd></div>
                <div><dt>Patient ID</dt><dd>{selectedRequest.patientId}</dd></div>
                <div><dt>Age / Sex</dt><dd>{selectedRequest.age} / {selectedRequest.sex}</dd></div>
                <div><dt>Queue No.</dt><dd>{selectedRequest.queueNo}</dd></div>
                <div><dt>Paid</dt><dd>{formatDateTime(selectedRequest.paidAt)}</dd></div>
                <div><dt>Receipt No.</dt><dd>{selectedRequest.receiptNo}</dd></div>
              </dl>
            </section>

            <section className="medtech-detail-section" aria-labelledby="request-tests-title">
              <h3 id="request-tests-title">Requested tests</h3>
              <div className="medtech-table-wrap medtech-table-wrap--nested">
                <table className="medtech-table">
                  <thead><tr><th scope="col">Test</th><th scope="col">Category</th><th scope="col">Specimen</th></tr></thead>
                  <tbody>
                    {selectedRequest.tests.map((test) => (
                      <tr key={test.name}><td>{test.name}</td><td>{test.category}</td><td>{test.specimenType}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="medtech-detail-section" aria-labelledby="request-specimens-title">
              <h3 id="request-specimens-title">Specimens</h3>
              <ul className="medtech-specimen-summary">
                {requestSpecimens.map((specimen) => (
                  <li key={specimen.label}>
                    <span>{specimen.label} · {specimen.type}</span>
                    <TechnologistStatusBadge status={specimen.status} />
                  </li>
                ))}
              </ul>
            </section>
          </div>
          <footer className="medtech-dialog__actions">
            <button className="medtech-button medtech-button--secondary" type="button" onClick={() => setSelectedRequestId('')}>Close</button>
            <button
              className="medtech-button"
              type="button"
              onClick={() => {
                goToSpecimens(selectedRequest.id)
                setSelectedRequestId('')
              }}
            >
              Go to Specimens
            </button>
          </footer>
        </TechnologistDialog>
      )}
    </section>
  )
}
