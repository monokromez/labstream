import { useMemo, useState } from 'react'
import SearchInput from '../../components/data/SearchInput.jsx'
import AdminDialog from '../../components/data/AdminDialog.jsx'
import PlusIcon from '../../components/data/PlusIcon.jsx'
import TablePagination from '../../components/data/TablePagination.jsx'
import { api } from '../../api/client.js'
import useApiResource from '../../api/useApiResource.js'
import './TestCatalog.css'

const specimenTypes = ['Blood', 'Whole blood', 'Serum', 'Plasma', 'Urine', 'Stool', 'Sputum', 'Swab', 'Saliva', 'Cerebrospinal fluid', 'Tissue', 'Other']
const unitsBySpecimen = {
  Blood: ['g/dL', 'g/L', 'mg/dL', 'mmol/L', 'µmol/L', 'U/L', '%', 'cells/µL', '10³/µL', '10⁶/µL', 'fL', 'pg', 'Other'],
  'Whole blood': ['g/dL', 'g/L', 'mg/dL', 'mmol/L', 'µmol/L', 'U/L', '%', 'cells/µL', '10³/µL', '10⁶/µL', 'fL', 'pg', 'Other'],
  Serum: ['mg/dL', 'g/dL', 'mmol/L', 'µmol/L', 'mEq/L', 'U/L', 'ng/mL', 'µg/L', 'Other'],
  Plasma: ['mg/dL', 'g/dL', 'mmol/L', 'µmol/L', 'mEq/L', 'U/L', 'ng/mL', 'µg/L', 'Other'],
  Urine: ['mg/dL', 'g/L', 'mmol/L', 'µmol/L', 'cells/HPF', 'RBC/HPF', 'WBC/HPF', 'pH', 'Other'],
  Stool: ['cells/HPF', 'mg/g', 'µg/g', 'Other'],
  Sputum: ['CFU/mL', 'copies/mL', 'cells/HPF', 'Other'],
  Swab: ['CFU/mL', 'copies/mL', 'Other'],
  Saliva: ['mg/dL', 'mmol/L', 'ng/mL', 'copies/mL', 'Other'],
  'Cerebrospinal fluid': ['mg/dL', 'mmol/L', 'cells/µL', 'cells/mm³', 'Other'],
  Tissue: ['mg/g', 'µg/g', 'cells/HPF', 'Other'],
  Other: ['mg/dL', 'g/dL', 'mmol/L', 'µmol/L', 'U/L', '%', 'Other'],
}
const emptyTest = { name: '', category: '', price: '', turnaroundHours: '', turnaroundMinutePart: '', availability: 'Available', specimenType: 'Blood', analyteLabel: 'Result', analyteValueType: 'text', analyteUnit: '', customAnalyteUnit: '', analyteOptions: '' }

function formatTurnaround(minutes) {
  if (minutes == null) return '—'
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return hours ? `${hours}h ${remainder}m` : `${remainder}m`
}

export default function TestCatalog() {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All categories')
  const [dialog, setDialog] = useState(null)
  const [view, setView] = useState('test')
  const [form, setForm] = useState(emptyTest)
  const [categoryName, setCategoryName] = useState('')
  const [saveNotice, setSaveNotice] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10
  const { result: catalogResult, error: loadError, refresh } = useApiResource(() => api.administrator.catalog({ q: search }), [search])
  const rawCatalog = catalogResult?.data ?? { categories: [], tests: [] }
  const categoryRecords = rawCatalog.categories ?? []
  const catalog = {
    categories: categoryRecords.map((category) => category.name),
    categoryRecords,
    tests: (rawCatalog.tests ?? []).map((test) => ({
      ...test, category: test.categoryName, availability: test.isAvailable ? 'Available' : 'Unavailable',
      turnaround: formatTurnaround(test.turnaroundMinutes),
    })),
  }

  const visibleTests = useMemo(() => catalog.tests.filter((test) => (
    test.name.toLowerCase().includes(search.toLowerCase())
      && (categoryFilter === 'All categories' || test.category === categoryFilter)
  )), [catalog.tests, categoryFilter, search])
  const pageRows = visibleTests.slice((page - 1) * pageSize, page * pageSize)

  function openAdd() {
    setView('test')
    setForm({ ...emptyTest, category: catalog.categories[0] || '' })
    setCategoryName('')
    setSaveNotice('')
    setDialog({ type: 'manage' })
  }
  async function saveTest() {
    try {
      const category = categoryRecords.find((item) => item.name === form.category)
      const hours = form.turnaroundHours === '' ? 0 : Number(form.turnaroundHours)
      const minutes = form.turnaroundMinutePart === '' ? 0 : Number(form.turnaroundMinutePart)
      const hasTurnaround = form.turnaroundHours !== '' || form.turnaroundMinutePart !== ''
      const turnaroundMinutes = hasTurnaround ? hours * 60 + minutes : null
      if (!Number.isInteger(hours) || hours < 0 || !Number.isInteger(minutes) || minutes < 0 || minutes > 59 || (hasTurnaround && turnaroundMinutes < 1)) {
        setSaveNotice('Enter a valid turnaround time. Minutes must be from 0 to 59.')
        return
      }
      if (dialog.editingId) {
        await api.administrator.updateTest(dialog.editingId, { name: form.name, categoryId: category?.id, price: Number(form.price), turnaroundMinutes, isAvailable: form.availability === 'Available' })
        setDialog(null)
      } else {
        const options = form.analyteOptions.split(',').map((value) => value.trim()).filter(Boolean)
        await api.administrator.addTest({
          name: form.name, categoryId: category?.id, price: Number(form.price), turnaroundMinutes,
          isAvailable: form.availability === 'Available', specimens: [{ specimenType: form.specimenType.trim() }],
          analytes: [{ key: 'RESULT', label: form.analyteLabel.trim(), valueType: form.analyteValueType, unit: (form.analyteUnit === 'Other' ? form.customAnalyteUnit : form.analyteUnit).trim(), options }],
        })
        setForm({ ...emptyTest, category: catalog.categories[0] || '' })
        setSaveNotice('Test added. You can add another test or category.')
        setDialog({ type: 'manage' })
      }
      await refresh()
    } catch (error) { setSaveNotice(error.message || 'Unable to save test.') }
  }
  async function saveCategory() {
    const name = categoryName.trim()
    if (!name || catalog.categories.some((category) => category.toLowerCase() === name.toLowerCase())) return
    try {
      await api.administrator.addCategory({ name })
      setCategoryName('')
      setSaveNotice('Category added. You can add another category or test.')
      setView('category')
      setDialog({ type: 'manage' })
      await refresh()
    } catch (error) { setSaveNotice(error.message || 'Unable to add category.') }
  }
  async function deleteTest() {
    try { await api.administrator.removeTest(dialog.test.id); setDialog(null); await refresh() }
    catch (error) { setSaveNotice(error.message || 'Unable to deactivate test.') }
  }
  async function removeCategory() {
    const category = categoryRecords.find((item) => item.name === dialog.category)
    const moves = dialog.moves ?? {}
    const testActions = catalog.tests.filter((test) => test.category === dialog.category).map((test) => moves[test.id]
      ? { testId: test.id, action: 'relocate', categoryId: categoryRecords.find((item) => item.name === moves[test.id])?.id }
      : { testId: test.id, action: 'remove' })
    try {
      await api.administrator.removeCategory(category.id, testActions)
      if (categoryFilter === dialog.category) setCategoryFilter('All categories')
      setDialog(null)
      await refresh()
    } catch (error) { setSaveNotice(error.message || 'Unable to remove category.') }
  }
  function editTest(test) {
    const turnaroundMinutes = test.turnaroundMinutes ?? null
    setForm({
      ...emptyTest,
      name: test.name,
      category: test.category,
      price: String(test.price),
      turnaroundHours: turnaroundMinutes == null ? '' : String(Math.floor(turnaroundMinutes / 60)),
      turnaroundMinutePart: turnaroundMinutes == null ? '' : String(turnaroundMinutes % 60),
      availability: test.availability,
    })
    setSaveNotice('')
    setDialog({ type: 'manage', editingId: test.id })
    setView('test')
  }

  return (
    <section className="admin-page" aria-label="Test catalog">
      {loadError && <p role="alert">{loadError}</p>}
      <div className="admin-page__controls-row">
        <div className="admin-toolbar" role="search">
          <SearchInput className="admin-toolbar__search" label="Search test catalog" placeholder="Test name" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} />
          <label className="admin-toolbar__field">Filter by category<select value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setPage(1) }}><option>All categories</option>{catalog.categories.map((category) => <option key={category}>{category}</option>)}</select></label>
        </div>
      </div>
      <section className="test-catalog__table-card" aria-labelledby="test-catalog-table-title">
        <header className="test-catalog__table-heading"><div><h2 id="test-catalog-table-title">TEST CATALOG</h2><p>Manage available tests, categories, pricing, and turnaround times.</p></div><div className="test-catalog__table-actions"><span>{visibleTests.length} {visibleTests.length === 1 ? 'test' : 'tests'}</span><button className="admin-button" type="button" onClick={openAdd}><PlusIcon /> TEST/CATEGORY</button></div></header>
      <div className="admin-table-wrap"><table className="admin-table">
        <thead><tr><th>Test</th><th>Category</th><th>Price</th><th>TAT</th><th>Availability</th><th>Actions</th></tr></thead>
        <tbody>
          {pageRows.map((test) => <tr key={test.id}><td className="admin-table__primary">{test.name}</td><td>{test.category}</td><td>₱{Number(test.price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td><td>{test.turnaround}</td><td><span className={`admin-badge ${test.availability === 'Available' ? 'admin-badge--success' : 'admin-badge--muted'}`}>{test.availability}</span></td><td className="admin-table__actions"><button className="admin-button admin-button--small admin-button--positive" type="button" onClick={() => editTest(test)}>Edit</button><button className="admin-button admin-button--small admin-button--negative" type="button" onClick={() => setDialog({ type: 'delete', test })}>Delete</button></td></tr>)}
          {visibleTests.length === 0 && <tr><td className="admin-empty" colSpan="6">{catalogResult ? 'No tests match your filters.' : 'Loading test catalog…'}</td></tr>}
        </tbody>
      </table></div></section>
      <TablePagination currentPage={page} pageSize={pageSize} totalItems={visibleTests.length} onPageChange={setPage} />

      {dialog?.type === 'manage' && <AdminDialog title={dialog.editingId ? 'Edit test' : 'Add Test/Category'} description="Choose whether to add a test or a catalog category." onClose={() => setDialog(null)} size="large">
        <div className="admin-dialog__tabs"><button className="admin-dialog__tab" type="button" aria-pressed={view === 'test'} onClick={() => setView('test')}>Test</button><button className="admin-dialog__tab" type="button" aria-pressed={view === 'category'} onClick={() => setView('category')}>Category</button></div>
        {saveNotice && <p className="admin-dialog__note" role="status">{saveNotice}</p>}
        {view === 'test' ? <form id="test-form" className="admin-dialog__form admin-dialog__form--test" onSubmit={(event) => { event.preventDefault(); setDialog({ ...dialog, type: 'confirm-test' }) }}>
          <label className="admin-dialog__field">Test name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label className="admin-dialog__field">Category<select required value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{catalog.categories.map((category) => <option key={category}>{category}</option>)}</select></label>
          <label className="admin-dialog__field">Price (₱)<input type="number" min="0" step="0.01" required value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} /></label>
          <fieldset className="admin-dialog__field test-catalog__turnaround-field"><legend>Turnaround time</legend><div className="test-catalog__turnaround-inputs"><label>Hours<input type="number" min="0" step="1" placeholder="0" value={form.turnaroundHours} onChange={(event) => setForm({ ...form, turnaroundHours: event.target.value })} /></label><label>Minutes<input type="number" min="0" max="59" step="1" placeholder="0" value={form.turnaroundMinutePart} onChange={(event) => setForm({ ...form, turnaroundMinutePart: event.target.value })} /></label></div></fieldset>
          <label className="admin-dialog__field">Availability<select value={form.availability} onChange={(event) => setForm({ ...form, availability: event.target.value })}><option>Available</option><option>Unavailable</option></select></label>
          {!dialog.editingId && <>
            <label className="admin-dialog__field">Required specimen type<select required value={form.specimenType} onChange={(event) => setForm({ ...form, specimenType: event.target.value, analyteUnit: '', customAnalyteUnit: '' })}>{specimenTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
            <label className="admin-dialog__field">First result field<input required value={form.analyteLabel} onChange={(event) => setForm({ ...form, analyteLabel: event.target.value })} placeholder="e.g. Hemoglobin" /><small className="admin-dialog__field-hint">The result name or analyte the technologist will record for this test.</small></label>
            <label className="admin-dialog__field">Result input type<select value={form.analyteValueType} onChange={(event) => setForm({ ...form, analyteValueType: event.target.value, analyteUnit: '', customAnalyteUnit: '' })}><option value="text">Text</option><option value="numeric">Number</option><option value="select">Dropdown</option><option value="boolean">Yes / no</option></select><small className="admin-dialog__field-hint">Choose how the technologist enters the result: typed text, a number, a selected option, or yes/no.</small></label>
            {form.analyteValueType === 'numeric' && <label className="admin-dialog__field">Result unit<select value={form.analyteUnit} onChange={(event) => setForm({ ...form, analyteUnit: event.target.value, customAnalyteUnit: '' })}><option value="">No unit</option>{(unitsBySpecimen[form.specimenType] ?? unitsBySpecimen.Other).map((unit) => <option key={unit}>{unit}</option>)}</select><small className="admin-dialog__field-hint">Unit choices follow the selected specimen. Confirm the correct unit for the test and reference range.</small></label>}
            {form.analyteValueType === 'numeric' && form.analyteUnit === 'Other' && <label className="admin-dialog__field">Specify result unit<input required value={form.customAnalyteUnit} onChange={(event) => setForm({ ...form, customAnalyteUnit: event.target.value })} placeholder="Enter the unit" /></label>}
            {form.analyteValueType === 'select' && <label className="admin-dialog__field admin-dialog__span">Dropdown options (comma-separated)<input required value={form.analyteOptions} onChange={(event) => setForm({ ...form, analyteOptions: event.target.value })} placeholder="Positive, Negative" /></label>}
          </>}
        </form> : <div className="admin-dialog__form admin-dialog__form--category"><label className="admin-dialog__field admin-dialog__span">Category name<input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="e.g. Serology" /></label><div className="admin-dialog__span"><p className="admin-dialog__note">Existing categories</p><ul className="test-catalog__category-list">{catalog.categories.map((category) => <li key={category}><span>{category} <small>({catalog.tests.filter((test) => test.category === category).length} tests)</small></span><button className="admin-button admin-button--small admin-button--negative" type="button" onClick={() => setDialog({ type: 'remove-category', category, moves: {} })}>Remove</button></li>)}</ul></div></div>}
        <div className="admin-dialog__footer"><button className="admin-button admin-button--secondary" type="button" onClick={() => setDialog(null)}>Cancel</button>{view === 'test' ? <button className="admin-button" type="submit" form="test-form">Review test</button> : <button className="admin-button" type="button" disabled={!categoryName.trim()} onClick={() => setDialog({ type: 'confirm-category' })}>Review category</button>}</div>
      </AdminDialog>}
      {dialog?.type === 'confirm-test' && <AdminDialog title={dialog.editingId ? 'Confirm test changes' : 'Confirm new test'} onClose={() => setDialog(null)} size="small"><p className="admin-dialog__confirm">{dialog.editingId ? 'Save changes to' : 'Add'} <strong>{form.name}</strong> under <strong>{form.category}</strong>?</p><div className="admin-dialog__footer"><button className="admin-button admin-button--secondary" type="button" onClick={() => setDialog({ ...dialog, type: 'manage' })}>Back</button><button className="admin-button" type="button" onClick={saveTest}>Confirm</button></div></AdminDialog>}
      {dialog?.type === 'confirm-category' && <AdminDialog title="Confirm category" onClose={() => setDialog(null)} size="small"><p className="admin-dialog__confirm">Add <strong>{categoryName.trim()}</strong> to the test catalog categories?</p><div className="admin-dialog__footer"><button className="admin-button admin-button--secondary" type="button" onClick={() => setDialog({ type: 'manage' })}>Back</button><button className="admin-button" type="button" onClick={saveCategory}>Confirm</button></div></AdminDialog>}
      {dialog?.type === 'delete' && <AdminDialog title="Delete test?" onClose={() => setDialog(null)} size="small"><p className="admin-dialog__confirm">Delete <strong>{dialog.test.name}</strong> from the catalog? This sample action cannot be undone.</p><div className="admin-dialog__footer"><button className="admin-button admin-button--secondary" type="button" onClick={() => setDialog(null)}>Cancel</button><button className="admin-button admin-button--negative" type="button" onClick={deleteTest}>Confirm delete</button></div></AdminDialog>}
      {dialog?.type === 'remove-category' && <AdminDialog title={`Remove ${dialog.category}?`} description="Choose a destination category for each test, or remove that test from the sample catalog." onClose={() => setDialog(null)} size="large">
        {catalog.tests.filter((test) => test.category === dialog.category).length === 0
          ? <p className="admin-dialog__confirm">This category has no tests. Remove it from the catalog?</p>
          : <div className="test-catalog__category-tests">{catalog.tests.filter((test) => test.category === dialog.category).map((test) => <label key={test.id}><span>{test.name}</span><select value={dialog.moves[test.id] ?? ''} onChange={(event) => setDialog({ ...dialog, moves: { ...dialog.moves, [test.id]: event.target.value } })}><option value="">Remove test</option>{catalog.categories.filter((category) => category !== dialog.category).map((category) => <option key={category} value={category}>Move to {category}</option>)}</select></label>)}</div>}
        <div className="admin-dialog__footer"><button className="admin-button admin-button--secondary" type="button" onClick={() => setDialog(null)}>Cancel</button><button className="admin-button admin-button--negative" type="button" onClick={removeCategory}>Confirm removal</button></div>
      </AdminDialog>}
    </section>
  )
}
