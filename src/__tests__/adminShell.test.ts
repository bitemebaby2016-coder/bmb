// Bite Me Baby — Admin shell structure tests (single nav set discipline).
// Component rendering isn't available in this project's test setup, so these
// assert the STRUCTURAL source contract the same way seo.test.ts asserts
// index.html (via Vite `?raw` imports) — locking the root-cause fixes:
// BottomNav route-gated off /admin, AdminNav = sidebar/drawer (no horizontal
// icon bar), Header customer menus hidden in admin, Dashboard = 3 zones.

import { describe, it, expect } from 'vitest'
import layoutSrc from '../components/layout/Layout.tsx?raw'
import headerSrc from '../components/layout/Header.tsx?raw'
import adminNavSrc from '../components/admin/AdminNav.tsx?raw'
import dashboardSrc from '../pages/admin/AdminDashboard.tsx?raw'

describe('admin shell — one navigation set (root-cause structure)', () => {
  it('Layout routes-gates BottomNav off /admin (structural, not CSS hiding)', () => {
    expect(layoutSrc).toContain("location.pathname.startsWith('/admin')")
    expect(layoutSrc).toContain('showBottomNav')
    expect(layoutSrc).toMatch(/\{showBottomNav && <BottomNav \/>/)
    expect(layoutSrc).not.toMatch(/\{!hideBottomNav && <BottomNav \/>/)
  })

  it('AdminNav is the sidebar shell: grouped rail + mobile drawer, no horizontal bar', () => {
    expect(adminNavSrc).toContain('ADMIN_NAV_GROUPS')
    expect(adminNavSrc).toContain('data-testid="admin-sidebar"')
    expect(adminNavSrc).toContain('data-testid="admin-drawer"')
    expect(adminNavSrc).toContain('aria-expanded')
    expect(adminNavSrc).toContain('aria-current')
    // the old duplicated sticky icon bar under the Header
    expect(adminNavSrc).not.toContain('overflow-x-auto')
    expect(adminNavSrc).not.toContain('ADMIN_NAV_ITEMS')
  })

  it('Header hides customer nav + hamburger inside the admin area', () => {
    expect(headerSrc).toContain("location.pathname.startsWith('/admin')")
    expect(headerSrc).toContain('{!isAdminArea && (')
    expect(headerSrc).toContain('(mobileMenuOpen && !isAdminArea)')
  })

  it('customer BottomNav component itself is untouched (customer area keeps its bar)', async () => {
    const bottomNavSrc = (await import('../components/layout/BottomNav.tsx?raw')).default
    expect(bottomNavSrc).toContain('fixed bottom-0')
    expect(bottomNavSrc).toContain("path: '/'")
    expect(bottomNavSrc).toContain("path: '/menu'")
  })
})

describe('AdminDashboard — 3 zones, real data, no dead links', () => {
  it('KPI zone reads real aggregated data with loading + error + retry states', () => {
    expect(dashboardSrc).toContain('getDashboardStats')
    expect(dashboardSrc).toContain('admin-kpi-loading')
    expect(dashboardSrc).toContain('admin-kpi-error')
    expect(dashboardSrc).toContain('admin-kpi-retry')
    expect(dashboardSrc).toContain('admin-kpi-empty')
  })

  it('quick actions only link to existing /admin destinations (no KPI in the zone)', () => {
    const tos = [...dashboardSrc.matchAll(/to="([^"]+)"/g)].map((m) => m[1])
    expect(tos.length).toBeGreaterThan(0)
    for (const to of tos) expect(to).toMatch(/^\/admin(\/|$)/)
    // Zone B block must not render stats values (no KPI duplication)
    const zoneB = dashboardSrc.slice(dashboardSrc.indexOf('admin-actions-zone'))
    expect(zoneB).not.toContain('stats.')
  })

  it('operational zone is separate from KPI and actions', () => {
    expect(dashboardSrc).toContain('admin-ops-zone')
    expect(dashboardSrc).toContain('ops-pending-orders')
    expect(dashboardSrc).toContain('ops-low-stock')
  })
})