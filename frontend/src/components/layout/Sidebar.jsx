import { useState } from 'react'
import './Sidebar.css'
import auditLogIcon from '../../assets/audit_log-icon.svg'
import dashboardIcon from '../../assets/dashboard-icon.svg'
import myResultsIcon from '../../assets/my_results-icon.svg'
import paymentReceiptIcon from '../../assets/payment_receipt-icon.svg'
import pendingValidationIcon from '../../assets/pending_validation-icon.svg'
import queueIcon from '../../assets/queue-icon.svg'
import refRangeIcon from '../../assets/ref_range-icon.svg'
import registerRequestIcon from '../../assets/register_new_request-icon.svg'
import releasedResultIcon from '../../assets/released_result-icon.svg'
import reportsIcon from '../../assets/reports-icon.svg'
import resultInProgressIcon from '../../assets/result_inprogress-icon.svg'
import returnedResultIcon from '../../assets/returned_result-icon.svg'
import specimenIcon from '../../assets/specimen-icon.svg'
import staffAccountsIcon from '../../assets/staff_accounts-icon.svg'
import testCatalogIcon from '../../assets/test_catalog-icon.svg'
import testHistoryIcon from '../../assets/test_history-icon.svg'
import workQueueIcon from '../../assets/work_queue-icon.svg'

const roleLabels = {
  cashier: 'Cashier',
  medical_technologist: 'Medical Technologist',
  pathologist: 'Pathologist',
  administrator: 'Administrator',
  patient: 'Patient',
}

const roleNavigation = {
  cashier: [
    { id: 'dashboard', label: 'Dashboard', icon: dashboardIcon },
    { id: 'register-request', label: 'Register New Request', icon: registerRequestIcon },
    { id: 'queue', label: 'Queue', icon: queueIcon },
    { id: 'payments', label: 'Payments & Receipts', icon: paymentReceiptIcon },
  ],
  medical_technologist: [
    { id: 'work-queue', label: 'Work Queue', icon: workQueueIcon },
    { id: 'specimens', label: 'Specimens', icon: specimenIcon },
    { id: 'results-in-progress', label: 'Results in Progress', icon: resultInProgressIcon },
  ],
  pathologist: [
    { id: 'pending-validation', label: 'Pending Validation', icon: pendingValidationIcon },
    { id: 'returned-results', label: 'Returned Results', icon: returnedResultIcon },
    { id: 'released-results', label: 'Released Results', icon: releasedResultIcon },
  ],
  administrator: [
    { id: 'dashboard', label: 'Dashboard', icon: dashboardIcon },
    { id: 'staff-accounts', label: 'Staff Accounts', icon: staffAccountsIcon },
    { id: 'test-catalog', label: 'Test Catalog', icon: testCatalogIcon },
    { id: 'reference-ranges', label: 'Reference Ranges', icon: refRangeIcon },
    { id: 'reports', label: 'Reports', icon: reportsIcon },
    { id: 'audit-log', label: 'Audit Log', icon: auditLogIcon },
  ],
  patient: [
    { id: 'my-results', label: 'My Results', icon: myResultsIcon },
    { id: 'test-history', label: 'Test History', icon: testHistoryIcon },
  ],
}

export default function Sidebar({ role = 'cashier', activeItem }) {
  const [selectedItem, setSelectedItem] = useState(activeItem)
  const currentRole = roleNavigation[role] ? role : 'cashier'
  const navigationItems = roleNavigation[currentRole]
  const currentRoleLabel = roleLabels[currentRole]
  const selected = selectedItem ?? navigationItems[0].id

  return (
    <aside className="app-sidebar">
      <div className="app-sidebar__heading">
        <span className="app-sidebar__eyebrow">WORKSPACE</span>
        <span className="app-sidebar__role">{currentRoleLabel}</span>
      </div>

      <nav className="app-sidebar__nav" aria-label={`${currentRoleLabel} navigation`}>
        {navigationItems.map((item) => (
          <a
            key={item.id}
            className="app-sidebar__link"
            href={`#${item.id}`}
            aria-current={selected === item.id ? 'page' : undefined}
            onClick={() => setSelectedItem(item.id)}
          >
            <span
              className="app-sidebar__icon"
              style={{ '--sidebar-icon': `url("${item.icon}")` }}
              aria-hidden="true"
            />
            <span>{item.label}</span>
          </a>
        ))}
      </nav>
    </aside>
  )
}
