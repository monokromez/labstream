import { useEffect, useRef, useState } from 'react'
import './AppShell.css'
import Sidebar, { getRoleNavigation } from './Sidebar.jsx'
import PageHeader from './PageHeader.jsx'
import * as CashierPages from '../../pages/cashier/index.js'
import * as TechnologistPages from '../../pages/medical-technologist/index.js'
import * as PathologistPages from '../../pages/pathologist/index.js'
import * as AdministratorPages from '../../pages/administrator/index.js'
import * as PatientPages from '../../pages/patient/index.js'
import { TechnologistProvider } from '../../pages/medical-technologist/TechnologistContext.jsx'

export default function AppShell({ children, role = 'administrator', userId, userName = 'User', activeItem, onLogout }) {
  const navigationItems = getRoleNavigation(role)
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia('(max-width: 760px)').matches,
  )
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const menuButtonRef = useRef(null)
  const closeButtonRef = useRef(null)
  const wasMenuOpen = useRef(false)
  const [selectedItem, setSelectedItem] = useState(
    activeItem ?? navigationItems[0].id,
  )

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 760px)')
    const handleViewportChange = (event) => {
      setIsMobile(event.matches)
      if (!event.matches) setMobileMenuOpen(false)
    }
    mediaQuery.addEventListener('change', handleViewportChange)
    return () => mediaQuery.removeEventListener('change', handleViewportChange)
  }, [])

  useEffect(() => {
    if (!isMobile) return
    if (mobileMenuOpen) closeButtonRef.current?.focus()
    else if (wasMenuOpen.current) menuButtonRef.current?.focus()
    wasMenuOpen.current = mobileMenuOpen
  }, [isMobile, mobileMenuOpen])

  useEffect(() => {
    if (!isMobile || !mobileMenuOpen) return undefined
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setMobileMenuOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [isMobile, mobileMenuOpen])

  const cashierPages = {
    dashboard: <CashierPages.CashierDashboard />,
    'register-request': <CashierPages.RegisterRequest />,
    queue: <CashierPages.CashierQueue />,
    payments: <CashierPages.PaymentsReceipts />,
  }

  const technologistPages = {
    'work-queue': <TechnologistPages.WorkQueue />,
    specimens: <TechnologistPages.Specimens />,
    'results-in-progress': <TechnologistPages.ResultsInProgress />,
  }

  const pathologistPages = {
    'pending-validation': <PathologistPages.PendingValidation />,
    'returned-results': <PathologistPages.ReturnedResults />,
    'released-results': <PathologistPages.ReleasedResults />,
  }

  const adminPages = {
    dashboard: <AdministratorPages.AdminDashboard />,
    'staff-accounts': <AdministratorPages.StaffAccounts currentUserId={userId} />,
    'test-catalog': <AdministratorPages.TestCatalog />,
    'reference-ranges': <AdministratorPages.ReferenceRanges />,
    reports: <AdministratorPages.Reports />,
    'audit-log': <AdministratorPages.AuditLog />,
  }

  const patientPages = {
    overview: <PatientPages.PatientOverview onNavigate={setSelectedItem} />,
    'my-results': <PatientPages.MyResults />,
    'test-history': <PatientPages.TestHistory />,
  }

  const pagesByRole = {
    cashier: cashierPages,
    medical_technologist: technologistPages,
    pathologist: pathologistPages,
    administrator: adminPages,
    patient: patientPages,
  }

  const pagesForRole = pagesByRole[role] ?? {}

  const currentItem = navigationItems.find((item) => item.id === selectedItem)
    ?? navigationItems[0]
  const currentPage = pagesForRole[currentItem.id] ?? children ?? (
    <p>This page has not been connected yet.</p>
  )

  return (
    <div className="app-shell">
      <header className="app-shell__mobile-header">
        <span className="app-shell__mobile-brand">Labstream</span>
        <button
          ref={menuButtonRef}
          className="app-shell__menu-toggle"
          type="button"
          aria-label="Open navigation menu"
          aria-expanded={mobileMenuOpen}
          aria-controls="app-navigation"
          onClick={() => setMobileMenuOpen(true)}
        >
          <span />
          <span />
          <span />
        </button>
      </header>
      <Sidebar
        role={role}
        userName={userName}
        activeItem={currentItem.id}
        isMobile={isMobile}
        mobileMenuOpen={mobileMenuOpen}
        closeButtonRef={closeButtonRef}
        onClose={() => setMobileMenuOpen(false)}
        onSelect={(itemId) => {
          setSelectedItem(itemId)
          setMobileMenuOpen(false)
        }}
        onLogout={onLogout}
      />
      <main className="app-shell__main">
        <PageHeader 
          title={currentItem.label}
          description={currentItem.description} />
        <hr className="app-shell__content-divider" />
        {role === 'medical_technologist'
          ? <TechnologistProvider onNavigate={setSelectedItem}>{currentPage}</TechnologistProvider>
          : currentPage}
      </main>
    </div>
  )
}
