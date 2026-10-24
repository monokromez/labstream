import { useEffect, useMemo, useState } from 'react'
import SummaryCard from '../../components/reports/SummaryCard.jsx'
import TablePagination from '../../components/data/TablePagination.jsx'
import useTablePagination from '../../components/data/useTablePagination.js'
import { api } from '../../api/client.js'
import useApiResource from '../../api/useApiResource.js'
import { formatDateTime } from '../../utils/dateFormat.js'
import './AdminDashboard.css'

const chartColors = ['#0f766e', '#2563eb', '#7c3aed', '#c2410c', '#0891b2', '#be123c', '#4d7c0f', '#9333ea']

export default function AdminDashboard() {
  const [chartType, setChartType] = useState('Bar')
  const [period, setPeriod] = useState('Weekly')
  const { result: summaryResult, error: summaryError } = useApiResource(() => api.administrator.dashboard(), [])
  const { result: volumeResult, error: volumeError } = useApiResource(() => api.administrator.testVolume({ period: period.toLowerCase() }), [period])
  const { result: activityResult } = useApiResource(() => api.administrator.auditLogs({ page: 1, pageSize: 10 }), [])
  const report = summaryResult?.data
  const volume = volumeResult?.data
  const testCategories = (volume?.series ?? []).map((category, index) => ({ ...category, color: chartColors[index % chartColors.length] }))
  const chartData = (volume?.buckets ?? []).map((bucket, bucketIndex) => ({ label: bucket.label, values: testCategories.map((category) => Number(category.values[bucketIndex] ?? 0)) }))
  const requestCounts = report?.requests ?? {}
  const summary = [
    { label: 'TOTAL REQUESTS', value: String(requestCounts.totalRequests ?? 0), helperText: 'Requested this month' },
    { label: 'IN PROGRESS', value: String(requestCounts.inProgress ?? 0), helperText: 'Paid and being processed' },
    { label: 'FOR VALIDATION', value: String(requestCounts.forValidation ?? 0), helperText: 'Awaiting pathologist review' },
    { label: 'RELEASED TESTS', value: String(report?.releasedTests ?? 0), helperText: 'Completed this month' },
  ]
  const workflow = [
    { label: 'Queued', value: Number(requestCounts.awaitingPayment ?? 0), tone: 'muted' },
    { label: 'Processing', value: Number(requestCounts.inProgress ?? 0), tone: 'info' },
    { label: 'For validation', value: Number(requestCounts.forValidation ?? 0), tone: 'warning' },
    { label: 'Released', value: Number(requestCounts.released ?? 0), tone: 'success' },
  ]
  const recentActivity = (activityResult?.data ?? []).map((event) => ({
    time: formatDateTime(event.createdAt), user: event.actor,
    role: (event.role ?? 'system').replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
    action: event.action, record: `${event.entityType}${event.entityId ? ` · ${event.entityId}` : ''}`,
  }))
  const chartMaximum = Math.max(1, ...chartData.flatMap((item) => item.values))
  const chartTotal = Number(volume?.total ?? 0)
  const chartDescription = `${period} test volume by category: ${chartData.map((item) => `${item.label}, ${testCategories.map((category, index) => `${category.label} ${item.values[index]}`).join(', ')}`).join('; ')}`
  const lineSeries = useMemo(() => testCategories.map((category, categoryIndex) => ({
    ...category,
    points: chartData.map((item) => item.values[categoryIndex]),
  })), [chartData, testCategories])
  const totalWorkflowRequests = workflow.reduce((sum, item) => sum + item.value, 0)
  const { currentPage, pageSize, setCurrentPage, visibleItems: pageActivity } = useTablePagination(recentActivity)

  function getLinePoints(values) {
    const left = 54
    const right = 700
    const top = 20
    const bottom = 184
    return values.map((value, index) => {
      const x = left + (values.length === 1 ? 0 : index * ((right - left) / (values.length - 1)))
      const y = bottom - (value / chartMaximum) * (bottom - top)
      return `${x},${y}`
    }).join(' ')
  }

  return (
    <section className="admin-dashboard" aria-label="Administrator dashboard">
      {(summaryError || volumeError) && <p role="alert">{summaryError || volumeError}</p>}
      <div className="admin-dashboard__summary">
        {summary.map((item) => (
          <SummaryCard
            key={item.label}
            title={item.label}
            value={item.value}
            helperText={item.helperText}
          />
        ))}
      </div>

      <div className="admin-dashboard__overview">
        <section className="admin-panel admin-dashboard__volume">
          <div className="admin-panel__heading">
            <div>
              <h2>Test volume</h2>
              <p>Requests processed {period === 'Annual' ? 'by year' : period === 'Monthly' ? 'by month' : 'this week'}</p>
            </div>
            <span className="admin-dashboard__chart-total">{chartTotal.toLocaleString()} tests</span>
          </div>
          <div className="admin-dashboard__chart-controls">
            <label><span>Chart type</span><select value={chartType} onChange={(event) => setChartType(event.target.value)}><option>Bar</option><option>Line</option></select></label>
            <label><span>Time period</span><select value={period} onChange={(event) => setPeriod(event.target.value)}><option>Weekly</option><option>Monthly</option><option>Annual</option></select></label>
          </div>
          {chartType === 'Bar' ? (
            <div className="admin-dashboard__bar-chart-scroll">
              <div className="admin-dashboard__chart admin-dashboard__chart--bar" style={{ gridTemplateColumns: `repeat(${chartData.length}, minmax(0, 1fr))`, minWidth: period === 'Monthly' ? '42rem' : undefined }} role="img" aria-label={chartDescription}>
                {chartData.map((item) => {
                  return (
                    <div className="admin-dashboard__chart-column" key={item.label}>
                      <div className="admin-dashboard__bar-group">
                        {testCategories.map((category, index) => (
                          <span key={category.label} className="admin-dashboard__bar" style={{ height: `${(item.values[index] / chartMaximum) * 100}%`, backgroundColor: category.color }} title={`${category.label}: ${item.values[index]}`} />
                        ))}
                      </div>
                      <span className="admin-dashboard__chart-label">{item.label}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="admin-dashboard__line-chart-scroll">
              <svg className="admin-dashboard__line-chart" style={{ minWidth: period === 'Monthly' ? '42rem' : undefined }} viewBox="0 0 720 256" preserveAspectRatio="none" role="img" aria-label={chartDescription}>
                {[0, 1, 2, 3, 4].map((step) => {
                  const y = 184 - step * 41
                  return <g key={step}><line x1="54" x2="700" y1={y} y2={y} className="admin-dashboard__grid-line" /><text x="44" y={y + 4} textAnchor="end" className="admin-dashboard__axis-label">{Math.round((chartMaximum * step) / 4)}</text></g>
                })}
                {lineSeries.map((series) => (
                  <g key={series.label} className="admin-dashboard__line-series">
                    <polyline points={getLinePoints(series.points)} fill="none" style={{ stroke: series.color }} />
                    {series.points.map((value, index) => {
                      const x = 54 + (series.points.length === 1 ? 0 : index * (646 / (series.points.length - 1)))
                      const y = 184 - (value / chartMaximum) * 164
                      return <circle key={`${series.label}-${chartData[index].label}`} cx={x} cy={y} r="3.5" style={{ fill: series.color }}><title>{`${chartData[index].label} · ${series.label}: ${value}`}</title></circle>
                    })}
                  </g>
                ))}
                {chartData.map((item, index) => {
                  const x = 54 + (chartData.length === 1 ? 0 : index * (646 / (chartData.length - 1)))
                  return <text key={item.label} x={x} y="222" textAnchor="middle" className="admin-dashboard__axis-label">{item.label}</text>
                })}
              </svg>
            </div>
          )}
          <ul className="admin-dashboard__chart-legend" aria-label="Test category legend">
            {testCategories.map((category) => <li key={category.label}><span className="admin-dashboard__legend-swatch" style={{ backgroundColor: category.color }} aria-hidden="true" />{category.label}</li>)}
          </ul>
          <p className="admin-dashboard__chart-note">
            Average turnaround time <strong>4h 18m</strong>
          </p>
        </section>

        <section className="admin-panel admin-dashboard__workflow">
          <div className="admin-panel__heading">
            <div>
              <h2>Request workflow</h2>
              <p>Current request status</p>
            </div>
          </div>
          <ul className="admin-dashboard__workflow-list">
            {workflow.map((item) => {
              const share = totalWorkflowRequests ? (item.value / totalWorkflowRequests) * 100 : 0
              return (
                <li key={item.label}>
                  <div className="admin-dashboard__workflow-row">
                    <span className={`admin-dashboard__workflow-dot admin-dashboard__workflow-dot--${item.tone}`} aria-hidden="true" />
                    <span>{item.label}</span>
                    <strong>{item.value}<span>{share.toFixed(1)}%</span></strong>
                  </div>
                  <div className="admin-dashboard__workflow-track" role="img" aria-label={`${item.label}: ${item.value} requests, ${share.toFixed(1)} percent of ${totalWorkflowRequests} total requests`}>
                    <span className={`admin-dashboard__workflow-bar admin-dashboard__workflow-bar--${item.tone}`} style={{ width: `${share}%` }} />
                  </div>
                </li>
              )
            })}
          </ul>
          <div className="admin-dashboard__workflow-insight"><strong>No workflow requests yet.</strong><span>Request counts will appear here as the clinic processes work.</span></div>
        </section>
      </div>

      <section className="admin-panel admin-dashboard__activity">
        <div className="admin-panel__heading">
          <div>
            <h2>System activity</h2>
            <p>Latest workflow events across staff roles</p>
          </div>
          <span className="admin-dashboard__activity-caption">{recentActivity.length} events · Today</span>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">Staff member</th>
                <th scope="col">Role</th>
                <th scope="col">Activity</th>
                <th scope="col">Record</th>
              </tr>
            </thead>
            <tbody>
              {pageActivity.map((item) => (
                <tr key={`${item.time}-${item.record}`}>
                  <td>{item.time}</td>
                  <td className="admin-table__primary">{item.user}</td>
                  <td>{item.role}</td>
                  <td>{item.action}</td>
                  <td>{item.record}</td>
                </tr>
              ))}
              {pageActivity.length === 0 && <tr><td className="admin-empty" colSpan="5">No system activity has been recorded.</td></tr>}
            </tbody>
          </table>
        </div>
        <TablePagination currentPage={currentPage} pageSize={pageSize} totalItems={recentActivity.length} onPageChange={setCurrentPage} />
      </section>
    </section>
  )
}
