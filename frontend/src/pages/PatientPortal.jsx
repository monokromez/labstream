import { useMemo, useState } from 'react'
import './PatientPortal.css'

const patient = {
  patientId: 'PID-000123',
  name: 'Dela Cruz, Juan A.',
  gender: 'Male',
  dob: '2006-12-05',
}

const results = [
  {
    labNo: 'LAB-2026-000148',
    category: 'Laboratory',
    orderDate: '2026-05-05',
    releasedDate: '2026-05-06',
    tests: ['Fasting Blood Sugar', 'Creatinine'],
    remarks: '',
    validatedBy: 'Dr. Maria L. Santos, MD, Pathologist',
    items: [
      { test: 'Fasting Blood Sugar', result: '112', unit: 'mg/dL', range: '70 - 100', flag: 'H' },
      { test: 'Creatinine', result: '0.9', unit: 'mg/dL', range: '0.7 - 1.3', flag: '' },
    ],
  },
  {
    labNo: 'LAB-2026-000139',
    category: 'Microbiology',
    orderDate: '2026-04-28',
    releasedDate: '2026-05-01',
    tests: ['Urine Culture'],
    remarks: 'Correlate with symptoms and clinical findings.',
    validatedBy: 'Dr. Maria L. Santos, MD, Pathologist',
    report: [
      { heading: 'Specimen', text: 'Urine, clean catch' },
      { heading: 'Findings', text: 'No significant growth after 48 hours of incubation.' },
      { heading: 'Impression', text: 'Negative urine culture.' },
    ],
  },
  {
    labNo: 'LAB-2026-000121',
    category: 'Histopathology',
    orderDate: '2026-04-15',
    releasedDate: '2026-04-20',
    tests: ['Skin lesion biopsy'],
    remarks: '',
    validatedBy: 'Dr. Maria L. Santos, MD, Pathologist',
    report: [
      { heading: 'Specimen', text: 'Skin lesion, left forearm' },
      { heading: 'Gross description', text: 'Tan-white tissue fragment measuring 0.8 cm.' },
      { heading: 'Microscopic description', text: 'Sections show benign fibrous tissue with mild chronic inflammation.' },
      { heading: 'Diagnosis', text: 'Benign fibrous histiocytoma.' },
    ],
  },
]

const categoryLabels = {
  all: 'All Results',
  laboratory: 'Laboratory',
  microbiology: 'Microbiology',
  histopathology: 'Histopathology',
}

function formatDate(date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(new Date(`${date}T00:00:00`))
}

function getAge(dob) {
  const birthDate = new Date(`${dob}T00:00:00`)
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const birthdayPassed = today.getMonth() > birthDate.getMonth()
    || (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate())
  if (!birthdayPassed) age -= 1
  return age
}

function DownloadIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 17v2h14v-2" />
    </svg>
  )
}

function ResultsTable({ results: visibleResults, showCategory, onView, onDownload }) {
  return (
    <div className="patient-portal__table-wrap">
      <table className="patient-portal__table">
        <thead>
          <tr>
            <th scope="col">Lab No.</th>
            <th scope="col">Order Date</th>
            {showCategory && <th scope="col">Category</th>}
            <th scope="col">Tests</th>
            <th scope="col" className="patient-portal__actions-heading">Actions</th>
          </tr>
        </thead>
        <tbody>
          {visibleResults.map((result) => (
            <tr key={result.labNo}>
              <td><strong>{result.labNo}</strong></td>
              <td>{formatDate(result.orderDate)}</td>
              {showCategory && <td><span className="patient-portal__category">{result.category}</span></td>}
              <td title={result.tests.join(', ')}>
                {result.tests.slice(0, 2).join(', ')}
                {result.tests.length > 2 && ` +${result.tests.length - 2}`}
              </td>
              <td className="patient-portal__actions">
                <button className="patient-portal__button patient-portal__button--small" type="button" onClick={() => onView(result)}>
                  View
                </button>
                <button
                  className="patient-portal__icon-button"
                  type="button"
                  aria-label={`Download PDF for ${result.labNo}`}
                  title={`Download PDF for ${result.labNo}`}
                  onClick={() => onDownload(result)}
                >
                  <DownloadIcon />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ResultViewer({ result, onClose, onDownload }) {
  return (
    <div className="patient-portal__backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="patient-portal__dialog" role="dialog" aria-modal="true" aria-labelledby="result-dialog-title">
        <div className="patient-portal__dialog-header">
          <div>
            <p className="patient-portal__dialog-kicker">{result.category} Report</p>
            <h2 id="result-dialog-title">{result.tests.join(', ')}</h2>
            <p className="patient-portal__muted">{result.labNo} · Released {formatDate(result.releasedDate)}</p>
          </div>
          <div className="patient-portal__dialog-actions">
            <button className="patient-portal__button patient-portal__button--secondary" type="button" onClick={() => onDownload(result)}>
              <DownloadIcon /> Download PDF
            </button>
            <button className="patient-portal__button patient-portal__button--ghost" type="button" onClick={onClose}>Close</button>
          </div>
        </div>

        <div className="patient-portal__patient-grid">
          <span><b>Name</b>{patient.name}</span>
          <span><b>Lab No.</b>{result.labNo}</span>
          <span><b>Age / Sex</b>{getAge(patient.dob)} / {patient.gender}</span>
          <span><b>Date of Request</b>{formatDate(result.orderDate)}</span>
          <span><b>Patient ID</b>{patient.patientId}</span>
          <span><b>Date of Result</b>{formatDate(result.releasedDate)}</span>
        </div>

        {result.items ? (
          <div className="patient-portal__table-wrap">
            <table className="patient-portal__table patient-portal__numeric-table">
              <thead>
                <tr>
                  <th scope="col">Test</th><th scope="col">Result</th><th scope="col">Unit</th><th scope="col">Reference Range</th><th scope="col">Flag</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((item) => (
                  <tr key={item.test}>
                    <td>{item.test}</td>
                    <td className={item.flag ? 'patient-portal__abnormal' : ''}>{item.result}</td>
                    <td>{item.unit}</td><td>{item.range}</td>
                    <td>{item.flag && <span className="patient-portal__flag">{item.flag}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="patient-portal__report-sections">
            {result.report.map((section) => (
              <article key={section.heading}>
                <h3>{section.heading}</h3>
                <p>{section.text}</p>
              </article>
            ))}
          </div>
        )}

        {result.remarks && (
          <div className="patient-portal__remarks">
            <h3>Pathologist remarks</h3>
            <p>{result.remarks}</p>
          </div>
        )}
        <footer className="patient-portal__dialog-footer">
          <strong>{result.validatedBy}</strong>
          <span>This report should be correlated with clinical findings.</span>
        </footer>
      </section>
    </div>
  )
}

function ProfilePage({ onPasswordChanged }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const [error, setError] = useState('')

  const submitPassword = (event) => {
    event.preventDefault()
    if (!form.current || !form.next || !form.confirm) return setError('Fill in all three fields.')
    if (form.next.length < 8) return setError('New password must be at least 8 characters.')
    if (form.next !== form.confirm) return setError('New password and confirmation do not match.')
    setForm({ current: '', next: '', confirm: '' })
    setError('')
    setIsDialogOpen(false)
    onPasswordChanged()
  }

  return (
    <section className="patient-portal__profile">
      <header className="patient-portal__page-heading">
        <p className="patient-portal__eyebrow">Account</p>
        <h1>{patient.name}</h1>
        <p className="patient-portal__muted">Your personal information and account security.</p>
      </header>
      <div className="patient-portal__profile-card">
        <div className="patient-portal__profile-fields">
          {[
            ['Patient ID', patient.patientId],
            ['Gender', patient.gender],
            ['Date of Birth', formatDate(patient.dob)],
            ['Age', `${getAge(patient.dob)} years old`],
          ].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
        </div>
        <p className="patient-portal__notice">To correct any of these details, please visit the cashier.</p>
      </div>
      <div className="patient-portal__security">
        <div><h2>Security</h2><p className="patient-portal__muted">Keep your patient portal password private and up to date.</p></div>
        <button className="patient-portal__button" type="button" onClick={() => setIsDialogOpen(true)}>Change Password</button>
      </div>

      {isDialogOpen && (
        <div className="patient-portal__backdrop" role="presentation">
          <form className="patient-portal__password-dialog" role="dialog" aria-modal="true" aria-labelledby="password-dialog-title" onSubmit={submitPassword}>
            <h2 id="password-dialog-title">Change password</h2>
            <p className="patient-portal__muted">Enter your current password, then choose a new one.</p>
            {error && <p className="patient-portal__form-error" role="alert">{error}</p>}
            {[
              ['current', 'Current password'],
              ['next', 'New password'],
              ['confirm', 'Confirm new password'],
            ].map(([key, label]) => (
              <label key={key}>{label}
                <input
                  type="password"
                  value={form[key]}
                  onChange={(event) => setForm({ ...form, [key]: event.target.value })}
                  autoComplete={key === 'current' ? 'current-password' : 'new-password'}
                />
              </label>
            ))}
            <div className="patient-portal__dialog-actions">
              <button className="patient-portal__button patient-portal__button--ghost" type="button" onClick={() => setIsDialogOpen(false)}>Cancel</button>
              <button className="patient-portal__button" type="submit">Save password</button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}

export default function PatientPortal({ currentHash = '#/all' }) {
  const [search, setSearch] = useState('')
  const [selectedResult, setSelectedResult] = useState(null)
  const [notice, setNotice] = useState('')
  const route = currentHash.replace(/^#\//, '')
  const isProfile = route === 'profile'
  const category = categoryLabels[route] ? route : 'all'

  const visibleResults = useMemo(() => results
    .filter((result) => category === 'all' || result.category.toLowerCase() === category)
    .filter((result) => {
      const query = search.trim().toLowerCase()
      return !query || result.labNo.toLowerCase().includes(query) || result.tests.some((test) => test.toLowerCase().includes(query))
    }), [category, search])

  const handleDownload = (result) => {
    setNotice(`PDF download requested for ${result.labNo}.`)
    window.setTimeout(() => setNotice(''), 4000)
  }

  if (isProfile) return <ProfilePage onPasswordChanged={() => setNotice('Your password has been changed.')} />

  return (
    <section className="patient-portal">
      <header className="patient-portal__page-heading">
        <p className="patient-portal__eyebrow">Released results</p>
        <h1>{categoryLabels[category]}</h1>
        <p className="patient-portal__muted">{patient.name} · {patient.patientId}</p>
      </header>

      <div className="patient-portal__toolbar">
        <label className="patient-portal__search">
          <span className="sr-only">Search results</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by Lab No. or test name" />
        </label>
        <span className="patient-portal__result-count">{visibleResults.length} {visibleResults.length === 1 ? 'report' : 'reports'}</span>
      </div>

      {visibleResults.length ? (
        <ResultsTable results={visibleResults} showCategory={category === 'all'} onView={setSelectedResult} onDownload={handleDownload} />
      ) : (
        <div className="patient-portal__empty">
          <h2>No released results found</h2>
          <p>Results appear here once the laboratory publishes them.</p>
        </div>
      )}

      {notice && <p className="patient-portal__toast" role="status">{notice}</p>}
      {selectedResult && <ResultViewer result={selectedResult} onClose={() => setSelectedResult(null)} onDownload={handleDownload} />}
    </section>
  )
}
