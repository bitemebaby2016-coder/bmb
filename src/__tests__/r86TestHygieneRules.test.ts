// ============================================
// Bite Me Baby — R86 (Owner 2026-11-08) — งาน 4 ชิ้น:
// ① เมนูเลยรอบไม่ขึ้นเธียเตอร์ (theaterStage pure logic)
// ③ ซ่อน COD default + แอดมินเปิด/ปิดได้ (codToggle + source gates 3 จุด)
// ④ หน้าต่างตรวจสลิปไม่หายจากค้าง 0 (source gate)
// + กฏ 16 (test data ต้องลบ) บันทึกลง rules แล้ว
// NOTE: ไฟล์ต้องเป็น `.ts` (vitest include ไม่รับ .tsx)
// ============================================
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Product } from '@/types'
import { isCodEnabled } from '@/lib/codToggle'
import { theaterStageEligible, pickTheaterStage } from '@/lib/theaterStage'
import checkoutSrc from '@/pages/CheckoutPage.tsx?raw'
import adminPosSrc from '@/pages/admin/AdminPos.tsx?raw'
import adminSettingsSrc from '@/pages/admin/AdminSettings.tsx?raw'
import slipPanelSrc from '@/components/admin/SlipReviewPanel.tsx?raw'

function product(over: Partial<Product>): Product {
  return {
    id: 'p1', name: 'X', description: '', price: 45, image_url: '', is_available: true,
    category_id: 'c1', display_order: 0, store_id: 's1', available_same_day: true,
    ...over,
  } as unknown as Product
}

describe('R86-① theaterStage — เมนูเลยรอบ/ยังไม่ลงปฏิทิน ไม่ขึ้นเวที', () => {
  const preOnly = product({ id: 'pre1', available_same_day: false, available_preorder: true })
  const sameDay = product({ id: 'sd1', available_same_day: true, available_preorder: false })

  it('pre-order-only + ไม่มีรอบถัดไปในปฏิทิน → ไม่ผ่านกติกาเวที', () => {
    expect(theaterStageEligible(preOnly, {})).toBe(false)
    expect(theaterStageEligible(preOnly, { pre1: '2099-01-15' })).toBe(true)
  })
  it('same-day → ขึ้นเวทีได้เสมอ (สั่งได้จริง · zero-fake)', () => {
    expect(theaterStageEligible(sameDay, {})).toBe(true)
  })
  it('pickTheaterStage กรองออกจาก picks + เคารพ count', () => {
    const picks = pickTheaterStage([preOnly, sameDay], {}, 3)
    expect(picks.map((p) => p.id)).toEqual(['sd1'])
    expect(pickTheaterStage([preOnly, sameDay], { pre1: '2099-01-15' }, 3).map((p) => p.id).sort()).toEqual(['pre1', 'sd1'])
  })
})

describe('R86-③ codToggle — ซ่อน COD เป็นค่าเริ่มต้น (ZERO-FAKE)', () => {
  it('ขาดคีย์ / null / รูปแบบผิด → ซ่อน (false)', () => {
    expect(isCodEnabled(undefined)).toBe(false)
    expect(isCodEnabled(null)).toBe(false)
    expect(isCodEnabled({})).toBe(false)
    expect(isCodEnabled({ cod_enabled: 'yes' })).toBe(false)
  })
  it('object {enabled} / boolean ตรง ๆ → ตามค่าจริง', () => {
    expect(isCodEnabled({ cod_enabled: { enabled: true } })).toBe(true)
    expect(isCodEnabled({ cod_enabled: { enabled: false } })).toBe(false)
    expect(isCodEnabled({ cod_enabled: true })).toBe(true)
    expect(isCodEnabled({ cod_enabled: false })).toBe(false)
  })
})

describe('R86 source gates — COD switch 3 จุด + หน้าต่างตรวจสลิป', () => {
  it('CheckoutPage: radio COD อยู่หลัง codEnabled gate + อ่านจาก business_settings', () => {
    expect(checkoutSrc).toContain('{codEnabled && (')
    expect(checkoutSrc).toContain('data-testid="pay-cod"')
    expect(checkoutSrc).toContain('setCodEnabled(isCodEnabled(s))')
  })
  it('AdminPos: option COD อยู่หลัง gate + เดิกค่าออกจาก COD เมื่อซ่อน', () => {
    expect(adminPosSrc).toContain('{codEnabled && <option value="cash_on_delivery">')
    expect(adminPosSrc).toContain('setCodEnabled(isCodEnabled(bset))')
    expect(adminPosSrc).toContain("if (!codEnabled && paymentMethod === 'cash_on_delivery') setPaymentMethod('promptpay_qr')")
  })
  it('AdminSettings: มีสวิตช์ COD เปิด/ปิด + คีย์อยู่ใน TYPED_FORM_KEYS (กัน generic editor ทับ)', () => {
    expect(adminSettingsSrc).toContain('data-testid="cod-switch"')
    expect(adminSettingsSrc).toContain('testId="cod-switch-toggle"')
    expect(adminSettingsSrc).toContain('async function handleToggleNested(')
    expect(adminSettingsSrc).toContain("'store_master_open'")
    expect(adminSettingsSrc).toContain("'cod_enabled'")
  })
  it('SlipReviewPanel: ห้าม return null เมื่อค้าง 0 — ต้องโชว์ empty state ของหน้าต่าง', () => {
    expect(slipPanelSrc).not.toContain('if (pending.length === 0) return null')
    expect(slipPanelSrc).toContain('data-testid="slip-review-empty"')
  })
})

describe('R86-② กฏ 16 — test data ต้องลบ บันทึกลง UNIVERSAL_MASTER_AI_RULES.md', () => {
  it('มี SECTION 16 + ข้อความกฏการลบออเดอร์ทดสอบ', () => {
    const rules = readFileSync(join(process.cwd(), 'UNIVERSAL_MASTER_AI_RULES.md'), 'utf8')
    expect(rules).toContain('SECTION 16: TEST DATA HYGIENE')
    expect(rules).toContain('AI TEST ORDERS MUST BE DELETED AFTER USE')
    expect(rules).toContain('VERIFY BEFORE DELETE')
  })
})
