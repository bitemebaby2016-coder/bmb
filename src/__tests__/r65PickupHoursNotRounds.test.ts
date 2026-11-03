/**
 * R65 (Owner 2026-11-03) — checkout pickup ไม่ผูกกับรอบ · ผูกกับเวลาเปิดร้าน:
 *  1) delivery นอกเวลาเปิดร้าน = ไม่มีรอบให้เลือก + ปุ่มสั่งปิด (พฤติกรรมเดิมคงไว้)
 *  2) pickup นอกเวลา = auto-select รอบตามเวลาปัจจุบัน (capacity-only) + การ์ดเวลารับ
 *     → แก้อาการ R65 "ไม่มีรอบให้เลือกในเช็คเอาท์" (roundBookability คืน shop_closed)
 *  3) pickup นอกเวลาไม่ติ๊กยืนยัน = บล็อกก่อนส่ง (ลูกค้าต้องแจ้งเป็น notice)
 *  4) ติ๊กยืนยันแล้ว = สั่งได้ + special_instructions แนบ "รับนอกเวลาเปิดร้าน"
 *     (พิมพ์ช่อง Notice บนสติกเกอร์) + delivery_method = pickup
 *  5) pickup ในเวลาเปิดร้าน = ไม่ต้องติ๊ก + ไม่แนบ notice
 *
 * NOTE: ไฟล์ต้องเป็น `.ts` (vitest include ไม่รับ .tsx) — ใช้ React.createElement
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
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
  getProductScheduleMap: vi.fn(),
  fetchServerDeliveryFee: vi.fn(),
  getBusinessSettings: vi.fn(),
}))

vi.mock('@/components/ui/ToastContainer', () => ({ showToast: m.showToast }))
vi.mock('@/lib/bmbAdminApi_orders', () => ({
  createOrder: m.createOrder,
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
vi.mock('@/lib/bmbAdminApi_settings', () => ({ getBusinessSettings: m.getBusinessSettings }))
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

// ---------------------------------------------------------------------------
// เวลาเปิดร้านที่ deterministic — mirror ของ contract 184 G0:
//   closedHours = [now+2h, now+3h] BKK → "now" อยู่นอกหน้าต่างเสมอ (รวมเคสข้ามเที่ยงคืน)
//   openHours   = [now-1h, now+1h] BKK → "now" อยู่ในหน้าต่างเสมอ
// ---------------------------------------------------------------------------
function bkkMinutesNow(): number {
  const bkk = new Date(Date.now() + 7 * 3_600_000) // UTC+7 = BKK wall clock
  return bkk.getUTCHours() * 60 + bkk.getUTCMinutes()
}
function hhmm(offsetMin: number): string {
  const t = ((bkkMinutesNow() + offsetMin) % 1440 + 1440) % 1440
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}
const closedHours = () => ({ open: hhmm(120), close: hhmm(180) })
const openHours = () => ({ open: hhmm(-60), close: hhmm(60) })

function product(id: string, name: string): Product {
  return {
    id, name, description: '', price: 45, image_url: '', is_available: true,
    category_id: 'c1', display_order: 0, store_id: 's1', available_same_day: true,
  } as unknown as Product
}

// หน้าต่าง 10:00–14:00 — pickup auto-select เลือกได้ทั้งเคส "อยู่ในหน้าต่าง" และ
// fallback `list.find(notFull)` เมื่อเลยหน้าต่าง (ยังไงก็ต้องได้รอบ = capacity-only)
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

async function mount() {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  useCartStore.setState({
    items: [{ product: product('p1', 'Menu 1'), quantity: 1, customizations: {}, subtotal: 45, line_mode: 'SAME_DAY' }],
    order_mode: 'SAME_DAY',
    isHydrated: true,
    couponCode: '',
    referralCode: '',
    appliedPromotion: null,
    subtotal: 45,
    discount: 0,
    deliveryFee: 0,
    total: 45,
    cartTotal: 45,
    cutlery: false,
    pointsRedemption: 0,
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

async function click(el: Element | null) {
  expect(el, 'element to click').toBeTruthy()
  await act(async () => {
    (el as HTMLElement).click()
  })
  await flush()
}

const $ = (sel: string) => container.querySelector(sel)
const placeOrder = () => $('[data-testid="place-order"]') as HTMLButtonElement | null
const pickupButton = () => $('[data-testid="fulfillment-pickup"]')

beforeEach(() => {
  vi.clearAllMocks()
  m.listRoundsForDate.mockResolvedValue([round])
  m.getPublishedScheduleForDate.mockResolvedValue([])
  m.getProductScheduleMap.mockResolvedValue({})
  m.fetchServerDeliveryFee.mockResolvedValue({ delivery_fee: 0, source: 'server' })
  m.getBusinessSettings.mockResolvedValue({ hours: closedHours() })
  m.createOrder.mockResolvedValue({
    order_number: 'BMB-R65-1', total_amount: 45, replay: false, discount_amount: 0,
  })
})

afterEach(async () => {
  await act(async () => {
    root.unmount()
  })
  container.remove()
  useAuthStore.setState({ customer: null, isAuthenticated: false })
})

describe('R65 ① delivery นอกเวลาเปิดร้าน = ไม่มีรอบให้เลือก (พฤติกรรมเดิมคงไว้)', () => {
  it('roundBookability=shop_closed → auto-select ว่าง + ปุ่มสั่งปิด + ไม่สร้างออเดอร์', async () => {
    await mount()

    // นอกเวลา → delivery ทุกรอบ shop_closed → เลือกไม่ได้ (อาการเดิมของ R65 ฝั่ง delivery)
    expect($('[data-testid="no-rounds"]')?.textContent).toContain('ยังไม่มีรอบที่เปิดรับสำหรับวันนี้')
    expect($('[data-testid="same-day-auto-round"]')).toBeNull()
    expect(placeOrder()?.disabled).toBe(true)

    expect(m.createOrder).not.toHaveBeenCalled()
  })
})

describe('R65 ② pickup นอกเวลา = auto-select รอบปัจจุบัน + การ์ดเวลารับ (แก้ R65)', () => {
  it('สลับเป็น pickup → เลือกรอบทันที (capacity-only) + ปุ่มสั่งเปิด + ack row โชว์', async () => {
    await mount()
    // baseline: delivery ยังไม่มีรอบ (ดู ①) — แล้วสลับ pickup
    expect($('[data-testid="no-rounds"]')).toBeTruthy()

    await click(pickupButton())

    // ไม่ผูกกับรอบ/เวลาเปิดร้าน → auto-select ได้ → การ์ดแทนที่ข้อความ "ไม่มีรอบ"
    expect($('[data-testid="pickup-hours-card"]')).toBeTruthy()
    expect($('[data-testid="no-rounds"]')).toBeNull()
    expect(placeOrder()?.disabled).toBe(false)

    // นอกเวลาเปิดร้าน → แบนเนอร์ + ช่องยืนยัน notice ปรากฏ
    expect($('[data-testid="pickup-outside-banner"]')).toBeTruthy()
    expect($('[data-testid="pickup-outside-ack-row"]')).toBeTruthy()
    expect($('[data-testid="pickup-hint"]')?.textContent).toContain('รับอาหารที่หน้าร้านได้ตลอดเวลาเปิดร้าน')
  })
})

describe('R65 ③ pickup นอกเวลาไม่ติ๊กยืนยัน = บล็อกก่อนส่ง (notice gate)', () => {
  it('กดสั่งโดยไม่ติ๊ก → toast เตือน + createOrder ไม่ถูกเรียก', async () => {
    await mount()
    await click(pickupButton())
    expect(placeOrder()?.disabled).toBe(false)

    await click(placeOrder())

    expect(m.showToast).toHaveBeenCalledWith(expect.stringContaining('อยู่นอกเวลาเปิดร้าน'), 'error')
    expect(m.createOrder).not.toHaveBeenCalled()
    // ช่องยืนยันถูกบังคับให้โชว์ (กัน UI ค้าง)
    expect($('[data-testid="pickup-outside-ack-row"]')).toBeTruthy()
  })
})

describe('R65 ④ ติ๊กยืนยันแล้ว = สั่งได้ + แนบ notice ลง special_instructions', () => {
  it('ติ๊ก "รับนอกเวลาเปิดร้าน" → createOrder ครั้งเดียว · notice + pickup + round ปัจจุบัน', async () => {
    await mount()
    // พิสูจน์การ join: ช้อนส้อม · นอกเวลา (cutlery ตั้งหลัง mount — mount reset เป็น false)
    useCartStore.setState({ cutlery: true })
    await click(pickupButton())

    const ack = $('[data-testid="pickup-outside-ack-row"] input[type="checkbox"]')
    await click(ack)
    expect((ack as HTMLInputElement).checked).toBe(true)

    await click(placeOrder())

    expect(m.createOrder).toHaveBeenCalledTimes(1)
    const input = m.createOrder.mock.calls[0][0] as {
      special_instructions: string
      delivery_method: string
      delivery_round_id: string
      delivery_address: string
      order_mode: string
    }
    expect(input.delivery_method).toBe('pickup')
    expect(input.delivery_address).toBe('รับที่ร้าน (Pickup)')
    expect(input.order_mode).toBe('SAME_DAY')
    expect(input.delivery_round_id).toBe('r1') // auto-select = รอบปัจจุบัน (ดีฟอลต์พิมพ์สติกเกอร์)
    expect(input.special_instructions).toBe('รับช้อนส้อม · รับนอกเวลาเปิดร้าน')
    expect(m.showToast).toHaveBeenCalledWith(expect.stringContaining('สั่งซื้อสำเร็จ'), 'success')
  })
})

describe('R65 ⑤ pickup ในเวลาเปิดร้าน = ไม่ต้องติ๊ก + ไม่แนบ notice', () => {
  it('hours ครอบคลุม now → ไม่มี ack row · สั่งผ่าน · special_instructions ไม่มี notice', async () => {
    m.getBusinessSettings.mockResolvedValue({ hours: openHours() })
    await mount()
    await click(pickupButton())

    expect($('[data-testid="pickup-hours-card"]')).toBeTruthy()
    expect($('[data-testid="pickup-outside-ack-row"]')).toBeNull()
    expect($('[data-testid="pickup-outside-banner"]')).toBeNull()

    await click(placeOrder())

    expect(m.createOrder).toHaveBeenCalledTimes(1)
    const input = m.createOrder.mock.calls[0][0] as {
      special_instructions: string
      delivery_method: string
    }
    expect(input.delivery_method).toBe('pickup')
    expect(input.special_instructions).not.toContain('รับนอกเวลาเปิดร้าน')
  })
})
