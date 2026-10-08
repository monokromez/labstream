import './Topbar.css'

export default function Topbar() {
  return (
    <header className="app-topbar">
      <div className="app-topbar__logo">
        <h1>Labstream</h1>
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
