// ============================================
// Promotion / coupon client engine — server-mirror rules (migration 114)
// ============================================

import { describe, it, expect, beforeEach } from 'vitest'
import {
  normalizePromoCode,
  computeServerDiscount,
  evaluateCoupon,
  validatePromotionForm,
  utcDateKey,
  type PromotionFormValues,
} from '@/lib/promotionClient'
import type { PromotionRow } from '@/lib/bmbAdminApi_promotions'
import type { Product } from '@/types'
import { useCartStore } from '@/store/cartStore'

function row(overrides: Partial<PromotionRow> = {}): PromotionRow {
  return {
    id: 'promo-test-1',
    name: 'Test Promo',
    code: 'SAVE10',
    discount_type: 'percentage',
    discount_value: 10,
    min_order_amount: 0,
    is_active: true,
    ...overrides,
  }
}

const today = new Date('2026-10-18T12:00:00Z')

describe('normalizePromoCode', () => {
  it('trims + uppercases (server compares upper(code))', () => {
    expect(normalizePromoCode('  save10 ')).toBe('SAVE10')
  })
  it('handles null/undefined/empty safely', () => {
    expect(normalizePromoCode(null)).toBe('')
    expect(normalizePromoCode(undefined)).toBe('')
    expect(normalizePromoCode('   ')).toBe('')
  })
})

describe('computeServerDiscount — exact 114 mirror', () => {
  it('percentage: subtotal * value / 100', () => {
    expect(computeServerDiscount(row({ discount_type: 'percentage', discount_value: 10 }), 500)).toBe(50)
  })
  it('percentage capped at subtotal (only when the cut would exceed it)', () => {
    expect(computeServerDiscount(row({ discount_type: 'percentage', discount_value: 150 }), 8)).toBe(8)
    expect(computeServerDiscount(row({ discount_type: 'percentage', discount_value: 10 }), 8)).toBe(0.8)
  })
  it('fixed_amount: value, capped at subtotal', () => {
    expect(computeServerDiscount(row({ discount_type: 'fixed_amount', discount_value: 70 }), 500)).toBe(70)
    expect(computeServerDiscount(row({ discount_type: 'fixed_amount', discount_value: 70 }), 50)).toBe(50)
  })
  it('unknown discount_type → 0 (SQL has no ELSE)', () => {
    expect(computeServerDiscount(row({ discount_type: 'free_shipping' as unknown as PromotionRow['discount_type'] }), 500)).toBe(0)
  })
  it('never goes negative on odd input', () => {
    expect(computeServerDiscount(row({ discount_value: -5 }), 500)).toBe(0)
    expect(computeServerDiscount(row({ discount_type: 'fixed_amount', discount_value: 10 }), -20)).toBe(0)
  })
})

describe('evaluateCoupon — code lookup / window / min order (114 rules)', () => {
  it('valid percentage code is case-insensitive', () => {
    const r = evaluateCoupon([row()], ' save10 ', 500, today)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.discountAmount).toBe(50)
  })
  it('valid fixed code', () => {
    const r = evaluateCoupon([row({ code: 'B70', discount_type: 'fixed_amount', discount_value: 70 })], 'b70', 500, today)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.discountAmount).toBe(70)
  })
  it('empty input → empty_code', () => {
    expect(evaluateCoupon([row()], '  ', 500, today)).toMatchObject({ ok: false, reason: 'empty_code' })
  })
  it('unknown code → not_found (rows without a code are display-only)', () => {
    expect(evaluateCoupon([row({ code: null })], 'SAVE10', 500, today)).toMatchObject({ ok: false, reason: 'not_found' })
    expect(evaluateCoupon([row()], 'NOPE', 500, today)).toMatchObject({ ok: false, reason: 'not_found' })
  })
  it('inactive row → inactive', () => {
    expect(evaluateCoupon([row({ is_active: false })], 'SAVE10', 500, today)).toMatchObject({ ok: false, reason: 'inactive' })
  })
  it('start_date in the future → not_started', () => {
    const r = evaluateCoupon([row({ start_date: '2026-10-19' })], 'SAVE10', 500, today)
    expect(r).toMatchObject({ ok: false, reason: 'not_started' })
  })
  it('end_date in the past → expired', () => {
    const r = evaluateCoupon([row({ end_date: '2026-10-17' })], 'SAVE10', 500, today)
    expect(r).toMatchObject({ ok: false, reason: 'expired' })
  })
  it('window boundaries are inclusive (start == today, end == today)', () => {
    expect(evaluateCoupon([row({ start_date: '2026-10-18', end_date: '2026-10-18' })], 'SAVE10', 500, today).ok).toBe(true)
  })
  it('below min_order_amount → below_min with the threshold', () => {
    const r = evaluateCoupon([row({ min_order_amount: 300 })], 'SAVE10', 250, today)
    expect(r).toMatchObject({ ok: false, reason: 'below_min', minOrderAmount: 300 })
  })
  it('subtotal == min_order_amount passes (>= like the SQL)', () => {
    expect(evaluateCoupon([row({ min_order_amount: 250 })], 'SAVE10', 250, today).ok).toBe(true)
  })
})

describe('validatePromotionForm — admin guard', () => {
  const base: PromotionFormValues = {
    name: '  Mid-Autumn  ',
    code: ' save10 ',
    description: ' d ',
    discount_type: 'percentage',
    discount_value: 10,
    min_order_amount: 100,
    start_date: '2026-10-01',
    end_date: '2026-10-31',
    is_active: true,
    is_banner: false,
    banner_image: '  ',
  }

  it('normalizes name/code and numeric fields on success', () => {
    const r = validatePromotionForm(base, [])
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.values.name).toBe('Mid-Autumn')
      expect(r.values.code).toBe('SAVE10')
      expect(r.values.description).toBe('d')
      expect(r.values.banner_image).toBe('')
    }
  })
  it('code-less promos are allowed (display-only)', () => {
    const r = validatePromotionForm({ ...base, code: '' }, [])
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.values.code).toBe('')
  })
  it('rejects empty name / non-positive discount / percentage > 100 / negative min / reversed dates', () => {
    expect(validatePromotionForm({ ...base, name: '  ' }, []).ok).toBe(false)
    expect(validatePromotionForm({ ...base, discount_value: 0 }, []).ok).toBe(false)
    expect(validatePromotionForm({ ...base, discount_value: 120 }, []).ok).toBe(false)
    expect(validatePromotionForm({ ...base, discount_type: 'fixed_amount', discount_value: 120 }, []).ok).toBe(true)
    expect(validatePromotionForm({ ...base, min_order_amount: -1 }, []).ok).toBe(false)
    expect(validatePromotionForm({ ...base, start_date: '2026-10-31', end_date: '2026-10-01' }, []).ok).toBe(false)
  })
  it('rejects duplicate codes case-insensitively (114 lookup is LIMIT 1)', () => {
    const existing = [row({ id: 'other', code: 'SAVE10', name: 'Existing' })]
    const r = validatePromotionForm(base, existing)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors[0]).toContain('SAVE10')
  })
  it('editing the same row keeps its own code valid', () => {
    const existing = [row({ id: 'self', code: 'SAVE10', name: 'Existing' })]
    expect(validatePromotionForm(base, existing, 'self').ok).toBe(true)
  })
})

describe('cartStore recalculate — real promotions only', () => {
  beforeEach(() => {
    useCartStore.getState().clearCart()
    useCartStore.getState().addItem({ id: 'p1', name: 'Test Bowl', price: 200 } as unknown as Product, 2)
  })

  it('applies a real row through the server-mirror formula', () => {
    const s = useCartStore.getState()
    s.setCouponCode('SAVE10')
    s.setAppliedPromotion(row())
    s.recalculate()
    const after = useCartStore.getState()
    expect(after.subtotal).toBe(400)
    expect(after.discount).toBe(40) // 10% of 400
    expect(after.total).toBe(360)
  })
  it('a row failing the rule yields a truthful 0 (never the legacy fake math)', () => {
    const s = useCartStore.getState()
    s.setCouponCode('SAVE10')
    s.setAppliedPromotion(row({ min_order_amount: 1000 }))
    s.recalculate()
    expect(useCartStore.getState().discount).toBe(0)
    expect(useCartStore.getState().total).toBe(400)
  })
  it('clearCart removes the coupon with everything else', () => {
    const s = useCartStore.getState()
    s.setCouponCode('SAVE10')
    s.setAppliedPromotion(row())
    s.recalculate()
    s.clearCart()
    const after = useCartStore.getState()
    expect(after.couponCode).toBe('')
    expect(after.appliedPromotion).toBeNull()
    expect(after.discount).toBe(0)
  })
})

describe('utcDateKey', () => {
  it('formats YYYY-MM-DD', () => {
    expect(utcDateKey(today)).toBe('2026-10-18')
  })
})