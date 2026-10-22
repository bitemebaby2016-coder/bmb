/**
 * Phase 2 — CheckoutPage mode-lock (RC-3 · OD-4 · INV-04 ข)
 *
 * `?mode=pre-order` + ตะกร้าล็อก SAME_DAY → lock ชนะ + แจ้งผู้ใช้ ห้ามสลับโหมดเงียบ ๆ
 * deep link ยังได้ผลเมื่อ "ยังไม่มี lock" (ของเดิมที่ใช้ได้ คงไว้)
 *
 * NOTE: ไฟล์ต้องเป็น `.ts` (vitest include ไม่รับ .tsx) — ใช้ React.createElement
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router-dom'
import type { Product } from '@/types'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

if (typeof window.matchMedia !== 'function') {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}
if (typeof (globalThis as Record<string, unknown>).ResizeObserver === 'undefined') {
  class RO {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  ;(globalThis as Record<string, unknown>).ResizeObserver = RO
}

const m = vi.hoisted(() => ({
  showToast: vi.fn(),
  createOrder: vi.fn(),
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
  createPaymentIntent: vi.fn(),
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
  mirrorPreOrderScheduleGate: vi.fn(),
}))
vi.mock('@/lib/deliveryFeeApi', () => ({
  fetchServerDeliveryFee: m.fetchServerDeliveryFee,
  feeUiState: vi.fn(() => ({ label: '', cls: '' })),
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
  deliveryPointStatus: () => 'unknown',
}))

import { CheckoutPage } from '@/pages/CheckoutPage'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'

function sdProduct(): Product {
  return {
    id: 'sd-1',
    name: 'ส้มตำ',
    description: '',
    price: 45,
    category_id: '',
    image_url: '',
    is_available: true,
    is_featured: false,
    is_preorder: false,
    prep_minutes: 0,
    sort_order: 0,
    created_at: '',
  } as Product
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}
function addDaysStr(d: string, n: number): string {
  const dt = new Date(d + 'T00:00:00')
  dt.setDate(dt.getDate() + n)
  return dt.toISOString().slice(0, 10)
}

let container: HTMLDivElement
let root: Root
let lastPath = '/'

function LocationProbe() {
  const loc = useLocation()
  lastPath = loc.pathname
  return null
}

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0))
    await new Promise((r) => setTimeout(r, 0))
    await new Promise((r) => setTimeout(r, 0))
  })
}

async function mount(initialEntry: string, cart: { order_mode: 'SAME_DAY' | 'PRE_ORDER' | null; withItem: boolean }) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  useCartStore.setState({
    items: cart.withItem
      ? [{ product: sdProduct(), quantity: 1, customizations: {}, subtotal: 45 }]
      : [],
    order_mode: cart.order_mode,
    pendingMode: null,
    isHydrated: true,
    couponCode: '',
    appliedPromotion: null,
    subtotal: cart.withItem ? 45 : 0,
    discount: 0,
    deliveryFee: 0,
    total: cart.withItem ? 45 : 0,
    cartTotal: cart.withItem ? 45 : 0,
  })
  // login ปลอม — ข้าม guest OTP gate เพื่อเข้าถึง checkout body (UI เท่านั้น ไม่แตะ server)
  useAuthStore.setState({
    customer: { id: 'u1', name: 'Test Customer', phone: '0800000000' } as never,
    isAuthenticated: true,
  })
  await act(async () => {
    root.render(
      React.createElement(
        MemoryRouter,
        { initialEntries: [initialEntry] },
        React.createElement(LocationProbe),
        React.createElement(CheckoutPage),
      ),
    )
  })
  await flush()
}

beforeEach(() => {
  vi.clearAllMocks()
  lastPath = '/'
  m.listRoundsForDate.mockResolvedValue([])
  m.getPublishedScheduleForDate.mockResolvedValue([])
  m.fetchServerDeliveryFee.mockResolvedValue({ fee: 0 })
})

afterEach(async () => {
  await act(async () => {
    root.unmount()
  })
  container.remove()
  useAuthStore.setState({ customer: null, isAuthenticated: false })
})

describe('CheckoutPage — cart lock vs deep link ?mode=pre-order (RC-3 · OD-4)', () => {
  it('ล็อก SAME_DAY + ?mode=pre-order → lock ชนะ + แจ้งผู้ใช้ ห้ามสลับโหมดเงียบ ๆ', async () => {
    await mount('/checkout?mode=pre-order', { order_mode: 'SAME_DAY', withItem: true })

    expect(container.textContent).toContain('🔥 สั่งซื้อวันนี้ (Same-day)')
    expect(container.textContent).not.toContain('📅 สั่งซื้อแบบจองล่วงหน้า (Pre-order)')
    expect(container.querySelectorAll('input[type="date"]').length).toBe(0)
    expect(m.showToast).toHaveBeenCalledWith(expect.stringContaining('ใช้โหมดเดิม'), 'info')
    expect(lastPath).toBe('/checkout') // ไม่ redirect/เปลี่ยนหน้า
  })

  it('ยังไม่มี lock + ?mode=pre-order → deep link ได้ผลตามเดิม (PRE_ORDER UI + date picker)', async () => {
    await mount('/checkout?mode=pre-order', { order_mode: null, withItem: true })

    expect(container.textContent).toContain('📅 สั่งซื้อแบบจองล่วงหน้า (Pre-order)')
    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement | null
    expect(dateInput).toBeTruthy()
    expect(dateInput!.min).toBe(addDaysStr(todayStr(), 1))
  })

  it('ล็อก PRE_ORDER (ไม่มี deep link) → PRE_ORDER UI คงเดิม ไม่มี conflict', async () => {
    await mount('/checkout', { order_mode: 'PRE_ORDER', withItem: true })

    expect(container.textContent).toContain('📅 สั่งซื้อแบบจองล่วงหน้า (Pre-order)')
    expect(m.showToast).not.toHaveBeenCalledWith(expect.stringContaining('ใช้โหมดเดิม'), 'info')
  })
})

