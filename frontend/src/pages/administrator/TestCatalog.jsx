import { useEffect, useMemo, useState } from 'react'
import SearchInput from '../../components/data/SearchInput.jsx'
import AdminDialog from '../../components/data/AdminDialog.jsx'
import TablePagination from '../../components/data/TablePagination.jsx'
import { defaultCatalog, readCatalog, subscribeCatalog, writeCatalog } from '../../data/administratorCatalog.js'
import './TestCatalog.css'

const emptyTest = { name: '', category: defaultCatalog.categories[0], price: '', turnaround: '', availability: 'Available' }

export default function TestCatalog() {
  const [catalog, setCatalog] = useState(readCatalog)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All categories')
  const [dialog, setDialog] = useState(null)
  const [view, setView] = useState('test')
  const [form, setForm] = useState(emptyTest)
  const [categoryName, setCategoryName] = useState('')
  const [saveNotice, setSaveNotice] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10

  useEffect(() => subscribeCatalog(() => setCatalog(readCatalog())), [])

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
  function saveTest() {
    const test = { ...form, id: dialog.editingId ?? Date.now(), price: Number(form.price) }
    const tests = dialog.editingId
      ? catalog.tests.map((item) => item.id === dialog.editingId ? test : item)
      : [...catalog.tests, test]
    const next = { ...catalog, tests }
    writeCatalog(next)
    setCatalog(next)
    if (dialog.editingId) {
      setDialog(null)
    } else {
      setForm({ ...emptyTest, category: catalog.categories[0] || '' })
      setSaveNotice('Test added. You can add another test or category.')
      setDialog({ type: 'manage' })
    }
  }
  function saveCategory() {
    const name = categoryName.trim()
    if (!name || catalog.categories.some((category) => category.toLowerCase() === name.toLowerCase())) return
    const next = { ...catalog, categories: [...catalog.categories, name] }
    writeCatalog(next)
    setCatalog(next)
    setCategoryName('')
    setSaveNotice('Category added. You can add another category or test.')
    setView('category')
    setDialog({ type: 'manage' })
  }
  function deleteTest() {
    const next = { ...catalog, tests: catalog.tests.filter((test) => test.id !== dialog.test.id) }
    writeCatalog(next)
    setCatalog(next)
    setDialog(null)
  }
  function editTest(test) {
    setForm({ name: test.name, category: test.category, price: String(test.price), turnaround: test.turnaround, availability: test.availability })
    setSaveNotice('')
    setDialog({ type: 'manage', editingId: test.id })
    setView('test')
  }

  return (
    <section className="admin-page" aria-label="Test catalog">
      <div className="admin-page__title-row"><div><h2>Test catalog</h2><p>Manage tests, categories, prices, turnaround times, and availability.</p></div><button className="admin-button" type="button" onClick={openAdd}>Add Test/Category</button></div>
      <div className="admin-toolbar" role="search">
        <SearchInput className="admin-toolbar__search" label="Search test catalog" placeholder="Test name" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} />
        <label className="admin-toolbar__field">Filter by category<select value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setPage(1) }}><option>All categories</option>{catalog.categories.map((category) => <option key={category}>{category}</option>)}</select></label>
      </div>
      <div className="admin-table-wrap"><table className="admin-table">
        <thead><tr><th>Test</th><th>Category</th><th>Price</th><th>TAT</th><th>Availability</th><th>Actions</th></tr></thead>
        <tbody>
          {pageRows.map((test) => <tr key={test.id}><td className="admin-table__primary">{test.name}</td><td>{test.category}</td><td>₱{Number(test.price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td><td>{test.turnaround}</td><td><span className={`admin-badge ${test.availability === 'Available' ? 'admin-badge--success' : 'admin-badge--muted'}`}>{test.availability}</span></td><td className="admin-table__actions"><button className="admin-button admin-button--secondary admin-button--small" type="button" onClick={() => editTest(test)}>Edit</button><button className="admin-button admin-button--secondary admin-button--small" type="button" onClick={() => setDialog({ type: 'delete', test })}>Delete</button></td></tr>)}
          {visibleTests.length === 0 && <tr><td className="admin-empty" colSpan="6">No tests match your filters.</td></tr>}
        </tbody>
      </table></div>
      <TablePagination currentPage={page} pageSize={pageSize} totalItems={visibleTests.length} onPageChange={setPage} />

      {dialog?.type === 'manage' && <AdminDialog title={dialog.editingId ? 'Edit test' : 'Add Test/Category'} description="Choose whether to add a test or a catalog category." onClose={() => setDialog(null)} size="large">
        <div className="admin-dialog__tabs"><button className="admin-dialog__tab" type="button" aria-pressed={view === 'test'} onClick={() => setView('test')}>Test</button><button className="admin-dialog__tab" type="button" aria-pressed={view === 'category'} onClick={() => setView('category')}>Category</button></div>
        {saveNotice && <p className="admin-dialog__note" role="status">{saveNotice}</p>}
        {view === 'test' ? <form id="test-form" className="admin-dialog__form admin-dialog__form--test" onSubmit={(event) => { event.preventDefault(); setDialog({ ...dialog, type: 'confirm-test' }) }}>
          <label className="admin-dialog__field">Test name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label className="admin-dialog__field">Category<select required value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{catalog.categories.map((category) => <option key={category}>{category}</option>)}</select></label>
          <label className="admin-dialog__field">Price (₱)<input type="number" min="0" step="0.01" required value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} /></label>
          <label className="admin-dialog__field">Turnaround time<input required placeholder="e.g. Same day" value={form.turnaround} onChange={(event) => setForm({ ...form, turnaround: event.target.value })} /></label>
          <label className="admin-dialog__field">Availability<select value={form.availability} onChange={(event) => setForm({ ...form, availability: event.target.value })}><option>Available</option><option>Unavailable</option></select></label>
        </form> : <div className="admin-dialog__form admin-dialog__form--category"><label className="admin-dialog__field admin-dialog__span">Category name<input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="e.g. Serology" /></label><div className="admin-dialog__span"><p className="admin-dialog__note">Existing categories: {catalog.categories.join(', ')}</p></div></div>}
        <div className="admin-dialog__footer"><button className="admin-button admin-button--secondary" type="button" onClick={() => setDialog(null)}>Cancel</button>{view === 'test' ? <button className="admin-button" type="submit" form="test-form">Review test</button> : <button className="admin-button" type="button" disabled={!categoryName.trim()} onClick={() => setDialog({ type: 'confirm-category' })}>Review category</button>}</div>
      </AdminDialog>}
      {dialog?.type === 'confirm-test' && <AdminDialog title={dialog.editingId ? 'Confirm test changes' : 'Confirm new test'} onClose={() => setDialog(null)} size="small"><p className="admin-dialog__confirm">{dialog.editingId ? 'Save changes to' : 'Add'} <strong>{form.name}</strong> under <strong>{form.category}</strong>?</p><div className="admin-dialog__footer"><button className="admin-button admin-button--secondary" type="button" onClick={() => setDialog({ ...dialog, type: 'manage' })}>Back</button><button className="admin-button" type="button" onClick={saveTest}>Confirm</button></div></AdminDialog>}
      {dialog?.type === 'confirm-category' && <AdminDialog title="Confirm category" onClose={() => setDialog(null)} size="small"><p className="admin-dialog__confirm">Add <strong>{categoryName.trim()}</strong> to the test catalog categories?</p><div className="admin-dialog__footer"><button className="admin-button admin-button--secondary" type="button" onClick={() => setDialog({ type: 'manage' })}>Back</button><button className="admin-button" type="button" onClick={saveCategory}>Confirm</button></div></AdminDialog>}
      {dialog?.type === 'delete' && <AdminDialog title="Delete test?" onClose={() => setDialog(null)} size="small"><p className="admin-dialog__confirm">Delete <strong>{dialog.test.name}</strong> from the catalog? This sample action cannot be undone.</p><div className="admin-dialog__footer"><button className="admin-button admin-button--secondary" type="button" onClick={() => setDialog(null)}>Cancel</button><button className="admin-button" type="button" onClick={deleteTest}>Confirm delete</button></div></AdminDialog>}
    </section>
  )
}
