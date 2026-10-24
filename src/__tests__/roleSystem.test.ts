// ============================================
// Bite Me Baby — 2026-10-24 (Owner signed P1-P3 + missing/partial ทั้งหมด)
// ระบบ role 13 ค่าบน profiles.role เดิม (146/147) — client layer:
//   · isAdminCapableRole = ใครเข้า /admin ได้ (parity กับ AdminRoute + RLS)
//   · navGroupsForRole   = per-role nav hiding (presentation only)
//   · shouldShowAdminLink = ป้าย Admin ใน header
// ============================================

import { describe, expect, it } from 'vitest'
import {
  ADMIN_CAPABLE_ROLES,
  ADMIN_NAV_GROUPS,
  isAdminCapableRole,
  navGroupsForRole,
  shouldShowAdminLink,
} from '@/lib/adminUi'
import appSrc from '@/App.tsx?raw'
import adminNavSrc from '@/components/admin/AdminNav.tsx?raw'

describe('isAdminCapableRole — 11 admin-capable roles (rider/customer ไม่ผ่าน)', () => {
  it('accepts the signed-off role set exactly', () => {
    for (const r of ['owner', 'admin', 'staff', 'pos', 'kitchen', 'inventory', 'finance', 'marketing', 'support', 'auditor', 'developer']) {
      expect(isAdminCapableRole(r), r).toBe(true)
    }
    expect(ADMIN_CAPABLE_ROLES).toHaveLength(11)
  })

  it('rejects rider, customer, null, unknown', () => {
    expect(isAdminCapableRole('rider')).toBe(false)
    expect(isAdminCapableRole('customer')).toBe(false)
    expect(isAdminCapableRole(null)).toBe(false)
    expect(isAdminCapableRole(undefined)).toBe(false)
    expect(isAdminCapableRole('superuser')).toBe(false)
  })
})

describe('shouldShowAdminLink — header parity กับ AdminRoute', () => {
  it('matches isAdminCapableRole for every role (13 ค่า)', () => {
    for (const r of ['owner', 'admin', 'staff', 'pos', 'kitchen', 'inventory', 'finance', 'marketing', 'support', 'auditor', 'developer', 'rider', 'customer']) {
      expect(shouldShowAdminLink(r), r).toBe(isAdminCapableRole(r))
    }
    expect(shouldShowAdminLink('admin', 'someone@x.com')).toBe(true)
    expect(shouldShowAdminLink('customer', 'admin@bmb.co.th')).toBe(false) // email fallback ถูกถอดแล้ว
  })
})

describe('navGroupsForRole — per-role nav hiding (Owner P1)', () => {
  const tos = (role: string) => navGroupsForRole(role).flatMap((g) => g.items).map((i) => i.to)

  it('owner/admin/staff/auditor/developer = ทุกเมนู (read/admin parity)', () => {
    const full = ADMIN_NAV_GROUPS.flatMap((g) => g.items).map((i) => i.to)
    for (const r of ['owner', 'admin', 'staff', 'auditor', 'developer']) {
      expect(tos(r), r).toEqual(full)
    }
  })

  it('kitchen = เห็นเฉพาะงานครัว (ไม่มี reports/settings/tenants)', () => {
    const list = tos('kitchen')
    expect(list).toContain('/admin/kitchen')
    expect(list).toContain('/admin/recipes')
    expect(list).not.toContain('/admin/reports')
    expect(list).not.toContain('/admin/settings')
    expect(list).not.toContain('/admin/tenants')
  })

  it('inventory = inventory+products · finance = reports+orders+pos · marketing = การตลาดทั้งกลุ่ม', () => {
    expect(tos('inventory')).toEqual(expect.arrayContaining(['/admin', '/admin/inventory', '/admin/products']))
    expect(tos('inventory')).not.toContain('/admin/reports')
    expect(tos('finance')).toEqual(expect.arrayContaining(['/admin/reports', '/admin/orders', '/admin/pos']))
    expect(tos('finance')).not.toContain('/admin/inventory')
    expect(tos('marketing')).toEqual(expect.arrayContaining(['/admin/marketing', '/admin/promotions', '/admin/media']))
    expect(tos('marketing')).not.toContain('/admin/orders')
  })

  it('pos = งานหน้าร้าน · support = อ่านออเดอร์/ลูกค้า/แจ้งเตือน', () => {
    expect(tos('pos')).toEqual(expect.arrayContaining(['/admin/pos', '/admin/orders']))
    expect(tos('pos')).not.toContain('/admin/settings')
    expect(tos('support')).toEqual(expect.arrayContaining(['/admin/orders', '/admin/customers', '/admin/notifications']))
    expect(tos('support')).not.toContain('/admin/promotions')
  })

  it('ทุก role ยังเห็น dashboard (/admin) เมื่อผ่าน gate', () => {
    for (const r of ['pos', 'kitchen', 'inventory', 'finance', 'marketing', 'support']) {
      expect(tos(r), r).toContain('/admin')
    }
  })
})

describe('AdminRoute + AdminNav source contract', () => {
  it('AdminRoute gates ด้วย isAdminCapableRole (ไม่ใช่ equality 2 ค่าเดิม) + sync role เข้า store', () => {
    expect(appSrc).toContain('if (!isAdminCapableRole(role)) return <Navigate to="/" replace />')
    expect(appSrc).not.toContain(`role !== 'admin' && role !== 'staff'`)
    expect(appSrc).toContain('setStoreRole(r)')
  })

  it('AdminNav กรองเมนูด้วย navGroupsForRole(role จาก store)', () => {
    expect(adminNavSrc).toContain('navGroupsForRole(role)')
    expect(adminNavSrc).toContain(`useAuthStore((s) => s.role)`)
    expect(adminNavSrc).not.toContain('ADMIN_NAV_GROUPS.map((group)')
  })
})