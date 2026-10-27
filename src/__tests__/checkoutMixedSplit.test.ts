/**
 * R5c (Owner 2026-10-23) — mixed cart = ONE order (M1 split engine removed)
 * 1) สินค้าทั่วไป + เมนูปฏิทิน → createOrder ครั้งเดียว ออเดอร์เดียว (PRE_ORDER, วันจากป้ายเมนู)
 * 2) ทุกวิธีชำระเงินใช้ได้กับตะกร้าผสม (เดิม mixed บังคับ COD เพราะต้อง split)
 * 3) ไม่มีการสร้างออเดอร์ที่ 2 (ไม่แยก Same-day/Pre-order)
 *
 * NOTE: ไฟล์ต้องเป็น `.ts` (vitest include ไม่รับ .tsx) — React.createElement
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

const MENU_DATE = '2099-01-15'

const m = vi.hoisted(() => ({
  showToast: vi.fn(),
  createOrder: vi.fn(),
  listRoundsForDate: vi.fn(),
  getPublishedScheduleForDate: vi.fn(),
  getProductScheduleMap: vi.fn(),
  fetchServerDeliveryFee: vi.fn(),
}))

vi.mock('@/components/ui/ToastContainer', () => ({ showToast: m.showToast }))
vi.mock('@/lib/bmbAdminApi_orders', () => ({
  createOrder: m.createOrder,
  // Owner 2026-10-27: CheckoutPage ย้ายไปใช้ createOrderDetailed (คืน errorCode) —
  // mock นี้ delegate กลับ m.createOrder เพื่อคง assertion เดิมทุกตัว
  createOrderDetailed: async (input: unknown) => {
    const result = await m.createOrder(input)
    return { result: result ?? null, errorCode: null }
  },
  orderInputFingerprint: (input: unknown) => JSON.stringify(input),
  OrderSubmitError: class extends Error {
    code: string
    constructor(code: string) { super(code); this.code = code }
  },
}))
vi.mock('@/lib/paymentGateway', () => ({
  createPaymentIntent: vi.fn(async () => ({ success: true })),
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
vi.mock('@/lib/productSchedule', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/lib/productSchedule')>()
  return { ...orig, getProductScheduleMap: m.getProductScheduleMap }
})
vi.mock('@/lib/deliveryFeeApi', () => ({
  fetchServerDeliveryFee: m.fetchServerDeliveryFee,
  feeUiState: vi.fn(() => ({ label: '', cls: '', tone: '', detail: '' })),
  summaryFeeState: vi.fn(() => ({ feeLabel: '', feeValue: '', totalSuffix: '', exact: true })),
}))
vi.mock('@/lib/bmbAdminApi_settings', () => ({ getBusinessSettings: vi.fn(async () => ({})) }))
vi.mock('@/lib/brandResolver', () => ({ resolvePublicBranch: vi.fn(async () => null) }))
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
  deliveryPointStatus: () => ({ orderable: true, confirmable: true }),
}))

import { CheckoutPage } from '@/pages/CheckoutPage'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'

function product(id: string, name: string): Product {
  return {
    id, name, description: '', price: 45, image_url: '', is_available: true,
    category_id: 'c1', display_order: 0, store_id: 's1', available_same_day: true,
  } as unknown as Product
}

const round = {
  id: 'r1', round_key: 'midday', display_name: 'Round Midday',
  cutoff_time: '23:59', delivery_start: '10:00', delivery_end: '14:00',
  current_count: 0, max_capacity: 99,
}

let container: HTMLDivElement
let root: Root

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0))
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
      { product: product('menu-1', 'Menu 1'), quantity: 1, customizations: {}, subtotal: 45, line_mode: 'PRE_ORDER' },
      { product: product('gen-1', 'General 1'), quantity: 1, customizations: {}, subtotal: 45, line_mode: 'SAME_DAY' },
    ],
    order_mode: 'PRE_ORDER',
    isHydrated: true,
    couponCode: '',
    appliedPromotion: null,
    subtotal: 90,
    discount: 0,
    deliveryFee: 0,
    total: 90,
    cartTotal: 90,
  })
  useAuthStore.setState({
    customer: { id: 'u1', name: 'Test Customer', phone: '0800000000' } as never,
    isAuthenticated: true,
  })
  await act(async () => {
    root.render(
      React.createElement(MemoryRouter, { initialEntries: ['/checkout'] }, React.createElement(CheckoutPage)),
    )
  })
  await flush()
}

async function clickSubmit(paymentValue?: string) {
  if (paymentValue) {
    const radio = container.querySelector(`input[name="payment"][value="${paymentValue}"]`) as HTMLInputElement | null
    await act(async () => {
      radio!.click()
    })
    await flush()
  }
  const submit = Array.from(container.querySelectorAll('button')).find((b) => (b.textContent || '').includes('ยืนยันสั่งซื้อ'))
  expect(submit).toBeTruthy()
  await act(async () => {
    submit!.click()
  })
  await flush()
}

beforeEach(() => {
  vi.clearAllMocks()
  m.listRoundsForDate.mockResolvedValue([round])
  m.getPublishedScheduleForDate.mockResolvedValue([])
  m.getProductScheduleMap.mockResolvedValue({ 'menu-1': MENU_DATE })
  m.fetchServerDeliveryFee.mockResolvedValue({ delivery_fee: 0, source: 'server' })
  m.createOrder.mockResolvedValue({ order_number: 'BMB-TEST-1', total_amount: 90, replay: false })
})

afterEach(async () => {
  await act(async () => {
    root.unmount()
  })
  container.remove()
  useAuthStore.setState({ customer: null, isAuthenticated: false })
})

describe('R5c — mixed cart (menu + general) = ONE order, never split', () => {
  it('createOrder called ONCE with ALL items + PRE_ORDER + menu date (COD)', async () => {
    await mountMixedCart()
    await clickSubmit('cash_on_delivery')

    expect(m.createOrder).toHaveBeenCalledTimes(1)
    const input = m.createOrder.mock.calls[0][0] as {
      items: Array<{ product_id: string }>
      order_mode: string
      scheduled_date?: string
      payment_method: string
    }
    expect(input.items.map((i) => i.product_id).sort()).toEqual(['gen-1', 'menu-1'])
    expect(input.order_mode).toBe('PRE_ORDER')
    expect(input.scheduled_date).toBe(MENU_DATE)
    expect(input.payment_method).toBe('cash_on_delivery')
  })

  it('promptpay works for mixed carts too (mixed is no longer COD-only — no split)', async () => {
    await mountMixedCart()
    await clickSubmit('promptpay_qr')

    expect(m.createOrder).toHaveBeenCalledTimes(1)
    expect(m.showToast).not.toHaveBeenCalledWith(expect.stringContaining('เงินสดปลายทาง'), 'error')
    const input = m.createOrder.mock.calls[0][0] as { payment_method: string }
    expect(input.payment_method).toBe('promptpay_qr')
  })

  it('never creates a second (same-day) order for the general items', async () => {
    await mountMixedCart()
    await clickSubmit('cash_on_delivery')

    expect(m.createOrder).toHaveBeenCalledTimes(1)
    const modes = m.createOrder.mock.calls.map((c) => (c[0] as { order_mode: string }).order_mode)
    expect(modes).toEqual(['PRE_ORDER'])
  })
})