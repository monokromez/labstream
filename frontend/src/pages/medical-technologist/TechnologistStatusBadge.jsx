const tones = {
  Paid: 'neutral',
  'Specimen Received': 'warning',
  Processing: 'primary',
  'For Validation': 'primary',
  Expected: 'neutral',
  Received: 'warning',
  Accepted: 'primary',
  Rejected: 'danger',
  'For Recollection': 'danger',
  'Awaiting result': 'neutral',
  Drafted: 'warning',
  Returned: 'danger',
  'For validation': 'primary',
}

const labels = {
  awaiting: 'Awaiting result',
  draft: 'Drafted',
  returned: 'Returned',
  validation: 'For validation',
}

export default function TechnologistStatusBadge({ status }) {
  const label = labels[status] ?? status
  const tone = tones[label] ?? 'neutral'
  return <span className={`medtech-badge medtech-badge--${tone}`}>{label}</span>
}
