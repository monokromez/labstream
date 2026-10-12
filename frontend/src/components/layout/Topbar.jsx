import './Topbar.css'
import sidepanelIcon from '../../assets/open_sidepanel.svg'

export default function Topbar({ isSidebarOpen, onToggleSidebar }) {
  return (
    <header className="app-topbar">
      <div className="app-topbar__brand">
        <button
          className="app-topbar__icon-button app-topbar__sidebar-toggle"
          type="button"
          aria-label={isSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          aria-expanded={isSidebarOpen}
          onClick={onToggleSidebar}
        >
          <span
            className="app-topbar__icon app-topbar__icon--sidepanel"
            style={{ '--sidepanel-icon': `url("${sidepanelIcon}")` }}
            aria-hidden="true"
          />
        </button>
        <div className="app-topbar__logo">
        <h1>Labstream</h1>
        </div>
      </div>
      <div className="app-topbar__user">
        <span>Welcome, User!</span>
        <button className="app-topbar__icon-button" type="button" aria-label="Open account menu" title="Account">
          <span className="app-topbar__icon app-topbar__icon--account" aria-hidden="true" />
        </button>
        <button className="app-topbar__icon-button" type="button" aria-label="Log out" title="Log out">
          <span className="app-topbar__icon app-topbar__icon--logout" aria-hidden="true" />
        </button>
      </div>
    </header>
  )
}
