import { useState } from 'react'
import SearchInput from '../../components/data/SearchInput.jsx'
import AdminDialog from '../../components/data/AdminDialog.jsx'
import PlusIcon from '../../components/data/PlusIcon.jsx'
import TablePagination from '../../components/data/TablePagination.jsx'
import { CurrencyInput, DecimalInput, LimitedInput } from '../../components/forms/LimitedInput.jsx'
import { api } from '../../api/client.js'
import useApiResource from '../../api/useApiResource.js'
import './TestCatalog.css'

const specimenTypes = ['Blood', 'Whole blood', 'Serum', 'Plasma', 'Citrated plasma', 'Urine', 'Stool', 'Sputum', 'Swab', 'Saliva', 'Semen', 'Cervical specimen', 'Aspirate', 'Cerebrospinal fluid', 'Tissue', 'Other']
const MAX_TURNAROUND_HOURS = 720
const PAGE_SIZE = 10
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

const emptyTest = {
  name: '',
  categoryIds: [],
  price: '',
  turnaroundHours: '',
  turnaroundMinutePart: '',
  specimenType: 'Blood',
  specimens: [{ specimenType: 'Whole blood', collectionInstructions: '', minimumQuantity: '', quantityUnit: '', isRequired: true }],
  analytes: [
    { label: '', valueType: 'numeric', unit: 'mg/dL', customAnalyteUnit: '', analyteOptions: '' },
  ],
}

function formatTurnaround(minutes) {
  if (minutes == null) return '—'
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return hours ? `${hours}h ${remainder}m` : `${remainder}m`
}

export default function TestCatalog() {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All categories')
  const [availabilityFilter, setAvailabilityFilter] = useState('all')
  const [dialog, setDialog] = useState(null)
  const [view, setView] = useState('test')
  const [form, setForm] = useState(emptyTest)
  const [categoryName, setCategoryName] = useState('')
  const [saveNotice, setSaveNotice] = useState('')
  const [page, setPage] = useState(1)
  const selectedCategoryId = categoryFilter === 'All categories' ? '' : categoryFilter
  const { result: catalogResult, error: loadError, refresh } = useApiResource(
    () => api.administrator.catalog({ page, pageSize: PAGE_SIZE, q: search, categoryId: selectedCategoryId, availability: availabilityFilter }),
    [page, search, selectedCategoryId, availabilityFilter],
  )
  const rawCatalog = catalogResult?.data ?? { categories: [], tests: [] }
  const categoryRecords = (rawCatalog.categories ?? []).map((category) => ({ ...category, isActive: category.isActive ?? category.is_active ?? true }))
  const firstActiveCategoryId = categoryRecords.find((category) => category.isActive)?.id
  const catalog = {
    categories: categoryRecords.map((category) => category.name),
    categoryRecords,
    tests: (rawCatalog.tests ?? []).map((test) => ({
      ...test, categoryNames: (test.categories ?? []).map((category) => category.name),
      categoryIds: (test.categories ?? []).map((category) => category.id),
      category: (test.categories ?? []).map((category) => category.name).join(', ') || test.categoryName,
      availability: test.isAvailable ? 'Available' : 'Unavailable',
      turnaround: formatTurnaround(test.turnaroundMinutes),
    })),
  }
  const canReviewTest = form.analytes.length > 0 && form.analytes.every((analyte) => analyte.label.trim())
  const pageRows = catalog.tests

  function openAdd() {
    setView('test')
    setForm({ ...emptyTest, categoryIds: firstActiveCategoryId ? [firstActiveCategoryId] : [] })
    setCategoryName('')
    setSaveNotice('')
    setDialog({ type: 'manage' })
  }

  function addAnalyte() {
    setForm((prev) => ({
      ...prev,
      analytes: [...prev.analytes, { label: '', valueType: 'numeric', unit: 'mg/dL', customAnalyteUnit: '', analyteOptions: '' }],
    }))
  }

  function addSpecimen() {
    setForm((prev) => ({ ...prev, specimens: [...prev.specimens, { specimenType: 'Blood', collectionInstructions: '', minimumQuantity: '', quantityUnit: '', isRequired: true }] }))
  }

  function updateSpecimen(index, key, value) {
    setForm((prev) => {
      const specimens = [...prev.specimens]
      specimens[index] = { ...specimens[index], [key]: value }
      return { ...prev, specimens, specimenType: specimens[0]?.specimenType || 'Other' }
    })
  }

  function removeSpecimen(index) {
    if (form.specimens.length <= 1) return
    setForm((prev) => {
      const specimens = prev.specimens.filter((_, i) => i !== index)
      return { ...prev, specimens, specimenType: specimens[0]?.specimenType || 'Other' }
    })
  }

  function removeAnalyte(index) {
    if (form.analytes.length <= 1) return
    setForm((prev) => ({
      ...prev,
      analytes: prev.analytes.filter((_, i) => i !== index),
    }))
  }

  function updateAnalyte(index, key, value) {
    setForm((prev) => {
      const next = [...prev.analytes]
      next[index] = { ...next[index], [key]: value }
      if (key === 'valueType' && value !== 'numeric') {
        next[index].unit = ''
        next[index].customAnalyteUnit = ''
      }
      return { ...prev, analytes: next }
    })
  }

  async function viewConfiguration(test, version) {
    try {
      const res = await api.administrator.testConfiguration(test.id, version)
      setDialog({ type: 'view-config', test, config: res.data })
    } catch (error) {
      setSaveNotice(error.message || 'Unable to load test configuration.')
    }
  }

  async function saveTest() {
    try {
      const categoryIds = form.categoryIds
      const price = String(form.price)
      if (!form.name.trim() || form.name.length > 160) {
        setSaveNotice('Test name is required and must be no longer than 160 characters.')
        return
      }
      if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(price) || Number(price) > 99_999_999.99) {
        setSaveNotice('Price must contain numbers only, with up to 8 digits and 2 decimal places.')
        return
      }
      const hours = form.turnaroundHours === '' ? 0 : Number(form.turnaroundHours)
      const minutes = form.turnaroundMinutePart === '' ? 0 : Number(form.turnaroundMinutePart)
      const hasTurnaround = form.turnaroundHours !== '' || form.turnaroundMinutePart !== ''
      const turnaroundMinutes = hasTurnaround ? hours * 60 + minutes : null
      if (!Number.isInteger(hours) || hours < 0 || hours > MAX_TURNAROUND_HOURS || !Number.isInteger(minutes) || minutes < 0 || minutes > 59 || (hasTurnaround && (turnaroundMinutes < 1 || turnaroundMinutes > MAX_TURNAROUND_HOURS * 60))) {
        setSaveNotice('Enter a valid turnaround time. The maximum is 30 days, with minutes from 0 to 59.')
        return
      }
      const analytesPayload = form.analytes.map((item, idx) => {
        const options = item.analyteOptions ? item.analyteOptions.split(',').map((val) => val.trim()).filter(Boolean) : []
        return {
          key: item.key || `PARAM_${idx + 1}`,
          label: item.label.trim(),
          valueType: item.valueType,
          unit: item.valueType === 'numeric' ? (item.unit === 'Other' ? item.customAnalyteUnit : item.unit).trim() || null : null,
          options,
          isRequired: item.isRequired !== false,
        }
      })
      if (form.analytes.some((item) => item.analyteOptions.split(',').some((option) => option.trim().length > 120))) {
        setSaveNotice('Each dropdown option or table column must be no longer than 120 characters.')
        return
      }
      if (form.analytes.some((item) => ['select', 'structured'].includes(item.valueType)
        && item.analyteOptions.trim()
        && item.analyteOptions.split(',').some((option) => !option.trim()))) {
        setSaveNotice('Remove empty entries from the comma-separated options or table columns.')
        return
      }
      if (!analytesPayload.length || analytesPayload.some((a) => !a.label)) {
        setSaveNotice('Provide a label for each test parameter.')
        return
      }
      if (form.analytes.some((item) => item.label.length > 160)) {
        setSaveNotice('Each test parameter label must be no longer than 160 characters.')
        return
      }
      if (analytesPayload.some((item) => new Set(item.options.map((option) => option.toLowerCase())).size !== item.options.length)) {
        setSaveNotice('Dropdown options and table columns must be unique.')
        return
      }
      if (!categoryIds.length) {
        setSaveNotice('Choose at least one category for this test.')
        return
      }
      if (analytesPayload.some((a) => a.valueType === 'select' && !a.options.length)) {
        setSaveNotice('Provide at least one option for each dropdown parameter.')
        return
      }
      if (analytesPayload.some((a) => a.valueType === 'structured' && (a.options.length < 2 || a.options.some((column) => !column) || new Set(a.options.map((column) => column.toLowerCase())).size !== a.options.length))) {
        setSaveNotice('Structured result fields need at least two unique column labels.')
        return
      }
      if (analytesPayload.some((a) => a.valueType === 'structured' && a.options.length > 20)) {
        setSaveNotice('Repeatable tables can have no more than 20 columns.')
        return
      }
      const specimenPayload = form.specimens.map((item) => ({
        ...item,
        specimenType: item.specimenType.trim(),
        collectionInstructions: item.collectionInstructions.trim() || null,
        minimumQuantity: item.minimumQuantity === '' ? null : Number(item.minimumQuantity),
        quantityUnit: item.quantityUnit.trim() || null,
      }))
      if (!specimenPayload.length || specimenPayload.some((item) => !item.specimenType)) {
        setSaveNotice('Choose a type for each required specimen.')
        return
      }
      if (form.specimens.some((item) => item.collectionInstructions.length > 500 || item.quantityUnit.length > 40)) {
        setSaveNotice('Collection instructions must be no longer than 500 characters and quantity units no longer than 40 characters.')
        return
      }
      if (form.specimens.some((item) => item.minimumQuantity !== ''
        && (!/^\d{1,8}(?:\.\d{1,2})?$/.test(item.minimumQuantity)
          || Number(item.minimumQuantity) < 0.01 || Number(item.minimumQuantity) > 99_999_999.99))) {
        setSaveNotice('Minimum quantity must be a number from 0.01 to 99,999,999.99, with up to 2 decimal places.')
        return
      }
      if (dialog.editingId) {
        await api.administrator.updateTest(dialog.editingId, {
          name: form.name, categoryIds, price: Number(form.price), turnaroundMinutes,
          specimens: specimenPayload, analytes: analytesPayload,
        })
        setDialog(null)
      } else {
        await api.administrator.addTest({
          name: form.name, categoryIds, price: Number(form.price), turnaroundMinutes,
          isAvailable: false, specimens: specimenPayload,
          analytes: analytesPayload,
        })
        setForm({ ...emptyTest, categoryIds: firstActiveCategoryId ? [firstActiveCategoryId] : [] })
        setSaveNotice('Test added. You can add another test or category.')
        setDialog({ type: 'manage' })
      }
      await refresh()
    } catch (error) { setSaveNotice(error.message || 'Unable to save test.') }
  }

  async function saveCategory() {
    const name = categoryName.trim()
    if (name.length < 2 || name.length > 120) {
      setSaveNotice('Category name must be between 2 and 120 characters.')
      return
    }
    if (catalog.categories.some((category) => category.toLowerCase() === name.toLowerCase())) {
      setSaveNotice('A category with this name already exists.')
      return
    }
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

  async function requestTestAvailability(test) {
    setSaveNotice('')
    setDialog({ type: 'confirm-test-availability', test })
  }

  async function confirmTestAvailability() {
    const test = dialog.test
    try {
      await api.administrator.setTestAvailable(test.id, !test.isAvailable)
      setDialog(null)
      await refresh()
    } catch (error) {
      if (error.code === 'TEST_REFERENCE_RANGE_REQUIRED') {
        setDialog({ type: 'missing-reference-range', test })
        return
      }
      setSaveNotice(error.message || 'Unable to update test availability.')
    }
  }

  async function requestCategoryAvailability(category) {
    setSaveNotice('')
    setDialog({ type: 'confirm-category-availability', category })
  }

  async function confirmCategoryAvailability() {
    const category = dialog.category
    try {
      await api.administrator.setCategoryActive(category.id, !category.isActive)
      setDialog(null)
      await refresh()
    } catch (error) {
      setSaveNotice(error.message || 'Unable to update category availability.')
    }
  }

  async function openRemoveCategory(category) {
    setDialog({ type: 'loading-category', category: category.name })
    try {
      const firstPage = await api.administrator.catalog({ page: 1, pageSize: 100, categoryId: category.id })
      const affectedTests = [...firstPage.data.tests]
      for (let nextPage = 2; nextPage <= firstPage.pagination.totalPages; nextPage += 1) {
        const response = await api.administrator.catalog({ page: nextPage, pageSize: 100, categoryId: category.id })
        affectedTests.push(...response.data.tests)
      }
      setDialog({ type: 'remove-category', category: category.name, categoryId: category.id, affectedTests, moves: {} })
    } catch (error) {
      setDialog(null)
      setSaveNotice(error.message || 'Unable to load tests in this category.')
    }
  }

  async function removeCategory() {
    const category = categoryRecords.find((item) => item.id === dialog.categoryId)
    const moves = dialog.moves ?? {}
    const testActions = dialog.affectedTests.map((test) => moves[test.id]
      ? { testId: test.id, action: 'relocate', categoryId: moves[test.id] }
      : { testId: test.id, action: 'remove' })
    try {
      await api.administrator.removeCategory(category.id, testActions)
      if (categoryFilter === category.id) setCategoryFilter('All categories')
      setDialog(null)
      await refresh()
    } catch (error) { setSaveNotice(error.message || 'Unable to remove category.') }
  }

  async function editTest(test) {
    const turnaroundMinutes = test.turnaroundMinutes ?? null
    setSaveNotice('')
    try {
      const response = await api.administrator.testConfiguration(test.id)
      const config = response.data
      const firstSpecimen = config.specimens?.[0]
      const specimenType = firstSpecimen?.specimenType || 'Blood'
      setForm({
        ...emptyTest,
        name: test.name,
        categoryIds: test.categoryIds?.length ? test.categoryIds : [test.categoryId],
        price: String(test.price),
        turnaroundHours: turnaroundMinutes == null ? '' : String(Math.floor(turnaroundMinutes / 60)),
        turnaroundMinutePart: turnaroundMinutes == null ? '' : String(turnaroundMinutes % 60),
        specimenType,
        specimens: (config.specimens ?? []).map((specimen) => ({
          specimenType: specimen.specimenType,
          collectionInstructions: specimen.collectionInstructions || '',
          minimumQuantity: specimen.minimumQuantity == null ? '' : String(specimen.minimumQuantity),
          quantityUnit: specimen.quantityUnit || '',
          isRequired: specimen.isRequired,
        })),
        analytes: (config.analytes ?? []).map((analyte) => ({
          key: analyte.key,
          label: analyte.label,
          valueType: analyte.valueType,
          unit: !analyte.unit || (unitsBySpecimen[specimenType] ?? unitsBySpecimen.Other).includes(analyte.unit) ? (analyte.unit || '') : 'Other',
          customAnalyteUnit: (unitsBySpecimen[specimenType] ?? unitsBySpecimen.Other).includes(analyte.unit) ? '' : (analyte.unit || ''),
          analyteOptions: Array.isArray(analyte.options) ? analyte.options.join(', ') : '',
          isRequired: analyte.isRequired,
        })),
      })
      setDialog({ type: 'manage', editingId: test.id })
      setView('test')
    } catch (error) {
      setSaveNotice(error.message || 'Unable to load the test configuration.')
    }
  }

  return (
    <section className="admin-page" aria-label="Test catalog">
      {loadError && <p role="alert">{loadError}</p>}
      <div className="admin-page__controls-row">
        <div className="admin-toolbar" role="search">
          <SearchInput className="admin-toolbar__search" label="Search test catalog" visibleLabel="Search test catalog" placeholder="Test name" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} />
          <label className="admin-toolbar__field">Filter by category<select value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setPage(1) }}><option value="All categories">All categories</option>{categoryRecords.map((category) => <option key={category.id} value={category.id}>{category.name}{category.isActive ? '' : ' (Archived)'}</option>)}</select></label>
          <label className="admin-toolbar__field">Availability<select value={availabilityFilter} onChange={(event) => { setAvailabilityFilter(event.target.value); setPage(1) }}><option value="all">All tests</option><option value="active">Available</option><option value="inactive">Archived / unavailable</option></select></label>
        </div>
      </div>
      <section className="test-catalog__table-card" aria-labelledby="test-catalog-table-title">
        <header className="test-catalog__table-heading"><div><h2 id="test-catalog-table-title">TEST CATALOG</h2><p>Manage available tests, categories, pricing, and turnaround times.</p></div><div className="test-catalog__table-actions"><span>{catalogResult?.pagination?.total ?? 0} tests</span><button className="admin-button" type="button" onClick={openAdd}><PlusIcon /> TEST/CATEGORY</button></div></header>
        <div className="admin-table-wrap"><table className="admin-table">
          <thead><tr><th>Test</th><th>Category</th><th>Price</th><th>TAT</th><th>Availability</th><th>Actions</th></tr></thead>
          <tbody>
            {pageRows.map((test) => <tr key={test.id}><td className="admin-table__primary">{test.name}</td><td>{test.category}</td><td>₱{Number(test.price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td><td>{test.turnaround}</td><td><span className={`admin-badge ${test.availability === 'Available' ? 'admin-badge--success' : 'admin-badge--muted'}`}>{test.availability}</span></td><td className="admin-table__actions"><button className="admin-button admin-button--small admin-button--secondary" type="button" onClick={() => viewConfiguration(test)}>Params ({test.analyteCount ?? 1})</button><button className="admin-button admin-button--small admin-button--positive" type="button" onClick={() => editTest(test)}>Edit</button><button className={`admin-button admin-button--small ${test.isAvailable ? 'admin-button--negative' : 'admin-button--positive'}`} type="button" onClick={() => requestTestAvailability(test)}>{test.isAvailable ? 'Make unavailable' : 'Make available'}</button></td></tr>)}
            {pageRows.length === 0 && <tr><td className="admin-empty" colSpan="6">{catalogResult ? 'No tests match your filters.' : 'Loading test catalog…'}</td></tr>}
          </tbody>
        </table></div>
      </section>
      <TablePagination currentPage={catalogResult?.pagination?.page ?? page} pageSize={PAGE_SIZE} totalItems={catalogResult?.pagination?.total ?? 0} onPageChange={setPage} />

      {dialog?.type === 'manage' && <AdminDialog title={dialog.editingId ? 'Edit test' : 'Add Test/Category'} description="Choose whether to add a test or a catalog category." onClose={() => setDialog(null)} size="large">
        <div className="admin-dialog__tabs"><button className="admin-dialog__tab" type="button" aria-pressed={view === 'test'} onClick={() => setView('test')}>Test</button><button className="admin-dialog__tab" type="button" aria-pressed={view === 'category'} onClick={() => setView('category')}>Category</button></div>
        {saveNotice && <p className="admin-dialog__note" role="status">{saveNotice}</p>}
        {view === 'test' ? <form id="test-form" className="admin-dialog__form admin-dialog__form--test" onSubmit={(event) => {
          event.preventDefault()
          if (!canReviewTest) {
            setDialog({ type: 'missing-parameters', editingId: dialog.editingId })
            return
          }
          setDialog({ ...dialog, type: 'confirm-test' })
        }}>
          <label className="admin-dialog__field">Test name<LimitedInput required value={form.name} maxLength={160} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Complete Blood Count (CBC)" /></label>
          <fieldset className="admin-dialog__field test-catalog__category-select"><legend>Categories</legend><div className="test-catalog__category-options">{categoryRecords.filter((category) => category.isActive).map((category) => <label className={`test-catalog__category-option${form.categoryIds.includes(category.id) ? ' test-catalog__category-option--selected' : ''}`} key={category.id}><input type="checkbox" checked={form.categoryIds.includes(category.id)} onChange={(event) => setForm((prev) => ({ ...prev, categoryIds: event.target.checked ? [...prev.categoryIds, category.id] : prev.categoryIds.filter((id) => id !== category.id) }))} /><span>{category.name}</span></label>)}</div></fieldset>
          <label className="admin-dialog__field">Price (₱)<CurrencyInput required value={form.price} onValueChange={(price) => setForm({ ...form, price })} /></label>
          <div className="admin-dialog__field test-catalog__turnaround-field" role="group" aria-label="Turnaround Time"><span className="test-catalog__turnaround-label">Turnaround Time</span><div className="test-catalog__turnaround-inputs"><label><input aria-label="Turnaround hours (maximum 720)" type="text" inputMode="numeric" maxLength={3} placeholder="0" value={form.turnaroundHours} onChange={(event) => setForm({ ...form, turnaroundHours: event.target.value.replace(/\D/g, '').slice(0, 3) })} /><span aria-hidden="true">HRS</span></label><label><input aria-label="Turnaround minutes (maximum 59)" type="text" inputMode="numeric" maxLength={2} placeholder="0" value={form.turnaroundMinutePart} onChange={(event) => setForm({ ...form, turnaroundMinutePart: event.target.value.replace(/\D/g, '').slice(0, 2) })} /><span aria-hidden="true">MIN</span></label></div><small className="character-count">{Number(form.turnaroundHours || 0)}/720 hours · {Number(form.turnaroundMinutePart || 0)}/59 minutes (max 30 days)</small></div>
          {!dialog.editingId && <p className="admin-dialog__note admin-dialog__span">New tests are saved as unavailable. Add a reference range in Reference Ranges before making a test available.</p>}
          <section className="test-catalog__analytes-section admin-dialog__span">
            <div className="test-catalog__section-header"><div><h3 className="test-catalog__section-title">Required Specimens ({form.specimens.length})</h3><p className="test-catalog__section-desc">Choose each specimen type needed for this test.</p></div><button type="button" className="admin-button admin-button--small admin-button--positive" onClick={addSpecimen}>+ Add Specimen</button></div>
            <div className="test-catalog__analyte-list">{form.specimens.map((specimen, index) => <div key={index} className="test-catalog__analyte-card"><div className="test-catalog__analyte-grid"><label className="admin-dialog__field">Specimen {index + 1}<select required value={specimen.specimenType} onChange={(event) => updateSpecimen(index, 'specimenType', event.target.value)}>{specimenTypes.map((type) => <option key={type}>{type}</option>)}</select></label><label className="admin-dialog__field">Collection instructions<LimitedInput value={specimen.collectionInstructions} maxLength={500} onChange={(event) => updateSpecimen(index, 'collectionInstructions', event.target.value)} placeholder="Optional" /></label><label className="admin-dialog__field">Minimum quantity<DecimalInput value={specimen.minimumQuantity} onValueChange={(value) => updateSpecimen(index, 'minimumQuantity', value)} placeholder="Optional" /></label><label className="admin-dialog__field">Quantity unit<LimitedInput value={specimen.quantityUnit} maxLength={40} onChange={(event) => updateSpecimen(index, 'quantityUnit', event.target.value)} placeholder="e.g. mL" /></label></div>{form.specimens.length > 1 && <button type="button" className="admin-button admin-button--small admin-button--negative test-catalog__remove-btn" onClick={() => removeSpecimen(index)}>Remove</button>}</div>)}</div>
          </section>

            <section className="test-catalog__analytes-section admin-dialog__span">
              <div className="test-catalog__section-header">
                <div>
                  <h3 className="test-catalog__section-title">Test Analytes / Parameters ({form.analytes.length})</h3>
                  <p className="test-catalog__section-desc">Add parameters for single tests or panels (e.g. Hemoglobin, WBC for CBC).</p>
                </div>
                <button type="button" className="admin-button admin-button--small admin-button--positive" onClick={addAnalyte}>+ Add Parameter</button>
              </div>
              <p className="admin-dialog__note">At least one labeled parameter is required to review and save this test.</p>

              <div className="test-catalog__analyte-list">
                {form.analytes.map((analyte, index) => (
                  <div key={index} className="test-catalog__analyte-card">
                    <div className="test-catalog__analyte-grid">
                      <label className="admin-dialog__field">
                        Parameter {index + 1}
                        <LimitedInput
                          required
                          value={analyte.label}
                          maxLength={160}
                          placeholder={index === 0 ? 'e.g. Hemoglobin' : 'e.g. Hematocrit'}
                          onChange={(e) => updateAnalyte(index, 'label', e.target.value)}
                        />
                      </label>
                      <label className="admin-dialog__field">
                        Type
                        <select value={analyte.valueType} onChange={(e) => updateAnalyte(index, 'valueType', e.target.value)}>
                          <option value="numeric">Number</option>
                          <option value="text">Text</option>
                          <option value="select">Dropdown</option>
                          <option value="boolean">Yes / no</option>
                          <option value="structured">Repeatable table</option>
                        </select>
                      </label>
                      {analyte.valueType === 'numeric' && (
                        <label className="admin-dialog__field">
                          Unit
                          <select value={analyte.unit} onChange={(e) => updateAnalyte(index, 'unit', e.target.value)}>
                            <option value="">No unit</option>
                            {(unitsBySpecimen[form.specimenType] ?? unitsBySpecimen.Other).map((unit) => <option key={unit}>{unit}</option>)}
                          </select>
                        </label>
                      )}
                      {analyte.valueType === 'numeric' && analyte.unit === 'Other' && (
                        <label className="admin-dialog__field">
                          Custom unit
                          <LimitedInput required value={analyte.customAnalyteUnit} maxLength={40} onChange={(e) => updateAnalyte(index, 'customAnalyteUnit', e.target.value)} placeholder="Specify unit" />
                        </label>
                      )}
                      {(analyte.valueType === 'select' || analyte.valueType === 'structured') && (
                        <label className="admin-dialog__field">
                          {analyte.valueType === 'select' ? 'Options (comma-separated)' : 'Table columns (comma-separated)'}
                          <LimitedInput required value={analyte.analyteOptions} maxLength={500} onChange={(e) => updateAnalyte(index, 'analyteOptions', e.target.value)} placeholder={analyte.valueType === 'select' ? 'Positive, Negative' : 'Cell, Result, Comment'} />
                        </label>
                      )}
                    </div>
                    {form.analytes.length > 1 && (
                      <button type="button" className="admin-button admin-button--small admin-button--negative test-catalog__remove-btn" onClick={() => removeAnalyte(index)}>
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
        </form> : <div className="admin-dialog__form admin-dialog__form--category"><label className="admin-dialog__field admin-dialog__span">Category name<LimitedInput value={categoryName} maxLength={120} onChange={(event) => setCategoryName(event.target.value)} placeholder="e.g. Serology" /></label><div className="admin-dialog__span"><p className="admin-dialog__note">Existing categories</p><ul className="test-catalog__category-list">{categoryRecords.map((category) => <li key={category.id}><span>{category.name} <small>({category.testCount ?? category.test_count ?? 0} tests) · {category.isActive ? 'Active' : 'Archived'}</small></span><button className={`admin-button admin-button--small ${category.isActive ? 'admin-button--negative' : 'admin-button--positive'}`} type="button" onClick={() => requestCategoryAvailability(category)}>{category.isActive ? 'Archive' : 'Restore'}</button></li>)}</ul></div></div>}
        <div className="admin-dialog__footer"><button className="admin-button admin-button--secondary" type="button" onClick={() => setDialog(null)}>Cancel</button>{view === 'test' ? <button className="admin-button" type="submit" form="test-form" onClick={(event) => {
          if (!canReviewTest) {
            event.preventDefault()
            setDialog({ type: 'missing-parameters', editingId: dialog.editingId })
          }
        }}>Review test</button> : <button className="admin-button" type="button" disabled={!categoryName.trim()} onClick={() => setDialog({ type: 'confirm-category' })}>Review category</button>}</div>
      </AdminDialog>}

      {dialog?.type === 'missing-parameters' && <AdminDialog
        title="Test parameter required"
        description="This test cannot be reviewed or saved yet."
        onClose={() => setDialog({ type: 'manage', editingId: dialog.editingId })}
        size="small"
      >
        <p className="admin-dialog__confirm">Add at least one result parameter and give it a label before reviewing this test. Parameters define what laboratory staff will record for the test.</p>
        <div className="admin-dialog__footer">
          <button className="admin-button" type="button" onClick={() => setDialog({ type: 'manage', editingId: dialog.editingId })}>Back to parameters</button>
        </div>
      </AdminDialog>}

      {dialog?.type === 'missing-reference-range' && <AdminDialog
        title="Reference range required"
        description="This test cannot be made available yet."
        onClose={() => setDialog(null)}
        size="small"
      >
        <p className="admin-dialog__confirm"><strong>{dialog.test.name}</strong> does not have an active reference range. Add at least one reference range for this test, then try making it available again.</p>
        <div className="admin-dialog__footer">
          <button className="admin-button" type="button" onClick={() => setDialog(null)}>Close</button>
        </div>
      </AdminDialog>}

      {dialog?.type === 'confirm-test-availability' && <AdminDialog
        title={`${dialog.test.isAvailable ? 'Make test unavailable?' : 'Make test available?'}`}
        onClose={() => { setSaveNotice(''); setDialog(null) }}
        size="small"
      >
        <p className="admin-dialog__confirm">
          {dialog.test.isAvailable
            ? <>Make <strong>{dialog.test.name}</strong> unavailable? Cashiers will no longer be able to add it to new requests. Past requests and released results keep this test.</>
            : <>Make <strong>{dialog.test.name}</strong> available so it can be requested again?</>}
        </p>
        {saveNotice && <p className="admin-dialog__note" role="alert">{saveNotice}</p>}
        <div className="admin-dialog__footer">
          <button className="admin-button admin-button--secondary" type="button" onClick={() => { setSaveNotice(''); setDialog(null) }}>Cancel</button>
          <button className={`admin-button ${dialog.test.isAvailable ? 'admin-button--negative' : 'admin-button--positive'}`} type="button" onClick={confirmTestAvailability}>Confirm</button>
        </div>
      </AdminDialog>}

      {dialog?.type === 'confirm-category-availability' && <AdminDialog
        title={`${dialog.category.isActive ? 'Archive' : 'Restore'} category?`}
        onClose={() => { setSaveNotice(''); setDialog(null) }}
        size="small"
      >
        <p className="admin-dialog__confirm">
          {dialog.category.isActive
            ? <>Archive <strong>{dialog.category.name}</strong>? It will stop appearing in the catalog filters and cannot be picked for new tests. Existing tests keep their category.</>
            : <>Restore <strong>{dialog.category.name}</strong> so it can be used again?</>}
        </p>
        {saveNotice && <p className="admin-dialog__note" role="alert">{saveNotice}</p>}
        <div className="admin-dialog__footer">
          <button className="admin-button admin-button--secondary" type="button" onClick={() => { setSaveNotice(''); setDialog(null) }}>Cancel</button>
          <button className={`admin-button ${dialog.category.isActive ? 'admin-button--negative' : 'admin-button--positive'}`} type="button" onClick={confirmCategoryAvailability}>Confirm</button>
        </div>
      </AdminDialog>}

      {dialog?.type === 'view-config' && <AdminDialog title={dialog.test.name} description={`Category: ${dialog.test.category} · ₱${Number(dialog.test.price).toFixed(2)}`} onClose={() => setDialog(null)} size="large" footer={<button className="admin-button" type="button" onClick={() => setDialog(null)}>Close</button>}>
        <section className="test-catalog__config-view">
          <label className="admin-dialog__field">Configuration version<select value={dialog.config.configurationVersion} onChange={(event) => viewConfiguration(dialog.test, Number(event.target.value))}>{Array.from({ length: dialog.config.test.currentConfigurationVersion }, (_, index) => index + 1).map((version) => <option key={version} value={version}>Version {version}{version === dialog.config.test.currentConfigurationVersion ? ' · current' : ''}</option>)}</select></label>
          {dialog.config.test.description && <aside className="test-catalog__setup-guidance"><h4>Standard Setup Guidance</h4><p>{dialog.config.test.description}</p></aside>}
          <div>
            <h4>Specimen Requirements</h4>
            <ul className="test-catalog__config-list">
              {(dialog.config.specimens ?? []).map((s) => (
                <li key={s.id}>
                  <strong>{s.specimenType}</strong>
                  {s.collectionInstructions && <small> · {s.collectionInstructions}</small>}
                </li>
              ))}
              {!(dialog.config.specimens?.length) && <li>No specimen requirements configured.</li>}
            </ul>
          </div>
          <div style={{ marginTop: '1rem' }}>
            <h4>Configured Parameters ({dialog.config.analytes?.length ?? 0})</h4>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Parameter</th><th>Type</th><th>Unit</th><th>Options</th></tr></thead>
                <tbody>
                  {(dialog.config.analytes ?? []).map((a) => (
                    <tr key={a.id}>
                      <td className="admin-table__primary">{a.label}</td>
                      <td>{a.valueType}</td>
                      <td>{a.unit || '—'}</td>
                      <td>{Array.isArray(a.options) && a.options.length ? a.options.join(', ') : '—'}</td>
                    </tr>
                  ))}
                  {!(dialog.config.analytes?.length) && <tr><td colSpan="4" className="admin-empty">No parameters configured.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </AdminDialog>}

      {dialog?.type === 'confirm-test' && <AdminDialog title={dialog.editingId ? 'Confirm test changes' : 'Confirm new test'} onClose={() => setDialog(null)} size="small">{saveNotice && <p role="alert">{saveNotice}</p>}<p className="admin-dialog__confirm">{dialog.editingId ? 'Save changes to' : 'Add'} <strong>{form.name}</strong> with <strong>{form.analytes.length} parameter{form.analytes.length === 1 ? '' : 's'}</strong> under <strong>{categoryRecords.filter((category) => form.categoryIds.includes(category.id)).map((category) => category.name).join(', ')}</strong>?</p><div className="admin-dialog__footer"><button className="admin-button admin-button--secondary" type="button" onClick={() => setDialog({ ...dialog, type: 'manage' })}>Back</button><button className="admin-button" type="button" onClick={saveTest}>Confirm</button></div></AdminDialog>}
      {dialog?.type === 'confirm-category' && <AdminDialog title="Confirm category" onClose={() => setDialog(null)} size="small">{saveNotice && <p role="alert">{saveNotice}</p>}<p className="admin-dialog__confirm">Add <strong>{categoryName.trim()}</strong> to the test catalog categories?</p><div className="admin-dialog__footer"><button className="admin-button admin-button--secondary" type="button" onClick={() => setDialog({ type: 'manage' })}>Back</button><button className="admin-button" type="button" onClick={saveCategory}>Confirm</button></div></AdminDialog>}
      {dialog?.type === 'delete' && <AdminDialog title="Delete test?" onClose={() => setDialog(null)} size="small"><p className="admin-dialog__confirm">Delete <strong>{dialog.test.name}</strong> from the catalog? This sample action cannot be undone.</p><div className="admin-dialog__footer"><button className="admin-button admin-button--secondary" type="button" onClick={() => setDialog(null)}>Cancel</button><button className="admin-button admin-button--negative" type="button" onClick={deleteTest}>Confirm delete</button></div></AdminDialog>}
      {dialog?.type === 'loading-category' && <AdminDialog title={`Loading ${dialog.category}`} description="Loading all tests in this category." onClose={() => setDialog(null)} size="small"><p className="admin-empty">Please wait…</p></AdminDialog>}
      {dialog?.type === 'remove-category' && <AdminDialog title={`Remove ${dialog.category}?`} description="Choose a destination category for each test, or remove that test from the sample catalog." onClose={() => setDialog(null)} size="large">
        {dialog.affectedTests.length === 0
          ? <p className="admin-dialog__confirm">This category has no tests. Remove it from the catalog?</p>
          : <div className="test-catalog__category-tests">{dialog.affectedTests.map((test) => <label key={test.id}><span>{test.name}</span><select value={dialog.moves[test.id] ?? ''} onChange={(event) => setDialog({ ...dialog, moves: { ...dialog.moves, [test.id]: event.target.value } })}><option value="">Remove test</option>{categoryRecords.filter((category) => category.id !== dialog.categoryId && category.isActive).map((category) => <option key={category.id} value={category.id}>Move to {category.name}</option>)}</select></label>)}</div>}
        <div className="admin-dialog__footer"><button className="admin-button admin-button--secondary" type="button" onClick={() => setDialog(null)}>Cancel</button><button className="admin-button admin-button--negative" type="button" onClick={removeCategory}>Confirm removal</button></div>
      </AdminDialog>}
    </section>
  )
}
