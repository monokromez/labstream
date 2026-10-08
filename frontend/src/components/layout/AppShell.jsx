import './AppShell.css'
import Topbar from './Topbar.jsx'
import Sidebar from './Sidebar.jsx'

export default function AppShell({ children, role = 'cashier', activeItem }) {
  return (
    <div className="app-shell">
      <Topbar />
      <Sidebar role={role} activeItem={activeItem} />
      <main className="app-shell__main">{children}</main>
    </div>
  )
}
