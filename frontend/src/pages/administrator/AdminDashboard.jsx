import { useMemo, useState } from 'react'
import SummaryCard from '../../components/reports/SummaryCard.jsx'
import TablePagination from '../../components/data/TablePagination.jsx'
import useTablePagination from '../../components/data/useTablePagination.js'
import './AdminDashboard.css'

const summary = [
  { label: 'Tests', value: '248', helperText: 'Across all test requests this month' },
  { label: 'For validation', value: '12', helperText: 'Results need pathologist review' },
  { label: 'Released', value: '216', helperText: 'Completed this month' },
  { label: 'Revenue', value: '₱84,650', helperText: 'From recorded payments this month' },
]

const testCategories = [
  { label: 'Hematology', color: 'hematology' },
  { label: 'Clinical Chemistry', color: 'chemistry' },
  { label: 'Clinical Microscopy', color: 'microscopy' },
  { label: 'Immunology', color: 'immunology' },
]

const testVolumeByPeriod = {
  Weekly: [
    { label: 'Mon', values: [6, 5, 3, 2] },
    { label: 'Tue', values: [8, 6, 6, 4] },
    { label: 'Wed', values: [7, 7, 4, 3] },
    { label: 'Thu', values: [10, 8, 5, 5] },
    { label: 'Fri', values: [9, 6, 4, 3] },
    { label: 'Sat', values: [7, 4, 2, 1] },
    { label: 'Sun', values: [4, 3, 2, 2] },
  ],
  Monthly: [
    { label: 'Jan', values: [45, 38, 22, 14] }, { label: 'Feb', values: [42, 35, 20, 13] },
    { label: 'Mar', values: [49, 40, 24, 15] }, { label: 'Apr', values: [47, 39, 23, 15] },
    { label: 'May', values: [52, 43, 27, 17] }, { label: 'Jun', values: [50, 42, 25, 16] },
    { label: 'Jul', values: [55, 45, 28, 18] }, { label: 'Aug', values: [54, 44, 27, 18] },
    { label: 'Sep', values: [58, 48, 30, 19] }, { label: 'Oct', values: [62, 51, 32, 21] },
    { label: 'Nov', values: [57, 47, 29, 18] }, { label: 'Dec', values: [64, 53, 34, 22] },
  ],
  Annual: [
    { label: '2021', values: [420, 350, 210, 135] },
    { label: '2022', values: [465, 382, 232, 148] },
    { label: '2023', values: [510, 425, 258, 166] },
    { label: '2024', values: [552, 458, 281, 179] },
    { label: '2025', values: [598, 494, 306, 196] },
    { label: '2026', values: [626, 516, 324, 208] },
  ],
}

const workflow = [
  { label: 'Queued', value: 8, tone: 'muted' },
  { label: 'Processing', value: 19, tone: 'info' },
  { label: 'For validation', value: 12, tone: 'warning' },
  { label: 'Released', value: 216, tone: 'success' },
]

const recentActivity = [
  { time: '10:42 AM', user: 'Dr. Ana Reyes', role: 'Pathologist', action: 'Released result', record: 'REQ-2026-0248' },
  { time: '10:18 AM', user: 'Leo Cruz', role: 'Medical Technologist', action: 'Encoded result', record: 'REQ-2026-0246' },
  { time: '09:56 AM', user: 'Mia Santos', role: 'Cashier', action: 'Recorded payment', record: 'REQ-2026-0247' },
  { time: '09:31 AM', user: 'Dr. Ana Reyes', role: 'Pathologist', action: 'Returned result', record: 'REQ-2026-0244' },
]

export default function AdminDashboard() {
  const [chartType, setChartType] = useState('Bar')
  const [period, setPeriod] = useState('Weekly')
  const chartData = testVolumeByPeriod[period]
  const chartMaximum = Math.max(...chartData.flatMap((item) => item.values))
  const chartTotal = chartData.reduce((sum, item) => sum + item.values.reduce((rowTotal, value) => rowTotal + value, 0), 0)
  const chartDescription = `${period} test volume by category: ${chartData.map((item) => `${item.label}, ${testCategories.map((category, index) => `${category.label} ${item.values[index]}`).join(', ')}`).join('; ')}`
  const lineSeries = useMemo(() => testCategories.map((category, categoryIndex) => ({
    ...category,
    points: chartData.map((item) => item.values[categoryIndex]),
  })), [chartData])
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
                          <span key={category.label} className={`admin-dashboard__bar admin-dashboard__bar--${category.color}`} style={{ height: `${(item.values[index] / chartMaximum) * 100}%` }} title={`${category.label}: ${item.values[index]}`} />
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
                  <g key={series.label} className={`admin-dashboard__line-series admin-dashboard__line-series--${series.color}`}>
                    <polyline points={getLinePoints(series.points)} fill="none" />
                    {series.points.map((value, index) => {
                      const x = 54 + (series.points.length === 1 ? 0 : index * (646 / (series.points.length - 1)))
                      const y = 184 - (value / chartMaximum) * 164
                      return <circle key={`${series.label}-${chartData[index].label}`} cx={x} cy={y} r="3.5"><title>{`${chartData[index].label} · ${series.label}: ${value}`}</title></circle>
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
            {testCategories.map((category) => <li key={category.label}><span className={`admin-dashboard__legend-swatch admin-dashboard__legend-swatch--${category.color}`} aria-hidden="true" />{category.label}</li>)}
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
              const share = (item.value / totalWorkflowRequests) * 100
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
          <div className="admin-dashboard__workflow-insight">
            <span className="admin-dashboard__workflow-insight-label">Needs attention <span>Sample data</span></span>
            <strong>3 requests are over 24 hours old</strong>
            <span>Oldest open request: 31h 12m</span>
          </div>
        </section>
      </div>

      <section className="admin-panel admin-dashboard__activity">
        <div className="admin-panel__heading">
          <div>
            <h2>System activity</h2>
            <p>Latest workflow events across staff roles</p>
          </div>
          <span className="admin-dashboard__activity-caption">Today</span>
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
            </tbody>
          </table>
        </div>
        <TablePagination currentPage={currentPage} pageSize={pageSize} totalItems={recentActivity.length} onPageChange={setCurrentPage} />
      </section>
    </section>
  )
}
