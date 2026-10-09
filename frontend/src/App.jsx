import AppShell from './components/layout/AppShell.jsx'
import PatientPortal from './pages/PatientPortal.jsx'
import { useEffect, useState } from 'react'

export default function App() {
  const [currentHash, setCurrentHash] = useState(window.location.hash || '#/all')

  useEffect(() => {
    if (!window.location.hash) {
      window.history.replaceState(null, '', '#/all')
    }

    const handleHashChange = () => setCurrentHash(window.location.hash || '#/all')
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  return (
    <AppShell activeItem={currentHash}>
      <PatientPortal currentHash={currentHash} />
    </AppShell>
  )
}
