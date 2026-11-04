import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { STORE_MASTER_KEY, masterClosedStatus, masterOpenFromConfig, parseStoreMasterOpen } from '../lib/storeMaster'

const root = join(__dirname, '..', '..')
const src = (p: string) => readFileSync(join(root, p), 'utf8')

describe('R66-B storeMaster (client parse · ZERO-FAKE default OPEN)', () => {
  it('key = store_master_open', () => {
    expect(STORE_MASTER_KEY).toBe('store_master_open')
  })

  it('boolean/string/object/missing/corrupt — ไม่มีค่าหรือเพี้ยน = เปิดเสมอ', () => {
    expect(parseStoreMasterOpen(false)).toBe(false)
    expect(parseStoreMasterOpen(true)).toBe(true)
    expect(parseStoreMasterOpen(undefined)).toBe(true)
    expect(parseStoreMasterOpen(null)).toBe(true)
    expect(parseStoreMasterOpen('not-json')).toBe(true)
    expect(parseStoreMasterOpen('{"open":false}')).toBe(false) // JSON string form
    expect(parseStoreMasterOpen({ open: false })).toBe(false) // seed object form
    expect(parseStoreMasterOpen({ open: true })).toBe(true)
    expect(parseStoreMasterOpen({})).toBe(true)
    expect(parseStoreMasterOpen(42)).toBe(true)
  })

  it('masterOpenFromConfig: ยังไม่โหลด/key อื่น = null (ไม่บัง), ค่าจริง = boolean', () => {
    expect(masterOpenFromConfig(undefined)).toBeNull()
    expect(masterOpenFromConfig(null)).toBeNull()
    expect(masterOpenFromConfig('hours')).toBeNull()
    expect(masterOpenFromConfig('operating_hours')).toBeNull()
    expect(masterOpenFromConfig(false)).toBe(false)
    expect(masterOpenFromConfig({ open: false })).toBe(false)
    expect(masterOpenFromConfig(true)).toBe(true)
  })

  it('masterClosedStatus = สถานะปิด (isOpen false · ทุก channel ปิด · copy แจ้ง Master)', () => {
    const s = masterClosedStatus()
    expect(s.isOpen).toBe(false)
    expect(s.state).toBe('closed')
    expect(s.sameDayOpen).toBe(false)
    expect(s.preOrderOpen).toBe(false)
    expect(s.message).toContain('Master')
  })
})

describe('R66-B migration 185 (file contract)', () => {
  const sql = src('supabase/migrations/185_admin_switches_master_category.sql')

  it('seed + 2 columns default true + reader + 2 BEFORE INSERT triggers + error markers', () => {
    expect(sql).toContain("'store_master_open'")
    expect(sql).toContain('ON CONFLICT (key) DO NOTHING')
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS allow_same_day BOOLEAN NOT NULL DEFAULT true')
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS allow_pre_order BOOLEAN NOT NULL DEFAULT true')
    expect(sql).toContain('store_master_is_open()')
    expect(sql).toContain('SECURITY DEFINER')
    expect(sql).toContain("RAISE EXCEPTION 'ERR_STORE_CLOSED'")
    expect(sql).toContain("RAISE EXCEPTION 'ERR_CATEGORY_MODE_NOT_ALLOWED'")
    expect(sql).toContain('BEFORE INSERT ON public.orders')
    expect(sql).toContain('BEFORE INSERT ON public.order_items')
  })
})

describe('R66-B client wiring (source contracts)', () => {
  it('homeProviders: master gate อยู่ก่อนกฎรอบ/เวลาใน getStoreStatusFromRounds', () => {
    const s = src('src/lib/homeProviders.ts')
    const gate = s.indexOf('masterOpen === false')
    const live = s.indexOf('const live = (rounds || [])')
    expect(gate).toBeGreaterThan(-1)
    expect(live).toBeGreaterThan(gate)
    expect(s).toContain('masterClosedStatus()')
  })

  it('shopHours: โหลดคีย์ store_master_open + expose masterOpen', () => {
    const s = src('src/lib/shopHours.ts')
    expect(s).toContain('store_master_open')
    expect(s).toContain('masterOpen')
  })

  it('AdminSettings: Master Switch card + handler + TYPED กัน generic เขียน', () => {
    const s = src('src/pages/admin/AdminSettings.tsx')
    expect(s).toContain('store-master-open-toggle')
    expect(s).toContain('handleToggleMaster')
    expect(s).toContain("'store_master_open'")
    expect(s).toContain('settings.store_master_open !== false')
    expect(s).toContain('setBusinessSetting')
  })

  it('AdminProducts: toggles ต่อหมวดทั้งสองโหมด + payload create/update', () => {
    const s = src('src/pages/admin/AdminProducts.tsx')
    expect(s).toContain('category-allow-sameday-toggle')
    expect(s).toContain('category-allow-preorder-toggle')
    expect(s).toContain('allow_same_day: catForm.allow_same_day')
    expect(s).toContain('allow_pre_order: catForm.allow_pre_order')
  })

  it('bmbAdminApi_products: CategoryForm + create/update carries flags (default true)', () => {
    const s = src('src/lib/bmbAdminApi_products.ts')
    expect(s).toContain('allow_same_day?: boolean')
    expect(s).toContain('allow_same_day: data.allow_same_day ?? true')
    expect(s).toContain('allow_pre_order: data.allow_pre_order ?? true')
  })

  it('types ProductCategory + HomePage ส่ง masterOpen เข้า gate', () => {
    const t = src('src/types/index.ts')
    expect(t).toContain('allow_same_day?: boolean')
    expect(t).toContain('allow_pre_order?: boolean')
    const h = src('src/pages/HomePage.tsx')
    expect(h).toContain('parseStoreMasterOpen(settings?.store_master_open)')
    expect(h).toContain('masterOpen,')
  })
})