import './Sidebar.css'
import labstreamIcon from '../../assets/labstream-icon.png'
import logoutIcon from '../../assets/logout-icon.svg'
import auditLogIcon from '../../assets/audit_log-icon.svg'
import dashboardIcon from '../../assets/dashboard-icon.svg'
import logoutIcon from '../../assets/logout-icon.svg'
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
    {
      id: 'dashboard',
      label: 'Dashboard',
      description: 'Manage your activity, track metrics, and access key tools.',
      icon: dashboardIcon,
    },
    {
      id: 'register-request',
      label: 'Register Request',
      description: 'Register a new test request for a patient.',
      icon: registerRequestIcon,
    },
    {
      id: 'queue',
      label: 'Queue',
      description: 'View and manage pending requests.',
      icon: queueIcon,
    },
    {
      id: 'payments',
      label: 'Payments & Invoice',
      description: 'Manage patient payments and invoices.',
      icon: paymentReceiptIcon,
    },
  ],
  medical_technologist: [
    {
      id: 'work-queue',
      label: 'Work Queue',
      description: 'View and manage your assigned tasks.',
      icon: workQueueIcon,
    },
    {
      id: 'specimens',
      label: 'Specimens',
      description: 'Track expected and received specimens.',
      icon: specimenIcon,
    },
    {
      id: 'results-in-progress',
      label: 'Results in Progress',
      description: 'Draft results and send them to the pathologist.',
      icon: resultInProgressIcon,
    },
  ],
  pathologist: [
    {
      id: 'pending-validation',
      label: 'Pending Validation',
      description: 'View and manage test results that require validation.',
      icon: pendingValidationIcon,
    },
    {
      id: 'returned-results',
      label: 'Returned Results',
      description: 'View and manage test results that have been returned.',
      icon: returnedResultIcon,
    },
    {
      id: 'released-results',
      label: 'Released Results',
      description: 'View and manage test results that have been released.',
      icon: releasedResultIcon,
    },
  ],
  administrator: [
    {
      id: 'dashboard',
      label: 'Dashboard',
      description: 'Manage your activity, track metrics, and access key tools.',
      icon: dashboardIcon,
    },
    {
      id: 'staff-accounts',
      label: 'Staff Accounts',
      description: 'Manage staff accounts and permissions.',
      icon: staffAccountsIcon,
    },
    {
      id: 'test-catalog',
      label: 'Test Catalog',
      description: 'Manage the catalog of available tests.',
      icon: testCatalogIcon,
    },
    {
      id: 'reference-ranges',
      label: 'Reference Ranges',
      description: 'Manage reference ranges for test results.',
      icon: refRangeIcon,
    },
    {
      id: 'reports',
      label: 'Reports',
      description: 'Generate and view reports.',
      icon: reportsIcon,
    },
    {
      id: 'audit-log',
      label: 'Audit Log',
      description: 'View audit logs.',
      icon: auditLogIcon,
    },
  ],
  patient: [
    {
      id: 'my-results',
      label: 'My Results',
      description: 'View your test results.',
      icon: myResultsIcon,
    },
    {
      id: 'test-history',
      label: 'Test History',
      description: 'View your test history.',
      icon: testHistoryIcon,
    },
  ],
}

export function getRoleNavigation(role = 'cashier') {
  return roleNavigation[role] ?? roleNavigation.cashier
}

export default function Sidebar({ role = 'cashier', userName = 'User', activeItem, onSelect, onSignOut }) {
  const currentRole = roleNavigation[role] ? role : 'cashier'
  const navigationItems = getRoleNavigation(currentRole)
  const currentRoleLabel = roleLabels[currentRole]
  const selected = activeItem ?? navigationItems[0].id

  return (
    <aside className={`app-sidebar app-sidebar--${currentRole}`}>
      <a className="app-sidebar__brand" href="#dashboard" aria-label="Labstream home">
        <img className="app-sidebar__brand-icon" src={labstreamIcon} alt="" />
        <span>Labstream</span>
      </a>

      <div className="app-sidebar__heading">
        <span className="app-sidebar__eyebrow">{currentRoleLabel}</span>
        <span className="app-sidebar__user-name">{userName}</span>
      </div>

      <nav className="app-sidebar__nav" aria-label={`${currentRoleLabel} navigation`}>
        {navigationItems.map((item) => (
          <a
            key={item.id}
            className="app-sidebar__link"
            href={`#${item.id}`}
            aria-current={selected === item.id ? 'page' : undefined}
            onClick={(event) => {
              event.preventDefault()
              onSelect?.(item.id)
            }}
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

      {onSignOut && (
        <button className="app-sidebar__sign-out" type="button" onClick={onSignOut}>
          <img src={logoutIcon} alt="" aria-hidden="true" />
          <span>Sign out</span>
        </button>
      )}
    </aside>
  )
}
