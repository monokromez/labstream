import { useState } from 'react'
import './AppShell.css'
import Topbar from './Topbar.jsx'
import Sidebar, { getRoleNavigation } from './Sidebar.jsx'
import PageHeader from './PageHeader.jsx'

export default function AppShell({ children, role = 'pathologist', activeItem }) {
  const navigationItems = getRoleNavigation(role)
  const [selectedItem, setSelectedItem] = useState(
    activeItem ?? navigationItems[0].id,
  )
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const currentItem = navigationItems.find((item) => item.id === selectedItem)
    ?? navigationItems[0]

  return (
    <div className={`app-shell${isSidebarOpen ? '' : ' app-shell--sidebar-closed'}`}>
      <Topbar
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((isOpen) => !isOpen)}
      />
      <Sidebar
        role={role}
        activeItem={currentItem.id}
        onSelect={setSelectedItem}
      />
      <main className="app-shell__main">
        <PageHeader 
          title={currentItem.label}
          description={currentItem.description} />
        <hr className="app-shell__content-divider" />
        {children}
      </main>
    </div>
  )
}
