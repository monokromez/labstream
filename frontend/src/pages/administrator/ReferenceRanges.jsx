import { useMemo, useState } from 'react'
import './ReferenceRanges.css'

const initialRanges = [
  { id: 1, test: 'Hemoglobin', ageGroup: 'Adults', sex: 'Female', low: 12, high: 16, unit: 'g/dL' },
  { id: 2, test: 'Hemoglobin', ageGroup: 'Adults', sex: 'Male', low: 13.5, high: 17.5, unit: 'g/dL' },
  { id: 3, test: 'Fasting Blood Sugar', ageGroup: 'Adults', sex: 'All', low: 70, high: 99, unit: 'mg/dL' },
  { id: 4, test: 'Platelet Count', ageGroup: 'Adults', sex: 'All', low: 150, high: 400, unit: '10³/µL' },
]

export default function ReferenceRanges() {
  const [ranges, setRanges] = useState(initialRanges)
  const [testFilter, setTestFilter] = useState('All tests')
  const [isAdding, setIsAdding] = useState(false)
  const [editingRangeId, setEditingRangeId] = useState(null)
  const [form, setForm] = useState({ test: 'Hemoglobin', ageGroup: 'Adults', sex: 'All', low: '', high: '', unit: '' })

  const testNames = [...new Set(ranges.map((range) => range.test))]
  const visibleRanges = useMemo(() => (
    ranges.filter((range) => testFilter === 'All tests' || range.test === testFilter)
  ), [ranges, testFilter])

  function addRange(event) {
    event.preventDefault()
    if (editingRangeId === null) {
      setRanges((current) => [
        ...current,
        { ...form, id: Date.now(), low: Number(form.low), high: Number(form.high) },
      ])
    } else {
      setRanges((current) => current.map((range) => (
        range.id === editingRangeId
          ? { ...form, id: range.id, low: Number(form.low), high: Number(form.high) }
          : range
      )))
    }
    setForm({ test: 'Hemoglobin', ageGroup: 'Adults', sex: 'All', low: '', high: '', unit: '' })
    setEditingRangeId(null)
    setIsAdding(false)
  }

  function editRange(range) {
    setForm({
      test: range.test,
      ageGroup: range.ageGroup,
      sex: range.sex,
      low: String(range.low),
      high: String(range.high),
      unit: range.unit,
    })
    setEditingRangeId(range.id)
    setIsAdding(true)
  }

  function closeForm() {
    setIsAdding(false)
    setEditingRangeId(null)
    setForm({ test: 'Hemoglobin', ageGroup: 'Adults', sex: 'All', low: '', high: '', unit: '' })
  }

  return (
    <section className="admin-page" aria-label="Reference ranges">
      <div className="admin-page__title-row">
        <div>
          <h2>Result reference ranges</h2>
          <p>Maintain test ranges by age group and sex for result interpretation.</p>
        </div>
        <button className="admin-button" type="button" onClick={() => {
          if (isAdding) closeForm()
          else setIsAdding(true)
        }}>
          {isAdding ? 'Close form' : 'Add reference range'}
        </button>
      </div>

      {isAdding && (
        <form className="admin-form" onSubmit={addRange}>
          <label className="admin-form__field">
            Test
            <select value={form.test} onChange={(event) => setForm({ ...form, test: event.target.value })}>
              {testNames.map((test) => <option key={test}>{test}</option>)}
            </select>
          </label>
          <label className="admin-form__field">
            Age group
            <input required placeholder="e.g. Adults 18–65" value={form.ageGroup} onChange={(event) => setForm({ ...form, ageGroup: event.target.value })} />
          </label>
          <label className="admin-form__field">
            Sex
            <select value={form.sex} onChange={(event) => setForm({ ...form, sex: event.target.value })}>
              <option>All</option>
              <option>Female</option>
              <option>Male</option>
            </select>
          </label>
          <label className="admin-form__field">
            Lower limit
            <input type="number" step="any" required value={form.low} onChange={(event) => setForm({ ...form, low: event.target.value })} />
          </label>
          <label className="admin-form__field">
            Upper limit
            <input type="number" step="any" min={form.low || undefined} required value={form.high} onChange={(event) => setForm({ ...form, high: event.target.value })} />
          </label>
          <label className="admin-form__field">
            Unit
            <input required placeholder="e.g. mg/dL" value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} />
          </label>
          <div className="admin-form__actions">
            <button className="admin-button" type="submit">{editingRangeId === null ? 'Save range' : 'Save changes'}</button>
            <button className="admin-button admin-button--secondary" type="button" onClick={closeForm}>Cancel</button>
          </div>
        </form>
      )}

      <div className="admin-toolbar">
        <label className="admin-toolbar__field">
          Filter by test
          <select value={testFilter} onChange={(event) => setTestFilter(event.target.value)}>
            <option>All tests</option>
            {testNames.map((test) => <option key={test}>{test}</option>)}
          </select>
        </label>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">Test</th>
              <th scope="col">Age group</th>
              <th scope="col">Sex</th>
              <th scope="col">Reference interval</th>
              <th scope="col">Unit</th>
              <th scope="col"><span className="visually-hidden">Range action</span></th>
            </tr>
          </thead>
          <tbody>
            {visibleRanges.map((range) => (
              <tr key={range.id}>
                <td className="admin-table__primary">{range.test}</td>
                <td>{range.ageGroup}</td>
                <td>{range.sex}</td>
                <td>{range.low} – {range.high}</td>
                <td>{range.unit}</td>
                <td>
                  <button
                    className="admin-button admin-button--secondary admin-button--small"
                    type="button"
                    onClick={() => editRange(range)}
                    aria-label={`Edit ${range.test} range for ${range.ageGroup}, ${range.sex}`}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
            {visibleRanges.length === 0 && (
              <tr><td className="admin-empty" colSpan="6">No reference ranges are available for this test.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
