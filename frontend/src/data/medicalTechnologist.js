export const medicalTechnologistTests = []
export const initialTechnologistRequests = []
export const initialTechnologistSpecimens = []
export const initialTechnologistResults = []

export const rejectionReasons = [
  'Hemolyzed sample',
  'Insufficient volume',
  'Wrong or missing label',
  'Contaminated sample',
  'Wrong container',
  'Other',
]

export const labelRejectionReason = 'Wrong or missing label'

export function isLabelRejection(reason = '') {
  return reason === labelRejectionReason || reason.startsWith(`${labelRejectionReason}:`)
}

export function parseRejectionReason(specimen) {
  const reasonText = String(specimen?.rejectionReason ?? '').trim()
  const notesText = String(specimen?.rejectionNotes ?? specimen?.notes ?? '').trim().replace(/^Recollection:\s*/i, '')
  const [head, ...rest] = (reasonText || notesText).split(':')
  const reason = head.trim()
  if (rejectionReasons.includes(reason)) {
    return { reason, notes: [rest.join(':').trim(), reasonText ? notesText : ''].filter(Boolean).join(' — ') }
  }
  return { reason: notesText || reasonText ? 'Rejected' : '', notes: notesText || reasonText }
}
