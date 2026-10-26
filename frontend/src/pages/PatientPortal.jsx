import { api } from '../api/client.js'
import useApiResource from '../api/useApiResource.js'
import SummaryCard from '../components/reports/SummaryCard.jsx'
import { formatDate, formatDateTime } from '../utils/dateFormat.js'
import './PatientPortal.css'

const describeStatus = (status = '') => String(status).replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase())

export default function PatientPortal({ onNavigate }) {
  const { result, loading, error } = useApiResource(() => api.patient.results({ page: 1, pageSize: 8 }), [])
  const requests = result?.data ?? []
  const patient = result?.patient
  const clinic = result?.clinic
  const summary = result?.summary ?? {}
  const releasedRequests = requests.filter((request) => request.resultVisibility === 'released').slice(0, 4)
  const pendingRequests = requests.filter((request) => request.resultVisibility !== 'released').slice(0, 4)
  const totalTests = Number(summary.totalTests ?? 0)
  const releasedTests = Number(summary.releasedTests ?? 0)
  const unreleasedTests = Number(summary.unreleasedTests ?? 0)

  return (
    <section className="patient-portal" aria-label="Patient portal overview">
      {error && <p className="patient-portal__error" role="alert">{error}</p>}

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
    </section>
  )
}
