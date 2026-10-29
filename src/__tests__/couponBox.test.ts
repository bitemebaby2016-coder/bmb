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

const m = vi.hoisted(() => ({ fetchCouponEvaluation: vi.fn(), listAvailableCoupons: vi.fn() }))
vi.mock('@/lib/promotionClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/promotionClient')>()
  return { ...actual, fetchCouponEvaluation: m.fetchCouponEvaluation, listAvailableCoupons: m.listAvailableCoupons }
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

  it('ยังไม่มีโค้ด → โชว์ปุ่มแตะเลือกคูปอง (R10 popup) — เปิดแล้วเจอช่องกรอก/ปุ่มใช้โค้ด', async () => {
    m.listAvailableCoupons.mockResolvedValue([])
    const c = await renderBox()
    expect(c.querySelector('[data-testid="coupon-open"]')).toBeTruthy()
    await act(async () => {
      ;(c.querySelector('[data-testid="coupon-open"]') as HTMLButtonElement).click()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(c.querySelector('[data-testid="coupon-picker"]')).toBeTruthy()
    expect(c.querySelector('[data-testid="coupon-input"]')).toBeTruthy()
    expect(c.querySelector('[data-testid="coupon-apply"]')).toBeTruthy()
  })

  it('popup โชว์โค้ดที่ใช้ได้ตอนนี้ + จิ้มโค้ด = เติม+ใช้อัตโนมัติ (R10)', async () => {
    m.listAvailableCoupons.mockResolvedValue([row()])
    m.fetchCouponEvaluation.mockResolvedValue({ ok: true, promo: row(), discountAmount: 20 })
    const c = await renderBox()
    await act(async () => {
      ;(c.querySelector('[data-testid="coupon-open"]') as HTMLButtonElement).click()
      await Promise.resolve()
      await Promise.resolve()
    })
    const pick = c.querySelector('[data-testid="coupon-pick-SAVE10"]') as HTMLButtonElement
    expect(pick).toBeTruthy()
    await act(async () => {
      pick.click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(useCartStore.getState().couponCode).toBe('SAVE10')
    expect(c.querySelector('[data-testid="applied-coupon"]')).toBeTruthy()
  })

  it('พิมพ์โค้ด+กดใช้ → apply เข้า store ทันที + โชว์การ์ด applied-coupon', async () => {
    m.listAvailableCoupons.mockResolvedValue([])
    m.fetchCouponEvaluation.mockResolvedValue({ ok: true, promo: row(), discountAmount: 20 })
    const c = await renderBox()
    await act(async () => {
      ;(c.querySelector('[data-testid="coupon-open"]') as HTMLButtonElement).click()
      await Promise.resolve()
      await Promise.resolve()
    })
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
    // [G&R 153] realign: บรรทัดตะกร้าถูกส่งไปคำนวณ "ฐานสินค้าเข้า scope" ด้วย
    // (ข้อเรียกเดิมคือ ('SAVE10', 200) 2 อาร์กิวเมนต์ — เปลี่ยนเพราะฟีเจอร์ใหม่ไม่ใช่การอ่อนกฎ)
    // attempt 2: ตรวจ args ตรง ๆ (expect.any(Array) ของ vitest 3.2.7 ในรอบแรก
    // โยน TypeError: Right-hand side of 'instanceof' is not callable)
    const evalArgs = m.fetchCouponEvaluation.mock.calls[0] as unknown as [string, number, { lines: unknown[] }]
    expect(evalArgs[0]).toBe('SAVE10')
    expect(evalArgs[1]).toBe(200)
    expect(Array.isArray(evalArgs[2].lines)).toBe(true)
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

describe('กฎห้ามซ้อน คูปอง✗แต้ม — ผ่าน store จริง (Task 1 · Owner)', () => {
  beforeEach(() => seedCart())

  it('applyCouponCode ถูกปฏิเสธทันทีเมื่อบิลใช้แต้มเป็นเงิน (ไม่ยิง network · โค้ดไม่เข้า store)', async () => {
    useCartStore.getState().setPointsRedemption(30)
    const callsBefore = m.fetchCouponEvaluation.mock.calls.length
    const result = await applyCouponCode('SAVE10')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('stack_conflict')
    expect(m.fetchCouponEvaluation.mock.calls.length).toBe(callsBefore)
    expect(useCartStore.getState().couponCode).toBe('')
    expect(useCartStore.getState().appliedPromotion).toBeNull()
  })

  it('revalidateCouponForSubmit ปฏิเสธก่อนยิง network เมื่อคูปองลดจริง + มีแต้มในบิลเดียวกัน', async () => {
    const s = useCartStore.getState()
    s.setCouponCode('SAVE10')
    s.setAppliedPromotion(row())
    s.recalculate()
    // precondition: คูปองลดจริงในบิล — ต้องอ่าน state ใหม่ (zustand แทนที่ object · snapshot เก่าค้างค่าเดิม)
    expect(useCartStore.getState().discount).toBeGreaterThan(0)
    s.setPointsRedemption(30)
    const callsBefore = m.fetchCouponEvaluation.mock.calls.length
    const result = await revalidateCouponForSubmit(200)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toContain('ร่วมกับการแลกแต้ม')
    expect(m.fetchCouponEvaluation.mock.calls.length).toBe(callsBefore)
  })

  it('setPointsRedemption sanitize (ลบ/NaN → 0) และ clearCart รีเซ็ตเป็น 0', () => {
    const s = useCartStore.getState()
    s.setPointsRedemption(-5)
    expect(useCartStore.getState().pointsRedemption).toBe(0)
    s.setPointsRedemption(Number.NaN)
    expect(useCartStore.getState().pointsRedemption).toBe(0)
    s.setPointsRedemption(45)
    expect(useCartStore.getState().pointsRedemption).toBe(45)
    s.clearCart()
    expect(useCartStore.getState().pointsRedemption).toBe(0)
  })

  it('render CouponBox ขณะคูปองลดจริง+มีแต้ม → โชว์ banner coupon-stack-conflict (ไม่มีแต้ม = ไม่โชว์)', async () => {
    m.listAvailableCoupons.mockResolvedValue([])
    const c = await renderBox()
    await act(async () => { await Promise.resolve() })
    expect(c.querySelector('[data-testid="coupon-stack-conflict"]')).toBeNull()

    await act(async () => {
      // wrap ทั้งชุดใน act — ห้ามให้ store update ยิงเข้า component นอก act (กัน warning)
      const s = useCartStore.getState()
      s.setCouponCode('SAVE10')
      s.setAppliedPromotion(row())
      s.recalculate()
      s.setPointsRedemption(30)
      await Promise.resolve()
    })
    expect(c.querySelector('[data-testid="coupon-stack-conflict"]')).toBeTruthy()
  })
})