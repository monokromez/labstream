const tones = {
  Paid: 'neutral',
  'Specimen Received': 'warning',
  Processing: 'primary',
  'For Validation': 'primary',
  Expected: 'neutral',
  Received: 'warning',
  Accepted: 'primary',
  Rejected: 'danger',
  'Awaiting result': 'neutral',
  'Draft saved': 'warning',
  'Returned by pathologist': 'danger',
  'For validation': 'primary',
}

const labels = {
  awaiting: 'Awaiting result',
  draft: 'Draft saved',
  returned: 'Returned by pathologist',
  validation: 'For validation',
}

export default function TechnologistStatusBadge({ status }) {
  const label = labels[status] ?? status
  const tone = tones[label] ?? 'neutral'
  return <span className={`medtech-badge medtech-badge--${tone}`}>{label}</span>
}
