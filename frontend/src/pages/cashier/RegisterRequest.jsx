import { useEffect, useMemo, useState } from 'react'
import SearchInput from '../../components/data/SearchInput.jsx'
import CountryCityFields from '../../components/data/CountryCityFields.jsx'
import PlusIcon from '../../components/data/PlusIcon.jsx'
import TablePagination from '../../components/data/TablePagination.jsx'
import useTestCatalog from '../../data/useTestCatalog.js'
import { api } from '../../api/client.js'
import useApiResource from '../../api/useApiResource.js'
import { formatDate } from '../../utils/dateFormat.js'
import './RegisterRequest.css'

const ROWS_PER_PAGE = 10

const validIdLabels = {
  'national-id': 'Philippine National ID',
  'drivers-license': 'Driver’s License',
  passport: 'Passport',
  philhealth: 'PhilHealth ID',
  sss: 'SSS ID',
  umid: 'UMID',
  'voters-id': 'Voter’s ID',
}

const getPatientName = (patient) => [patient.firstName, patient.middleName, patient.lastName].filter(Boolean).join(' ') || patient.name || ''
const getPatientNameWithMiddleInitial = (patient) => [
  patient.firstName,
  patient.middleName ? `${patient.middleName.trim().charAt(0).toUpperCase()}.` : '',
  patient.lastName,
].filter(Boolean).join(' ')
const getPatientAddress = (patient) => [patient.houseNumber, patient.street, patient.city, patient.country].filter(Boolean).join(', ') || '—'
const calculateAge = (dateOfBirth) => {
  if (!dateOfBirth) return '—'
  const [year, month, day] = dateOfBirth.split('-').map(Number)
  const today = new Date()
  let age = today.getFullYear() - year
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) age -= 1
  return `${age} years`
}
const openDatePicker = (event) => {
  const input = event.currentTarget.querySelector("input[type='date']")
  if (!input) return

  if (typeof input.showPicker === 'function') {
    event.preventDefault()
    try {
      input.showPicker()
    } catch {
      input.focus()
    }
    return
  }

  input.focus()
}
const handleDatePickerKeyDown = (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    openDatePicker(event)
  }
}
export default function RegisterRequest() {
  const [searchQuery, setSearchQuery] = useState('')
  const [sexFilter, setSexFilter] = useState('all')
  const [previousVisitFilter, setPreviousVisitFilter] = useState('')
  const [patientCountry, setPatientCountry] = useState('')
  const [patientCity, setPatientCity] = useState('')
  const [patientDateOfBirth, setPatientDateOfBirth] = useState('')
  const [validIdSelection, setValidIdSelection] = useState('')
  const [validIdType, setValidIdType] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [activeModal, setActiveModal] = useState(null)
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [selectedTestIds, setSelectedTestIds] = useState([])
  const [requestSubmitted, setRequestSubmitted] = useState(false)
  const [showRequestPrompt, setShowRequestPrompt] = useState(false)
  const [showPatientConfirm, setShowPatientConfirm] = useState(false)
  const [patientConfirmData, setPatientConfirmData] = useState(null)
  const [showRequestConfirm, setShowRequestConfirm] = useState(false)
  const [showPortalConfirm, setShowPortalConfirm] = useState(false)
  const [portalActivation, setPortalActivation] = useState(null)
  const [actionError, setActionError] = useState('')
  const { result: patientResult, refresh: refreshPatients, error: patientLoadError } = useApiResource(
    () => api.patients.list({ page: 1, pageSize: 100, q: searchQuery }), [searchQuery],
  )
  const patients = (patientResult?.data ?? []).map((patient) => ({
    ...patient,
    contact: patient.phone,
    previousVisitDate: patient.previousVisit?.slice(0, 10) ?? patient.createdAt?.slice(0, 10),
    validId: patient.validIdType?.toLowerCase() === 'other' ? 'Other' : patient.validIdType,
    hasPendingRequest: patient.hasPendingRequest,
  }))
  const { categories: testCategories } = useTestCatalog({ availableOnly: true })
  useEffect(() => {
    if (!activeModal) return undefined

    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return
      if (showPortalConfirm) setShowPortalConfirm(false)
      else if (showPatientConfirm) setShowPatientConfirm(false)
      else if (showRequestConfirm) setShowRequestConfirm(false)
      else setActiveModal(null)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [activeModal, showPatientConfirm, showRequestConfirm, showPortalConfirm])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, sexFilter, previousVisitFilter])

  const openPatientModal = (type, patient = null) => {
    if (type === 'request' && patient?.hasPendingRequest) return
    setActionError('')
    setSelectedPatient(patient)
    setSelectedTestIds([])
    setRequestSubmitted(false)
    setShowRequestPrompt(false)
    setShowPatientConfirm(false)
    setPatientConfirmData(null)
    setShowRequestConfirm(false)
    setShowPortalConfirm(false)
    setPortalActivation(null)
    if (type === 'add') {
      setPatientCountry('')
      setPatientCity('')
      setPatientDateOfBirth('')
      setValidIdSelection('')
      setValidIdType('')
    }
    setActiveModal(type)
  }

  const toggleTest = (testId) => {
    setSelectedTestIds((current) => current.includes(testId)
      ? current.filter((id) => id !== testId)
      : [...current, testId])
  }

  const handleCreateTestRequest = () => {
    setShowRequestConfirm(true)
  }

  const confirmCreateTestRequest = async () => {
    try {
      await api.cashier.createRequest({ patientId: selectedPatient.id, testIds: selectedTestIds, priority: 'routine' })
      setRequestSubmitted(true)
      await refreshPatients()
    } catch (requestError) {
      setActionError(requestError.message || 'Unable to create the test request.')
    } finally {
      setShowRequestConfirm(false)
    }
  }

  const patientHasActiveRequest = (patient) => Boolean(patient?.hasPendingRequest)

  const handleRegisterPatient = (event) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    setPatientConfirmData(formData)
    setShowPatientConfirm(true)
  }

  const issuePortalActivation = async () => {
    if (!selectedPatient) return
    try {
      const response = await api.cashier.issuePatientPortalActivation(selectedPatient.id)
      setPortalActivation({ pid: selectedPatient.pid, code: response.activation.code, expiresInHours: response.activation.expiresInHours })
      setShowPortalConfirm(false)
      setActionError('')
    } catch (requestError) {
      setActionError(requestError.message || 'Unable to issue patient portal activation.')
      setShowPortalConfirm(false)
    }
  }

  const confirmRegisterPatient = async () => {
    if (!patientConfirmData) return
    const formData = patientConfirmData
    const patientDetails = {
      firstName: String(formData.get('firstName') ?? '').trim(),
      middleName: String(formData.get('middleName') ?? '').trim(),
      lastName: String(formData.get('lastName') ?? '').trim(),
      country: String(formData.get('country') ?? '').trim(),
      city: String(formData.get('city') ?? '').trim(),
      houseNumber: String(formData.get('houseNumber') ?? '').trim(),
      street: String(formData.get('street') ?? '').trim(),
      email: String(formData.get('email') ?? '').trim(),
      sex: String(formData.get('sex') ?? ''),
      dateOfBirth: String(formData.get('dateOfBirth') ?? ''),
      phone: String(formData.get('contact') ?? '').trim(),
      validIdType: validIdSelection === 'other' ? validIdType.trim() : validIdLabels[validIdSelection],
      validIdNumber: String(formData.get('validIdNumber') ?? '').trim(),
    }
    try {
      const response = await api.cashier.registerPatient(patientDetails)
      const patient = { ...patientDetails, ...response.data, id: response.data.id, contact: patientDetails.phone, previousVisitDate: response.data.createdAt?.slice(0, 10), validId: validIdSelection === 'other' ? 'Other' : patientDetails.validIdType, validIdType: validIdSelection === 'other' ? validIdType.trim() : '' }
      await refreshPatients()
      setSelectedPatient(patient)
      setSearchQuery('')
      setSexFilter('all')
      setPreviousVisitFilter('')
      setCurrentPage(1)
      setPatientConfirmData(null)
      setShowPatientConfirm(false)
      setShowRequestPrompt(true)
    } catch (requestError) {
      setActionError(requestError.message || 'Unable to register the patient.')
    }
  }

  const filteredPatients = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return patients.filter((patient) => {
      const matchesQuery = !query || [patient.pid, getPatientName(patient), patient.contact, patient.email]
        .some((value) => String(value ?? '').toLowerCase().includes(query))
      const matchesSex = sexFilter === 'all' || String(patient.sex ?? '').toLowerCase() === sexFilter
      const matchesPreviousVisit = !previousVisitFilter || patient.previousVisitDate === previousVisitFilter

      return matchesQuery && matchesSex && matchesPreviousVisit
    })
  }, [patients, searchQuery, sexFilter, previousVisitFilter])
  const visiblePatients = filteredPatients.slice(
    (currentPage - 1) * ROWS_PER_PAGE,
    currentPage * ROWS_PER_PAGE,
  )

  return (
    <section className='register-request' aria-label='Find a patient'>
      {(actionError || patientLoadError) && <p className='register-request__modal-note' role='alert'>{actionError || patientLoadError}</p>}
      <div className='register-request__toolbar'>
        <SearchInput
          className='register-request__search'
          label='Search patients'
          placeholder='Search by patient name, PID, or contact number'
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
        />

        <div className='register-request__filters' aria-label='Patient filters'>
          <label className='register-request__field' htmlFor='filter-sex'>
            <span>Sex</span>
            <select id='filter-sex' value={sexFilter} onChange={(event) => setSexFilter(event.target.value)}>
              <option value='all'>All</option>
              <option value='male'>Male</option>
              <option value='female'>Female</option>
            </select>
          </label>
          <label className='register-request__field register-request__field--date' htmlFor='filter-previous-visit'>
            <span>Previous visit</span>
            <span
              className='register-request__date-picker'
              role='button'
              tabIndex='0'
              aria-label={`Choose previous visit date${previousVisitFilter ? `, selected ${formatDate(previousVisitFilter)}` : ''}`}
              onClick={openDatePicker}
              onKeyDown={handleDatePickerKeyDown}
            >
              <span className='register-request__date-picker-display' aria-hidden='true'>
                {previousVisitFilter ? formatDate(previousVisitFilter) : 'MM/DD/YYYY'}
              </span>
              <input
                type='date'
                id='filter-previous-visit'
                aria-hidden='true'
                tabIndex='-1'
                value={previousVisitFilter}
                onChange={(event) => setPreviousVisitFilter(event.target.value)}
              />
            </span>
          </label>
        </div>
      </div>

      <section className='register-request__registry' aria-labelledby='patient-registry-title'>
        <div className='register-request__registry-heading'>
          <div>
            <h2 id='patient-registry-title'>Patients</h2>
            <p>Select an existing patient to continue with their test request.</p>
          </div>
          <div className='register-request__registry-actions'>
            <span className='register-request__count'>{filteredPatients.length} {filteredPatients.length === 1 ? 'patient' : 'patients'}</span>
            <button className='register-request__add-button' type='button' onClick={() => openPatientModal('add')}>
              <PlusIcon /> PATIENT
            </button>
          </div>
        </div>

        <div className='register-request__table-wrap'>
          <table className='register-request__table'>
            <thead>
              <tr>
                <th scope='col'>PID</th>
                <th scope='col'>Name</th>
                <th scope='col'>Contact number</th>
                <th scope='col'>Previous visit</th>
                <th scope='col'>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visiblePatients.map((patient) => (
                <tr key={patient.pid}>
                  <td className='register-request__pid'>{patient.pid}</td>
                  <td className='register-request__patient-name'>{getPatientNameWithMiddleInitial(patient)}</td>
                  <td>{patient.contact}</td>
                  <td>{formatDate(patient.previousVisitDate)}</td>
                  <td>
                    <div className='register-request__row-actions'>
                      <button className='register-request__action-button register-request__action-button--details' type='button' onClick={() => openPatientModal('details', patient)}>
                        Details
                      </button>
                      <button
                        className='register-request__action-button register-request__action-button--request'
                        type='button'
                        disabled={patientHasActiveRequest(patient)}
                        title={patientHasActiveRequest(patient) ? 'This patient has a pending request. Process or cancel it before creating another.' : undefined}
                        aria-label={patientHasActiveRequest(patient) ? `Request unavailable for ${getPatientName(patient)}: an active request is pending` : `Create request for ${getPatientName(patient)}`}
                        onClick={() => openPatientModal('request', patient)}
                      >
                        {patientHasActiveRequest(patient) ? 'Request Pending' : 'Request'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredPatients.length === 0 && (
                <tr>
                  <td className='register-request__empty' colSpan='5'>No patients match the current search or filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <TablePagination
          currentPage={currentPage}
          pageSize={ROWS_PER_PAGE}
          totalItems={filteredPatients.length}
          onPageChange={setCurrentPage}
        />
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
                  {activeModal === 'request' && (requestSubmitted
                    ? 'The request has been added to Payments & Invoice as pending.'
                    : `Create a test request for ${getPatientName(selectedPatient ?? {})}.`)}
                  {activeModal === 'add' && !showRequestPrompt && 'Enter the patient’s information to create a registry record.'}
                  {activeModal === 'add' && showRequestPrompt && 'Patient registration is complete.'}
                </p>
              </div>
              <button className='register-request__modal-close' type='button' aria-label='Close dialog' onClick={() => setActiveModal(null)}>×</button>
            </div>

            <div className='register-request__modal-body'>
              {activeModal === 'details' && selectedPatient && (
                <>
                <dl className='register-request__details-grid'>
                  <div className='register-request__details-row'>
                    <div><dt>PID</dt><dd>{selectedPatient.pid}</dd></div>
                    <div><dt>Full name</dt><dd>{getPatientName(selectedPatient)}</dd></div>
                  </div>
                  <div className='register-request__details-row register-request__details-row--three'>
                    <div><dt>Sex</dt><dd>{selectedPatient.sex || '—'}</dd></div>
                    <div><dt>DoB</dt><dd>{formatDate(selectedPatient.dateOfBirth)}</dd></div>
                    <div><dt>Age</dt><dd>{calculateAge(selectedPatient.dateOfBirth)}</dd></div>
                  </div>
                  <div className='register-request__details-row register-request__details-row--full'>
                    <div><dt>Address</dt><dd>{getPatientAddress(selectedPatient)}</dd></div>
                  </div>
                  <div className='register-request__details-row'>
                    <div><dt>Contact number</dt><dd>{selectedPatient.contact || '—'}</dd></div>
                  <div><dt>Valid ID</dt><dd>{selectedPatient.validId?.toLowerCase() === 'other' && selectedPatient.validIdType
                      ? `Other — ${selectedPatient.validIdType}`
                      : selectedPatient.validId || 'Not provided'}</dd></div>
                  </div>
                  <div className='register-request__details-row register-request__details-row--full'>
                    <div><dt>Valid ID number</dt><dd>{selectedPatient.validIdNumber || 'Not provided'}</dd></div>
                  </div>
                  <div className='register-request__details-row register-request__details-row--full'>
                    <div><dt>Previous visit</dt><dd>{selectedPatient.previousVisitDate ? formatDate(selectedPatient.previousVisitDate) : 'No previous visit'}</dd></div>
                  </div>
                  <div className='register-request__details-row register-request__details-row--full'>
                    <div><dt>Email</dt><dd>{selectedPatient.email || '—'}</dd></div>
                  </div>
                </dl>
                {portalActivation && <div className='register-request__confirmation register-request__confirmation--portal' role='status'><h3>Portal activation issued</h3><p>PID: <strong>{portalActivation.pid}</strong></p><p>One-time activation code: <strong>{portalActivation.code}</strong></p><p>Expires in {portalActivation.expiresInHours} hours. Share it privately; the patient sets their own password during activation.</p></div>}
                </>
              )}

              {activeModal === 'request' && (
                requestSubmitted ? (
                  <div className='register-request__confirmation'>
                    <h3>Request registered</h3>
                  <p>{selectedTestIds.length} {selectedTestIds.length === 1 ? 'test was' : 'tests were'} added to Payments &amp; Invoice with a Pending status. The cashier can record the in-person cash payment there.</p>
                  </div>
                ) : (
                <form className='register-request__modal-form'>
                  <label>Patient<input value={`${getPatientName(selectedPatient ?? {})} (${selectedPatient?.pid})`} readOnly /></label>
                  <fieldset className='register-request__test-selection'>
                    <legend>Select tests</legend>
                    <p className='register-request__test-selection-hint'>Choose one or more tests, grouped by category.</p>
                    <div className='register-request__test-categories'>
                      {testCategories.map((category) => (
                        <section className='register-request__test-category' key={category.name} aria-labelledby={`test-category-${category.name}`}>
                          <h3 id={`test-category-${category.name}`}>{category.name}</h3>
                          <div className='register-request__test-options'>
                            {category.tests.map((test) => (
                              <label className='register-request__test-option' key={test.id}>
                                <input
                                  type='checkbox'
                                  name='tests'
                                  value={test.id}
                                  checked={selectedTestIds.includes(test.id)}
                                  onChange={() => toggleTest(test.id)}
                                />
                                <span>{test.name}</span>
                              </label>
                            ))}
                          </div>
                        </section>
                      ))}
                    </div>
                    <p className='register-request__test-selection-count' aria-live='polite'>
                      {selectedTestIds.length} {selectedTestIds.length === 1 ? 'test' : 'tests'} selected
                    </p>
                  </fieldset>
                  <p className='register-request__modal-note'>Available tests and prices come from the administrator’s current catalog.</p>
                </form>
                )
              )}
              {activeModal === 'add' && !showRequestPrompt && (
                <form className='register-request__modal-form' id='new-patient-form' onSubmit={handleRegisterPatient}>
                  <div className='register-request__form-row register-request__form-row--three'>
                    <label htmlFor='new-patient-first-name'>First name<input id='new-patient-first-name' name='firstName' type='text' placeholder='First name' required /></label>
                    <label htmlFor='new-patient-middle-name'>Middle name<input id='new-patient-middle-name' name='middleName' type='text' placeholder='Middle name' /></label>
                    <label htmlFor='new-patient-last-name'>Surname<input id='new-patient-last-name' name='lastName' type='text' placeholder='Surname' required /></label>
                  </div>
                  <CountryCityFields
                    className='register-request__form-row'
                    fieldClassName='register-request__field'
                    idPrefix='new-patient'
                    country={patientCountry}
                    city={patientCity}
                    onCountryChange={setPatientCountry}
                    onCityChange={setPatientCity}
                  />
                  <div className='register-request__form-row'>
                    <label htmlFor='new-patient-house-number'>House no.<input id='new-patient-house-number' name='houseNumber' type='text' placeholder='House number' /></label>
                    <label htmlFor='new-patient-street'>Street<input id='new-patient-street' name='street' type='text' placeholder='Street' /></label>
                  </div>
                  <label htmlFor='new-patient-email'>Email address<input id='new-patient-email' name='email' type='email' placeholder='name@example.com' /></label>
                  <label htmlFor='new-patient-valid-id'>Valid ID type<select id='new-patient-valid-id' name='validId' value={validIdSelection} onChange={(event) => {
                    setValidIdSelection(event.target.value)
                    if (event.target.value !== 'other') setValidIdType('')
                  }} required>
                    <option value='' disabled>Select an ID type</option>
                    <option value='national-id'>Philippine National ID</option>
                    <option value='drivers-license'>Driver’s License</option>
                    <option value='passport'>Passport</option>
                    <option value='philhealth'>PhilHealth ID</option>
                    <option value='sss'>SSS ID</option>
                    <option value='umid'>UMID</option>
                    <option value='voters-id'>Voter’s ID</option>
                    <option value='other'>Other</option>
                  </select></label>
                  {validIdSelection === 'other' && (
                    <label htmlFor='new-patient-valid-id-type'>ID type / classification<input
                      id='new-patient-valid-id-type'
                      name='validIdType'
                      type='text'
                      placeholder='Enter ID type or classification'
                      value={validIdType}
                      onChange={(event) => setValidIdType(event.target.value)}
                      required
                    /></label>
                  )}
                  <label htmlFor='new-patient-valid-id-number'>ID or card number<input id='new-patient-valid-id-number' name='validIdNumber' type='text' placeholder='Enter the ID or card number' required /></label>
                  <div className='register-request__form-row'>
                    <label htmlFor='new-patient-sex'>Sex<select id='new-patient-sex' name='sex' defaultValue='' required><option value='' disabled>Select sex</option><option>Female</option><option>Male</option></select></label>
                    <label htmlFor='new-patient-dob'>Date of birth
                      <span
                        className='register-request__date-picker'
                        role='button'
                        tabIndex='0'
                        aria-label={`Choose date of birth${patientDateOfBirth ? `, selected ${formatDate(patientDateOfBirth)}` : ''}`}
                        onClick={openDatePicker}
                        onKeyDown={handleDatePickerKeyDown}
                      >
                        <span className='register-request__date-picker-display' aria-hidden='true'>
                          {patientDateOfBirth ? formatDate(patientDateOfBirth) : 'MM/DD/YYYY'}
                        </span>
                        <input id='new-patient-dob' name='dateOfBirth' type='date' autoComplete='bday' aria-hidden='true' tabIndex='-1' value={patientDateOfBirth} onChange={(event) => setPatientDateOfBirth(event.target.value)} required />
                      </span>
                    </label>
                  </div>
                  <label htmlFor='new-patient-contact'>Contact number<input id='new-patient-contact' name='contact' type='tel' placeholder='Enter contact number' required /></label>
                  <p className='register-request__modal-note'>A PID is generated by the system after the patient is saved.</p>
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
              {!(activeModal === 'add' && showRequestPrompt) && !(activeModal === 'request' && requestSubmitted) && (
                <button className='register-request__modal-secondary' type='button' onClick={() => setActiveModal(null)}>Close</button>
              )}
              {activeModal === 'request' && (
                <button className='register-request__modal-primary' type='button' disabled={!requestSubmitted && selectedTestIds.length === 0} onClick={requestSubmitted ? () => setActiveModal(null) : handleCreateTestRequest}>
                  {requestSubmitted ? 'Done' : `Review Request · ${selectedTestIds.length} ${selectedTestIds.length === 1 ? 'test' : 'tests'}`}
                </button>
              )}
              {activeModal === 'details' && selectedPatient && !portalActivation && <button className='register-request__modal-primary' type='button' onClick={() => setShowPortalConfirm(true)}>Issue Portal Activation</button>}
              {activeModal === 'add' && !showRequestPrompt && (
                <button className='register-request__modal-primary' type='submit' form='new-patient-form'>Register Patient</button>
              )}
              {activeModal === 'add' && showRequestPrompt && (
                <>
                  <button className='register-request__modal-secondary' type='button' onClick={() => setActiveModal(null)}>Not now</button>
                  <button className='register-request__modal-primary' type='button' onClick={() => {
                    setShowRequestPrompt(false)
                    setActiveModal('request')
                  }}>Proceed to Request</button>
                </>
              )}
            </div>
          </section>
        </div>
      )}

      {showPatientConfirm && patientConfirmData && (
        <div className='register-request__confirm-backdrop'>
          <section className='register-request__confirm-dialog' role='alertdialog' aria-modal='true' aria-labelledby='confirm-patient-title'>
            <h2 id='confirm-patient-title'>Confirm Patient Registration?</h2>
            <p>Register <strong>{[patientConfirmData.get('firstName'), patientConfirmData.get('middleName'), patientConfirmData.get('lastName')].filter(Boolean).join(' ')}</strong> in the patient registry?</p>
            <div className='register-request__confirm-actions'>
              <button className='register-request__modal-secondary' type='button' onClick={() => setShowPatientConfirm(false)}>Back to Form</button>
              <button className='register-request__modal-primary' type='button' onClick={confirmRegisterPatient}>Confirm Registration</button>
            </div>
          </section>
        </div>
      )}

      {showRequestConfirm && (
        <div className='register-request__confirm-backdrop'>
          <section className='register-request__confirm-dialog' role='alertdialog' aria-modal='true' aria-labelledby='confirm-request-title'>
            <h2 id='confirm-request-title'>Confirm Test Request?</h2>
            <p>Create a request for <strong>{getPatientName(selectedPatient ?? {})}</strong> with <strong>{selectedTestIds.length} {selectedTestIds.length === 1 ? 'test' : 'tests'}</strong>? It will appear in Payments &amp; Invoice as pending.</p>
            <div className='register-request__confirm-actions'>
              <button className='register-request__modal-secondary' type='button' onClick={() => setShowRequestConfirm(false)}>Back to Tests</button>
              <button className='register-request__modal-primary' type='button' onClick={confirmCreateTestRequest}>Confirm Request</button>
            </div>
          </section>
        </div>
      )}

      {showPortalConfirm && selectedPatient && (
        <div className='register-request__confirm-backdrop'>
          <section className='register-request__confirm-dialog' role='alertdialog' aria-modal='true' aria-labelledby='confirm-portal-title'>
            <h2 id='confirm-portal-title'>Issue patient portal access?</h2>
            <p>Create a one-time activation code for <strong>{getPatientName(selectedPatient)}</strong>? The code is shown once and expires after 24 hours.</p>
            <div className='register-request__confirm-actions'>
              <button className='register-request__modal-secondary' type='button' onClick={() => setShowPortalConfirm(false)}>Cancel</button>
              <button className='register-request__modal-primary' type='button' onClick={issuePortalActivation}>Issue Code</button>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}
