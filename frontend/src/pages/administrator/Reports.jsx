import { api } from '../../api/client.js'
import useApiResource from '../../api/useApiResource.js'
import SummaryCard from '../../components/reports/SummaryCard.jsx'
import TablePagination from '../../components/data/TablePagination.jsx'
import useTablePagination from '../../components/data/useTablePagination.js'
import './Reports.css'

export default function Reports() {
  const { result: summaryResult, error: summaryError } = useApiResource(() => api.administrator.dashboard(), [])
  const { result: volumeResult, error: volumeError } = useApiResource(() => api.administrator.testVolume({ period: 'monthly' }), [])
  const report = summaryResult?.data
  const requestCounts = report?.requests ?? {}
  const series = volumeResult?.data?.series ?? []
  const testVolume = series.map((category) => ({ category: category.label, value: category.values.reduce((sum, value) => sum + Number(value), 0) }))
  const volumeScale = Math.max(1, ...testVolume.map((item) => item.value))

  const currency = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })
  const tatMinutes = Number(report?.averageTurnaroundMinutes ?? 0)
  const tatFormatted = tatMinutes > 0
    ? (tatMinutes >= 60 ? `${Math.floor(tatMinutes / 60)}h ${tatMinutes % 60}m` : `${tatMinutes}m`)
    : '—'
  const revenueFormatted = currency.format(Number(report?.revenue ?? 0))

  const reportMetrics = [
    ['Total revenue this month', revenueFormatted],
    ['Average turnaround time (TAT)', tatFormatted],
    ['Requests this month', String(requestCounts.totalRequests ?? 0)],
    ['Awaiting payment', String(requestCounts.awaitingPayment ?? 0)],
    ['In progress', String(requestCounts.inProgress ?? 0)],
    ['Awaiting validation', String(requestCounts.forValidation ?? 0)],
    ['Released requests', String(requestCounts.released ?? 0)],
    ['Released tests', String(report?.releasedTests ?? 0)],
  ]
  const performanceRows = reportMetrics
  const { currentPage, pageSize, setCurrentPage, visibleItems: pageRows } = useTablePagination(performanceRows)

  function exportForExcel() {
    const rows = [
      ['Laboratory Operations & Revenue Report'],
      ['Metric', 'Value'],
      ...reportMetrics,
      [],
      ['Test category', 'Tests processed'],
      ...testVolume.map(({ category, value }) => [category, String(value)]),
    ]
    const csv = rows.map((row) => row.map((cell) => {
      const value = String(cell ?? '')
      return `"${value.replaceAll('"', '""')}"`
    }).join(',')).join('\r\n')
    const file = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url
    link.download = 'labstream-operations-report.csv'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <section className="admin-page" aria-label="Laboratory reports">
      {(summaryError || volumeError) && <p role="alert">{summaryError || volumeError}</p>}
      <div className="admin-page__title-row">
        <p>Review laboratory activity, revenue, turnaround times, and test volumes.</p>
        <div className="admin-toolbar">
          <button className="admin-button admin-button--positive" type="button" onClick={exportForExcel}>
            Export Spreadsheet
          </button>
          <button className="admin-button" type="button" onClick={() => window.print()}>
            Print / Save PDF
          </button>
        </div>
      </div>

      <div className="admin-dashboard__summary">
        <SummaryCard title="Revenue" value={revenueFormatted} helperText="Collected this month" />
        <SummaryCard title="Avg. turnaround time" value={tatFormatted} helperText="Payment to release" />
        <SummaryCard title="Tests processed" value={String(volumeResult?.data?.total ?? 0)} helperText="Released this month" />
        <SummaryCard title="Pending results" value={String(requestCounts.forValidation ?? 0)} helperText="Awaiting validation" />
      </div>

      <section className="admin-panel admin-report">
        <div className="admin-panel__heading">
          <div>
            <h2>Category Volume</h2>
            <p>Distribution of processed tests this month</p>
          </div>
          <span className="admin-badge">{volumeResult?.data?.total ?? 0} tests</span>
        </div>
        <div className="admin-report__chart">
          {testVolume.map((item) => (
            <div className="admin-report__row" key={item.category}>
              <span>{item.category}</span>
              <div className="admin-report__track" role="img" aria-label={`${item.category}: ${item.value} tests`}>
                <span className="admin-report__bar" style={{ width: `${(item.value / volumeScale) * 100}%` }} />
              </div>
              <span className="admin-report__value">{item.value}</span>
            </div>
          ))}
          {testVolume.length === 0 && <p className="admin-empty">{volumeResult ? 'No processed tests are available for this reporting period.' : 'Loading report data…'}</p>}
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel__heading">
          <div>
            <h2>Performance</h2>
            <p>Operational indicators for the selected reporting period</p>
          </div>
          <span className="admin-dashboard__activity-caption">{performanceRows.length} measures</span>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th scope="col">Measure</th><th scope="col">Result</th></tr>
            </thead>
            <tbody>
              {pageRows.map(([measure, result]) => <tr key={measure}><td className="admin-table__primary">{measure}</td><td>{result}</td></tr>)}
              {pageRows.length === 0 && <tr><td className="admin-empty" colSpan="2">No report data is available for this period.</td></tr>}
            </tbody>
          </table>
        </div>
        <TablePagination currentPage={currentPage} pageSize={pageSize} totalItems={performanceRows.length} onPageChange={setCurrentPage} />
      </section>
    </section>
  )
}
