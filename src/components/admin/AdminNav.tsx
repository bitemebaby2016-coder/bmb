// ============================================
// Bite Me Baby — Admin navigation bar (PHASE 6 UI/admin completion)
// Persistent horizontal nav shown on every /admin page so an admin can
// always move between sections without relying on the browser Back button.
// ============================================

import { Link, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { ADMIN_NAV_ITEMS } from '@/lib/adminUi'

export function AdminNav({ children }: { children?: ReactNode }) {
  const location = useLocation()

  return (
    <>
    <nav
      aria-label="Admin navigation"
      className="sticky top-0 z-40 bg-brand-surface border-b border-brand-border shadow-sm no-print"
    >
      <div className="flex items-center gap-1 px-2 py-2 overflow-x-auto whitespace-nowrap">
        <span className="text-sm font-bold text-brand-accent mr-1 hidden md:inline">🛠️</span>
        {ADMIN_NAV_ITEMS.map((item) => {
          const isActive =
            location.pathname === item.to ||
            (item.to === '/admin' && location.pathname === '/admin') ||
            (item.to !== '/admin' && location.pathname.startsWith(item.to))
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isActive ? 'text-brand-primary bg-brand-bg' : 'text-brand-muted hover:text-brand-primary hover:bg-brand-bg/60'
              }`}
            >
              <span aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          )
        })}
        <Link to="/" className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-brand-muted hover:text-brand-primary">
          <span aria-hidden="true">🏪</span>
          <span>หน้าลูกค้า</span>
        </Link>
      </div>
    </nav>
    {children}
    </>
  )
}