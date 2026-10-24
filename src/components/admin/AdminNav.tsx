// ============================================
// Bite Me Baby — Admin navigation SHELL (single nav set)
// Desktop: grouped left Sidebar (collapsible, sticky, active state)
// Mobile:  drawer opened from a thin trigger bar (no second menu list)
// Replaces the old horizontal icon bar — same <AdminNav> wrapper API, so
// every /admin route in App.tsx keeps working unchanged.
// ============================================

import { Link, useLocation } from 'react-router-dom'
import { useEffect, useState, type ReactNode } from 'react'
import { ADMIN_NAV_GROUPS, navGroupsForRole } from '@/lib/adminUi'
import { useAuthStore } from '@/store/authStore'
import { BranchSwitcher } from './BranchSwitcher'

const COLLAPSE_KEY = 'bmb-admin-nav-collapsed'

function isActivePath(pathname: string, to: string): boolean {
  if (to === '/admin') return pathname === '/admin'
  return pathname === to || pathname.startsWith(to + '/')
}

function NavItem({
  to,
  label,
  icon,
  collapsed,
  active,
  onNavigate,
}: {
  to: string
  label: string
  icon: string
  collapsed: boolean
  active: boolean
  onNavigate?: () => void
}) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-brand-primary ${
        active
          ? 'bg-brand-primary text-white shadow-sm'
          : 'text-brand-muted hover:text-brand-primary hover:bg-brand-bg'
      } ${collapsed ? 'justify-center px-2' : ''}`}
      data-testid="admin-nav-item"
    >
      <span aria-hidden="true" className="text-base">{icon}</span>
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  )
}
export function AdminNav({ children }: { children?: ReactNode }) {
  const location = useLocation()
  // 146: per-role nav hiding (presentation layer — RLS ยังเป็นประตูจริง)
  const role = useAuthStore((s) => s.role)
  const groups = navGroupsForRole(role)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1'
    } catch {
      return false
    }
  })

  // Close the mobile drawer on every navigation (single nav set discipline)
  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  // Escape closes the drawer (keyboard access)
  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawerOpen])

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
      } catch {
        // private mode — collapse state stays for this session only
      }
      return next
    })
  }

  const currentLabel =
    groups.flatMap((g) => g.items).find((i) => isActivePath(location.pathname, i.to))
      ?.label ?? 'Dashboard'

  const navList = (onNavigate?: () => void) => (
    <>
      <div className="px-2 pb-2 border-b border-brand-border">
        <BranchSwitcher />
      </div>
      <nav aria-label="Admin navigation" className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {groups.map((group) => (
          <div key={group.id}>
            {!collapsed && (
              <div className="px-3 mb-1 text-[10px] font-bold tracking-wider uppercase text-brand-muted/80">
                {group.label}
              </div>
            )}
            <ul className="space-y-1">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavItem
                    {...item}
                    collapsed={collapsed}
                    active={isActivePath(location.pathname, item.to)}
                    onNavigate={onNavigate}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="px-3 py-3 border-t border-brand-border">
        <Link
          to="/"
          className="flex items-center gap-2.5 text-sm font-medium text-brand-muted hover:text-brand-primary transition-colors"
        >
          <span aria-hidden="true">🏪</span>
          {!collapsed && <span>หน้าลูกค้า</span>}
        </Link>
      </div>
    </>
  )

  return (
    <div className="flex min-h-0" data-testid="admin-shell">
      {/* Desktop sidebar — the ONE primary nav in admin area */}
      <aside
        className={`hidden lg:flex flex-col sticky top-0 self-start h-screen bg-brand-surface border-r border-brand-border z-30 no-print transition-[width] duration-200 ${
          collapsed ? 'w-[72px]' : 'w-64'
        }`}
        data-testid="admin-sidebar"
      >
        <div className="flex items-center justify-between px-3 py-3 border-b border-brand-border">
          {!collapsed && (
            <span className="font-display font-bold text-brand-accent text-sm truncate">🛠️ Admin</span>
          )}
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'ขยายเมนูด้านข้าง' : 'ย่อเมนูด้านข้าง'}
            className="p-1.5 rounded-lg text-brand-muted hover:text-brand-primary hover:bg-brand-bg transition-colors focus-visible:outline-2 focus-visible:outline-brand-primary"
            data-testid="admin-sidebar-collapse"
          >
            <span aria-hidden="true">{collapsed ? '▶' : '◀'}</span>
          </button>
        </div>
        {navList()}
      </aside>

      {/* Mobile trigger bar — button + page title only (no menu list here) */}
      <div className="lg:hidden sticky top-0 z-30 w-full bg-brand-surface border-b border-brand-border no-print">
        <div className="flex items-center gap-3 px-3 py-2">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-expanded={drawerOpen}
            aria-controls="admin-drawer"
            aria-label="เปิดเมนูแอดมิน"
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-brand-bg text-brand-accent text-sm font-semibold hover:bg-brand-surface-warm transition-colors focus-visible:outline-2 focus-visible:outline-brand-primary"
            data-testid="admin-drawer-trigger"
          >
            <span aria-hidden="true">☰</span>
            <span>เมนู</span>
          </button>
          <span className="text-sm font-bold text-brand-accent truncate" data-testid="admin-page-title">
            {currentLabel}
          </span>
          <span className="ml-auto">
            <BranchSwitcher />
          </span>
        </div>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50" data-testid="admin-drawer">
          <button
            type="button"
            aria-label="ปิดเมนูแอดมิน"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-black/50"
            data-testid="admin-drawer-backdrop"
          />
          <div
            id="admin-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="เมนูแอดมิน"
            className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-brand-surface border-r border-brand-border flex flex-col shadow-2xl"
          >
            <div className="flex items-center justify-between px-3 py-3 border-b border-brand-border">
              <span className="font-display font-bold text-brand-accent">🛠️ Admin</span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="ปิดเมนูแอดมิน"
                className="p-1.5 rounded-lg text-brand-muted hover:text-brand-primary hover:bg-brand-bg transition-colors focus-visible:outline-2 focus-visible:outline-brand-primary"
                data-testid="admin-drawer-close"
              >
                ✕
              </button>
            </div>
            {navList(() => setDrawerOpen(false))}
          </div>
        </div>
      )}

      {/* Page content */}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
