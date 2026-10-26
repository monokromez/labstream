import { useEffect, useState } from 'react'
import AppShell from './components/layout/AppShell.jsx'
import Login from './pages/Login.jsx'
import { apiRequest, signOut } from './lib/api.js'

export default function App() {
  const [user, setUser] = useState(null)
  const [isCheckingSession, setIsCheckingSession] = useState(true)

  useEffect(() => {
    let active = true
    const handleSessionExpired = () => {
      if (active) setUser(null)
    }
    window.addEventListener('labstream:session-expired', handleSessionExpired)
    apiRequest('/api/auth/me')
      .then(({ user: currentUser }) => { if (active) setUser(currentUser) })
      .catch(() => {})
      .finally(() => { if (active) setIsCheckingSession(false) })

    return () => {
      active = false
      window.removeEventListener('labstream:session-expired', handleSessionExpired)
    }
  }, [])

  if (isCheckingSession) return <main className="app-loading" role="status">Checking your session…</main>
  if (!user) return <Login onAuthenticated={setUser} />

<<<<<<< HEAD
  return (
    <AppShell
      role={user.role}
      userName={user.email}
      onSignOut={() => {
        setUser(null)
        signOut().catch(() => {})
      }}
    />
  )
=======
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
>>>>>>> parent of c6490db (feat: add structured results and workflow improvements)
}
