import { useState } from 'react'
import { api } from '../../api/client.js'
import useApiResource from '../../api/useApiResource.js'
import { formatDate, formatDateTime } from '../../utils/dateFormat.js'
import AdminDialog from '../../components/data/AdminDialog.jsx'
import SummaryCard from '../../components/reports/SummaryCard.jsx'
import TablePagination from '../../components/data/TablePagination.jsx'
import './MyResults.css'
import { resultValueForDisplay } from '../../utils/resultValue.js'
import StructuredValueTable from '../../components/data/StructuredValueTable.jsx'

export default function MyResults() {
  const [selected, setSelected] = useState(null)
  const [downloadError, setDownloadError] = useState('')
  const [page, setPage] = useState(1)
  const { result, loading, error } = useApiResource(() => api.patient.results({ page, pageSize: 10 }), [page])
  const requests = (result?.data ?? []).map((request) => ({
    ...request,
    backendId: request.id,
    id: request.requestNumber,
    requested: formatDateTime(request.requestedAt),
    released: formatDate(request.releasedAt),
    status: request.resultVisibility === 'released' ? 'Released' : 'Unreleased',
    tests: (request.tests ?? []).map((test) => ({
      name: test.testName,
      interpretation: test.pathologistInterpretation,
      results: (test.values ?? []).map((value) => ({
        name: value.label,
        value: Array.isArray(value.structuredValue) ? null : resultValueForDisplay(value),
        structuredValue: value.structuredValue,
        isNumeric: value.numericValue != null,
        unit: value.unit,
        reference: value.lowerLimit != null || value.upperLimit != null
          ? `${value.lowerLimit ?? '—'} – ${value.upperLimit ?? '—'}${value.unit ? ` ${value.unit}` : ''}`
          : 'Not configured',
        abnormal: value.isAbnormal,
      })),
    })),
  }))
  async function downloadSelectedResult() {
    if (!selected) return
    setDownloadError('')
    try { await api.patient.downloadResultPdf(selected.backendId) }
    catch (requestError) { setDownloadError(requestError.message || 'Unable to download this result.') }
  }
  const releasedCount = Number(result?.summary?.releasedTests ?? requests.filter((request) => request.status === 'Released').reduce((sum, request) => sum + request.testCount, 0))
  const unreleasedCount = Number(result?.summary?.unreleasedTests ?? requests.filter((request) => request.status !== 'Released').reduce((sum, request) => sum + request.testCount, 0))
  const rows = requests

  return (
    <section className="patient-records" aria-label="My test results">
      {error && <p role="alert">{error}</p>}
      <div className="patient-records__summary">
        <SummaryCard title="Released results" value={String(releasedCount).padStart(2, '0')} helperText="Individual tests available to view" />
        <SummaryCard title="Unreleased results" value={String(unreleasedCount).padStart(2, '0')} helperText="Tests still being processed or reviewed" />
        <SummaryCard title="Total tests" value={String(result?.summary?.totalTests ?? releasedCount + unreleasedCount).padStart(2, '0')} helperText="Tests across your registered requests" />
      </div>
      <section className="patient-records__table-card" aria-labelledby="patient-results-title">
        <header className="patient-records__heading"><div><h2 id="patient-results-title">My Results</h2><p>Each row represents one request. Released requests include all of their test results.</p></div><span>{requests.length} {requests.length === 1 ? 'request' : 'requests'}</span></header>
        <div className="patient-records__scroll" role="region" aria-label="My results table" tabIndex="0"><table className="patient-records__table"><thead><tr><th>Request</th><th>Requested</th><th>Tests</th><th>Availability</th><th>Action</th></tr></thead><tbody>
          {rows.map((item) => <tr key={item.id}><td className="patient-records__primary">{item.id}</td><td>{item.requested}</td><td>{item.testCount} tests</td><td><span className={`patient-records__status${item.status === 'Released' ? '' : ' patient-records__status--processing'}`}>{item.status}</span></td><td>{item.status === 'Released' ? <button className="patient-records__button" type="button" onClick={() => setSelected(item)}>View results</button> : <span className="patient-records__unavailable">Not available yet</span>}</td></tr>)}
          {(loading || rows.length === 0) && <tr><td className="patient-records__empty" colSpan="5">{loading ? 'Loading results…' : 'No results are available yet.'}</td></tr>}
        </tbody></table></div>
        <TablePagination currentPage={page} pageSize={10} totalItems={result?.pagination?.total ?? requests.length} onPageChange={setPage} />
      </section>
      {selected && (
        <AdminDialog
          title="Diagnostic Laboratory Report"
          description={`${selected.id} · Released ${selected.released}`}
          onClose={() => setSelected(null)}
          size="large"
          className="patient-records__report-dialog"
          footer={<>
            <button className="admin-button admin-button--secondary" type="button" onClick={() => setSelected(null)}>Close</button>
            <button className="admin-button admin-button--positive" type="button" onClick={downloadSelectedResult}>Download PDF</button>
          </>}
        >
          <div className="patient-records__printable-report">
            {downloadError && <p role="alert">{downloadError}</p>}
            <div className="patient-records__report-header">
              <div>
                <h3 className="patient-records__clinic-title">{result?.clinic?.name || 'Diagnostic Laboratory'}</h3>
                <p className="patient-records__clinic-subtitle">Official Diagnostic Test Report</p>
              </div>
              <div className="patient-records__report-meta">
                <span><strong>Request:</strong> {selected.id}</span>
                <span><strong>Released:</strong> {selected.released}</span>
              </div>
            </div>
            <div className="patient-records__patient-meta">
              <span><strong>Patient:</strong> {result?.patient?.name || '—'}</span>
              <span><strong>PID:</strong> {result?.patient?.pid || '—'}</span>
              <span><strong>Date of birth:</strong> {result?.patient?.dateOfBirth ? formatDate(result.patient.dateOfBirth) : '—'}</span>
              <span><strong>Sex:</strong> {result?.patient?.sex || '—'}</span>
            </div>
            {selected.tests.map((test) => (
              <section className="patient-records__request-test" key={test.name}>
                <h4 className="patient-records__test-name">{test.name}</h4>
                <div className="patient-records__result-list">
                  {test.results.map((row) => (
                    <div key={row.name}>
                      <span>{row.name}</span>
                      {Array.isArray(row.structuredValue) ? <StructuredValueTable rows={row.structuredValue} /> : <strong>{row.value}{row.unit && row.isNumeric ? ` ${row.unit}` : ''}</strong>}
                      <small className={row.abnormal ? 'patient-records__abnormal' : ''}>{row.abnormal ? 'Outside reference range' : `Reference: ${row.reference}`}</small>
                    </div>
                  ))}
                </div>
                {test.interpretation && (
                  <div className="patient-records__interpretation-box">
                    <strong>Pathologist Interpretation:</strong>
                    <p>{test.interpretation}</p>
                  </div>
                )}
              </section>
            ))}
            <footer className="patient-records__report-footer">
              <p>This request’s results were approved and released by the laboratory.</p>
            </footer>
          </div>
        </AdminDialog>
      )}
    </section>
  )
}
