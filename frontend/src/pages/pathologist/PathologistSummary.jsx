import SummaryCard from '../../components/reports/SummaryCard.jsx'
import { usePathologistSummary } from './usePathologistData.js'

export default function PathologistSummary({ refreshKey = 0 }) {
  const { summary } = usePathologistSummary(refreshKey)
  const metrics = [
    { title: 'Awaiting validation', value: summary.pendingCount, helperText: 'Results ready for your review' },
    { title: 'Returned for correction', value: summary.returnedCount, helperText: 'Awaiting technologist updates' },
    { title: 'Reviewed today', value: summary.reviewedTodayCount, helperText: 'Across all result types' },
    { title: 'Released today', value: summary.releasedTodayCount, helperText: 'Available in patient portals' },
  ]

  return (
    <div className="admin-dashboard__summary">
      {metrics.map((metric) => (
        <SummaryCard
          key={metric.title}
          title={metric.title}
          value={String(metric.value).padStart(2, '0')}
          helperText={metric.helperText}
        />
      ))}
    </div>
  )
}
