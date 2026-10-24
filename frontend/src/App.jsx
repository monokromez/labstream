import { useEffect, useState } from 'react'
import AppShell from './components/layout/AppShell.jsx'
import { api } from './api/client.js'
import Login from './pages/Login.jsx'
import { clearLegacyPrototypeData } from './utils/clearLegacyPrototypeData.js'

clearLegacyPrototypeData()

export default function App() {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)
  const [mustChangePassword, setMustChangePassword] = useState(false)
  const [connectionMessage, setConnectionMessage] = useState('')

  useEffect(() => {
    let active = true
    api.auth.me()
      .then((session) => {
        if (!active) return
        setUser(session)
        setMustChangePassword(Boolean(session.mustChangePassword))
      })
      .catch((error) => {
        if (!active) return
        if (error.status !== 401) setConnectionMessage(error.message || 'The backend is not reachable.')
      })
      .finally(() => { if (active) setReady(true) })
    return () => { active = false }
  }, [])

  const handleAuthenticated = (authenticatedUser) => {
    setConnectionMessage('')
    setUser(authenticatedUser)
    setMustChangePassword(Boolean(authenticatedUser.mustChangePassword))
  }

  const handleLogout = async () => {
    try { await api.auth.logout() } finally {
      setUser(null)
      setMustChangePassword(false)
    }
  }

  if (!ready) return <main className="login-page"><p>Connecting to Labstream…</p></main>
  if (!user || mustChangePassword) return <>
    {connectionMessage && !user && <p className="login-page__connection-error" role="status">{connectionMessage}</p>}
    <Login onAuthenticated={handleAuthenticated} mustChangePassword={mustChangePassword} sessionUser={user} />
  </>

  return <AppShell role={user.role} userName={user.displayName ?? user.username ?? 'User'} onLogout={handleLogout} />
}
