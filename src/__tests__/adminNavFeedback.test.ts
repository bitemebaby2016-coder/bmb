// ============================================
// Bite Me Baby — 2026-10-24 (handoff task 3): admin menu + navigation feedback
// Acceptance encoded here (source contracts, mirrors repo convention):
//   - every visible nav item links to a REAL registered route (no dead links)
//   - legacy/bookmark admin paths still resolve (redirect routes registered)
//   - single-nav discipline: groups flatten to the master nav set
//   - permission-aware: every admin PAGE route is wrapped in AdminRoute
//   - feedback: Layout resets the scroll window to top on route change
// (desktop/mobile visual pass runs via playwright routeNav + Owner acceptance)
// ============================================

import { describe, expect, it } from 'vitest'
import { ADMIN_NAV_GROUPS, ADMIN_NAV_ITEMS } from '@/lib/adminUi'
import appSrc from '@/App.tsx?raw'
import layoutSrc from '@/components/layout/Layout.tsx?raw'

const navItems = ADMIN_NAV_GROUPS.flatMap((g) => g.items)

describe('Admin nav → real routes (every visible item links to a real page)', () => {
  it('groups flatten to exactly the master nav set (single nav set discipline)', () => {
    expect(navItems.map((i) => i.to).sort()).toEqual(ADMIN_NAV_ITEMS.map((i) => i.to).sort())
    expect(new Set(navItems.map((i) => i.to)).size).toBe(navItems.length)
  })

  it('every nav target is a registered route in App.tsx (no dead links)', () => {
    for (const item of navItems) {
      expect(appSrc, `route missing for ${item.to}`).toContain(`path="${item.to}"`)
    }
  })

  it('legacy/bookmark admin paths keep resolving via registered redirect routes', () => {
    const legacy = [
      '/admin/pre-orders',
      '/admin/payment-exceptions',
      '/admin/menu-schedule',
      '/admin/route-optimization',
      '/admin/print-settings',
      '/admin/mascot',
      '/admin/brands',
      // C5–C7 (audit Q3/Q4/Q5): เมนูที่ถูกยุบ — bookmark เก่าต้องไม่ตาย
      '/admin/content-approvals',
      '/admin/control',
      '/admin/ai-studio',
      '/admin/asset-audit',
    ]
    for (const p of legacy) {
      expect(appSrc, `redirect missing for ${p}`).toContain(`path="${p}"`)
    }
  })
})

describe('Permission-aware routing (AdminRoute gate)', () => {
  it('every admin PAGE route (Suspense-rendered) is wrapped in AdminRoute', () => {
    const lines = appSrc.split('\n')
    const pageRoutes = lines.filter((l) => l.includes('<Route path="/admin') && l.includes('<Suspense'))
    const gated = pageRoutes.filter((l) => l.includes('<AdminRoute>'))
    expect(pageRoutes.length).toBeGreaterThan(10)
    expect(gated.length, 'an admin page route is NOT gated by AdminRoute').toBe(pageRoutes.length)
  })

  it('AdminRoute admits only admin-capable roles (146: 11 ค่า — DB role ผ่าน RLS/SET CLAIMS)', () => {
    expect(appSrc).toContain('if (!isAdminCapableRole(role)) return <Navigate to="/" replace />')
    expect(appSrc).toContain('isAdminCapableRole')
  })
})

describe('Navigation feedback — scroll-top on route change (Layout)', () => {
  it('resets the scroll window to top whenever the pathname changes (jsdom-safe guard)', () => {
    // guard: Element.scrollTo บางสภาพแวดล้อม (jsdom) ไม่มี — fallback = scrollTop
    expect(layoutSrc).toContain("if (typeof el.scrollTo === 'function') el.scrollTo({ top: 0 })")
    expect(layoutSrc).toContain('else el.scrollTop = 0')
    expect(layoutSrc).toContain('}, [location.pathname])')
  })

  it('the scroll window is the Layout <main> container (admin pages render inside it)', () => {
    expect(layoutSrc).toContain('<main ref={mainRef}')
  })
})