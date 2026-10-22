import SummaryCard from '../../components/reports/SummaryCard.jsx'
import './Reports.css'

const reportMetrics = [
  ['Tests processed', '248'],
  ['Results pending validation', '12'],
  ['Results released', '216'],
  ['Revenue collected', '₱84,650'],
  ['Average turnaround time', '4h 18m'],
]

const testVolume = [
  { category: 'Hematology', value: 92 },
  { category: 'Clinical Chemistry', value: 76 },
  { category: 'Clinical Microscopy', value: 48 },
  { category: 'Immunology', value: 32 },
]

export default function Reports() {
  function exportForExcel() {
    const rows = [
      ['October 2026 Laboratory Operations Report'],
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
    link.download = 'labstream-operations-report-october-2026.csv'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <section className="admin-page" aria-label="Laboratory reports">
      <div className="admin-page__title-row">
        <div>
          <h2>Laboratory operations</h2>
          <p>Monthly overview · October 1–31, 2026</p>
        </div>
        <div className="admin-toolbar">
          <button className="admin-button admin-button--secondary" type="button" onClick={exportForExcel}>
            Export for Excel
          </button>
          <button className="admin-button" type="button" onClick={() => window.print()}>
            Print / Save PDF
          </button>
        </div>
      </div>

      <div className="admin-dashboard__summary">
        <SummaryCard title="Tests processed" value="248" helperText="Across all test categories" />
        <SummaryCard title="Pending results" value="12" helperText="Awaiting validation" />
        <SummaryCard title="Released results" value="216" helperText="This reporting period" />
        <SummaryCard title="Revenue collected" value="₱84,650" helperText="Recorded payments" />
      </div>

      <section className="admin-panel admin-report">
        <div className="admin-panel__heading">
          <div>
            <h2>Test volume by category</h2>
            <p>Distribution of processed tests this month</p>
          </div>
          <span className="admin-badge">248 tests</span>
        </div>
        <div className="admin-report__chart">
          {testVolume.map((item) => (
            <div className="admin-report__row" key={item.category}>
              <span>{item.category}</span>
              <div className="admin-report__track" role="img" aria-label={`${item.category}: ${item.value} tests`}>
                <span className="admin-report__bar" style={{ width: `${(item.value / 248) * 100}%` }} />
              </div>
              <span className="admin-report__value">{item.value}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel__heading">
          <div>
            <h2>Performance summary</h2>
            <p>Operational indicators for the selected reporting period</p>
          </div>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th scope="col">Measure</th><th scope="col">Result</th></tr>
            </thead>
            <tbody>
              <tr><td className="admin-table__primary">Average turnaround time</td><td>4h 18m</td></tr>
              <tr><td className="admin-table__primary">Requests completed</td><td>216</td></tr>
              <tr><td className="admin-table__primary">Requests awaiting validation</td><td>12</td></tr>
              <tr><td className="admin-table__primary">Payments recorded</td><td>₱84,650</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </section>
  )
}
