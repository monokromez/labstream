import './Topbar.css'

export default function Topbar({
  role = 'patient',
  patientName = 'Juan',
  isMobileNavOpen = false,
  onMobileNavToggle,
  menuButtonRef,
}) {
  const isPatient = role === 'patient'

  return (
    <header className="app-topbar">
      <div className="app-topbar__brand">
        <button
          className={`app-topbar__menu-button${isMobileNavOpen ? ' app-topbar__menu-button--open' : ''}`}
          type="button"
          aria-expanded={isMobileNavOpen}
          aria-controls="app-navigation"
          aria-label={isMobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
          onClick={onMobileNavToggle}
          ref={menuButtonRef}
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>
        <div className="app-topbar__logo">
          <h1>Labstream</h1>
        </div>
      </div>
      <div className="app-topbar__user">
        <span>Welcome, {isPatient ? patientName : 'User'}!</span>
        {!isPatient && (
          <button className="app-topbar__icon-button" type="button" aria-label="Open account menu" title="Account">
            <span className="app-topbar__icon app-topbar__icon--account" aria-hidden="true" />
          </button>
        )}
        <button className="app-topbar__icon-button" type="button" aria-label="Log out" title="Log out">
          <span className="app-topbar__icon app-topbar__icon--logout" aria-hidden="true" />
        </button>
      </div>
    </header>
  )
}
