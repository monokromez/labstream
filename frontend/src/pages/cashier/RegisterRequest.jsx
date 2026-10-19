import { useEffect, useMemo, useState } from 'react'
import './RegisterRequest.css'

const samplePatients = [
  { pid: 'PID-2026-00124', name: 'Ariana Santos', sex: 'Female', dateOfBirth: '1998-04-16', contact: '0917 234 6810', registered: 'Oct 18, 2026', registeredDate: '2026-10-18' },
  { pid: 'PID-2026-00123', name: 'Miguel Reyes', sex: 'Male', dateOfBirth: '1987-11-02', contact: '0928 517 4403', registered: 'Oct 18, 2026', registeredDate: '2026-10-18' },
  { pid: 'PID-2026-00122', name: 'Leah Dela Cruz', sex: 'Female', dateOfBirth: '2001-07-29', contact: '0916 802 1957', registered: 'Oct 17, 2026', registeredDate: '2026-10-17' },
  { pid: 'PID-2026-00121', name: 'Noah Garcia', sex: 'Male', dateOfBirth: '1975-02-11', contact: '0995 310 7624', registered: 'Oct 16, 2026', registeredDate: '2026-10-16' },
]

export default function RegisterRequest() {
  const [searchQuery, setSearchQuery] = useState('')
  const [sexFilter, setSexFilter] = useState('all')
  const [registrationDateFilter, setRegistrationDateFilter] = useState('')
  const [activeModal, setActiveModal] = useState(null)
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [showRequestPrompt, setShowRequestPrompt] = useState(false)

  useEffect(() => {
    if (!activeModal) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setActiveModal(null)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [activeModal])

  const openPatientModal = (type, patient = null) => {
    setSelectedPatient(patient)
    setShowRequestPrompt(false)
    setActiveModal(type)
  }

  const filteredPatients = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return samplePatients.filter((patient) => {
      const matchesQuery = !query || [patient.pid, patient.name, patient.contact]
        .some((value) => value.toLowerCase().includes(query))
      const matchesSex = sexFilter === 'all' || patient.sex.toLowerCase() === sexFilter
      const matchesRegistrationDate = !registrationDateFilter || patient.registeredDate === registrationDateFilter

      return matchesQuery && matchesSex && matchesRegistrationDate
    })
  }, [searchQuery, sexFilter, registrationDateFilter])

  return (
    <section className='register-request' aria-label='Find a patient'>
      <div className='register-request__toolbar'>
        <label className='register-request__search' htmlFor='search-bar'>
          <svg aria-hidden='true' viewBox='0 0 24 24' fill='none'>
            <circle cx='10.8' cy='10.8' r='6.3' stroke='currentColor' strokeWidth='1.8' />
            <path d='m15.4 15.4 4.1 4.1' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' />
          </svg>
          <input
            type='search'
            placeholder='Search by patient name, PID, or contact number'
            id='search-bar'
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </label>

        <div className='register-request__filters' aria-label='Patient filters'>
          <label className='register-request__field' htmlFor='filter-sex'>
            <span>Sex</span>
            <select id='filter-sex' value={sexFilter} onChange={(event) => setSexFilter(event.target.value)}>
              <option value='all'>All</option>
              <option value='male'>Male</option>
              <option value='female'>Female</option>
            </select>
          </label>
          <label className='register-request__field register-request__field--date' htmlFor='filter-registration-date-range'>
            <span>Registered on</span>
            <input
              type='date'
              id='filter-registration-date-range'
              value={registrationDateFilter}
              onChange={(event) => setRegistrationDateFilter(event.target.value)}
            />
          </label>
        </div>
      </div>

      <section className='register-request__registry' aria-labelledby='patient-registry-title'>
        <div className='register-request__registry-heading'>
          <div>
            <h2 id='patient-registry-title'>Patient Registry</h2>
            <p>Select an existing patient to continue with their test request.</p>
          </div>
          <div className='register-request__registry-actions'>
            <span className='register-request__count'>{filteredPatients.length} {filteredPatients.length === 1 ? 'patient' : 'patients'}</span>
            <button className='register-request__add-button' type='button' onClick={() => openPatientModal('add')}>
              <span aria-hidden='true'>+</span> Add New Patient
            </button>
          </div>
        </div>

        <div className='register-request__table-wrap'>
          <table className='register-request__table'>
            <thead>
              <tr>
                <th scope='col'>PID</th>
                <th scope='col'>Patient name</th>
                <th scope='col'>Sex</th>
                <th scope='col'>Date of birth</th>
                <th scope='col'>Contact number</th>
                <th scope='col'>Registered</th>
                <th scope='col'>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPatients.map((patient) => (
                <tr key={patient.pid}>
                  <td className='register-request__pid'>{patient.pid}</td>
                  <td className='register-request__patient-name'>{patient.name}</td>
                  <td>{patient.sex}</td>
                  <td>{patient.dateOfBirth}</td>
                  <td>{patient.contact}</td>
                  <td>{patient.registered}</td>
                  <td>
                    <div className='register-request__row-actions'>
                      <button className='register-request__action-button register-request__action-button--details' type='button' onClick={() => openPatientModal('details', patient)}>
                        Details
                      </button>
                      <button className='register-request__action-button register-request__action-button--request' type='button' onClick={() => openPatientModal('request', patient)}>
                        Request
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredPatients.length === 0 && (
                <tr>
                  <td className='register-request__empty' colSpan='7'>No patients match “{searchQuery}”. Try a PID, name, or contact number.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {activeModal && (
        <div className='register-request__modal-backdrop' onMouseDown={(event) => {
          if (event.target === event.currentTarget) setActiveModal(null)
        }}>
          <section className='register-request__modal' role='dialog' aria-modal='true' aria-labelledby='register-request-modal-title'>
            <div className='register-request__modal-header'>
              <div>
                <h2 id='register-request-modal-title'>
                  {activeModal === 'details' && 'Patient Details'}
                  {activeModal === 'request' && 'Create Test Request'}
                  {activeModal === 'add' && 'Add New Patient'}
                </h2>
                <p>
                  {activeModal === 'details' && 'Review the selected patient’s registry information.'}
                  {activeModal === 'request' && `Create a test request for ${selectedPatient?.name}.`}
                  {activeModal === 'add' && !showRequestPrompt && 'Enter the patient’s information to create a registry record.'}
                  {activeModal === 'add' && showRequestPrompt && 'Patient registration is complete.'}
                </p>
              </div>
              <button className='register-request__modal-close' type='button' aria-label='Close dialog' onClick={() => setActiveModal(null)}>×</button>
            </div>

            <div className='register-request__modal-body'>
              {activeModal === 'details' && selectedPatient && (
                <dl className='register-request__details-grid'>
                  <div><dt>Patient ID</dt><dd>{selectedPatient.pid}</dd></div>
                  <div><dt>Full name</dt><dd>{selectedPatient.name}</dd></div>
                  <div><dt>Sex</dt><dd>{selectedPatient.sex}</dd></div>
                  <div><dt>Date of birth</dt><dd>{selectedPatient.dateOfBirth}</dd></div>
                  <div><dt>Contact number</dt><dd>{selectedPatient.contact}</dd></div>
                  <div><dt>Registered</dt><dd>{selectedPatient.registered}</dd></div>
                </dl>
              )}

              {activeModal === 'request' && (
                <form className='register-request__modal-form'>
                  <label>Patient<input value={`${selectedPatient?.name} (${selectedPatient?.pid})`} readOnly /></label>
                  <label htmlFor='request-tests'>Tests to request<select id='request-tests' defaultValue=''>
                    <option value='' disabled>Select a test</option>
                    <option value='cbc'>Complete Blood Count (CBC)</option>
                    <option value='urinalysis'>Urinalysis</option>
                    <option value='fasting-blood-sugar'>Fasting Blood Sugar</option>
                  </select></label>
                  <p className='register-request__modal-note'>Test selection, pricing, and queue assignment will be connected to system data later.</p>
                </form>
              )}

              {activeModal === 'add' && !showRequestPrompt && (
                <form className='register-request__modal-form'>
                  <label htmlFor='new-patient-name'>Full name<input id='new-patient-name' type='text' placeholder='Enter patient’s full name' /></label>
                  <div className='register-request__form-row'>
                    <label htmlFor='new-patient-sex'>Sex<select id='new-patient-sex' defaultValue=''><option value='' disabled>Select sex</option><option>Female</option><option>Male</option></select></label>
                    <label htmlFor='new-patient-dob'>Date of birth<input id='new-patient-dob' type='date' /></label>
                  </div>
                  <label htmlFor='new-patient-contact'>Contact number<input id='new-patient-contact' type='tel' placeholder='Enter contact number' /></label>
                  <p className='register-request__modal-note'>The system will assign a PID when patient registration is connected.</p>
                </form>
              )}

              {activeModal === 'add' && showRequestPrompt && (
                <div className='register-request__confirmation'>
                  <h3>Proceed with a test request?</h3>
                  <p>Would you like to continue to processing a test request for this patient now?</p>
                </div>
              )}
            </div>

            <div className='register-request__modal-footer'>
              {!(activeModal === 'add' && showRequestPrompt) && (
                <button className='register-request__modal-secondary' type='button' onClick={() => setActiveModal(null)}>Close</button>
              )}
              {activeModal === 'request' && (
                <button className='register-request__modal-primary' type='button' onClick={() => setActiveModal(null)}>Continue</button>
              )}
              {activeModal === 'add' && !showRequestPrompt && (
                <button className='register-request__modal-primary' type='button' onClick={() => setShowRequestPrompt(true)}>Register Patient</button>
              )}
              {activeModal === 'add' && showRequestPrompt && (
                <>
                  <button className='register-request__modal-secondary' type='button' onClick={() => setActiveModal(null)}>Not now</button>
                  <button className='register-request__modal-primary' type='button' onClick={() => {
                    setSelectedPatient({ pid: 'Pending PID', name: 'New patient' })
                    setShowRequestPrompt(false)
                    setActiveModal('request')
                  }}>Proceed to Request</button>
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </section>
  )
}
