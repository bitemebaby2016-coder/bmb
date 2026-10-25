// ============================================
// CONFIG AUTHORITY MAP — D3 (Owner 2026-10-25)
// ============================================
// เจ้าของเดียวต่อค่า (กันสองที่แย่งกันเขียน):
//   business_settings (bmbAdminApi_settings) = authority ที่แก้ได้ (DB)
//   platformConfigBootstrap                  = loader/projection เท่านั้น (ห้ามเก็บค่าเอง)
//   @/config/platformConfig DEFAULT_*        = static fallback ตอน boot ก่อนโหลดค่าจริง
// ชุดนี้กันไม่ให้มีใครเพิ่ม "ที่เก็บค่าที่ 3" หรือให้ bootstrap เขียนค่ากลับ
// ============================================

import { describe, it, expect } from 'vitest'
import bootstrapSrc from '../lib/platformConfigBootstrap.ts?raw'
import settingsApiSrc from '../lib/bmbAdminApi_settings.ts?raw'
import adminSettingsSrc from '../pages/admin/AdminSettings.tsx?raw'

describe('D3 — config authority map (1 ค่า = 1 เจ้าของ)', () => {
  it('platformConfigBootstrap = loader เท่านั้น — ไม่เขียน business_settings กลับ', () => {
    expect(bootstrapSrc).toContain('loader ONLY')
    // ห้ามมีการ upsert กลับเข้า business_settings จากตัว loader
    expect(bootstrapSrc).not.toContain('setBusinessSetting')
    expect(bootstrapSrc).not.toContain(".upsert(")
    // ต้องโหลดจาก authority เดียว
    expect(bootstrapSrc).toContain("getBusinessSettings()")
  })

  it('bmbAdminApi_settings = ทางเดียวของ business_settings (อ่าน/เขียนตารางเดียว)', () => {
    expect(settingsApiSrc).toContain("from('business_settings')")
    expect(settingsApiSrc).not.toContain('delivery_zones')
    expect(settingsApiSrc).not.toContain('branches')
    expect(settingsApiSrc).not.toContain('brands')
  })

  it('ownership map ต่อค้ายังตรงกับที่ประกาศ (กัน map เพี้ยน)', () => {
    // cutoffHours ← order_policy.cutoff_hours (อำนาจร่วมกับ enforce_pre_order_*)
    expect(bootstrapSrc).toContain('op.cutoff_hours')
    // radius ← branches.service_radius_km (FC-3)
    expect(bootstrapSrc).toContain('branch?.service_radius_km')
    // enabled/markup/freeship/currency ← delivery_policy
    expect(bootstrapSrc).toContain('dp.bite_drive_enabled')
    expect(bootstrapSrc).toContain('dp.tier2_markup_pct')
    expect(bootstrapSrc).toContain('dp.free_shipping_threshold')
    expect(bootstrapSrc).toContain('dp.currency')
    // dailyQuota ← order_policy.daily_quota
    expect(bootstrapSrc).toContain('op.daily_quota')
  })

  it('หน้าตั้งค่า = ประสบการณ์เดียว: ค่าที่ไม่ได้อยู่ business_settings ชี้ลิงก์ไปที่เจ้าของจริง', () => {
    // brand → OrgHub (AdminBrands)
    expect(adminSettingsSrc).toContain('/admin/tenants?tab=brands')
    // ค่าส่ง/โซน → ศูนย์ขนส่ง (D2)
    expect(adminSettingsSrc).toContain('/admin/delivery?tab=fees')
  })
})