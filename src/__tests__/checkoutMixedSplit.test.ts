/**
 * WAVE 5-1 — CheckoutPage component tests: M1 mixed-split wiring (B1-B12)
 * 1) mixed + promptpay → ปฏิเสธก่อน createOrder RPC 2) mixed + COD → split 2 child
 * 3) partial → ไม่อ้าง success / ไม่ clearCart / ไม่ navigate
 * NOTE: ต้องเป็น `.ts` (vitest include ไม่รับ .tsx) — React.createElement ตาม harness
 * ของ checkoutModeLock.test.ts — ไม่มี production code ถูกแตะในเทสนี้
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router-dom'
import type { Product } from '@/types'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

if (typeof window.matchMedia !== 'function') {
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: () => {}, removeListener: () => {},
    addEventListener: () => {}, removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}
if (typeof (globalThis as Record<string, unknown>).ResizeObserver === 'undefined') {
  class RO { observe() {} unobserve() {} disconnect() {} }
  ;(globalThis as Record<string, unknown>).ResizeObserver = RO
}

const m = vi.hoisted(() => ({
  showToast: vi.fn(),
  createOrder: vi.fn(),
  createPaymentIntent: vi.fn(),
  listRoundsForDate: vi.fn(),
  getPublishedScheduleForDate: vi.fn(),
  fetchServerDeliveryFee: vi.fn(),
}))

vi.mock('@/components/ui/ToastContainer', () => ({ showToast: m.showToast }))
vi.mock('@/lib/bmbAdminApi_orders', () => ({
  createOrder: m.createOrder,
  // pure 124 helpers — deterministic stub (no DB side effects in UI tests)
  orderInputFingerprint: (input: unknown) => JSON.stringify(input),
  OrderSubmitError: class extends Error {
    code: string
    constructor(code: string) { super(code); this.code = code }
  },
}))
vi.mock('@/lib/paymentGateway', () => ({
  createPaymentIntent: m.createPaymentIntent,
  getPaymentIntents: vi.fn(async () => []),
}))
vi.mock('@/lib/auditLog', () => ({ writeAuditLog: vi.fn() }))
vi.mock('@/lib/guestCheckout', () => ({
  sendGuestCheckoutOtp: vi.fn(),
  createGuestCheckoutSession: vi.fn(),
  describeGuestOtpError: vi.fn(() => ''),
}))
vi.mock('@/components/delivery/DistanceChecker', () => ({ DistanceChecker: () => null }))
vi.mock('@/components/delivery/DeliveryMapPicker', () => ({ DeliveryMapPicker: () => null }))
vi.mock('@/lib/bmbAdminApi_rounds', () => ({ listRoundsForDate: m.listRoundsForDate }))
vi.mock('@/lib/bmbMenuSchedule', () => ({
  getPublishedScheduleForDate: m.getPublishedScheduleForDate,
  mirrorPreOrderScheduleGate: vi.fn(() => ({ allowed: true })),
  checkModeEligibility: vi.fn(() => ({ ok: true, rejected: [] })),
}))
vi.mock('@/lib/deliveryFeeApi', () => ({
  fetchServerDeliveryFee: m.fetchServerDeliveryFee,
  feeUiState: vi.fn(() => ({ label: '', cls: '' })),
  summaryFeeState: vi.fn(() => ({ feeLabel: '', feeValue: '', totalSuffix: '', exact: true })),
}))
vi.mock('@/lib/bmbAdminApi_settings', () => ({ getBusinessSettings: vi.fn(async () => ({})) }))
vi.mock('@/lib/brandResolver', () => ({ resolvePublicBranch: vi.fn(async () => ({ branch_id: 'br1' })) }))
vi.mock('@/lib/bmbAdminApi_products', () => ({ getProducts: vi.fn(async () => []) }))
vi.mock('@/lib/cartPersistence', () => ({
  revalidateWithCatalog: vi.fn(async () => ({ changed: false })),
  reportToToastMessage: vi.fn(),
}))
vi.mock('@/lib/locationLogin', () => ({ getTrustedGpsLocation: vi.fn(async () => null) }))
vi.mock('@/store/locationStore', () => ({
  useLocationStore: Object.assign(
    (sel?: (s: unknown) => unknown) => (sel ? sel({ location: null }) : { location: null }),
    { getState: () => ({ location: null }) },
  ),
  isTrustedSource: () => false,
  deliveryPointStatus: () => ({ orderable: true }), // ข้าม CR-2 gate (UI เท่านั้น ไม่แตะ server)
}))

import { CheckoutPage } from '@/pages/CheckoutPage'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'

function product(id: string, name: string): Product {
  return {
    id, name, description: '', price: 45, image_url: '', is_available: true,
    category_id: 'c1', display_order: 0, store_id: 's1',
  } as unknown as Product
}

const round = {
  id: 'r1', round_key: 'morning', display_name: 'รอบเช้า',
  cutoff_time: '23:59', current_count: 0, max_capacity: 99,
}

let container: HTMLDivElement
let root: Root
let lastPath = '/'

function LocationProbe() {
  lastPath = useLocation().pathname
  return null
}

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0))
    await new Promise((r) => setTimeout(r, 0))
    await new Promise((r) => setTimeout(r, 0))
  })
}

async function mountMixedCart() {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  useCartStore.setState({
    items: [
      { product: product('sd-1', 'ส้มตำ'), quantity: 1, customizations: {}, subtotal: 45, line_mode: 'SAME_DAY' },
      { product: product('po-1', 'ข้าวผัดปู'), quantity: 1, customizations: {}, subtotal: 45, line_mode: 'PRE_ORDER' },
    ] as never,
    order_mode: 'SAME_DAY',
    pendingMode: null,
    isHydrated: true,
    couponCode: '',
    appliedPromotion: null,
    subtotal: 90, discount: 0, deliveryFee: 0, total: 90, cartTotal: 90,
  })
  useAuthStore.setState({
    customer: { id: 'u1', name: 'Test Customer', phone: '0800000000' } as never,
    isAuthenticated: true,
  })
  await act(async () => {
    root.render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/checkout'] },
        React.createElement(LocationProbe),
        React.createElement(CheckoutPage),
      ),
    )
  })
  await flush()
}

function placeOrderBtn(): HTMLButtonElement {
  return container.querySelector('[data-testid="place-order"]') as HTMLButtonElement
}
function selectCod() {
  ;(container.querySelector('input[value="cash_on_delivery"]') as HTMLInputElement).click()
}

beforeEach(() => {
  vi.clearAllMocks()
  lastPath = '/'
  m.listRoundsForDate.mockResolvedValue([round])
  m.getPublishedScheduleForDate.mockResolvedValue([])
  m.fetchServerDeliveryFee.mockResolvedValue({ fee: 0 })
})

afterEach(async () => {
  await act(async () => { root.unmount() })
  container.remove()
  useAuthStore.setState({ customer: null, isAuthenticated: false })
})

describe('CheckoutPage — M1 mixed-split wiring (component level)', () => {
  it('mixed + promptpay (ค่าเริ่มต้น) → ปฏิเสธก่อน createOrder RPC ใด ๆ', async () => {
    await mountMixedCart()
    await act(async () => { placeOrderBtn().click() })
    await flush()

    expect(m.createOrder).not.toHaveBeenCalled() // B4: ไม่มี RPC ก่อน gate
    expect(m.createPaymentIntent).not.toHaveBeenCalled()
    expect(m.showToast).toHaveBeenCalledWith(expect.stringContaining('เงินสดปลายทาง'), 'error')
    expect(lastPath).toBe('/checkout')
    expect(useCartStore.getState().items.length).toBe(2) // cart คงเดิม
  })

  it('mixed + COD → createOrder 2 ครั้ง (SAME_DAY ก่อน PRE_ORDER) + navigate + clearCart', async () => {
    await mountMixedCart()
    m.createOrder
      .mockResolvedValueOnce({ order_number: 'BMB-20261013-111', total_amount: 100 })
      .mockResolvedValueOnce({ order_number: 'PO-20261014-222', total_amount: 200 })
    await act(async () => { selectCod() })
    await act(async () => { placeOrderBtn().click() })
    await flush()

    expect(m.createOrder).toHaveBeenCalledTimes(2)
    expect(m.createOrder.mock.calls[0][0].order_mode).toBe('SAME_DAY') // deterministic
    expect(m.createOrder.mock.calls[1][0].order_mode).toBe('PRE_ORDER')
    expect(m.createOrder.mock.calls[0][0].payment_method).toBe('cash_on_delivery')
    // intent 1:1 ต่อ child (คนละ order_number — ไม่มี intent ซ้ำ)
    expect(m.createPaymentIntent).toHaveBeenCalledTimes(2)
    expect(m.createPaymentIntent.mock.calls.map((c) => c[0])).toEqual(['BMB-20261013-111', 'PO-20261014-222'])
    expect(lastPath).toBe('/payment/BMB-20261013-111')
    expect(useCartStore.getState().items.length).toBe(0)
    expect(m.showToast).toHaveBeenCalledWith(expect.stringContaining('สั่งซื้อสำเร็จ 2 ออเดอร์'), 'success')
  })

  it('partial (child ที่ 2 = null/กำกวม) → ไม่อ้าง success + ไม่ clearCart + ไม่ navigate', async () => {
    await mountMixedCart()
    m.createOrder
      .mockResolvedValueOnce({ order_number: 'BMB-20261013-333', total_amount: 100 })
      .mockResolvedValueOnce(null) // ผลกำกวม → engine = ambiguous/pending
    await act(async () => { selectCod() })
    await act(async () => { placeOrderBtn().click() })
    await flush()

    expect(m.createOrder).toHaveBeenCalledTimes(2)
    expect(m.showToast).toHaveBeenCalledWith(expect.stringContaining('ห้ามถือว่าสำเร็จ'), 'error')
    expect(lastPath).toBe('/checkout') // ไม่ navigate ตอนผลไม่ครบ
    expect(useCartStore.getState().items.length).toBe(2) // cart คงไว้เพื่อ reconcile
    expect(m.showToast).not.toHaveBeenCalledWith(expect.stringContaining('สั่งซื้อสำเร็จ 2 ออเดอร์'), 'success')
  })
})
