import { useMemo, useState } from 'react'
import useTechnologist from './useTechnologist.js'
import TechnologistDialog from './TechnologistDialog.jsx'
import TechnologistStatusBadge from './TechnologistStatusBadge.jsx'
import TablePagination from '../../components/data/TablePagination.jsx'
import useTablePagination from '../../components/data/useTablePagination.js'
import './ResultsInProgress.css'

const stateFilters = [
  { value: 'all', label: 'All' },
  { value: 'awaiting', label: 'Awaiting result' },
  { value: 'draft', label: 'Draft saved' },
  { value: 'returned', label: 'Returned by pathologist' },
  { value: 'validation', label: 'For validation' },
]

function formatDateTime(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function referenceRange(field, sex) {
  return typeof field.range === 'object' ? field.range[sex] ?? '-' : field.range || '-'
}

function abnormalFlag(value, range) {
  if (!/^\d+(?:\.\d+)?$/.test(value.trim()) || !range || range === '—') return ''
  const numericValue = Number(value)
  const upperLimit = range.match(/^<\s*(\d+(?:\.\d+)?)$/)
  if (upperLimit && numericValue >= Number(upperLimit[1])) return 'H'
  const lowerLimit = range.match(/^>\s*(\d+(?:\.\d+)?)$/)
  if (lowerLimit && numericValue <= Number(lowerLimit[1])) return 'L'
  const interval = range.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/)
  if (!interval) return ''
  if (numericValue < Number(interval[1])) return 'L'
  if (numericValue > Number(interval[2])) return 'H'
  return ''
}

function ResultEntryTable({ fields, specimenLabel, values, isLocked, showFieldErrors, onValueChange }) {
  const { currentPage, pageSize, setCurrentPage, visibleItems } = useTablePagination(fields)

  return (
    <>
      <div className="medtech-table-wrap medtech-table-wrap--result">
        <table className="medtech-table medtech-table--result-entry">
          <thead>
            <tr>
              <th scope="col">Parameter</th>
              <th scope="col">Result</th>
              <th scope="col">Unit</th>
              <th scope="col">Reference range</th>
              <th scope="col">Flag</th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((field) => {
              const fieldValue = String(values[field.key] ?? '')
              const missing = !fieldValue.trim()
              const flag = abnormalFlag(fieldValue, field.range)
              return (
                <tr key={field.key}>
                  <td className="medtech-table__primary">{field.label}</td>
                  <td>
                    <label className="visually-hidden" htmlFor={`result-${specimenLabel}-${field.key}`}>{field.label} result</label>
                    {field.valueType === 'select' ? (
                      <select id={`result-${specimenLabel}-${field.key}`} className="medtech-result-input" value={fieldValue} disabled={isLocked} aria-invalid={showFieldErrors && missing} onChange={(event) => onValueChange(field.key, event.target.value)}>
                        <option value="">Select…</option>
                        {field.options.map((option) => <option key={option}>{option}</option>)}
                      </select>
                    ) : (
                      <input
                        id={`result-${specimenLabel}-${field.key}`}
                        className="medtech-result-input"
                        type={field.valueType === 'numeric' ? 'number' : 'text'}
                        step={field.valueType === 'numeric' ? 'any' : undefined}
                        value={fieldValue}
                        disabled={isLocked}
                        aria-invalid={showFieldErrors && missing}
                        onChange={(event) => onValueChange(field.key, event.target.value)}
                      />
                    )}
                  </td>
                  <td>{field.unit ?? '—'}</td>
                  <td>{field.range}</td>
                  <td>{flag
                    ? <span className="medtech-flag" title={flag === 'H' ? 'Above reference range' : 'Below reference range'}>{flag} <span>{flag === 'H' ? 'High' : 'Low'}</span></span>
                    : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <TablePagination currentPage={currentPage} pageSize={pageSize} totalItems={fields.length} onPageChange={setCurrentPage} />
    </>
  )
}

function getNumericChartRows(fields, values) {
  return fields.flatMap((field) => {
    if (field.valueType !== 'numeric' || !String(values[field.key] ?? '').trim()) return []
    const value = Number(values[field.key])
    if (!Number.isFinite(value) || value < 0) return []

    const interval = field.range.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/)
    const upperLimit = field.range.match(/^<\s*(\d+(?:\.\d+)?)$/)
    const lowerLimit = field.range.match(/^>\s*(\d+(?:\.\d+)?)$/)
    const lower = interval ? Number(interval[1]) : lowerLimit ? Number(lowerLimit[1]) : 0
    const upper = interval ? Number(interval[2]) : upperLimit ? Number(upperLimit[1]) : lowerLimit ? Math.max(value, Number(lowerLimit[1]) * 1.1) : 0
    const scale = Math.max(value, upper, 1) * 1.1
    const hasReferenceRange = Boolean(interval || upperLimit || lowerLimit)
    return [{
      ...field,
      value,
      valueWidth: Math.min(100, (value / scale) * 100),
      rangeStart: Math.min(100, (lower / scale) * 100),
      rangeWidth: hasReferenceRange ? Math.max(0, Math.min(100, ((upper - lower) / scale) * 100)) : 0,
      flag: abnormalFlag(String(value), field.range),
    }]
  })
}

export default function ResultsInProgress() {
  const { requests, specimens, results, saveDraft, submitResult } = useTechnologist()
  const [filter, setFilter] = useState('all')
  const [selectedLabel, setSelectedLabel] = useState('')
  const [draftValues, setDraftValues] = useState({})
  const [showFieldErrors, setShowFieldErrors] = useState(false)
  const [validationError, setValidationError] = useState('')
  const [confirmSubmit, setConfirmSubmit] = useState(false)

  const visibleResults = useMemo(() => results
    .filter((result) => filter === 'all' || result.state === filter)
    .map((result) => {
      const specimen = specimens.find((item) => item.label === result.specimenLabel)
      const request = requests.find((item) => item.id === specimen?.requestId)
      return { ...result, specimen, request }
    })
    .filter((result) => result.specimen?.status === 'Accepted' && result.request),
  [results, specimens, requests, filter])

  const selectedResult = visibleResults.find((result) => result.specimenLabel === selectedLabel) ?? visibleResults[0]
  const selectedTests = selectedResult
    ? selectedResult.request.tests.filter((test) => test.specimenType === selectedResult.specimen.type)
    : []
  const values = selectedResult
    ? draftValues[selectedResult.specimenLabel] ?? selectedResult.values
    : {}
  const resultFields = selectedTests.flatMap((test) => test.fields.map((field) => ({
    ...field,
    testName: test.name,
    category: test.category,
    range: referenceRange(field, selectedResult?.request.sex),
  })))
  const numericChartRows = getNumericChartRows(resultFields, values)
  const isLocked = selectedResult?.state === 'validation'

  function saveCurrentDraft() {
    if (!selectedResult || isLocked) return
    saveDraft(selectedResult.specimenLabel, values)
  }

  function requestSubmission(event) {
    event.preventDefault()
    if (!selectedResult || isLocked) return
    const emptyFields = resultFields.filter((field) => !String(values[field.key] ?? '').trim())
    if (emptyFields.length > 0) {
      setShowFieldErrors(true)
      setValidationError(`Complete all result fields before submitting (${emptyFields.length} empty). You can save a draft instead.`)
      document.getElementById(`result-${selectedResult.specimenLabel}-${emptyFields[0].key}`)?.focus()
      return
    }
    setValidationError('')
    setConfirmSubmit(true)
  }

  function confirmSubmission() {
    if (!selectedResult) return
    submitResult(selectedResult.specimenLabel, values)
    setConfirmSubmit(false)
  }

  function changeFilter(nextFilter) {
    const nextResult = results.find((result) => {
      const specimen = specimens.find((item) => item.label === result.specimenLabel)
      return specimen?.status === 'Accepted' && (nextFilter === 'all' || result.state === nextFilter)
    })
    setFilter(nextFilter)
    setSelectedLabel(nextResult?.specimenLabel ?? '')
    setShowFieldErrors(false)
    setValidationError('')
    setConfirmSubmit(false)
  }

  function changeFieldValue(fieldKey, fieldValue) {
    if (!selectedResult) return
    setDraftValues((current) => ({
      ...current,
      [selectedResult.specimenLabel]: {
        ...(current[selectedResult.specimenLabel] ?? selectedResult.values),
        [fieldKey]: fieldValue,
      },
    }))
    setValidationError('')
  }

  function selectSpecimen(specimenLabel) {
    setSelectedLabel(specimenLabel)
    setShowFieldErrors(false)
    setValidationError('')
    setConfirmSubmit(false)
  }

  return (
    <section className="medtech-page medtech-results" aria-label="Results in progress">
      <div className="medtech-result-layout">
        <section className="medtech-panel medtech-result-list" aria-labelledby="result-list-title">
          <div className="medtech-panel__heading">
            <div><h2 id="result-list-title">Accepted specimens</h2></div>
          </div>
          <div className="medtech-result-filters" role="group" aria-label="Filter results by state">
            {stateFilters.map((item) => (
              <button
                key={item.value}
                type="button"
                className={`medtech-filter-chip${filter === item.value ? ' is-active' : ''}`}
                aria-pressed={filter === item.value}
                onClick={() => changeFilter(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="medtech-result-cards">
            {visibleResults.map((result) => {
              const tests = result.request.tests.filter((test) => test.specimenType === result.specimen.type)
              const testSummary = tests.slice(0, 2).map((test) => test.name).join(', ')
              const moreTests = tests.length > 2 ? ` +${tests.length - 2}` : ''
              return (
                <button
                  className={`medtech-result-card${selectedResult?.specimenLabel === result.specimenLabel ? ' is-selected' : ''}`}
                  type="button"
                  key={result.specimenLabel}
                  aria-pressed={selectedResult?.specimenLabel === result.specimenLabel}
                  onClick={() => selectSpecimen(result.specimenLabel)}
                >
                  <span className="medtech-result-card__top">
                    <strong>{result.specimenLabel}</strong>
                    <TechnologistStatusBadge status={result.state} />
                  </span>
                  <span className="medtech-result-card__patient">{result.request.patient}</span>
                  <span className="medtech-result-card__tests">{testSummary}{moreTests}</span>
                </button>
              )
            })}
            {visibleResults.length === 0 && <p className="medtech-empty medtech-empty--compact">No specimens in this list.</p>}
          </div>
        </section>

        {selectedResult ? (
          <section className="medtech-panel medtech-result-detail" aria-labelledby="selected-result-title">
            <div className="medtech-result-detail__heading">
              <div>
                <h2 id="selected-result-title">{selectedResult.specimenLabel}</h2>
                <p>{selectedResult.request.patient} · {selectedResult.request.id}</p>
              </div>
              <TechnologistStatusBadge status={selectedResult.state} />
            </div>

            <dl className="medtech-detail-grid medtech-detail-grid--result">
              <div><dt>Patient</dt><dd>{selectedResult.request.patient}</dd></div>
              <div><dt>Patient ID</dt><dd>{selectedResult.request.patientId}</dd></div>
              <div><dt>Age / Sex</dt><dd>{selectedResult.request.age} / {selectedResult.request.sex}</dd></div>
              <div><dt>Request ID</dt><dd>{selectedResult.request.id}</dd></div>
              <div><dt>Specimen</dt><dd>{selectedResult.specimen.type}</dd></div>
              <div><dt>Collected</dt><dd>{formatDateTime(selectedResult.specimen.collectedAt)}</dd></div>
              <div className="medtech-detail-grid__wide">
                <dt>Lab No.</dt>
                <dd>
                  {selectedResult.labNumbers.map((lab) => (
                    <span className="medtech-lab-number" key={lab.category}>{lab.number} ({lab.category})</span>
                  ))}
                </dd>
              </div>
            </dl>

            {selectedResult.state === 'returned' && (
              <section className="medtech-feedback" aria-labelledby="pathologist-feedback-title">
                <h3 id="pathologist-feedback-title">Pathologist feedback</h3>
                <p>{selectedResult.feedback}</p>
              </section>
            )}
            {isLocked && (
              <p className="medtech-lock-notice">
                Submitted to the pathologist on {formatDateTime(selectedResult.submittedAt)}. This result is locked unless the pathologist returns it.
              </p>
            )}
            {selectedTests.some((test) => test.category === 'Laboratory' && test.fields.some((field) => field.valueType === 'numeric')) && (
              <p className="medtech-reference-note">Numeric values outside the reference range are flagged automatically: H (high) or L (low). The range shown is for the patient&apos;s sex.</p>
            )}

            <form className="medtech-result-form" onSubmit={requestSubmission}>
              {selectedTests.map((test) => {
                const fields = resultFields.filter((field) => field.testName === test.name)
                if (test.category !== 'Laboratory') {
                  return (
                    <section className="medtech-test-section" key={test.name} aria-labelledby={`test-${test.name.replaceAll(' ', '-')}`}>
                      <div className="medtech-test-section__heading">
                        <div><h3 id={`test-${test.name.replaceAll(' ', '-')}`}>{test.name}</h3><span>{test.category}</span></div>
                      </div>
                      <div className="medtech-text-results">
                        {fields.map((field) => {
                          const missing = !String(values[field.key] ?? '').trim()
                          return (
                            <label className="medtech-form__field" htmlFor={`result-${selectedResult.specimenLabel}-${field.key}`} key={field.key}>
                              <span>{field.label}</span>
                              {field.valueType === 'select' ? (
                                <select id={`result-${selectedResult.specimenLabel}-${field.key}`} value={values[field.key] ?? ''} disabled={isLocked} aria-invalid={showFieldErrors && missing} onChange={(event) => changeFieldValue(field.key, event.target.value)}>
                                  <option value="">Select {field.label.toLowerCase()}</option>
                                  {field.options.map((option) => <option key={option}>{option}</option>)}
                                </select>
                              ) : field.valueType === 'numeric' ? (
                                <input id={`result-${selectedResult.specimenLabel}-${field.key}`} type="number" step="any" value={values[field.key] ?? ''} disabled={isLocked} aria-invalid={showFieldErrors && missing} onChange={(event) => changeFieldValue(field.key, event.target.value)} />
                              ) : (
                                <textarea
                                  id={`result-${selectedResult.specimenLabel}-${field.key}`}
                                  rows="3"
                                  value={values[field.key] ?? ''}
                                  disabled={isLocked}
                                  aria-invalid={showFieldErrors && missing}
                                  onChange={(event) => changeFieldValue(field.key, event.target.value)}
                                />
                              )}
                            </label>
                          )
                        })}
                      </div>
                    </section>
                  )
                }
                return (
                  <section className="medtech-test-section" key={test.name} aria-labelledby={`test-${test.name.replaceAll(' ', '-')}`}>
                    <div className="medtech-test-section__heading">
                      <div><h3 id={`test-${test.name.replaceAll(' ', '-')}`}>{test.name}</h3><span>{test.category}</span></div>
                    </div>
                    <ResultEntryTable
                      fields={fields}
                      specimenLabel={selectedResult.specimenLabel}
                      values={values}
                      isLocked={isLocked}
                      showFieldErrors={showFieldErrors}
                      onValueChange={changeFieldValue}
                    />
                  </section>
                )
              })}

              {numericChartRows.length > 0 && (
                <figure className="medtech-findings-chart" aria-label="Chart of entered numeric findings">
                  <figcaption>
                    <strong>Numeric findings overview</strong>
                    <span>Bars show entered values; shaded bands show reference ranges when available.</span>
                  </figcaption>
                  <div className="medtech-findings-chart__rows">
                    {numericChartRows.map((row) => (
                      <div className="medtech-findings-chart__row" key={row.key}>
                        <div className="medtech-findings-chart__label"><span>{row.label}</span><strong>{row.value} {row.unit ?? ''}</strong></div>
                        <div className="medtech-findings-chart__track" role="img" aria-label={`${row.label}: ${row.value} ${row.unit ?? ''}; reference ${row.range || 'not specified'}${row.flag ? `; ${row.flag === 'H' ? 'high' : 'low'}` : ''}`}>
                          {row.rangeWidth > 0 && <span className="medtech-findings-chart__range" style={{ left: `${row.rangeStart}%`, width: `${row.rangeWidth}%` }} />}
                          <span className={`medtech-findings-chart__value-marker${row.flag ? ' is-out-of-range' : ''}`} style={{ left: `${row.valueWidth}%` }} />
                        </div>
                        <small>Reference: {row.range || 'Not specified'} {row.unit ?? ''}</small>
                      </div>
                    ))}
                  </div>
                </figure>
              )}

              {validationError && <p className="medtech-form__error" role="alert">{validationError}</p>}
              {!isLocked && (
                <div className="medtech-result-actions">
                  <button className="medtech-button medtech-button--positive" type="button" onClick={saveCurrentDraft}>Save draft</button>
                  <button className="medtech-button" type="submit">
                    {selectedResult.state === 'returned' ? 'Resubmit to pathologist' : 'Submit to pathologist'}
                  </button>
                </div>
              )}
            </form>
          </section>
        ) : (
          <section className="medtech-panel medtech-result-placeholder" aria-live="polite">
            <p>Select a specimen to review its result details.</p>
          </section>
        )}
      </div>

      {confirmSubmit && selectedResult && (
        <TechnologistDialog title="Submit to pathologist?" onClose={() => setConfirmSubmit(false)}>
          <div className="medtech-dialog__body">
            <p className="medtech-dialog__context">{selectedResult.specimenLabel} · {selectedResult.request.patient}</p>
            <p className="medtech-form__notice">After you submit, you cannot edit this result unless the pathologist returns it with feedback.</p>
            <div className="medtech-dialog__actions">
              <button className="medtech-button medtech-button--secondary" type="button" onClick={() => setConfirmSubmit(false)}>Cancel</button>
              <button className="medtech-button" type="button" onClick={confirmSubmission}>Submit</button>
            </div>
          </div>
        </TechnologistDialog>
      )}
    </section>
  )
}
