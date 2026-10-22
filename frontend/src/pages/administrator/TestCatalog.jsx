import { useMemo, useState } from 'react'
import './TestCatalog.css'

const initialTests = [
  { id: 1, name: 'Complete Blood Count (CBC)', category: 'Hematology', price: 450, turnaround: 'Same day', status: 'Active' },
  { id: 2, name: 'Fasting Blood Sugar', category: 'Clinical Chemistry', price: 250, turnaround: 'Same day', status: 'Active' },
  { id: 3, name: 'Urinalysis', category: 'Clinical Microscopy', price: 300, turnaround: 'Same day', status: 'Active' },
  { id: 4, name: 'Lipid Profile', category: 'Clinical Chemistry', price: 850, turnaround: '1 day', status: 'Active' },
  { id: 5, name: 'Thyroid Stimulating Hormone', category: 'Immunology', price: 700, turnaround: '2 days', status: 'Inactive' },
]

export default function TestCatalog() {
  const [tests, setTests] = useState(initialTests)
  const [search, setSearch] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [form, setForm] = useState({ name: '', category: 'Hematology', price: '', turnaround: '' })

  const visibleTests = useMemo(() => tests.filter((test) => (
    `${test.name} ${test.category}`.toLowerCase().includes(search.toLowerCase())
  )), [search, tests])

  function addTest(event) {
    event.preventDefault()
    setTests((current) => [
      ...current,
      { ...form, id: Date.now(), price: Number(form.price), status: 'Active' },
    ])
    setForm({ name: '', category: 'Hematology', price: '', turnaround: '' })
    setIsAdding(false)
  }

  function toggleStatus(id) {
    setTests((current) => current.map((test) => (
      test.id === id
        ? { ...test, status: test.status === 'Active' ? 'Inactive' : 'Active' }
        : test
    )))
  }

  function updatePrice(id, price) {
    setTests((current) => current.map((test) => (
      test.id === id ? { ...test, price } : test
    )))
  }

  return (
    <section className="admin-page" aria-label="Test catalog">
      <div className="admin-page__title-row">
        <div>
          <h2>Available laboratory tests</h2>
          <p>Maintain test names, categories, prices, and expected turnaround times.</p>
        </div>
        <button className="admin-button" type="button" onClick={() => setIsAdding((current) => !current)}>
          {isAdding ? 'Close form' : 'Add test'}
        </button>
      </div>

      {isAdding && (
        <form className="admin-form" onSubmit={addTest}>
          <label className="admin-form__field">
            Test name
            <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </label>
          <label className="admin-form__field">
            Category
            <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
              <option>Hematology</option>
              <option>Clinical Chemistry</option>
              <option>Clinical Microscopy</option>
              <option>Immunology</option>
              <option>Microbiology</option>
            </select>
          </label>
          <label className="admin-form__field">
            Price (₱)
            <input type="number" min="0" step="0.01" required value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} />
          </label>
          <label className="admin-form__field">
            Turnaround time
            <input required placeholder="e.g. Same day" value={form.turnaround} onChange={(event) => setForm({ ...form, turnaround: event.target.value })} />
          </label>
          <div className="admin-form__actions">
            <button className="admin-button" type="submit">Save test</button>
            <button className="admin-button admin-button--secondary" type="button" onClick={() => setIsAdding(false)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="admin-toolbar" role="search">
        <label className="admin-toolbar__field admin-toolbar__field--search">
          Search catalog
          <input type="search" placeholder="Test name or category" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">Test name</th>
              <th scope="col">Category</th>
              <th scope="col">Price</th>
              <th scope="col">Turnaround</th>
              <th scope="col">Status</th>
              <th scope="col"><span className="visually-hidden">Catalog action</span></th>
            </tr>
          </thead>
          <tbody>
            {visibleTests.map((test) => (
              <tr key={test.id}>
                <td className="admin-table__primary">{test.name}</td>
                <td>{test.category}</td>
                <td>
                  <label className="visually-hidden" htmlFor={`test-price-${test.id}`}>Price for {test.name}</label>
                  <input
                    id={`test-price-${test.id}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={test.price}
                    onChange={(event) => updatePrice(test.id, event.target.value)}
                  />
                </td>
                <td>{test.turnaround}</td>
                <td><span className={`admin-badge ${test.status === 'Active' ? 'admin-badge--success' : 'admin-badge--muted'}`}>{test.status}</span></td>
                <td>
                  <button
                    className="admin-button admin-button--secondary admin-button--small"
                    type="button"
                    onClick={() => toggleStatus(test.id)}
                    aria-label={`${test.status === 'Active' ? 'Deactivate' : 'Activate'} ${test.name}`}
                  >
                    {test.status === 'Active' ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
            {visibleTests.length === 0 && (
              <tr><td className="admin-empty" colSpan="6">No tests match your search.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
