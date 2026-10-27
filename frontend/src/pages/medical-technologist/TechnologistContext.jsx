import { useCallback, useEffect, useMemo, useState } from 'react'
import TechnologistContext from './TechnologistState.js'
import { getRequestStatus } from './technologistWorkflow.js'
import { api, subscribeToClinicChanges } from '../../api/client.js'
import useTestCatalog from '../../data/useTestCatalog.js'

const statusLabels = { expected: 'Expected', received: 'Received', accepted: 'Accepted', rejected: 'Rejected', for_recollection: 'For Recollection' }

function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return ''
  const [year, month, day] = String(dateOfBirth).slice(0, 10).split('-').map(Number)
  if (!year || !month || !day) return ''
  const today = new Date()
  let age = today.getFullYear() - year
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) age -= 1
  return age >= 0 ? age : ''
}

function toApiAnalyteValue(field, values) {
  const current = values[field.key]
  const valueKey = { numeric: 'numericValue', select: 'selectValue', boolean: 'booleanValue', structured: 'structuredValue', text: 'textValue' }[field.valueType]
  let value = current
  if (field.valueType === 'boolean') value = current === '' || current == null ? null : current === 'true'
  else if (field.valueType === 'numeric') value = current === '' || current == null ? null : Number(current)
  else if (field.valueType === 'structured') value = Array.isArray(current) && current.some((row) => Object.values(row).some((cell) => String(cell ?? '').trim())) ? current : null
  else if (current === '') value = null
  return { analyteId: field.analyteId, [valueKey]: value }
}

export function TechnologistProvider({ children, onNavigate }) {
  const [requests, setRequests] = useState([])
  const [specimens, setSpecimens] = useState([])
  const [results, setResults] = useState([])
  const [specimenSearch, setSpecimenSearch] = useState('')
  const [notice, setNotice] = useState('')
  const [loadError, setLoadError] = useState('')
  const { catalog } = useTestCatalog()

  const refresh = useCallback(async () => {
    try {
      const [queueResponse, specimenResponse] = await Promise.all([
        api.technologist.workQueue(), api.technologist.specimens({}),
      ])
      const rawSpecimens = specimenResponse.data ?? []
      const catalogTests = catalog.tests ?? []
      const requestRows = (queueResponse.data ?? []).map((row) => {
        const requestSpecimens = rawSpecimens.filter((specimen) => specimen.requestNumber === row.requestNumber)
        const linkedTests = new Map()
        requestSpecimens.forEach((specimen) => {
          if (['rejected', 'for_recollection'].includes(String(specimen.status ?? '').toLowerCase())) return
          ;(specimen.tests ?? []).forEach((link) => {
            const key = `${link.id}:${specimen.specimenType}`
            if (linkedTests.has(key)) return
            const catalogTest = catalogTests.find((test) => test.id === link.testId)
            const analytes = link.analytes?.length ? link.analytes : catalogTest?.analytes ?? []
            linkedTests.set(key, {
              id: link.id, requestItemId: link.id, testId: link.testId, name: link.testName,
              category: link.category ?? catalogTest?.categoryName ?? '—', specimenType: specimen.specimenType,
              latestResult: link.latestResult,
              fields: analytes.map((analyte) => ({
                key: `${link.testId}:${analyte.key}`, analyteId: analyte.id, label: analyte.label,
                valueType: analyte.valueType ?? analyte.value_type, options: analyte.options ?? [], unit: analyte.resultUnit ?? analyte.unit ?? '',
                range: analyte.lowerLimit != null || analyte.upperLimit != null ? `${analyte.lowerLimit ?? '—'} - ${analyte.upperLimit ?? '—'}` : '—',
                required: analyte.isRequired !== false,
              })),
            })
          })
        })
        const tests = [...linkedTests.values()]
        return {
          ...row, backendId: row.id, id: row.requestNumber, patient: row.patientName,
          patientId: row.pid, queueNo: `Q-${String(row.queueTicket).padStart(3, '0')}`,
          receiptNo: row.receiptNumber ?? '', age: calculateAge(row.dateOfBirth),
          sex: row.sex, paidAt: row.paidAt, tests,
          priority: row.priority?.replace(/^./, (char) => char.toUpperCase()),
        }
      })
      const requestByNumber = new Map(requestRows.map((request) => [request.id, request]))
      const specimenLabels = new Map(rawSpecimens.map((row) => {
        const requestSequence = String(row.requestNumber ?? '').match(/(\d+)$/)?.[1]?.slice(-6).padStart(6, '0') ?? String(row.id).slice(0, 6).toUpperCase()
        const typeCode = String(row.specimenType ?? '').replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase().padEnd(3, 'X')
        const attempt = String(row.attemptNumber ?? 1).padStart(2, '0')
        return [row.id, `SP-${requestSequence}-${typeCode}-${attempt}`]
      }))
      const specimenRows = rawSpecimens.map((row) => {
        const label = specimenLabels.get(row.id)
        return {
        ...row, label, recollectionOf: specimenLabels.get(row.replacesSpecimenId) ?? '', requestId: row.requestNumber, type: row.specimenType,
        status: statusLabels[row.status] ?? row.status, collectedAt: row.receivedAt,
        reason: row.rejectionReason ?? row.notes ?? '',
        linkedItemIds: (row.tests ?? []).map((test) => test.id),
      }})
      const resultRows = specimenRows.filter((specimen) => specimen.status === 'Accepted').map((specimen) => {
        const request = requestByNumber.get(specimen.requestId)
        const tests = (request?.tests ?? []).filter((test) => test.specimenType === specimen.type && specimen.linkedItemIds.includes(test.requestItemId))
        const states = tests.map((test) => test.latestResult?.status ?? test.status)
        const state = states.includes('returned') || states.includes('for_recollection') ? 'returned'
          : states.some((value) => ['submitted', 'approved', 'released'].includes(value)) ? 'validation'
            : states.some((value) => ['draft', 'drafted'].includes(value)) ? 'draft' : 'awaiting'
        const values = Object.fromEntries(tests.flatMap((test) => test.fields.map((field) => {
          const saved = (test.latestResult?.values ?? []).find((value) => value.analyteId === field.analyteId)
          const value = saved && [saved.numericValue, saved.textValue, saved.selectValue, saved.booleanValue, saved.structuredValue].find((entry) => entry != null)
          return [field.key, value == null ? (field.valueType === 'structured' ? [] : '') : field.valueType === 'structured' ? value : String(value)]
        })))
        return { specimenLabel: specimen.label, requestId: specimen.requestId, state, values, feedback: tests.map((test) => test.latestResult?.reviewRemarks).filter(Boolean).join('; '), submittedAt: tests.map((test) => test.latestResult?.updatedAt).filter(Boolean).at(0) ?? '', labNumbers: [], tests }
      })
      setRequests(requestRows)
      setSpecimens(specimenRows)
      setResults(resultRows)
      setLoadError('')
    } catch (error) { setLoadError(error.message || 'Unable to load technologist work.') }
  }, [catalog.tests])

  useEffect(() => { refresh() }, [refresh])
  useEffect(() => subscribeToClinicChanges(() => { refresh().catch(() => {}) }), [refresh])
  useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => setNotice(''), 3000)
    return () => window.clearTimeout(timer)
  }, [notice])

  const findSpecimen = useCallback((label) => specimens.find((item) => item.label === label), [specimens])
  const acceptSpecimen = useCallback(async (label) => {
    const specimen = findSpecimen(label)
    if (!specimen) return
    try {
      if (specimen.status !== 'Received') await api.technologist.receiveSpecimen(specimen.id)
      await api.technologist.acceptSpecimen(specimen.id)
      await refresh()
      setNotice(`${label} accepted and sent to Results in Progress.`)
    }
    catch (error) { setNotice(error.message || 'Unable to accept this specimen.') }
  }, [findSpecimen, refresh])
  const rejectSpecimen = useCallback(async (label, reason, notes) => {
    const specimen = findSpecimen(label)
    if (!specimen) return
    try {
      await api.technologist.rejectSpecimen(specimen.id, notes.trim() ? `${reason}: ${notes.trim()}` : reason)
      await refresh()
      setNotice(`${label} rejected. A new specimen is expected for recollection.`)
    } catch (error) { setNotice(error.message || 'Unable to reject this specimen.') }
  }, [findSpecimen, refresh])

  const saveDraft = useCallback(async (specimenLabel, values, { quiet = false } = {}) => {
    const specimen = findSpecimen(specimenLabel)
    const request = requests.find((item) => item.id === specimen?.requestId)
    const specimenResult = results.find((item) => item.specimenLabel === specimenLabel)
    if (!specimen || !request || !specimenResult) return
    try {
      for (const test of specimenResult.tests) {
        const linkedSpecimens = specimens.filter((entry) => entry.status === 'Accepted' && entry.requestId === request.id && entry.linkedItemIds.includes(test.requestItemId))
        const analyteValues = test.fields.map((field) => toApiAnalyteValue(field, values))
        await api.technologist.saveDraft(request.backendId, test.requestItemId, { specimenIds: linkedSpecimens.map((entry) => entry.id), values: analyteValues })
      }
      await refresh()
      if (!quiet) setNotice('Draft saved to the server.')
      return true
    } catch (error) {
      if (!quiet) setNotice(error.message || 'Unable to save this result draft.')
      throw error
    }
  }, [findSpecimen, requests, results, specimens, refresh])

  const submitRequest = useCallback(async (requestId, valuesBySpecimen = {}) => {
    const request = requests.find((item) => item.id === requestId)
    if (!request) return
    try {
      const accepted = specimens.filter((specimen) => specimen.requestId === requestId && specimen.status === 'Accepted')
      const seen = new Set()
      for (const specimen of accepted) {
        const specimenResult = results.find((item) => item.specimenLabel === specimen.label)
        for (const test of specimenResult?.tests ?? []) {
          if (seen.has(test.requestItemId)) continue
          seen.add(test.requestItemId)
          const values = valuesBySpecimen[specimen.label] ?? specimenResult.values
          const linkedSpecimens = accepted.filter((entry) => entry.linkedItemIds.includes(test.requestItemId))
          const analyteValues = test.fields.map((field) => toApiAnalyteValue(field, values))
          await api.technologist.saveDraft(request.backendId, test.requestItemId, { specimenIds: linkedSpecimens.map((entry) => entry.id), values: analyteValues })
        }
      }
      await api.technologist.submitResults(request.backendId)
      await refresh()
      setNotice('Completed request results submitted to the assigned pathologist.')
    } catch (error) { setNotice(error.message || 'Unable to submit this request.') }
  }, [requests, specimens, results, refresh])

  const value = useMemo(() => ({
    requests, specimens, results, notice, loadError, specimenSearch, setSpecimenSearch,
    acceptSpecimen, rejectSpecimen, saveDraft, submitRequest,
    getRequestStatus: (request) => getRequestStatus(request, specimens, results),
    goToSpecimens: (requestId) => { setSpecimenSearch(requestId); onNavigate?.('specimens') },
  }), [requests, specimens, results, notice, loadError, specimenSearch, acceptSpecimen, rejectSpecimen, saveDraft, submitRequest, onNavigate])

  return <TechnologistContext.Provider value={value}>{children}<div className="medtech-toast" role="status" aria-live="polite" aria-atomic="true">{notice}</div></TechnologistContext.Provider>
}
