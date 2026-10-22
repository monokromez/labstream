import { useState } from 'react'
import './AppShell.css'
import Sidebar, { getRoleNavigation } from './Sidebar.jsx'
import PageHeader from './PageHeader.jsx'
import * as CashierPages from '../../pages/cashier/index.js'
import * as TechnologistPages from '../../pages/medical-technologist/index.js'
import * as PathologistPages from '../../pages/pathologist/index.js'
import * as AdministratorPages from '../../pages/administrator/index.js'
import * as PatientPages from '../../pages/patient/index.js'

export default function AppShell({ children, role = 'administrator', userName = 'User', activeItem, onLogout }) {
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
    'staff-accounts': <AdministratorPages.StaffAccounts />,
    'test-catalog': <AdministratorPages.TestCatalog />,
    'reference-ranges': <AdministratorPages.ReferenceRanges />,
    reports: <AdministratorPages.Reports />,
    'audit-log': <AdministratorPages.AuditLog />,
  }

  const patientPages = {
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

  const navigationItems = getRoleNavigation(role)
  const [selectedItem, setSelectedItem] = useState(
    activeItem ?? navigationItems[0].id,
  )
  const currentItem = navigationItems.find((item) => item.id === selectedItem)
    ?? navigationItems[0]

  return (
    <div className="app-shell">
      <Sidebar
        role={role}
        userName={userName}
        activeItem={currentItem.id}
        onSelect={setSelectedItem}
        onLogout={onLogout}
      />
      <main className="app-shell__main">
        <PageHeader 
          title={currentItem.label}
          description={currentItem.description} />
        <hr className="app-shell__content-divider" />
        {pagesForRole[currentItem.id] ?? children ?? (
          <p>This page has not been connected yet.</p>
        )}
      </main>
    </div>
  )
}
