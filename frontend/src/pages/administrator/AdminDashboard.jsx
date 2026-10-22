import SummaryCard from '../../components/reports/SummaryCard.jsx'
import './AdminDashboard.css'

const summary = [
  { label: 'Tests this month', value: '248', helperText: 'Across all test requests' },
  { label: 'Awaiting validation', value: '12', helperText: 'Results need pathologist review' },
  { label: 'Released results', value: '216', helperText: 'Completed this month' },
  { label: 'Revenue this month', value: '₱84,650', helperText: 'From recorded payments' },
]

const weeklyVolume = [
  { day: 'Mon', value: 18 },
  { day: 'Tue', value: 24 },
  { day: 'Wed', value: 21 },
  { day: 'Thu', value: 28 },
  { day: 'Fri', value: 22 },
  { day: 'Sat', value: 14 },
  { day: 'Sun', value: 9 },
]

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
  const maxVolume = Math.max(...weeklyVolume.map((item) => item.value))

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
              <p>Requests processed this week</p>
            </div>
            <span className="admin-dashboard__chart-total">136 tests</span>
          </div>
          <div
            className="admin-dashboard__chart"
            role="img"
            aria-label="Weekly test volume: Monday 18, Tuesday 24, Wednesday 21, Thursday 28, Friday 22, Saturday 14, Sunday 9"
          >
            {weeklyVolume.map((item) => (
              <div className="admin-dashboard__chart-column" key={item.day}>
                <span className="admin-dashboard__chart-value">{item.value}</span>
                <div className="admin-dashboard__bar-track">
                  <span
                    className="admin-dashboard__bar"
                    style={{ height: `${(item.value / maxVolume) * 100}%` }}
                  />
                </div>
                <span className="admin-dashboard__chart-label">{item.day}</span>
              </div>
            ))}
          </div>
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
            {workflow.map((item) => (
              <li key={item.label}>
                <span className={`admin-dashboard__workflow-dot admin-dashboard__workflow-dot--${item.tone}`} aria-hidden="true" />
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </li>
            ))}
          </ul>
          <p className="admin-dashboard__workflow-note">
            Review the queue regularly to keep requests moving through each step.
          </p>
        </section>
      </div>

      <section className="admin-panel admin-dashboard__activity">
        <div className="admin-panel__heading">
          <div>
            <h2>Recent system activity</h2>
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
              {recentActivity.map((item) => (
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
      </section>
    </section>
  )
}
