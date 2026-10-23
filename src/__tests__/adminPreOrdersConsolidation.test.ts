/**
 * Phase 4 — AdminPreOrders consolidation (RC-6 · INV-12 · INV-13)
 *
 * (ก) route redirect ของ /admin/pre-orders (ข) preset filter จาก URL ที่ AdminOrders อ่านจริง
 * (ค) nav invariant = มี test เดิมใน adminUi.test.ts:66-71 (คงเดิม)
 * (ง) ไม่เหลือ reference `pages/admin/AdminPreOrders` ใน src (recursive scan)
 *
 * NOTE: ไฟล์ต้องเป็น `.ts` (vitest include ไม่รับ .tsx)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import type { OrderForm } from '@/lib/bmbAdminApi_orders'
// source-contract ตาม convention ของ adminShell.test.ts (Vite `?raw`)
import appSrc from '../App.tsx?raw'
import adminDashboardSrc from '../pages/admin/AdminDashboard.tsx?raw'
import adminUiSrc from '../lib/adminUi.ts?raw'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

const m = vi.hoisted(() => ({
  getOrdersPaged: vi.fn(),
  getDeliveryAssignmentsFor: vi.fn(),
  getRoundsByIds: vi.fn(),
  getProductsAdmin: vi.fn(),
  showToast: vi.fn(),
}))

vi.mock('@/lib/bmbAdminApi_orders', () => ({
  getOrdersPaged: m.getOrdersPaged,
  updateOrderStatus: vi.fn(),
  confirmOfflinePayment: vi.fn(),
  stripeRefundOrder: vi.fn(),
  cancelOrder: vi.fn(),
  getDeliveryAssignmentsFor: m.getDeliveryAssignmentsFor,
  getOrderStatusHistory: vi.fn(),
  getOrderAuditTrail: vi.fn(),
  getRoundsByIds: m.getRoundsByIds,
}))

vi.mock('@/lib/bmbAdminApi_products', () => ({ getProductsAdmin: m.getProductsAdmin }))
vi.mock('@/components/ui/ToastContainer', () => ({ showToast: m.showToast }))
// A2+M5 (2026-10-22): AdminOrders batch-reads payment_intents per page (SlipReviewPanel)
// — stub ให้ hermetic ไม่ต้องแตะ supabase จริงในเทสต์หน้านี้
// D-04 (R1.2): + getPaymentExceptionOrders (แผงตรวจสลิปโหลดรายการรอตรวจเอง)
vi.mock('@/lib/paymentExceptions', () => ({
  getPaymentIntentsFor: vi.fn(async () => []),
  getPaymentExceptionOrders: vi.fn(async () => []),
  describePaymentConfirmError: (e: unknown) => String(e || ''),
  paymentConfirmability: () => ({ confirmable: true, reason: '' }),
}))
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return actual // ใช้ router จริง — Link/useSearchParams ต้องมี context
})

import { AdminOrders } from '@/pages/admin/AdminOrders'

const PO_ORDER = {
  id: 'o1',
  order_number: 'BMB-PO-1',
  customer_name: 'Test',
  customer_phone: '0800000000',
  created_at: '2026-10-13T10:00:00+07:00',
  order_mode: 'PRE_ORDER',
  status: 'confirmed',
  payment_status: 'pending',
  payment_method: 'cod',
  total_amount: 100,
  scheduled_date: '2099-10-20',
  delivery_round_id: 'R1',
  items: [{ product_id: 'p1', product_name: 'Pad Thai', quantity: 1, unit_price: 100, customizations: {} }],
} as unknown as OrderForm

let container: HTMLDivElement
let root: Root

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0))
    await new Promise((r) => setTimeout(r, 0))
  })
}

async function mount(entry: string) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root.render(
      React.createElement(
        MemoryRouter,
        { initialEntries: [entry] },
        React.createElement(AdminOrders),
      ),
    )
  })
  await flush()
}

beforeEach(() => {
  vi.clearAllMocks()
  m.getOrdersPaged.mockImplementation(async (opts: { orderMode?: 'SAME_DAY' | 'PRE_ORDER' }) => ({
    orders: opts.orderMode === 'PRE_ORDER' ? [PO_ORDER] : [],
    total: opts.orderMode === 'PRE_ORDER' ? 1 : 0,
  }))
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

function firstCallMode(): 'SAME_DAY' | 'PRE_ORDER' | undefined {
  expect(m.getOrdersPaged.mock.calls.length).toBeGreaterThan(0)
  return m.getOrdersPaged.mock.calls[0][0].orderMode
}

describe('Phase 4 — AdminOrders preset จาก URL (bookmark /admin/pre-orders ไม่ตาย)', () => {
  it('?mode=PRE_ORDER → query แรก = orderMode PRE_ORDER + grouping header เปิด', async () => {
    await mount('/admin/orders?mode=PRE_ORDER')
    expect(firstCallMode()).toBe('PRE_ORDER')
    expect(container.textContent).toContain('BMB-PO-1')
    expect(container.querySelector('[data-testid="preorder-queue-header"]')).toBeTruthy()
  })

  it('?mode=SAME_DAY → query แรก = orderMode SAME_DAY', async () => {
    await mount('/admin/orders?mode=SAME_DAY')
    expect(firstCallMode()).toBe('SAME_DAY')
  })

  it('ไม่มี param → all modes (orderMode undefined) — พฤติกรรมเดิมไม่เปลี่ยน', async () => {
    await mount('/admin/orders')
    expect(firstCallMode()).toBeUndefined()
  })
})

describe('Phase 4 — route/nav/source contract', () => {
  it('App.tsx: /admin/pre-orders = Navigate → /admin/orders?mode=PRE_ORDER + ไม่เหลือ lazy import', () => {
    expect(appSrc).toContain('path="/admin/pre-orders"')
    expect(appSrc).toContain('Navigate to="/admin/orders?mode=PRE_ORDER" replace')
    expect(appSrc).not.toContain("import('./pages/admin/AdminPreOrders')")
    expect(appSrc).not.toContain('<AdminPreOrders')
  })

  it('ไม่มีไฟล์ใดใน src import อ้าง pages/admin/AdminPreOrders (recursive scan = 0)', () => {
    const all = import.meta.glob('../**/*.{ts,tsx}', {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>
    const offenders = Object.entries(all)
      .filter(([path]) => !path.includes('adminPreOrdersConsolidation')) // ไม่นับตัว test เองที่ถือ pattern
      .filter(([, code]) => code.includes('pages/admin/AdminPreOrders'))
      .map(([path]) => path)
    expect(offenders).toEqual([])
  })

  it('AdminDashboard quick link ชี้ /admin/orders?mode=PRE_ORDER (ไม่ใช่หน้าเก่า)', () => {
    expect(adminDashboardSrc).toContain('/admin/orders?mode=PRE_ORDER')
    expect(adminDashboardSrc).not.toContain('"/admin/pre-orders"')
  })

  it('adminUi: ไม่มี nav entry /admin/pre-orders เหลือทั้ง items และ groups (flatten invariant คงเดิม = adminUi.test)', () => {
    expect(adminUiSrc).not.toContain('/admin/pre-orders')
  })
})

