import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { Toaster } from '@/components/ui/sonner'

export function Layout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Top title bar - aligned with macOS traffic lights */}
      <Header 
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      
      {/* Main content area - no gap with header */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar collapsed={sidebarCollapsed} />
        
        {/* Content area - each page controls its own layout */}
        <div className="flex-1 pr-3 pb-3 overflow-hidden">
          <Outlet />
        </div>
      </div>
      
      {/* Toast notifications */}
      <Toaster position="top-right" />
    </div>
  )
}
