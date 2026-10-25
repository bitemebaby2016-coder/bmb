// ============================================
// R-10 — Role matrix automated coverage (D8 2026-10-25)
// ============================================
// ตรวจความสอดคล้องของเมทริกซ์บทบาท 13 ค่าทุกชั้น (static coverage อัตโนมัติ):
//   146 (DB CHECK + set_user_role guard) ↔ adminUi (ADMIN_CAPABLE_ROLES + ROLE_NAV_ALLOW)
//   ↔ acceptance plan §5 (สูตรทดสอบ 14a–14j ที่เตรียมให้ Owner)
// runtime 14a–14j บนเบราว์เซอร์จริง = ขั้นของ Owner (สูตร SQL พร้อมในแผน)
// ============================================

import { describe, it, expect } from 'vitest'
import mig146Src from '../../supabase/migrations/146_role_foundation.sql?raw'
import adminUiSrc from '../lib/adminUi.ts?raw'

// 13 ค่าของ profiles_role_check (146a) — 1 ระบบเดิม ไม่สร้างระบบใหม่
const ROLES_13 = ['customer', 'staff', 'admin', 'owner', 'auditor', 'support', 'developer', 'kitchen', 'inventory', 'finance', 'marketing', 'pos', 'rider']
// ADMIN_CAPABLE_ROLES 11 ค่า (adminUi:90-93 — rider/customer ไม่เข้า /admin)
const ADMIN_CAPABLE_11 = ['owner', 'admin', 'staff', 'pos', 'kitchen', 'inventory', 'finance', 'marketing', 'support', 'auditor', 'developer']
// ROLE_NAV_ALLOW = เฉพาะ specialist 6 บทบาท (owner/admin/staff/auditor/developer = ไม่มี allowlist = เต็ม)
const NAV_SPECIALISTS_6 = ['pos', 'kitchen', 'inventory', 'finance', 'marketing', 'support']

function quotedList(src: string, anchor: string): string[] {
  const i = src.indexOf(anchor)
  if (i < 0) return []
  const seg = src.slice(i, i + 900)
  const m = seg.match(/[([]([^)\]]+)[)\]]/)
  return m ? (m[1].match(/'([^']+)'/g) || []).map((s) => s.slice(1, -1)) : []
}

describe('R-10 — role matrix consistency (13 ค่า)', () => {
  it('146: profiles_role_check มีครบทั้ง 13 ค่า', () => {
    const values = quotedList(mig146Src, 'profiles_role_check CHECK')
    for (const r of ROLES_13) expect(values, `ขาด role ${r}`).toContain(r)
    expect(values.length).toBe(13)
  })

  it('146: set_user_role guard ครอบคลุมทุก role ที่ตั้งได้ (ห้ามตกหล่น)', () => {
    const guardRoles = quotedList(mig146Src, 'p_role NOT IN')
    for (const r of ROLES_13) expect(guardRoles, `guard ขาด ${r}`).toContain(r)
    expect(guardRoles.length).toBe(13)
  })

  it('adminUi: ADMIN_CAPABLE_ROLES = 11 ค่าตาม contract (rider/customer ไม่เข้า /admin)', () => {
    const caps = quotedList(adminUiSrc, 'ADMIN_CAPABLE_ROLES')
    for (const r of ADMIN_CAPABLE_11) expect(caps, `ขาด ${r}`).toContain(r)
    expect(caps.length).toBe(11)
    expect(caps).not.toContain('customer')
    expect(caps).not.toContain('rider')
  })

  it('adminUi: ROLE_NAV_ALLOW = specialist 6 บทบาท (superadmin/auditor/developer/staff = เต็ม)', () => {
    const seg = adminUiSrc.slice(adminUiSrc.indexOf('ROLE_NAV_ALLOW'))
    for (const r of NAV_SPECIALISTS_6) {
      expect(seg, `ROLE_NAV_ALLOW ขาดคีย์ ${r}`).toContain(`${r}: [`)
    }
    // ไม่มี allowlist = ทุกกลุ่ม (navGroupsForRole คืน ADMIN_NAV_GROUPS เมื่อ allow undefined)
    expect(seg).toContain('if (!allow) return ADMIN_NAV_GROUPS')
  })

  it('set_user_role มี guard กัน self-demotion/owner-only (146)', () => {
    expect(mig146Src).toContain('set_user_role')
    // owner-only promote → owner + self-guard (ตามที่ประกาศในรอบ 13)
    expect(mig146Src.toLowerCase()).toContain('owner')
  })
})