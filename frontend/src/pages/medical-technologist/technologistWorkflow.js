export function getRequestStatus(request, specimens, results) {
  const requestSpecimens = specimens.filter((specimen) => specimen.requestId === request.id)
  const activeSpecimens = requestSpecimens.filter((specimen) => specimen.status !== 'Rejected')

  if (activeSpecimens.length > 0 && activeSpecimens.every((specimen) => specimen.status === 'Accepted')) {
    const requestResults = activeSpecimens.map((specimen) =>
      results.find((result) => result.specimenLabel === specimen.label),
    )
    return requestResults.every((result) => result?.state === 'validation')
      ? 'For Validation'
      : 'Processing'
  }

  return requestSpecimens.some((specimen) => specimen.status !== 'Expected')
    ? 'Specimen Received'
    : 'Paid'
}
