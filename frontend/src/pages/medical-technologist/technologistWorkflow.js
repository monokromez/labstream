import { isLabelRejection } from '../../data/medicalTechnologist.js'

export function getReplacementChain(specimenId, specimens) {
  const chain = []
  const seen = new Set([specimenId])
  let current = specimens.find((specimen) => specimen.replacesSpecimenId === specimenId)
  while (current && !seen.has(current.id)) {
    chain.push(current)
    seen.add(current.id)
    current = specimens.find((specimen) => specimen.replacesSpecimenId === current.id)
  }
  return chain
}

export function getAcceptedReplacement(specimenId, specimens) {
  return getReplacementChain(specimenId, specimens).find((specimen) => specimen.status === 'Accepted') ?? null
}

export function getRequestStatus(request, specimens, results) {
  const requestSpecimens = specimens.filter((specimen) => specimen.requestId === request.id)
  const activeSpecimens = requestSpecimens.filter((specimen) => !['Rejected', 'For Recollection'].includes(specimen.status))

  if (requestSpecimens.some((specimen) => specimen.status === 'Rejected' && isLabelRejection(specimen.reason))) return 'For Recollection'

  if (requestSpecimens.some((specimen) => specimen.status === 'For Recollection'
    || (specimen.recollectionOf && ['Expected', 'Received'].includes(specimen.status)))) return 'For Recollection'

  if (activeSpecimens.length > 0 && activeSpecimens.every((specimen) => specimen.status === 'Accepted')) {
    const requestResults = activeSpecimens.map((specimen) =>
      results.find((result) => result.specimenLabel === specimen.label),
    )
    return requestResults.every((result) => result?.state === 'validation')
      ? 'For Validation'
      : 'Processing'
  }

  return requestSpecimens.some((specimen) => !['Expected', 'Rejected', 'For Recollection'].includes(specimen.status))
    ? 'Specimen Received'
    : 'Paid'
}
