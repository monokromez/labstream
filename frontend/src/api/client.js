import { io } from 'socket.io-client'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export class ApiError extends Error {
  constructor({ status, error, message, details }) {
    super(message || error || 'The request failed.')
    this.name = 'ApiError'
    this.status = status
    this.code = error || 'API_ERROR'
    this.details = details
  }
}

async function request(path, { method = 'GET', body, signal } = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: 'include',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  })

  if (response.status === 204) return null
  const responseBody = await response.text()
  let payload = null
  if (responseBody) {
    try {
      payload = JSON.parse(responseBody)
    } catch {
      payload = { message: responseBody }
    }
  }
  if (!response.ok) {
    throw new ApiError({ status: response.status, ...payload })
  }
  return payload
}

function queryString(values = {}) {
  const query = new URLSearchParams()
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, value)
  })
  const encoded = query.toString()
  return encoded ? `?${encoded}` : ''
}

export const api = {
  auth: {
    login: (credentials) => request('/api/auth/login', { method: 'POST', body: credentials }),
    activate: (activation) => request('/api/auth/activate', { method: 'POST', body: activation }),
    me: () => request('/api/auth/me'),
    changePassword: (passwords) => request('/api/auth/change-password', { method: 'POST', body: passwords }),
    logout: () => request('/api/auth/logout', { method: 'POST', body: {} }),
  },
  catalog: {
    list: (filters) => request(`/api/catalog${queryString(filters)}`),
  },
  patients: {
    list: (filters) => request(`/api/patients${queryString(filters)}`),
  },
  cashier: {
    dashboard: () => request('/api/cashier/dashboard'),
    registerPatient: (patient) => request('/api/cashier/patients', { method: 'POST', body: patient }),
    issuePatientPortalActivation: (patientId) => request(`/api/cashier/patients/${patientId}/portal-activation`, { method: 'POST', body: {} }),
    createRequest: (testRequest) => request('/api/cashier/requests', { method: 'POST', body: testRequest }),
    queue: (filters) => request(`/api/cashier/queue${queryString(filters)}`),
    callQueueItem: (requestId) => request(`/api/cashier/queue/${requestId}/call`, { method: 'POST', body: {} }),
    callNext: () => request('/api/cashier/queue/call-next', { method: 'POST', body: {} }),
    dismissCurrentCall: () => request('/api/cashier/queue/call', { method: 'DELETE' }),
    processPayment: (requestId) => request(`/api/cashier/requests/${requestId}/payment`, { method: 'POST', body: {} }),
    cancelRequest: (requestId, reason) => request(`/api/cashier/requests/${requestId}/cancel`, { method: 'PATCH', body: { reason } }),
    invoices: (filters) => request(`/api/cashier/invoices${queryString(filters)}`),
  },
  staff: {
    list: (filters) => request(`/api/admin/staff${queryString(filters)}`),
    create: (staff) => request('/api/admin/staff', { method: 'POST', body: staff }),
    setActive: (staffId, isActive) => request(`/api/admin/staff/${staffId}/status`, { method: 'PATCH', body: { isActive } }),
  },
  administrator: {
    dashboard: () => request('/api/admin/dashboard/summary'),
    testVolume: (filters) => request(`/api/admin/dashboard/test-volume${queryString(filters)}`),
    auditLogs: (filters) => request(`/api/admin/audit-logs${queryString(filters)}`),
    catalog: (filters) => request(`/api/admin/catalog${queryString(filters)}`),
    addCategory: (category) => request('/api/admin/categories', { method: 'POST', body: category }),
    removeCategory: (categoryId, testActions) => request(`/api/admin/categories/${categoryId}`, { method: 'DELETE', body: { testActions } }),
    addTest: (test) => request('/api/admin/tests', { method: 'POST', body: test }),
    testConfiguration: (testId) => request(`/api/admin/tests/${testId}/configuration`),
    updateTest: (testId, updates) => request(`/api/admin/tests/${testId}`, { method: 'PATCH', body: updates }),
    removeTest: (testId) => request(`/api/admin/tests/${testId}`, { method: 'DELETE' }),
    referenceRanges: (filters) => request(`/api/admin/reference-ranges${queryString(filters)}`),
    addReferenceRange: (range) => request('/api/admin/reference-ranges', { method: 'POST', body: range }),
    updateReferenceRange: (rangeId, updates) => request(`/api/admin/reference-ranges/${rangeId}`, { method: 'PATCH', body: updates }),
    removeReferenceRange: (rangeId) => request(`/api/admin/reference-ranges/${rangeId}`, { method: 'DELETE' }),
  },
  technologist: {
    workQueue: () => request('/api/technologist/work-queue'),
    specimens: (filters) => request(`/api/technologist/specimens${queryString(filters)}`),
    receiveSpecimen: (specimenId) => request(`/api/technologist/specimens/${specimenId}/receive`, { method: 'POST', body: {} }),
    acceptSpecimen: (specimenId) => request(`/api/technologist/specimens/${specimenId}/accept`, { method: 'POST', body: {} }),
    rejectSpecimen: (specimenId, reason) => request(`/api/technologist/specimens/${specimenId}/reject`, { method: 'POST', body: { reason } }),
    saveDraft: (requestId, itemId, values) => request(`/api/technologist/requests/${requestId}/items/${itemId}/draft`, { method: 'POST', body: values }),
    submitResults: (requestId) => request(`/api/technologist/requests/${requestId}/submit-results`, { method: 'POST', body: {} }),
  },
  pathologist: {
    pending: (filters) => request(`/api/pathologist/pending${queryString(filters)}`),
    returned: (filters) => request(`/api/pathologist/returned${queryString(filters)}`),
    released: (filters) => request(`/api/pathologist/released${queryString(filters)}`),
    review: (requestId, decisions) => request(`/api/pathologist/requests/${requestId}/review`, { method: 'POST', body: { decisions } }),
  },
  patient: {
    results: (filters) => request(`/api/patient/results${queryString(filters)}`),
    testHistory: (filters) => request(`/api/patient/test-history${queryString(filters)}`),
  },
}

// Re-fetch the authenticated clinic catalog when an administrator changes it.
// The server only emits the event to the clinic from the signed-in session.
let clinicSocket
const clinicListeners = new Set()
const catalogListeners = new Set()
let clinicRefreshTimer

function notifyClinicListeners() {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
  ;[...clinicListeners, ...catalogListeners].forEach((listener) => listener())
}

function startClinicRefresh() {
  if (!clinicRefreshTimer) clinicRefreshTimer = window.setInterval(notifyClinicListeners, 10_000)
}

function stopClinicRefreshIfUnused() {
  if (clinicListeners.size || catalogListeners.size) return
  if (clinicRefreshTimer) window.clearInterval(clinicRefreshTimer)
  clinicRefreshTimer = undefined
  clinicSocket?.disconnect()
  clinicSocket = undefined
}

function ensureClinicSocket() {
  if (!clinicSocket) clinicSocket = io(new URL(API_BASE_URL).origin, { withCredentials: true })
  return clinicSocket
}

export function subscribeToClinicChanges(onChange) {
  clinicListeners.add(onChange)
  startClinicRefresh()
  const socket = ensureClinicSocket()
  socket.on('clinic:changed', onChange)
  return () => {
    clinicListeners.delete(onChange)
    socket.off('clinic:changed', onChange)
    stopClinicRefreshIfUnused()
  }
}

export function subscribeToCatalogChanges(onChange) {
  catalogListeners.add(onChange)
  startClinicRefresh()
  const socket = ensureClinicSocket()
  socket.on('catalog:changed', onChange)
  return () => {
    catalogListeners.delete(onChange)
    socket.off('catalog:changed', onChange)
    stopClinicRefreshIfUnused()
  }
}
