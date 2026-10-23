import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  initialTechnologistRequests,
  initialTechnologistResults,
  initialTechnologistSpecimens,
} from '../../data/medicalTechnologist.js'
import TechnologistContext from './TechnologistState.js'
import { getRequestStatus } from './technologistWorkflow.js'

export function TechnologistProvider({ children, onNavigate }) {
  const [requests] = useState(initialTechnologistRequests)
  const [specimens, setSpecimens] = useState(initialTechnologistSpecimens)
  const [results, setResults] = useState(initialTechnologistResults)
  const [specimenSearch, setSpecimenSearch] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => setNotice(''), 2500)
    return () => window.clearTimeout(timer)
  }, [notice])

  const markSpecimenReceived = useCallback((label, collectedAt) => {
    setSpecimens((current) => current.map((specimen) =>
      specimen.label === label
        ? { ...specimen, status: 'Received', collectedAt }
        : specimen,
    ))
    setNotice(`${label} marked as received.`)
  }, [])

  const acceptSpecimen = useCallback((label) => {
    const specimen = specimens.find((item) => item.label === label)
    if (!specimen) throw new Error(`Unknown specimen: ${label}`)
    const request = requests.find((item) => item.id === specimen.requestId)
    if (!request) throw new Error(`Unable to find request details for ${label}.`)
    const tests = request.tests.filter((test) => test.specimenType === specimen.type)
    if (tests.length === 0) throw new Error(`No requested tests match specimen type ${specimen.type}.`)

    setSpecimens((current) => current.map((item) =>
      item.label === label ? { ...item, status: 'Accepted' } : item,
    ))

    setResults((current) => {
      if (current.some((result) => result.specimenLabel === label)) return current

      let nextLabNo = current.reduce((max, result) =>
        Math.max(max, ...result.labNumbers.map((lab) => Number(lab.number.slice(-6)) || 0)), 0) + 1
      const labNumbers = [...new Set(tests.map((test) => test.category))].map((category) => {
        const existingLab = current
          .filter((result) => result.requestId === request.id)
          .flatMap((result) => result.labNumbers)
          .find((lab) => lab.category === category)
        if (existingLab) return existingLab
        const lab = { category, number: `LAB-2026-${String(nextLabNo).padStart(6, '0')}` }
        nextLabNo += 1
        return lab
      })

      return [...current, {
        specimenLabel: label,
        requestId: request.id,
        state: 'awaiting',
        values: {},
        feedback: '',
        submittedAt: '',
        labNumbers,
      }]
    })
    setNotice(`${label} accepted and sent to Results in Progress.`)
  }, [requests, specimens])

  const rejectSpecimen = useCallback((label, reason, notes) => {
    setSpecimens((current) => {
      const rejected = current.find((specimen) => specimen.label === label)
      if (!rejected) return current
      const nextRecollection = current
        .filter((specimen) => specimen.recollectionOf === (rejected.recollectionOf || rejected.label))
        .reduce((max, specimen) => {
          const match = specimen.label.match(/-R(\d+)$/)
          return Math.max(max, match ? Number(match[1]) : 0)
        }, 0) + 1
      const originalLabel = rejected.recollectionOf || rejected.label
      return [
        ...current.map((specimen) => specimen.label === label
          ? { ...specimen, status: 'Rejected', reason: notes.trim() ? `${reason}: ${notes.trim()}` : reason }
          : specimen),
        {
          label: `${originalLabel}-R${nextRecollection}`,
          requestId: rejected.requestId,
          type: rejected.type,
          collectedAt: '',
          status: 'Expected',
          reason: '',
          recollectionOf: originalLabel,
        },
      ]
    })
    setNotice(`${label} rejected. A new specimen is expected for recollection.`)
  }, [])

  const saveDraft = useCallback((specimenLabel, values) => {
    setResults((current) => current.map((result) => {
      if (result.specimenLabel !== specimenLabel || result.state === 'validation') return result
      return { ...result, state: result.state === 'returned' ? 'returned' : 'draft', values }
    }))
    setNotice('Draft saved.')
  }, [])

  const submitResult = useCallback((specimenLabel, values) => {
    setResults((current) => current.map((result) =>
      result.specimenLabel === specimenLabel
        ? { ...result, state: 'validation', values, feedback: '', submittedAt: new Date().toISOString() }
        : result,
    ))
    setNotice('Submitted to the pathologist.')
  }, [])

  const value = useMemo(() => ({
    requests,
    specimens,
    results,
    notice,
    specimenSearch,
    setSpecimenSearch,
    markSpecimenReceived,
    acceptSpecimen,
    rejectSpecimen,
    saveDraft,
    submitResult,
    getRequestStatus: (request) => getRequestStatus(request, specimens, results),
    goToSpecimens: (requestId) => {
      setSpecimenSearch(requestId)
      onNavigate?.('specimens')
    },
  }), [requests, specimens, results, notice, specimenSearch, markSpecimenReceived, acceptSpecimen, rejectSpecimen, saveDraft, submitResult, onNavigate])

  return (
    <TechnologistContext.Provider value={value}>
      {children}
      <div className="medtech-toast" role="status" aria-live="polite" aria-atomic="true">
        {notice}
      </div>
    </TechnologistContext.Provider>
  )
}
