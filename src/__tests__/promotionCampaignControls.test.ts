// ============================================
// G&R STAGE 1 (migration 153) — campaign controls ฝั่ง client mirror
//   · max_discount_amount (เพดานส่วนลด/ออเดอร์)
//   · applies_to + scope_product_ids (ฐานส่วนลด = ยอดสินค้าใน scope)
//   · usage_limit/usage_count (จำนวนสิทธิ์)
//   · kill switch / budget (ctx จาก server — evaluateCoupon รับผิดชอบการตัดสิน)
//   · validatePromotionForm ของแคมเปญใหม่ + cartStore.recalculate บนฐาน scope
// ============================================

import { describe, it, expect, beforeEach } from 'vitest'
import {
  computeServerDiscount,
  evaluateCoupon,
  validatePromotionForm,
  type PromotionFormValues,
} from '@/lib/promotionClient'
import type { PromotionRow } from '@/lib/bmbAdminApi_promotions'
import type { Product } from '@/types'
import { useCartStore } from '@/store/cartStore'

function row(overrides: Partial<PromotionRow> = {}): PromotionRow {
  return {
    id: 'promo-153-1',
    name: 'G153',
    code: 'G153',
    discount_type: 'percentage',
    discount_value: 10,
    min_order_amount: 0,
    is_active: true,
    ...overrides,
  }
}

const today = new Date('2026-10-25T12:00:00Z')

describe('computeServerDiscount — เพดานส่วนลดต่อออเดอร์ (max_discount_amount)', () => {
  it('ไม่มีเพดาน → ค่าเดิมเท่า 114 (10% ของ 500 = 50)', () => {
    expect(computeServerDiscount(row(), 500)).toBe(50)
  })
  it('มีเพดาน 15 → 50 ถูกตัดเหลือ 15', () => {
    expect(computeServerDiscount(row({ max_discount_amount: 15 }), 500)).toBe(15)
  })
  it('เพดานสูงกว่าส่วนลดที่คำนวณได้ → ใช้ค่าที่คำนวณได้', () => {
    expect(computeServerDiscount(row({ max_discount_amount: 999 }), 500)).toBe(50)
  })
  it('fixed_amount 70 + เพดาน 50 → 50', () => {
    expect(
      computeServerDiscount(row({ discount_type: 'fixed_amount', discount_value: 70, max_discount_amount: 50 }), 500),
    ).toBe(50)
  })
})

describe('evaluateCoupon — กติกาแคมเปญ 153 (kill switch/scope/usage/budget)', () => {
  it('kill switch ปิด (ctx.promotionsEnabled=false) → disabled ทันที', () => {
    expect(evaluateCoupon([row()], 'G153', 500, today, { promotionsEnabled: false })).toMatchObject({
      ok: false,
      reason: 'disabled',
    })
  })
  it('kill switch เปิด → คำนวณตามปกติ', () => {
    const r = evaluateCoupon([row()], 'G153', 500, today, { promotionsEnabled: true })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.discountAmount).toBe(50)
  })
  it('usage_limit ครบ (usage_count >= limit) → usage_exhausted', () => {
    const r = evaluateCoupon([row({ usage_limit: 3, usage_count: 3 })], 'G153', 500, today)
    expect(r).toMatchObject({ ok: false, reason: 'usage_exhausted' })
  })
  it('usage_limit ยังไม่ครบ → คำนวณตามปกติ', () => {
    const r = evaluateCoupon([row({ usage_limit: 3, usage_count: 2 })], 'G153', 500, today)
    expect(r.ok).toBe(true)
  })
  it('แคมเปญจำกัดสินค้า + ไม่ส่งฐาน → out_of_scope (ห้ามเดา)', () => {
    const scoped = row({ applies_to: 'specific_products' })
    expect(evaluateCoupon([scoped], 'G153', 500, today)).toMatchObject({ ok: false, reason: 'out_of_scope' })
  })
  it('แคมเปญจำกัดสินค้า + ส่งฐาน 100 → ลดจาก 100 (ไม่ใช่ subtotal 500)', () => {
    const scoped = row({ applies_to: 'specific_products', discount_value: 50 })
    const r = evaluateCoupon([scoped], 'G153', 500, today, { eligibleSubtotal: 100 })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.discountAmount).toBe(50)
  })
  it('แคมเปญทั้งออเดอร์ → ไม่สน eligibleSubtotal (ใช้ subtotal เต็ม)', () => {
    const r = evaluateCoupon([row()], 'G153', 500, today, { eligibleSubtotal: 10 })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.discountAmount).toBe(50)
  })
  it('budgetOk=false → budget_exhausted (และไม่โชว์ส่วนลดปลอม)', () => {
    const r = evaluateCoupon([row()], 'G153', 500, today, { budgetOk: false })
    expect(r).toMatchObject({ ok: false, reason: 'budget_exhausted' })
  })
  it('budgetOk=true → คำนวณตามปกติ', () => {
    const r = evaluateCoupon([row()], 'G153', 500, today, { budgetOk: true })
    expect(r.ok).toBe(true)
  })
  it('กติกาเดิม 114 ยังคงอยู่: below_min + expired', () => {
    expect(evaluateCoupon([row({ min_order_amount: 1000 })], 'G153', 500, today)).toMatchObject({
      ok: false,
      reason: 'below_min',
    })
    expect(evaluateCoupon([row({ end_date: '2020-01-01' })], 'G153', 500, today)).toMatchObject({
      ok: false,
      reason: 'expired',
    })
  })
})
describe('validatePromotionForm — ฟิลด์แคมเปญ 153', () => {
  const base: PromotionFormValues = {
    name: 'G153',
    code: 'G153',
    description: '',
    discount_type: 'percentage',
    discount_value: 10,
    min_order_amount: 0,
    start_date: '',
    end_date: '',
    is_active: true,
    is_banner: false,
    banner_image: '',
  }

  it('ค่าเริ่มต้น: ทั้งออเดอร์ + ไม่เพดาน + ไม่จำกัดสิทธิ์ + ไม่ซ้อน', () => {
    const r = validatePromotionForm(base, [])
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.values.applies_to).toBe('all_products')
      expect(r.values.stackable).toBe(false)
      expect(r.values.max_discount_amount).toBeNull()
      expect(r.values.usage_limit).toBeNull()
      expect(r.values.scope_product_ids).toEqual([])
    }
  })
  it('จำกัดสินค้าแต่ไม่เลือกสินค้า → ปฏิเสธ', () => {
    const r = validatePromotionForm({ ...base, applies_to: 'specific_products' }, [])
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.join(' ')).toContain('สินค้าที่ร่วมรายการ')
  })
  it('จำกัดสินค้า + เลือกแล้ว → ผ่านและคืน scope', () => {
    const r = validatePromotionForm(
      { ...base, applies_to: 'specific_products', scope_product_ids: ['p1', 'p2'] },
      [],
    )
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.values.scope_product_ids).toEqual(['p1', 'p2'])
  })
  it('usage_limit = 0 หรือ ไม่ใช่จำนวนเต็ม → ปฏิเสธ', () => {
    expect(validatePromotionForm({ ...base, usage_limit: 0 }, []).ok).toBe(false)
    expect(validatePromotionForm({ ...base, usage_limit: 2.5 }, []).ok).toBe(false)
    expect(validatePromotionForm({ ...base, usage_limit: 5 }, []).ok).toBe(true)
  })
  it('max_discount_amount ติดลบ → ปฏิเสธ · null = ไม่จำกัด ผ่าน', () => {
    expect(validatePromotionForm({ ...base, max_discount_amount: -1 }, []).ok).toBe(false)
    expect(validatePromotionForm({ ...base, max_discount_amount: null }, []).ok).toBe(true)
  })
})

describe('cartStore.recalculate — ฐานสินค้าใน scope (153)', () => {
  beforeEach(() => {
    useCartStore.getState().clearCart()
    useCartStore.getState().addItem({ id: 'p-scope-a', name: 'A', price: 100 } as unknown as Product, 1)
    useCartStore.getState().addItem({ id: 'p-other-b', name: 'B', price: 50 } as unknown as Product, 1)
  })

  it('แคมเปญจำกัดสินค้า A → ลดจากยอด A เท่านั้น (50% ของ 100 = 50)', () => {
    const s = useCartStore.getState()
    s.setCouponCode('SCOPED')
    s.setAppliedPromotion(
      row({ code: 'SCOPED', discount_value: 50, applies_to: 'specific_products', scope_product_ids: ['p-scope-a'] }),
    )
    const after = useCartStore.getState()
    expect(after.subtotal).toBe(150)
    expect(after.discount).toBe(50)
    expect(after.total).toBe(100)
  })

  it('สินค้าในตะกร้าไม่อยู่ใน scope → discount เป็น 0 จริง (ไม่แสร้งลด)', () => {
    const s = useCartStore.getState()
    s.setCouponCode('SCOPED')
    s.setAppliedPromotion(
      row({ code: 'SCOPED', discount_value: 50, applies_to: 'specific_products', scope_product_ids: ['p-none'] }),
    )
    expect(useCartStore.getState().discount).toBe(0)
    expect(useCartStore.getState().total).toBe(150)
  })

  it('แคมเปญทั้งออเดอร์ → ลดจาก subtotal เต็ม (10% ของ 150 = 15)', () => {
    const s = useCartStore.getState()
    s.setCouponCode('ALL')
    s.setAppliedPromotion(row({ code: 'ALL', discount_value: 10 }))
    expect(useCartStore.getState().discount).toBe(15)
  })
})