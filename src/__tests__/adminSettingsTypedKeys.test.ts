// ============================================
// C1/Q8 (audit D1) — "1 เรื่อง = 1 ที่": key ที่มีฟอร์มเฉพาะทางต้องไม่โผล่ใน
// generic editor ของ AdminSettings (กันพิมพ์ค่าเสียชนิด 22P02 ซ้ำผ่าน Save All)
// ============================================

import { describe, expect, it } from 'vitest'
import adminSettingsSrc from '../pages/admin/AdminSettings.tsx?raw'

describe('AdminSettings — typed-form keys ถูกกันออกจาก generic editor', () => {
  it('มี TYPED_FORM_KEYS = social_links + seo + order_policy และ filter ทั้งตอน render/save/save-all', () => {
    expect(adminSettingsSrc).toContain("const TYPED_FORM_KEYS = new Set<string>([SOCIAL_LINKS_SETTING_KEY, SEO_SETTINGS_KEY, 'order_policy'])")
    expect(adminSettingsSrc).toContain('.filter((key) => !TYPED_FORM_KEYS.has(key))')
    expect(adminSettingsSrc).toContain('if (TYPED_FORM_KEYS.has(key)) {') // handleSave กัน
    expect(adminSettingsSrc).toContain('if (TYPED_FORM_KEYS.has(key)) continue') // Save All กัน
  })

  it(' brand editor ถูกถอดออกจาก Settings (canonical = OrgHub) — เหลือแค่ลิงก์', () => {
    expect(adminSettingsSrc).not.toContain('saveBrand()')
    expect(adminSettingsSrc).not.toContain('from(\'brands\')')
    expect(adminSettingsSrc).toContain('to="/admin/tenants?tab=brands"')
  })
})
