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
