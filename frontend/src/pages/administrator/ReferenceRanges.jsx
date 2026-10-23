import { useEffect, useMemo, useState } from 'react'
import SearchInput from '../../components/data/SearchInput.jsx'
import AdminDialog from '../../components/data/AdminDialog.jsx'
import TablePagination from '../../components/data/TablePagination.jsx'
import PlusIcon from '../../components/data/PlusIcon.jsx'
import { readCatalog, subscribeCatalog } from '../../data/administratorCatalog.js'
import './ReferenceRanges.css'

const units = ['g/dL', 'mg/dL', 'mmol/L', '10³/µL', '10⁶/µL', 'µIU/mL', 'U/L', 'Other']
const initialRanges = [
  { id: 1, test: 'Complete Blood Count (CBC)', gender: 'Female', minAge: 18, maxAge: 120, lower: 12, upper: 16, unit: 'g/dL' },
  { id: 2, test: 'Complete Blood Count (CBC)', gender: 'Male', minAge: 18, maxAge: 120, lower: 13.5, upper: 17.5, unit: 'g/dL' },
  { id: 3, test: 'Fasting Blood Sugar', gender: 'All', minAge: 18, maxAge: 120, lower: 70, upper: 99, unit: 'mg/dL' },
]
const blankRange = { test: '', gender: 'All', minAge: '', maxAge: '', lower: '', upper: '', unit: 'mg/dL' }

export default function ReferenceRanges() {
  const [ranges, setRanges] = useState(initialRanges)
  const [catalog, setCatalog] = useState(readCatalog)
  const [search, setSearch] = useState('')
  const [genderFilter, setGenderFilter] = useState('All genders')
  const [dialog, setDialog] = useState(null)
  const [form, setForm] = useState(blankRange)
  const [page, setPage] = useState(1)
  const pageSize = 10

  useEffect(() => subscribeCatalog(() => setCatalog(readCatalog())), [])

  const visibleRanges = useMemo(() => ranges.filter((range) => (
    range.test.toLowerCase().includes(search.toLowerCase())
      && (genderFilter === 'All genders' || range.gender === genderFilter)
  )), [genderFilter, ranges, search])
  const pageRows = visibleRanges.slice((page - 1) * pageSize, page * pageSize)

  function openAdd() {
    setForm({ ...blankRange, test: catalog.tests[0]?.name || '' })
    setDialog({ type: 'form' })
  }
  function openEdit(range) {
    setForm({ test: range.test, gender: range.gender, minAge: String(range.minAge), maxAge: String(range.maxAge), lower: String(range.lower), upper: String(range.upper), unit: range.unit })
    setDialog({ type: 'form', editingId: range.id })
  }
  function commitSave() {
    const value = { ...form, id: dialog.editingId ?? Date.now(), minAge: Number(form.minAge), maxAge: Number(form.maxAge), lower: Number(form.lower), upper: Number(form.upper) }
    setRanges((current) => dialog.editingId ? current.map((range) => range.id === dialog.editingId ? value : range) : [...current, value])
    setDialog(null)
  }
  function commitDelete() {
    setRanges((current) => current.filter((range) => range.id !== dialog.range.id))
    setDialog(null)
  }

  return (
    <section className="admin-page" aria-label="Reference ranges">
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
          <label className="admin-dialog__field admin-dialog__span">Test<select required value={form.test} onChange={(event) => setForm({ ...form, test: event.target.value })}>{catalog.tests.map((test) => <option key={test.id} value={test.name}>{test.name}</option>)}</select></label>
          <label className="admin-dialog__field">Gender<select value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value })}><option>All</option><option>Female</option><option>Male</option></select></label>
          <label className="admin-dialog__field">Minimum age<input type="number" min="0" max="120" required value={form.minAge} onChange={(event) => setForm({ ...form, minAge: event.target.value })} /></label>
          <label className="admin-dialog__field">Maximum age<input type="number" min={form.minAge || 0} max="120" required value={form.maxAge} onChange={(event) => setForm({ ...form, maxAge: event.target.value })} /></label>
          <label className="admin-dialog__field">Lower limit<input type="number" step="any" required value={form.lower} onChange={(event) => setForm({ ...form, lower: event.target.value })} /></label>
          <label className="admin-dialog__field">Upper limit<input type="number" step="any" required value={form.upper} onChange={(event) => setForm({ ...form, upper: event.target.value })} /></label>
          <label className="admin-dialog__field">Unit<select value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })}>{units.map((unit) => <option key={unit}>{unit}</option>)}</select></label>
        </form>
        <div className="admin-dialog__footer"><button className="admin-button admin-button--secondary" type="button" onClick={() => setDialog(null)}>Cancel</button><button className="admin-button" type="submit" form="range-form">Review changes</button></div>
      </AdminDialog>}
      {dialog?.type === 'confirm-save' && <AdminDialog title="Confirm reference range" onClose={() => setDialog(null)} size="small"><p className="admin-dialog__confirm">{dialog.editingId ? 'Save the updated boundaries for' : 'Add a reference range for'} <strong>{form.test}</strong>, {form.gender.toLowerCase()}, ages <strong>{form.minAge}–{form.maxAge}</strong>?</p><div className="admin-dialog__footer"><button className="admin-button admin-button--secondary" type="button" onClick={() => setDialog({ ...dialog, type: 'form' })}>Back</button><button className="admin-button" type="button" onClick={commitSave}>Confirm</button></div></AdminDialog>}
      {dialog?.type === 'delete' && <AdminDialog title="Delete reference range?" onClose={() => setDialog(null)} size="small"><p className="admin-dialog__confirm">Delete the reference range for <strong>{dialog.range.test}</strong> ({dialog.range.gender}, {dialog.range.minAge}–{dialog.range.maxAge})?</p><div className="admin-dialog__footer"><button className="admin-button admin-button--secondary" type="button" onClick={() => setDialog(null)}>Cancel</button><button className="admin-button admin-button--negative" type="button" onClick={commitDelete}>Confirm delete</button></div></AdminDialog>}
    </section>
  )
}
