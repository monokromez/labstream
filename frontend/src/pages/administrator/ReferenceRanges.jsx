import { useState } from 'react'
import SearchInput from '../../components/data/SearchInput.jsx'
import AdminDialog from '../../components/data/AdminDialog.jsx'
import TablePagination from '../../components/data/TablePagination.jsx'
import PlusIcon from '../../components/data/PlusIcon.jsx'
import { api } from '../../api/client.js'
import useApiResource from '../../api/useApiResource.js'
import useTestCatalog from '../../data/useTestCatalog.js'
import './ReferenceRanges.css'

const units = ['g/dL', 'mg/dL', 'mmol/L', '10³/µL', '10⁶/µL', 'µIU/mL', 'U/L', 'Other']
const blankRange = { test: '', analyteId: '', gender: 'All', minAge: '', maxAge: '', lower: '', upper: '', unit: 'mg/dL' }

export default function ReferenceRanges() {
  const [search, setSearch] = useState('')
  const [genderFilter, setGenderFilter] = useState('All genders')
  const [dialog, setDialog] = useState(null)
  const [form, setForm] = useState(blankRange)
  const [formErrors, setFormErrors] = useState({})
  const [attemptedSubmit, setAttemptedSubmit] = useState(false)
  const [page, setPage] = useState(1)
  const [saveError, setSaveError] = useState('')
  const pageSize = 10
  const { catalog } = useTestCatalog()
  const sex = genderFilter === 'All genders' ? '' : genderFilter === 'All' ? 'all' : genderFilter.toLowerCase()
  const { result: rangeResult, error: loadError, refresh } = useApiResource(
    () => api.administrator.referenceRanges({ page, pageSize, q: search, sex }),
    [page, search, sex],
  )
  const ranges = (rangeResult?.data ?? []).map((range) => ({
    ...range, test: range.testName, gender: range.sex ? range.sex[0].toUpperCase() + range.sex.slice(1) : 'All',
    minAge: Math.floor(Number(range.minAgeDays ?? 0) / 365.25), maxAge: Math.floor(Number(range.maxAgeDays ?? 120 * 365.25) / 365.25),
    lower: range.lowerLimit, upper: range.upperLimit,
  }))
  const selectedTest = catalog.tests.find((test) => test.id === form.test)
  const analytes = selectedTest?.analytes ?? []

  const pageRows = ranges

  function validateForm(values) {
    const errors = {}
    const minAge = Number(values.minAge)
    const maxAge = Number(values.maxAge)
    const lower = Number(values.lower)
    const upper = Number(values.upper)

    if (!values.test) errors.test = 'Choose a test.'
    if (!values.analyteId || !catalog.tests.find((test) => test.id === values.test)?.analytes?.some((analyte) => analyte.id === values.analyteId)) {
      errors.analyteId = 'Choose a result field for the selected test.'
    }
    if (!['All', 'Female', 'Male'].includes(values.gender)) errors.gender = 'Choose All, Female, or Male.'

    if (!/^\d{1,3}$/.test(values.minAge) || minAge > 120) errors.minAge = 'Enter a whole-number age from 0 to 120.'
    if (!/^\d{1,3}$/.test(values.maxAge) || maxAge > 120) errors.maxAge = 'Enter a whole-number age from 0 to 120.'
    if (!errors.minAge && !errors.maxAge && minAge > maxAge) errors.maxAge = 'Maximum age must be at least the minimum age.'

    if (!/^-?\d{1,10}(?:\.\d{1,4})?$/.test(values.lower)
      || !Number.isFinite(lower) || Math.abs(lower) > 9_999_999_999.9999) {
      errors.lower = 'Enter a number with up to 10 digits and 4 decimal places.'
    }
    if (!/^-?\d{1,10}(?:\.\d{1,4})?$/.test(values.upper)
      || !Number.isFinite(upper) || Math.abs(upper) > 9_999_999_999.9999) {
      errors.upper = 'Enter a number with up to 10 digits and 4 decimal places.'
    }
    if (!errors.lower && !errors.upper && lower > upper) errors.upper = 'Upper limit must be at least the lower limit.'
    if (!values.unit || values.unit.length > 40) errors.unit = 'Choose a unit no longer than 40 characters.'

    return errors
  }

  function updateForm(field, value) {
    const next = { ...form, [field]: value }
    setForm(next)
    if (attemptedSubmit) setFormErrors(validateForm(next))
    setSaveError('')
  }

  function sanitizeDecimal(value, maxWholeDigits, maxDecimalPlaces) {
    const allowed = value.replace(/[^\d.-]/g, '')
    const negative = allowed.startsWith('-')
    const unsigned = allowed.replace(/-/g, '')
    const [whole = '', ...fractionParts] = unsigned.split('.')
    const fraction = fractionParts.join('').slice(0, maxDecimalPlaces)
    const wholeDigits = whole.slice(0, maxWholeDigits)
    return `${negative ? '-' : ''}${wholeDigits || (fractionParts.length ? '0' : '')}${fractionParts.length ? `.${fraction}` : ''}`
  }

  function openAdd() {
    setSaveError('')
    setFormErrors({})
    setAttemptedSubmit(false)
    const test = catalog.tests[0]
    setForm({ ...blankRange, test: test?.id || '', analyteId: test?.analytes?.[0]?.id || '' })
    setDialog({ type: 'form' })
  }
  function openEdit(range) {
    const test = catalog.tests.find((item) => item.id === range.testId)
    setForm({ test: range.testId, analyteId: range.analyteId, gender: range.gender, minAge: String(range.minAge), maxAge: String(range.maxAge), lower: String(range.lower), upper: String(range.upper), unit: range.unit || test?.analytes?.find((item) => item.id === range.analyteId)?.unit || 'Other' })
    setSaveError('')
    setFormErrors({})
    setAttemptedSubmit(false)
    setDialog({ type: 'form', editingId: range.id })
  }
  async function commitSave() {
    const errors = validateForm(form)
    setAttemptedSubmit(true)
    setFormErrors(errors)
    if (Object.keys(errors).length) {
      setDialog((current) => ({ ...current, type: 'form' }))
      return
    }
    try {
      const body = { analyteId: form.analyteId, sex: form.gender === 'All' ? null : form.gender.toLowerCase(), minAgeDays: Math.round(Number(form.minAge) * 365.25), maxAgeDays: Math.round(Number(form.maxAge) * 365.25), lowerLimit: Number(form.lower), upperLimit: Number(form.upper), unit: form.unit }
      if (dialog.editingId) await api.administrator.updateReferenceRange(dialog.editingId, body)
      else await api.administrator.addReferenceRange(body)
      setDialog(null)
      await refresh()
    } catch (error) {
      setSaveError(error.message || 'Unable to save reference range.')
      setDialog((current) => ({ ...current, type: 'form' }))
    }
  }
  async function commitDelete() {
    try { await api.administrator.removeReferenceRange(dialog.range.id); setDialog(null); await refresh() }
    catch (error) { setSaveError(error.message || 'Unable to remove reference range.') }
  }

  return (
    <section className="admin-page" aria-label="Reference ranges">
      {loadError && <p role="alert">{loadError}</p>}
      {saveError && dialog?.type !== 'form' && <p role="alert">{saveError}</p>}
      <div className="admin-page__controls-row">
        <div className="admin-toolbar" role="search">
          <SearchInput className="admin-toolbar__search" label="Search reference ranges" placeholder="Test name" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} />
          <label className="admin-toolbar__field">Filter by gender<select value={genderFilter} onChange={(event) => { setGenderFilter(event.target.value); setPage(1) }}><option>All genders</option><option>All</option><option>Female</option><option>Male</option></select></label>
        </div>
      </div>
      <section className="admin-list-card" aria-labelledby="reference-ranges-title">
      <header className="admin-list-card__heading"><div><h2 id="reference-ranges-title">REFERENCE RANGES</h2><p>Maintain result boundaries by test, gender, and age.</p></div><div><span>{rangeResult?.pagination?.total ?? 0} ranges</span><button className="admin-button" type="button" onClick={openAdd}><PlusIcon /> REFERENCE RANGE</button></div></header>
      <div className="admin-table-wrap"><table className="admin-table">
        <thead><tr><th>Test</th><th>Gender</th><th>Age range</th><th>Boundary limits</th><th>Unit</th><th>Actions</th></tr></thead>
        <tbody>
          {pageRows.map((range) => <tr key={range.id}><td className="admin-table__primary">{range.test}</td><td>{range.gender}</td><td>{range.minAge}–{range.maxAge}</td><td>{range.lower}–{range.upper}</td><td>{range.unit}</td><td className="admin-table__actions"><button className="admin-button admin-button--small admin-button--positive" type="button" onClick={() => openEdit(range)}>Edit</button><button className="admin-button admin-button--small admin-button--negative" type="button" onClick={() => { setSaveError(''); setDialog({ type: 'delete', range }) }}>Delete</button></td></tr>)}
          {pageRows.length === 0 && <tr><td className="admin-empty" colSpan="6">No reference ranges match your filters.</td></tr>}
        </tbody>
      </table></div></section>
      <TablePagination currentPage={rangeResult?.pagination?.page ?? page} pageSize={pageSize} totalItems={rangeResult?.pagination?.total ?? 0} onPageChange={setPage} />

      {dialog?.type === 'form' && <AdminDialog title={dialog.editingId ? 'Edit reference range' : 'Add reference change'} description="Enter the applicable demographic range and result boundaries." onClose={() => setDialog(null)} size="large">
        <form id="range-form" className="admin-dialog__form" onSubmit={(event) => {
          event.preventDefault()
          const errors = validateForm(form)
          setAttemptedSubmit(true)
          setFormErrors(errors)
          if (Object.keys(errors).length) return
          setDialog({ ...dialog, type: 'confirm-save' })
        }}>
          {saveError && <p className="admin-dialog__field-error admin-dialog__span" role="alert">{saveError}</p>}
          <label className="admin-dialog__field admin-dialog__span">Test<select aria-invalid={Boolean(formErrors.test)} aria-describedby={formErrors.test ? 'range-test-error' : undefined} value={form.test} onChange={(event) => { const test = catalog.tests.find((item) => item.id === event.target.value); const next = { ...form, test: event.target.value, analyteId: test?.analytes?.[0]?.id || '' }; setForm(next); if (attemptedSubmit) setFormErrors(validateForm(next)); setSaveError('') }}>{catalog.tests.map((test) => <option key={test.id} value={test.id}>{test.name}</option>)}</select>{formErrors.test && <span id="range-test-error" className="admin-dialog__field-error" role="alert">{formErrors.test}</span>}</label>
          <label className="admin-dialog__field admin-dialog__span">Result field<select aria-invalid={Boolean(formErrors.analyteId)} aria-describedby={formErrors.analyteId ? 'range-analyte-error' : undefined} value={form.analyteId} onChange={(event) => updateForm('analyteId', event.target.value)}>{analytes.map((analyte) => <option key={analyte.id} value={analyte.id}>{analyte.label}{analyte.unit ? ` (${analyte.unit})` : ''}</option>)}</select>{formErrors.analyteId && <span id="range-analyte-error" className="admin-dialog__field-error" role="alert">{formErrors.analyteId}</span>}</label>
          <label className="admin-dialog__field">Gender<select aria-invalid={Boolean(formErrors.gender)} aria-describedby={formErrors.gender ? 'range-gender-error' : undefined} value={form.gender} onChange={(event) => updateForm('gender', event.target.value)}><option>All</option><option>Female</option><option>Male</option></select>{formErrors.gender && <span id="range-gender-error" className="admin-dialog__field-error" role="alert">{formErrors.gender}</span>}</label>
          <label className="admin-dialog__field">Minimum age<input aria-invalid={Boolean(formErrors.minAge)} aria-describedby={formErrors.minAge ? 'range-min-age-error' : undefined} type="text" inputMode="numeric" maxLength="3" value={form.minAge} onChange={(event) => updateForm('minAge', event.target.value.replace(/\D/g, '').slice(0, 3))} />{formErrors.minAge && <span id="range-min-age-error" className="admin-dialog__field-error" role="alert">{formErrors.minAge}</span>}</label>
          <label className="admin-dialog__field">Maximum age<input aria-invalid={Boolean(formErrors.maxAge)} aria-describedby={formErrors.maxAge ? 'range-max-age-error' : undefined} type="text" inputMode="numeric" maxLength="3" value={form.maxAge} onChange={(event) => updateForm('maxAge', event.target.value.replace(/\D/g, '').slice(0, 3))} />{formErrors.maxAge && <span id="range-max-age-error" className="admin-dialog__field-error" role="alert">{formErrors.maxAge}</span>}</label>
          <label className="admin-dialog__field">Lower limit<input aria-invalid={Boolean(formErrors.lower)} aria-describedby={formErrors.lower ? 'range-lower-error' : undefined} type="text" inputMode="decimal" maxLength="16" value={form.lower} onChange={(event) => updateForm('lower', sanitizeDecimal(event.target.value, 10, 4))} />{formErrors.lower && <span id="range-lower-error" className="admin-dialog__field-error" role="alert">{formErrors.lower}</span>}</label>
          <label className="admin-dialog__field">Upper limit<input aria-invalid={Boolean(formErrors.upper)} aria-describedby={formErrors.upper ? 'range-upper-error' : undefined} type="text" inputMode="decimal" maxLength="16" value={form.upper} onChange={(event) => updateForm('upper', sanitizeDecimal(event.target.value, 10, 4))} />{formErrors.upper && <span id="range-upper-error" className="admin-dialog__field-error" role="alert">{formErrors.upper}</span>}</label>
          <label className="admin-dialog__field">Unit<select aria-invalid={Boolean(formErrors.unit)} aria-describedby={formErrors.unit ? 'range-unit-error' : undefined} value={form.unit} onChange={(event) => updateForm('unit', event.target.value)}>{units.map((unit) => <option key={unit}>{unit}</option>)}</select>{formErrors.unit && <span id="range-unit-error" className="admin-dialog__field-error" role="alert">{formErrors.unit}</span>}</label>
        </form>
        <div className="admin-dialog__footer"><button className="admin-button admin-button--secondary" type="button" onClick={() => setDialog(null)}>Cancel</button><button className="admin-button" type="submit" form="range-form">Review changes</button></div>
      </AdminDialog>}
      {dialog?.type === 'confirm-save' && <AdminDialog title="Confirm reference range" onClose={() => setDialog(null)} size="small">{saveError && <p role="alert">{saveError}</p>}<p className="admin-dialog__confirm">{dialog.editingId ? 'Save the updated boundaries for' : 'Add a reference range for'} <strong>{selectedTest?.name}</strong> · <strong>{analytes.find((item) => item.id === form.analyteId)?.label}</strong>, {form.gender.toLowerCase()}, ages <strong>{form.minAge}–{form.maxAge}</strong>?</p><div className="admin-dialog__footer"><button className="admin-button admin-button--secondary" type="button" onClick={() => setDialog({ ...dialog, type: 'form' })}>Back</button><button className="admin-button" type="button" onClick={commitSave}>Confirm</button></div></AdminDialog>}
      {dialog?.type === 'delete' && <AdminDialog title="Delete reference range?" onClose={() => { setSaveError(''); setDialog(null) }} size="small">{saveError && <p role="alert">{saveError}</p>}<p className="admin-dialog__confirm">Delete the reference range for <strong>{dialog.range.test}</strong> ({dialog.range.gender}, {dialog.range.minAge}–{dialog.range.maxAge})?</p><div className="admin-dialog__footer"><button className="admin-button admin-button--secondary" type="button" onClick={() => { setSaveError(''); setDialog(null) }}>Cancel</button><button className="admin-button admin-button--negative" type="button" onClick={commitDelete}>Confirm delete</button></div></AdminDialog>}
    </section>
  )
}
