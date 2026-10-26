import { useMemo, useState } from 'react'
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
  const [page, setPage] = useState(1)
  const [saveError, setSaveError] = useState('')
  const pageSize = 10
  const { catalog } = useTestCatalog()
  const { result: rangeResult, error: loadError, refresh } = useApiResource(() => api.administrator.referenceRanges({ page: 1, pageSize: 100, q: search }), [search])
  const ranges = (rangeResult?.data ?? []).map((range) => ({
    ...range, test: range.testName, gender: range.sex ? range.sex[0].toUpperCase() + range.sex.slice(1) : 'All',
    minAge: Math.floor(Number(range.minAgeDays ?? 0) / 365.25), maxAge: Math.floor(Number(range.maxAgeDays ?? 120 * 365.25) / 365.25),
    lower: range.lowerLimit, upper: range.upperLimit,
  }))
  const selectedTest = catalog.tests.find((test) => test.id === form.test)
  const analytes = selectedTest?.analytes ?? []

  const visibleRanges = useMemo(() => ranges.filter((range) => (
    range.test.toLowerCase().includes(search.toLowerCase())
      && (genderFilter === 'All genders' || range.gender === genderFilter)
  )), [genderFilter, ranges, search])
  const pageRows = visibleRanges.slice((page - 1) * pageSize, page * pageSize)

  function openAdd() {
    setSaveError('')
    const test = catalog.tests[0]
    setForm({ ...blankRange, test: test?.id || '', analyteId: test?.analytes?.[0]?.id || '' })
    setDialog({ type: 'form' })
  }
  function openEdit(range) {
    const test = catalog.tests.find((item) => item.id === range.testId)
    setForm({ test: range.testId, analyteId: range.analyteId, gender: range.gender, minAge: String(range.minAge), maxAge: String(range.maxAge), lower: String(range.lower), upper: String(range.upper), unit: range.unit || test?.analytes?.find((item) => item.id === range.analyteId)?.unit || 'Other' })
    setSaveError('')
    setDialog({ type: 'form', editingId: range.id })
  }
  async function commitSave() {
    try {
      const body = { analyteId: form.analyteId, sex: form.gender === 'All' ? null : form.gender.toLowerCase(), minAgeDays: Math.round(Number(form.minAge) * 365.25), maxAgeDays: Math.round(Number(form.maxAge) * 365.25), lowerLimit: Number(form.lower), upperLimit: Number(form.upper), unit: form.unit }
      if (dialog.editingId) await api.administrator.updateReferenceRange(dialog.editingId, body)
      else await api.administrator.addReferenceRange(body)
      setDialog(null)
      await refresh()
    } catch (error) { setSaveError(error.message || 'Unable to save reference range.') }
  }
  async function commitDelete() {
    try { await api.administrator.removeReferenceRange(dialog.range.id); setDialog(null); await refresh() }
    catch (error) { setSaveError(error.message || 'Unable to remove reference range.') }
  }

  return (
    <section className="admin-page" aria-label="Reference ranges">
      {(loadError || saveError) && <p role="alert">{saveError || loadError}</p>}
      <div className="admin-page__controls-row">
        <div className="admin-toolbar" role="search">
          <SearchInput className="admin-toolbar__search" label="Search reference ranges" placeholder="Test name" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} />
          <label className="admin-toolbar__field">Filter by gender<select value={genderFilter} onChange={(event) => { setGenderFilter(event.target.value); setPage(1) }}><option>All genders</option><option>All</option><option>Female</option><option>Male</option></select></label>
        </div>
      </div>
      <section className="admin-list-card" aria-labelledby="reference-ranges-title">
      <header className="admin-list-card__heading"><div><h2 id="reference-ranges-title">REFERENCE RANGES</h2><p>Maintain result boundaries by test, gender, and age.</p></div><div><span>{visibleRanges.length} {visibleRanges.length === 1 ? 'range' : 'ranges'}</span><button className="admin-button" type="button" onClick={openAdd}><PlusIcon /> REFERENCE RANGE</button></div></header>
      <div className="admin-table-wrap"><table className="admin-table">
        <thead><tr><th>Test</th><th>Gender</th><th>Age range</th><th>Boundary limits</th><th>Unit</th><th>Actions</th></tr></thead>
        <tbody>
          {pageRows.map((range) => <tr key={range.id}><td className="admin-table__primary">{range.test}</td><td>{range.gender}</td><td>{range.minAge}–{range.maxAge}</td><td>{range.lower}–{range.upper}</td><td>{range.unit}</td><td className="admin-table__actions"><button className="admin-button admin-button--small admin-button--positive" type="button" onClick={() => openEdit(range)}>Edit</button><button className="admin-button admin-button--small admin-button--negative" type="button" onClick={() => setDialog({ type: 'delete', range })}>Delete</button></td></tr>)}
          {visibleRanges.length === 0 && <tr><td className="admin-empty" colSpan="6">No reference ranges match your filters.</td></tr>}
        </tbody>
      </table></div></section>
      <TablePagination currentPage={page} pageSize={pageSize} totalItems={visibleRanges.length} onPageChange={setPage} />

      {dialog?.type === 'form' && <AdminDialog title={dialog.editingId ? 'Edit reference range' : 'Add reference change'} description="Enter the applicable demographic range and result boundaries." onClose={() => setDialog(null)} size="large">
        <form id="range-form" className="admin-dialog__form" onSubmit={(event) => { event.preventDefault(); setDialog({ ...dialog, type: 'confirm-save' }) }}>
          <label className="admin-dialog__field admin-dialog__span">Test<select required value={form.test} onChange={(event) => { const test = catalog.tests.find((item) => item.id === event.target.value); setForm({ ...form, test: event.target.value, analyteId: test?.analytes?.[0]?.id || '' }) }}>{catalog.tests.map((test) => <option key={test.id} value={test.id}>{test.name}</option>)}</select></label>
          <label className="admin-dialog__field admin-dialog__span">Result field<select required value={form.analyteId} onChange={(event) => setForm({ ...form, analyteId: event.target.value })}>{analytes.map((analyte) => <option key={analyte.id} value={analyte.id}>{analyte.label}{analyte.unit ? ` (${analyte.unit})` : ''}</option>)}</select></label>
          <label className="admin-dialog__field">Gender<select value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value })}><option>All</option><option>Female</option><option>Male</option></select></label>
          <label className="admin-dialog__field">Minimum age<input type="number" min="0" max="120" required value={form.minAge} onChange={(event) => setForm({ ...form, minAge: event.target.value })} /></label>
          <label className="admin-dialog__field">Maximum age<input type="number" min={form.minAge || 0} max="120" required value={form.maxAge} onChange={(event) => setForm({ ...form, maxAge: event.target.value })} /></label>
          <label className="admin-dialog__field">Lower limit<input type="number" step="any" required value={form.lower} onChange={(event) => setForm({ ...form, lower: event.target.value })} /></label>
          <label className="admin-dialog__field">Upper limit<input type="number" step="any" required value={form.upper} onChange={(event) => setForm({ ...form, upper: event.target.value })} /></label>
          <label className="admin-dialog__field">Unit<select value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })}>{units.map((unit) => <option key={unit}>{unit}</option>)}</select></label>
        </form>
        <div className="admin-dialog__footer"><button className="admin-button admin-button--secondary" type="button" onClick={() => setDialog(null)}>Cancel</button><button className="admin-button" type="submit" form="range-form">Review changes</button></div>
      </AdminDialog>}
      {dialog?.type === 'confirm-save' && <AdminDialog title="Confirm reference range" onClose={() => setDialog(null)} size="small"><p className="admin-dialog__confirm">{dialog.editingId ? 'Save the updated boundaries for' : 'Add a reference range for'} <strong>{selectedTest?.name}</strong> · <strong>{analytes.find((item) => item.id === form.analyteId)?.label}</strong>, {form.gender.toLowerCase()}, ages <strong>{form.minAge}–{form.maxAge}</strong>?</p><div className="admin-dialog__footer"><button className="admin-button admin-button--secondary" type="button" onClick={() => setDialog({ ...dialog, type: 'form' })}>Back</button><button className="admin-button" type="button" onClick={commitSave}>Confirm</button></div></AdminDialog>}
      {dialog?.type === 'delete' && <AdminDialog title="Delete reference range?" onClose={() => setDialog(null)} size="small"><p className="admin-dialog__confirm">Delete the reference range for <strong>{dialog.range.test}</strong> ({dialog.range.gender}, {dialog.range.minAge}–{dialog.range.maxAge})?</p><div className="admin-dialog__footer"><button className="admin-button admin-button--secondary" type="button" onClick={() => setDialog(null)}>Cancel</button><button className="admin-button admin-button--negative" type="button" onClick={commitDelete}>Confirm delete</button></div></AdminDialog>}
    </section>
  )
}
