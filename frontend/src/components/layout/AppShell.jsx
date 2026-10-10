import './AppShell.css'
import { useEffect, useRef, useState } from 'react'
import Topbar from './Topbar.jsx'
import Sidebar from './Sidebar.jsx'

export default function AppShell({ children, role = 'patient', activeItem }) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
  const topbarMenuButtonRef = useRef(null)
  const sidebarCloseButtonRef = useRef(null)
  const wasMobileNavOpen = useRef(false)

  useEffect(() => {
    if (!isMobileNavOpen) {
      document.body.style.overflow = ''
      return undefined
    }

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setIsMobileNavOpen(false)
      }
    }

    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', closeOnEscape)

    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [isMobileNavOpen])

  useEffect(() => {
    if (isMobileNavOpen) {
      wasMobileNavOpen.current = true
      const focusFrame = requestAnimationFrame(() => {
        sidebarCloseButtonRef.current?.focus()
      })

      return () => cancelAnimationFrame(focusFrame)
    }

    if (wasMobileNavOpen.current) {
      wasMobileNavOpen.current = false
      topbarMenuButtonRef.current?.focus()
    }

    return undefined
  }, [isMobileNavOpen])

  return (
    <div className="app-shell">
      <Topbar
        role={role}
        isMobileNavOpen={isMobileNavOpen}
        onMobileNavToggle={() => setIsMobileNavOpen((open) => !open)}
        menuButtonRef={topbarMenuButtonRef}
      />
      <Sidebar
        role={role}
        activeItem={activeItem}
        isMobileNavOpen={isMobileNavOpen}
        onMobileNavClose={() => setIsMobileNavOpen(false)}
        closeButtonRef={sidebarCloseButtonRef}
      />
      <main className="app-shell__main">{children}</main>
    </div>
  )
}
