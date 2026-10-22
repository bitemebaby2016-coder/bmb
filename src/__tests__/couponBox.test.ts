// ============================================
// Bite Me Baby — CouponBox tests (M2 · A1)
// ============================================
// ONE apply path for every coupon surface (PromotionsPage "ใช้เลย",
// /menu?code=X deep-link, CartPage, CheckoutPage). Guards:
//   - code lands in the cart store IMMEDIATELY (A1 — not just clipboard)
//   - below_min keeps a PENDING code without pretending a discount
//   - dead codes are cleared (no phantom coupon)
//   - submit gate refuses stale/invalid codes (migration 114 would silently
//     ignore them — the customer must never pay full price believing a
//     discount applied)
// NOTE: ไฟล์ต้องเป็น `.ts` (vitest include ไม่รับ .tsx) — ใช้ React.createElement
// ============================================
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { PromotionRow } from '@/lib/bmbAdminApi_promotions'
import type { Product } from '@/types'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

const m = vi.hoisted(() => ({ fetchCouponEvaluation: vi.fn() }))
vi.mock('@/lib/promotionClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/promotionClient')>()
  return { ...actual, fetchCouponEvaluation: m.fetchCouponEvaluation }
})
vi.mock('@/components/ui/ToastContainer', () => ({ showToast: vi.fn() }))

import { CouponBox, applyCouponCode, removeCouponCode, revalidateCouponForSubmit } from '@/components/CouponBox'
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

function seedCart() {
  useCartStore.getState().clearCart()
  useCartStore.getState().addItem({ id: 'p1', name: 'Test Bowl', price: 200 } as unknown as Product, 1)
}

let container: HTMLDivElement | null = null
let root: Root | null = null

async function renderBox() {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root!.render(React.createElement(CouponBox))
    await Promise.resolve()
  })
  return container
}

afterEach(() => {
  if (root) act(() => root!.unmount())
  if (container) container.remove()
  root = null
  container = null
  vi.clearAllMocks()
})

describe('applyCouponCode — ทาง apply เดียวของทุกพื้นผิว (A1)', () => {
  beforeEach(() => seedCart())

  it('rule ok → โค้ด+โปรโมชันเข้าตะกร้าทันที (ไม่ใช่แค่ clipboard) + หักส่วนลดตามสูตรจริง', async () => {
    m.fetchCouponEvaluation.mockResolvedValue({ ok: true, promo: row(), discountAmount: 20 })
    const result = await applyCouponCode('SAVE10')
    expect(result.ok).toBe(true)
    const s = useCartStore.getState()
    expect(s.couponCode).toBe('SAVE10')
    expect(s.appliedPromotion?.name).toBe('Test Promo')
    expect(s.discount).toBe(20) // 10% of 200 — server-mirror formula
  })

  it('normalize โค้ดเป็นตัวพิมพ์ใหญ่เสมอ (server compares upper(code))', async () => {
    m.fetchCouponEvaluation.mockResolvedValue({ ok: true, promo: row(), discountAmount: 20 })
    await applyCouponCode('  save10 ')
    expect(useCartStore.getState().couponCode).toBe('SAVE10')
  })

  it('below_min → เก็บโค้ดเป็น PENDING (ไม่หักส่วนลด ไม่แสร้งว่าสำเร็จ)', async () => {
    m.fetchCouponEvaluation.mockResolvedValue({ ok: false, reason: 'below_min', promo: row({ min_order_amount: 500 }), minOrderAmount: 500 })
    const result = await applyCouponCode('SAVE10')
    expect(result.ok).toBe(false)
    const s = useCartStore.getState()
    expect(s.couponCode).toBe('SAVE10') // kept for re-check as the cart grows
    expect(s.appliedPromotion).toBeNull()
    expect(s.discount).toBe(0)
  })

  it('โค้ดตาย (not_found/expired) → ล้างออกจากตะกร้า ไม่ค้างเป็นผี', async () => {
    m.fetchCouponEvaluation.mockResolvedValue({ ok: false, reason: 'not_found' })
    useCartStore.getState().setCouponCode('DEADCODE')
    await applyCouponCode('DEADCODE')
    expect(useCartStore.getState().couponCode).toBe('')
    expect(useCartStore.getState().appliedPromotion).toBeNull()
  })
})

describe('removeCouponCode', () => {
  beforeEach(() => seedCart())

  it('ล้างโค้ด+โปรโมชันและสรุปราคาขยับจริง', async () => {
    m.fetchCouponEvaluation.mockResolvedValue({ ok: true, promo: row(), discountAmount: 20 })
    await applyCouponCode('SAVE10')
    removeCouponCode(false)
    const s = useCartStore.getState()
    expect(s.couponCode).toBe('')
    expect(s.appliedPromotion).toBeNull()
    expect(s.discount).toBe(0)
  })
})

describe('revalidateCouponForSubmit — submit gate (ย้ายจาก CheckoutPage · M2)', () => {
  beforeEach(() => seedCart())

  it('ไม่มีโค้ด → ผ่านได้โดยไม่แตะเครือข่าย', async () => {
    const r = await revalidateCouponForSubmit(200)
    expect(r).toEqual({ ok: true, discountAmount: 0 })
    expect(m.fetchCouponEvaluation).not.toHaveBeenCalled()
  })

  it('โค้ดผ่านกฎ → คืนยอดคาดการณ์ + sync โปรโมชันเข้า store', async () => {
    m.fetchCouponEvaluation.mockResolvedValue({ ok: true, promo: row(), discountAmount: 20 })
    useCartStore.getState().setCouponCode('SAVE10')
    const r = await revalidateCouponForSubmit(200)
    expect(r).toEqual({ ok: true, discountAmount: 20 })
    expect(useCartStore.getState().appliedPromotion?.code).toBe('SAVE10')
  })

  it('โค้ดไม่ผ่านกฎ → ปฏิเสธพร้อมข้อความจริง (ห้ามส่งออเดอร์เงียบ ๆ)', async () => {
    m.fetchCouponEvaluation.mockResolvedValue({ ok: false, reason: 'expired', promo: row({ end_date: '2020-01-01' }) })
    useCartStore.getState().setCouponCode('SAVE10')
    const r = await revalidateCouponForSubmit(200)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message.length).toBeGreaterThan(0)
  })
})

describe('CouponBox — หนึ่ง UI สำหรับ Cart+Checkout (M2)', () => {
  beforeEach(() => seedCart())

  it('ยังไม่มีโค้ด → โชว์ช่องกรอก + ปุ่มใช้โค้ด (testids เดิมของทั้งสองหน้า)', async () => {
    const c = await renderBox()
    expect(c.querySelector('[data-testid="coupon-input"]')).toBeTruthy()
    expect(c.querySelector('[data-testid="coupon-apply"]')).toBeTruthy()
  })

  it('พิมพ์โค้ด+กดใช้ → apply เข้า store ทันที + โชว์การ์ด applied-coupon', async () => {
    m.fetchCouponEvaluation.mockResolvedValue({ ok: true, promo: row(), discountAmount: 20 })
    const c = await renderBox()
    const input = c.querySelector('[data-testid="coupon-input"]') as HTMLInputElement
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
    await act(async () => {
      setter.call(input, 'SAVE10')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      await Promise.resolve()
    })
    await act(async () => {
      ;(c.querySelector('[data-testid="coupon-apply"]') as HTMLButtonElement).click()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(m.fetchCouponEvaluation).toHaveBeenCalledWith('SAVE10', 200)
    expect(useCartStore.getState().couponCode).toBe('SAVE10')
    expect(c.querySelector('[data-testid="applied-coupon"]')).toBeTruthy()
  })

  it('โค้ด pending (below_min) → โชว์ pending-coupon ไม่ใช่ส่วนลดปลอม + เอาออกได้', async () => {
    // rehydration effect จะ re-check ตอน mount — ผลลัพธ์จริงคือยัง below_min
    m.fetchCouponEvaluation.mockResolvedValue({ ok: false, reason: 'below_min', promo: row({ min_order_amount: 500 }), minOrderAmount: 500 })
    useCartStore.getState().setCouponCode('SAVE10')
    const c = await renderBox()
    await act(async () => { await Promise.resolve() })
    expect(c.querySelector('[data-testid="pending-coupon"]')).toBeTruthy()
    expect(c.querySelector('[data-testid="applied-coupon"]')).toBeNull()
    await act(async () => {
      ;(c.querySelector('[data-testid="coupon-remove"]') as HTMLButtonElement).click()
      await Promise.resolve()
    })
    expect(useCartStore.getState().couponCode).toBe('')
  })
})