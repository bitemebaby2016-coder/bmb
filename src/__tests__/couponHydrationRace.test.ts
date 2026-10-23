// ============================================
// Bite Me Baby — R3 (D-04): coupon hydration race guard
// ============================================
// Regression: cartPersistence restore เป็น async (โหลด catalog ก่อน) — ถ้า
// CouponBox mount ก่อน restore เสร็จ แล้ว effect รันแค่รอบเดียว (deps [])
// คูปองจะค้าง pending + discount หายหลัง reload. deps = [couponCode] ทำให้
// rehydrate ทันทีที่โค้ดถูก set กลับเข้า store
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { PromotionRow } from '@/lib/bmbAdminApi_promotions'
import type { Product } from '@/types'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

const m = vi.hoisted(() => ({ fetchCouponEvaluation: vi.fn() }))
vi.mock('@/lib/promotionClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/promotionClient')>()
  return { ...actual, fetchCouponEvaluation: m.fetchCouponEvaluation }
})
vi.mock('@/components/ui/ToastContainer', () => ({ showToast: vi.fn() }))

import { CouponBox } from '@/components/CouponBox'
import { useCartStore } from '@/store/cartStore'

function promo(): PromotionRow {
  return {
    id: 'promo-r4',
    name: 'R4 Promo',
    code: 'SAVE10',
    discount_type: 'percentage',
    discount_value: 10,
    min_order_amount: 0,
    is_active: true,
  } as unknown as PromotionRow
}

beforeEach(() => {
  m.fetchCouponEvaluation.mockReset()
  useCartStore.getState().clearCart()
  useCartStore.getState().setCouponCode('')
  useCartStore.getState().setAppliedPromotion(null)
})

describe('R3 (D-04) — coupon rehydrates when the code arrives AFTER mount', () => {
  it('async restore ตั้ง couponCode หลัง mount → appliedPromotion ถูก rebuild (ไม่ค้าง pending)', async () => {
    useCartStore.getState().addItem({ id: 'p1', name: 'Bowl', price: 200 } as unknown as Product, 1)
    m.fetchCouponEvaluation.mockResolvedValue({ ok: true, promo: promo(), discountAmount: 20 })

    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => {
      root.render(React.createElement(CouponBox))
      await Promise.resolve()
    })
    // mount ตอนยังไม่มีโค้ด → ยังไม่ยุ่งกับ promotion
    expect(m.fetchCouponEvaluation).not.toHaveBeenCalled()

    // จำลอง initCartPersistence restore เสร็จช้ากว่า (set โค้ดกลับเข้า store)
    await act(async () => {
      useCartStore.getState().setCouponCode('SAVE10')
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(m.fetchCouponEvaluation).toHaveBeenCalledTimes(1)
    expect(useCartStore.getState().appliedPromotion?.code).toBe('SAVE10')
    expect(useCartStore.getState().discount).toBe(20)
  })
})