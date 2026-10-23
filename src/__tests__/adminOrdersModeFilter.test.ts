/**
 * Phase 3 — AdminOrders mode-filter wiring (RC-1 / INV-11)
 *
 * Page-level regression test: ขับ component จริง (render + คลิกปุ่มกรองโหมดจริง)
 * แล้ว assert ว่า `filterMode` ถูกส่งเข้า `getOrdersPaged({ orderMode })` ทั้ง 3 ค่า
 * และ pagination คง mode filter ไว้ — ต่างจาก `adminOrdersOp.test.ts:79-83`
 * ที่เป็นแค่ API level.
 *
 * NOTE: ไฟล์นี้ต้องเป็น `.ts` — vitest include pattern ระบุ .js/.ts เท่านั้น (ไม่รับ .tsx)
 * จึงใช้ React.createElement แทน JSX.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { OrderForm } from '@/lib/bmbAdminApi_orders'

// React 19: ต้องเปิด flag นี้ก่อนใช้ act() ใน test environment
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

const m = vi.hoisted(() => ({
  getOrdersPaged: vi.fn(),
  updateOrderStatus: vi.fn(),
  confirmOfflinePayment: vi.fn(),
  stripeRefundOrder: vi.fn(),
  cancelOrder: vi.fn(),
  getDeliveryAssignmentsFor: vi.fn(),
  getOrderStatusHistory: vi.fn(),
  getOrderAuditTrail: vi.fn(),
  getRoundsByIds: vi.fn(),
  getProductsAdmin: vi.fn(),
  showToast: vi.fn(),
}))

vi.mock('@/lib/bmbAdminApi_orders', () => ({
  getOrdersPaged: m.getOrdersPaged,
  updateOrderStatus: m.updateOrderStatus,
  confirmOfflinePayment: m.confirmOfflinePayment,
  stripeRefundOrder: m.stripeRefundOrder,
  cancelOrder: m.cancelOrder,
  getDeliveryAssignmentsFor: m.getDeliveryAssignmentsFor,
  getOrderStatusHistory: m.getOrderStatusHistory,
  getOrderAuditTrail: m.getOrderAuditTrail,
  getRoundsByIds: m.getRoundsByIds,
}))

vi.mock('@/lib/bmbAdminApi_products', () => ({
  getProductsAdmin: m.getProductsAdmin,
}))

vi.mock('@/components/ui/ToastContainer', () => ({
  showToast: m.showToast,
}))

// A2+M5 (2026-10-22): AdminOrders batch-reads payment_intents per page (SlipReviewPanel)
// — stub ให้ hermetic ไม่ต้องแตะ supabase จริงในเทสต์หน้านี้
// D-04 (R1.2): + getPaymentExceptionOrders (แผงตรวจสลิปโหลดรายการรอตรวจเอง)
vi.mock('@/lib/paymentExceptions', () => ({
  getPaymentIntentsFor: vi.fn(async () => []),
  getPaymentExceptionOrders: vi.fn(async () => []),
  describePaymentConfirmError: (e: unknown) => String(e || ''),
  paymentConfirmability: () => ({ confirmable: true, reason: '' }),
}))

vi.mock('react-router-dom', () => ({
  // AdminOrders ใช้แค่ <Link> + useSearchParams (Phase 4 preset) — ไม่ต้องมี Router เต็ม
  Link: (props: { to: string; className?: string; children?: React.ReactNode }) =>
    React.createElement('a', { href: props.to, className: props.className }, props.children),
  useSearchParams: () => [new URLSearchParams('')],
}))

import { AdminOrders } from '@/pages/admin/AdminOrders'

function makeOrder(overrides: Partial<OrderForm>): OrderForm {
  return {
    id: 'o1',
    order_number: 'BMB-0001',
    customer_name: 'Test Customer',
    customer_phone: '0800000000',
    created_at: '2026-10-13T10:00:00+07:00',
    order_mode: 'SAME_DAY',
    status: 'pending',
    payment_status: 'pending',
    payment_method: 'cod',
    total_amount: 120,
    scheduled_date: null,
    delivery_round_id: null,
    items: [
      { product_id: 'p1', product_name: 'Pad Thai', quantity: 1, unit_price: 120, customizations: {} },
    ],
    ...overrides,
  } as unknown as OrderForm
}

const SD_ORDER = makeOrder({ id: 'o-sd', order_number: 'BMB-SD-1', order_mode: 'SAME_DAY' })

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0))
    await new Promise((r) => setTimeout(r, 0))
  })
}

async function mount() {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root.render(React.createElement(AdminOrders))
  })
  await flush()
}

function findButton(label: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll('button')).find(
    (b) => (b.textContent || '').trim() === label,
  )
}

async function clickModeButton(label: string) {
  const btn = findButton(label)
  expect(btn, `ปุ่ม "${label}" ไม่พบในหน้า`).toBeTruthy()
  await act(async () => {
    (btn as HTMLButtonElement).click()
  })
  await flush()
}

function lastCallArgs() {
  expect(m.getOrdersPaged.mock.calls.length).toBeGreaterThan(0)
  return m.getOrdersPaged.mock.calls[m.getOrdersPaged.mock.calls.length - 1][0]
}

beforeEach(() => {
  vi.clearAllMocks()
  // ข้อมูล mock: SAME_DAY = BMB-SD-1 · PRE_ORDER = BMB-PO-1 · ไม่กรอง = ทั้งคู่
  // PRE_ORDER ตั้ง total > PAGE_SIZE เพื่อให้ปุ่ม "ถัดไป" ใช้งานได้ (test pagination)
  m.getOrdersPaged.mockImplementation(async (opts: { page: number; orderMode?: 'SAME_DAY' | 'PRE_ORDER' }) => {
    const rows =
      opts.orderMode === 'SAME_DAY' ? [SD_ORDER] : opts.orderMode === 'PRE_ORDER' ? [PO_ORDER] : [SD_ORDER, PO_ORDER]
    const total = opts.orderMode === 'PRE_ORDER' ? 30 : rows.length
    return { orders: rows, total }
  })
  m.getDeliveryAssignmentsFor.mockResolvedValue([])
  m.getRoundsByIds.mockResolvedValue([])
  m.getProductsAdmin.mockResolvedValue([])
})

afterEach(async () => {
  await act(async () => {
    root.unmount()
  })
  container.remove()
})

describe('AdminOrders — mode filter wiring (Phase 3 / RC-1 / INV-11)', () => {
  it('initial load: all modes → orderMode = undefined (ไม่กรองฝั่ง server)', async () => {
    await mount()
    expect(m.getOrdersPaged).toHaveBeenCalledTimes(1)
    expect(m.getOrdersPaged.mock.calls[0][0]).toMatchObject({
      page: 0,
      orderMode: undefined,
      status: undefined,
    })
    expect(container.textContent).toContain('BMB-SD-1')
    expect(container.textContent).toContain('BMB-PO-1')
  })

  it('คลิก ⚡ SAME_DAY → getOrdersPaged ได้ orderMode=SAME_DAY และโชว์เฉพาะ SAME_DAY', async () => {
    await mount()
    await clickModeButton('⚡ SAME_DAY')
    expect(lastCallArgs()).toMatchObject({ page: 0, orderMode: 'SAME_DAY' })
    expect(container.textContent).toContain('BMB-SD-1')
    expect(container.textContent).not.toContain('BMB-PO-1')
  })

  it('คลิก 📅 PRE_ORDER → orderMode=PRE_ORDER + ได้เฉพาะ PRE_ORDER + queue grouping เปิด', async () => {
    await mount()
    await clickModeButton('📅 PRE_ORDER')
    expect(lastCallArgs()).toMatchObject({ page: 0, orderMode: 'PRE_ORDER' })
    expect(container.textContent).toContain('BMB-PO-1')
    expect(container.textContent).not.toContain('BMB-SD-1')
    // grouping header แสดงเฉพาะเมื่อ filterMode === 'PRE_ORDER' (AdminOrders.tsx)
    expect(container.querySelector('[data-testid="preorder-queue-header"]')).toBeTruthy()
  })

  it('คลิก All modes กลับ → orderMode กลับเป็น undefined และโชว์ทั้งสองโหมด', async () => {
    await mount()
    await clickModeButton('📅 PRE_ORDER')
    await clickModeButton('All modes')
    expect(lastCallArgs()).toMatchObject({ page: 0, orderMode: undefined })
    expect(container.textContent).toContain('BMB-SD-1')
    expect(container.textContent).toContain('BMB-PO-1')
  })

  it('pagination คง mode filter ไว้ (ถัดไป ขณะกรอง PRE_ORDER → page=1 + orderMode=PRE_ORDER)', async () => {
    await mount()
    await clickModeButton('📅 PRE_ORDER')
    const nextBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => (b.textContent || '').trim() === 'ถัดไป →',
    )
    expect(nextBtn).toBeTruthy()
    expect((nextBtn as HTMLButtonElement).disabled).toBe(false) // total=30 > PAGE_SIZE=25
    await act(async () => {
      ;(nextBtn as HTMLButtonElement).click()
    })
    await flush()
    expect(lastCallArgs()).toMatchObject({ page: 1, orderMode: 'PRE_ORDER' })
  })

  it('จำนวนผลลัพธ์ต่างกันจริงตาม acceptance (PRE_ORDER 1 รายการ vs All modes 2 รายการ)', async () => {
    await mount()
    const allCount = container.querySelectorAll('[data-testid="admin-order-badges"]').length
    await clickModeButton('📅 PRE_ORDER')
    const poCount = container.querySelectorAll('[data-testid="admin-order-badges"]').length
    expect(allCount).toBe(2)
    expect(poCount).toBe(1)
    expect(poCount).not.toBe(allCount)
  })
})

const PO_ORDER = makeOrder({
  id: 'o-po',
  order_number: 'BMB-PO-1',
  order_mode: 'PRE_ORDER',
  status: 'confirmed',
  scheduled_date: '2099-10-20',
  delivery_round_id: 'R1',
})

let container: HTMLDivElement
let root: Root
