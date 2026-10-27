/**
 * R5c (Owner 2026-10-23) — CheckoutPage contract:
 *  - โหมดออเดอร์ = ผลจากเนื้อตะกร้า (มีบรรทัด "จองล่วงหน้า" = PRE_ORDER ทั้งตะกร้า)
 *  - ไม่มีช่องเลือกวันอิสระ — วันล็อกจากป้ายเมนู (menu_schedule) เท่านั้น
 *  - ไม่มีเมนูปฏิทินในตะกร้า = SAME_DAY เท่านั้น (deep link ?mode= ไม่เปลี่ยนโหมด)
 *  - PRE_ORDER โดยไม่มีเมนูปฏิทิน = ถูกบล็อก (mirror ของ ERR_PRE_ORDER_REQUIRES_MENU)
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
  deliveryPointStatus: () => ({ orderable: true, confirmable: true }), // UI-only harness
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

async function mount(initialEntry: string, lines: Array<{ product: Product; line_mode: 'SAME_DAY' | 'PRE_ORDER' }>) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  useCartStore.setState({
    items: lines.map((l) => ({ product: l.product, quantity: 1, customizations: {}, subtotal: 45, line_mode: l.line_mode })),
    order_mode: lines.some((l) => l.line_mode === 'PRE_ORDER') ? 'PRE_ORDER' : 'SAME_DAY',
    isHydrated: true,
    couponCode: '',
    appliedPromotion: null,
    subtotal: 45 * lines.length,
    discount: 0,
    deliveryFee: 0,
    total: 45 * lines.length,
    cartTotal: 45 * lines.length,
  })
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
  m.listRoundsForDate.mockResolvedValue([round])
  m.getPublishedScheduleForDate.mockResolvedValue([])
  m.fetchServerDeliveryFee.mockResolvedValue({ delivery_fee: 0, source: 'server' })
})

afterEach(async () => {
  await act(async () => {
    root.unmount()
  })
  container.remove()
  useAuthStore.setState({ customer: null, isAuthenticated: false })
})

describe('R5c — order mode derives from the cart (no mode switch)', () => {
  it('menu-calendar line (PRE_ORDER) -> PRE_ORDER UI + date locked from menu badge + NO date input', async () => {
    m.getProductScheduleMap.mockResolvedValue({ 'menu-1': MENU_DATE })
    await mount('/checkout', [{ product: product('menu-1', 'Menu 1'), line_mode: 'PRE_ORDER' }])

    expect(container.textContent).toContain('จองล่วงหน้า (Pre-order)')
    const dateEl = container.querySelector('[data-testid="preorder-date"]')
    expect(dateEl?.textContent).toContain(MENU_DATE)
    expect(container.textContent).toContain('วันจัดส่งถูกกำหนดโดยเมนูรอบพิเศษของแอดมิน')
    // R5c: no free-date picker anymore
    expect(container.querySelectorAll('input[type="date"]').length).toBe(0)
  })

  it('general-only cart -> SAME_DAY even with ?mode=pre-order (no free-date pre-order)', async () => {
    m.getProductScheduleMap.mockResolvedValue({})
    await mount('/checkout?mode=pre-order', [{ product: product('a', 'General A'), line_mode: 'SAME_DAY' }])

    expect(container.textContent).toContain('สั่งซื้อวันนี้ (Same-day)')
    expect(container.textContent).not.toContain('จองล่วงหน้า (Pre-order)')
    expect(container.querySelectorAll('[data-testid="preorder-date"]').length).toBe(0)
    expect(container.querySelectorAll('input[type="date"]').length).toBe(0)
  })

  it('general + menu cart -> ONE PRE_ORDER order (general items ride along)', async () => {
    m.getProductScheduleMap.mockResolvedValue({ 'menu-1': MENU_DATE })
    await mount('/checkout', [
      { product: product('menu-1', 'Menu 1'), line_mode: 'PRE_ORDER' },
      { product: product('gen-1', 'General 1'), line_mode: 'SAME_DAY' },
    ])

    expect(container.textContent).toContain('จองล่วงหน้า (Pre-order)')
    const dateEl = container.querySelector('[data-testid="preorder-date"]')
    expect(dateEl?.textContent).toContain(MENU_DATE)
  })
})

describe('R5c — PRE_ORDER requires a calendar menu (mirror ERR_PRE_ORDER_REQUIRES_MENU)', () => {
  it('PRE_ORDER cart whose menu is off the calendar -> warning + submit blocked (createOrder never called)', async () => {
    m.getProductScheduleMap.mockResolvedValue({})
    await mount('/checkout', [{ product: product('stale-1', 'Stale menu'), line_mode: 'PRE_ORDER' }])

    expect(container.querySelector('[data-testid="preorder-requires-menu"]')).toBeTruthy()

    const submit = Array.from(container.querySelectorAll('button')).find((b) => (b.textContent || '').includes('ยืนยันสั่งซื้อ'))
    expect(submit).toBeTruthy()
    await act(async () => {
      submit!.click()
    })
    await flush()
    expect(m.createOrder).not.toHaveBeenCalled()
    expect(m.showToast).toHaveBeenCalledWith(expect.stringContaining('พรีออเดอร์ต้องมีเมนูจากปฏิทิน'), 'error')
    expect(lastPath).toBe('/checkout')
  })
})