const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers)
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers, credentials: 'include' })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new Error('Could not connect to the Labstream API. Check that the backend is running.')
  }

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    if (response.status === 401) {
      window.dispatchEvent(new CustomEvent('labstream:session-expired'))
    }
    throw new Error(payload.error || 'The request could not be completed.')
  }
  return payload
}

export async function signIn(credentials) {
  const result = await apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  })
  return result.user
}

export function signOut() {
  return apiRequest('/api/auth/logout', { method: 'POST' })
}
