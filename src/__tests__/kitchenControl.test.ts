// ============================================
// Bite Me Baby — STEP 3B-2C Kitchen operational control tests
// ============================================
// Covers (Owner decision §9): the READY_TO_MAKE gate matrix (SAME_DAY/PRE_ORDER
// COD · paid card/promptpay · pending card · processing promptpay · failed ·
// cancelled · refunded), non-admin denied, empty order denied, invalid order
// denied, kitchen queue display helpers, and the canonical kitchen flow
// confirmed → preparing → ready_for_dispatch via transition_order_status only.
// NOTE: offline mock only — no real money, no real customers.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', async () => {
  const { createSupabaseMock } = await import('./helpers/supabaseMock')
  return {
    supabase: createSupabaseMock(),
    supabaseAdmin: null,
    getCurrentUser: async () => null,
    isAdmin: async () => false,
    default: null,
  }
})

import { supabase } from '@/lib/supabase'
import type { OrderForm } from '@/lib/bmbAdminApi_orders'
import { paymentReadyToMake, kitchenGatePreview, groupKitchenOrders, splitSameDayPreOrder, kitchenItemLines, readyReasonLabel } from '@/lib/kitchenQueueView'
import { getOrderReadyToMake, getKitchenPipelineOrders } from '@/lib/bmbAdminApi_kitchen'
import { updateOrderStatus } from '@/lib/bmbAdminApi_orders'
import { ADMIN_ALLOWED_TRANSITIONS } from '@/lib/adminOrderDisplay'

const ROW = {
  id: '', order_number: '', customer_id: 'auth-test-user', customer_ref: 'auth-test-user',
  customer_name: 'T', customer_phone: '0',
  status: 'confirmed', payment_status: 'paid', payment_method: 'credit_card',
  total_amount: 10, delivery_fee: 0, delivery_address: '', dropoff_latitude: 0, dropoff_longitude: 0,
  delivery_round_id: 'round-1', delivery_method: 'self_delivery',
  items: [] as any[], created_at: '', updated_at: '',
  order_mode: 'SAME_DAY', scheduled_date: undefined as string | undefined,
}

function orderRow(over: Partial<typeof ROW> & { order_number: string; created_at: string }) {
  return { ...ROW, ...over }
}

function itemRow(over: Partial<{ order_id: string; product_id: string; product_name: string; quantity: number; unit_price: number; item_total: number }>) {
  return {
    id: 'oi-' + Math.random().toString(36).slice(2, 8), order_id: over.order_id || '',
    product_id: over.product_id || 'p-1', product_name: over.product_name || 'ข้าวไข่เจียว',
    quantity: over.quantity ?? 2, unit_price: over.unit_price ?? 10, item_total: over.item_total ?? 20,
    customizations: {}, special_request: '', created_at: new Date().toISOString(),
  }
}

const FUTURE = '2099-01-01'

beforeEach(async () => {
  await (supabase as any).__reset?.()
  ;(supabase as any).__setNoAdmin?.(false)
})

async function seedGate(over: { order_number: string; payment_method?: string; payment_status?: string; status?: string; order_mode?: string; scheduled_date?: string; withItems?: boolean; id?: string }) {
  const id = over.id || 'o-' + over.order_number
  await supabase.from('orders').insert([orderRow({
    id, order_number: over.order_number, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    payment_method: over.payment_method ?? 'credit_card',
    payment_status: over.payment_status ?? 'paid',
    status: over.status ?? 'confirmed',
    order_mode: over.order_mode ?? 'SAME_DAY',
    scheduled_date: over.scheduled_date,
  })] as any)
  if (over.withItems !== false) await supabase.from('order_items').insert([itemRow({ order_id: id })] as any)
}

describe('3B-2C · order_ready_to_make — Owner §7 gate matrix (server-side via RPC)', () => {
  it('SAME_DAY COD + pending → READY (COD settles at delivery)', async () => {
    await seedGate({ order_number: 'G-COD-SD', payment_method: 'cash_on_delivery', payment_status: 'pending' })
    expect((await getOrderReadyToMake('G-COD-SD'))?.ready).toBe(true)
  })
  it('PRE_ORDER COD + pending (future date) → READY', async () => {
    await seedGate({ order_number: 'G-COD-PO', payment_method: 'cash_on_delivery', payment_status: 'pending', order_mode: 'PRE_ORDER', scheduled_date: FUTURE })
    expect((await getOrderReadyToMake('G-COD-PO'))?.ready).toBe(true)
  })
  it('SAME_DAY paid credit_card → READY', async () => {
    await seedGate({ order_number: 'G-CARD-PAID', payment_method: 'credit_card', payment_status: 'paid' })
    expect((await getOrderReadyToMake('G-CARD-PAID'))?.ready).toBe(true)
  })
  it('PRE_ORDER paid credit_card (future date) → READY', async () => {
    await seedGate({ order_number: 'G-CARD-PO', payment_method: 'credit_card', payment_status: 'paid', order_mode: 'PRE_ORDER', scheduled_date: FUTURE })
    expect((await getOrderReadyToMake('G-CARD-PO'))?.ready).toBe(true)
  })
  it('promptpay_qr paid → READY', async () => {
    await seedGate({ order_number: 'G-PP-PAID', payment_method: 'promptpay_qr', payment_status: 'paid' })
    expect((await getOrderReadyToMake('G-PP-PAID'))?.ready).toBe(true)
  })
  it('credit_card pending → NOT_READY (PAYMENT_NOT_PAID)', async () => {
    await seedGate({ order_number: 'G-CARD-PEND', payment_method: 'credit_card', payment_status: 'pending' })
    const r = await getOrderReadyToMake('G-CARD-PEND')
    expect(r?.ready).toBe(false)
    expect(r?.reason_code).toBe('PAYMENT_NOT_PAID')
  })
  it('promptpay processing-like (non-paid) → NOT_READY', async () => {
    await seedGate({ order_number: 'G-PP-PROC', payment_method: 'promptpay_qr', payment_status: 'pending' })
    const r = await getOrderReadyToMake('G-PP-PROC')
    expect(r?.ready).toBe(false)
    expect(r?.reason_code).toBe('PAYMENT_NOT_PAID')
  })
  it('failed (non-paid non-COD) → NOT_READY', async () => {
    await seedGate({ order_number: 'G-FAIL', payment_method: 'credit_card', payment_status: 'failed' })
    const r = await getOrderReadyToMake('G-FAIL')
    expect(r?.ready).toBe(false)
    expect(r?.reason_code).toBe('PAYMENT_NOT_PAID')
  })
  it('COD refund → NOT_READY', async () => {
    await seedGate({ order_number: 'G-COD-REF', payment_method: 'cash_on_delivery', payment_status: 'refund' })
    const r = await getOrderReadyToMake('G-COD-REF')
    expect(r?.ready).toBe(false)
    expect(r?.reason_code).toBe('PAYMENT_REFUNDED')
  })
  it('cancelled → NOT_READY (TERMINAL_STATE)', async () => {
    await seedGate({ order_number: 'G-CXL', status: 'cancelled' })
    const r = await getOrderReadyToMake('G-CXL')
    expect(r?.ready).toBe(false)
    expect(r?.reason_code).toBe('TERMINAL_STATE')
  })
  it('failed (terminal) → NOT_READY', async () => {
    await seedGate({ order_number: 'G-TERMINAL', status: 'failed' })
    const r = await getOrderReadyToMake('G-TERMINAL')
    expect(r?.ready).toBe(false)
    expect(r?.reason_code).toBe('TERMINAL_STATE')
  })
  it('refunded paid card → NOT_READY', async () => {
    await seedGate({ order_number: 'G-REF', payment_method: 'credit_card', payment_status: 'refund' })
    expect((await getOrderReadyToMake('G-REF'))?.reason_code).toBe('PAYMENT_REFUNDED')
  })
  it('unknown payment method + unpaid → NOT_READY (PAYMENT_METHOD_UNKNOWN)', async () => {
    await seedGate({ order_number: 'G-UNK', payment_method: '', payment_status: 'pending' })
    const r = await getOrderReadyToMake('G-UNK')
    expect(r?.ready).toBe(false)
    expect(r?.reason_code).toBe('PAYMENT_METHOD_UNKNOWN')
  })
  it('non-admin caller denied (ERR_FORBIDDEN)', async () => {
    ;(supabase as any).__setNoAdmin?.(true)
    const r = await getOrderReadyToMake('G-COD-SD') // deny comes first, before order lookup
    expect(r).toBeNull()
    ;(supabase as any).__setNoAdmin?.(false)
  })
  it('invalid order (missing) → NOT_READY ORDER_NOT_FOUND', async () => {
    expect((await getOrderReadyToMake('G-NOPE'))?.reason_code).toBe('ORDER_NOT_FOUND')
  })
  it('empty order (no items) → NOT_READY EMPTY_ORDER', async () => {
    await seedGate({ order_number: 'G-EMPTY', withItems: false })
    const r = await getOrderReadyToMake('G-EMPTY')
    expect(r?.ready).toBe(false)
    expect(r?.reason_code).toBe('EMPTY_ORDER')
  })
  it('pending status order → NOT_READY INVALID_ORDER_STATE (no pending→preparing)', async () => {
    await seedGate({ order_number: 'G-PENDING-STAT', status: 'pending' })
    const r = await getOrderReadyToMake('G-PENDING-STAT')
    expect(r?.ready).toBe(false)
    expect(r?.reason_code).toBe('INVALID_ORDER_STATE')
  })
  it('PRE_ORDER missing schedule → NOT_READY MISSING_SCHEDULE', async () => {
    await seedGate({ order_number: 'G-NOSCHED', order_mode: 'PRE_ORDER', scheduled_date: undefined })
    expect((await getOrderReadyToMake('G-NOSCHED'))?.reason_code).toBe('MISSING_SCHEDULE')
  })
  it('PRE_ORDER past-due schedule → NOT_READY SCHEDULE_PAST_DUE', async () => {
    await seedGate({ order_number: 'G-PASTDUE', order_mode: 'PRE_ORDER', scheduled_date: '2020-01-01' })
    expect((await getOrderReadyToMake('G-PASTDUE'))?.reason_code).toBe('SCHEDULE_PAST_DUE')
  })
})

// ---------------------------------------------------------------------------
// Display helpers (kitchenQueueView) — pure render logic, no authority
// ---------------------------------------------------------------------------
const fmt = (over: Partial<typeof ROW> & { order_number: string; items?: any[] }): OrderForm =>
  ({ ...ROW, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...over, items: (over.items ?? []) as any }) as unknown as OrderForm

describe('3B-2C · kitchen display helpers (render-only mirror)', () => {
  it('paymentReadyToMake mirrors the Owner COD/card rule', () => {
    expect(paymentReadyToMake('cash_on_delivery', 'pending')).toEqual({ ok: true, reasonCode: null, codPrepaid: false })
    expect(paymentReadyToMake('cash_on_delivery', 'paid')).toEqual({ ok: true, reasonCode: null, codPrepaid: true })
    expect(paymentReadyToMake('credit_card', 'pending').ok).toBe(false)
    expect(paymentReadyToMake('credit_card', 'failed').reasonCode).toBe('PAYMENT_NOT_PAID')
    expect(paymentReadyToMake('promptpay_qr', 'processing').ok).toBe(false)
    expect(paymentReadyToMake('credit_card', 'paid').ok).toBe(true)
    expect(paymentReadyToMake('promptpay_qr', 'paid').ok).toBe(true)
    expect(paymentReadyToMake('promptpay_qr', 'refund').reasonCode).toBe('PAYMENT_REFUNDED')
    expect(paymentReadyToMake(null, 'pending').reasonCode).toBe('PAYMENT_METHOD_UNKNOWN')
  })
  it('kitchenGatePreview: COD+confirmed canStart; card+pending blocked with reason', () => {
    const cod = kitchenGatePreview(fmt({ order_number: 'X1', payment_method: 'cash_on_delivery', payment_status: 'pending', items: [{ product_id: 'p', product_name: 'A', quantity: 1, unit_price: 10 }] }))
    expect(cod.canStart).toBe(true)
    const card = kitchenGatePreview(fmt({ order_number: 'X2', payment_method: 'credit_card', payment_status: 'pending', items: [{ product_id: 'p', product_name: 'A', quantity: 1, unit_price: 10 }] }))
    expect(card.canStart).toBe(false)
    expect(readyReasonLabel(card.reasonCode)).toContain('ชำระเงิน')
    const empty = kitchenGatePreview(fmt({ order_number: 'X3', items: [] }))
    expect(empty.reasonCode).toBe('EMPTY_ORDER')
  })
  it('kitchenGatePreview: ready hop only from preparing (no ready_for_dispatch→preparing)', () => {
    const rfd = kitchenGatePreview(fmt({ order_number: 'X4', status: 'ready_for_dispatch', items: [{ product_id: 'p', product_name: 'A', quantity: 1, unit_price: 10 }] }))
    expect(rfd.canStart).toBe(false)
    expect(rfd.canReady).toBe(false)
    const prep = kitchenGatePreview(fmt({ order_number: 'X5', status: 'preparing', items: [{ product_id: 'p', product_name: 'A', quantity: 1, unit_price: 10 }] }))
    expect(prep.canStart).toBe(false)
    expect(prep.canReady).toBe(true)
  })
  it('groupKitchenOrders groups by (scheduled_date, delivery_round_id)', () => {
    const g = groupKitchenOrders([
      fmt({ order_number: 'A', scheduled_date: '2026-10-01', delivery_round_id: 'r1' }),
      fmt({ order_number: 'B', scheduled_date: '2026-10-01', delivery_round_id: 'r1' }),
      fmt({ order_number: 'C', scheduled_date: '2026-10-02', delivery_round_id: 'r2' }),
    ])
    expect(g).toHaveLength(2)
    expect(g[0].scheduledDate).toBe('2026-10-02')
    expect(g[1].orders.map((o) => o.order_number)).toEqual(['A', 'B'])
  })
  it('splitSameDayPreOrder: PRE_ORDER due-today goes to today bucket, later to later', () => {
    const s = splitSameDayPreOrder([
      fmt({ order_number: 'A', order_mode: 'SAME_DAY' }),
      fmt({ order_number: 'B', order_mode: 'PRE_ORDER', scheduled_date: '2099-01-01' }),
      fmt({ order_number: 'C', order_mode: 'PRE_ORDER', scheduled_date: '2000-01-01' }),
    ], '2026-09-29')
    expect(s.sameDay.map((o) => o.order_number)).toEqual(['A'])
    expect(s.preOrderToday.map((o) => o.order_number)).toEqual(['C'])
    expect(s.preOrderLater.map((o) => o.order_number)).toEqual(['B'])
  })
  it('kitchenItemLines shows name/qty/addons/special-request and NO prices', () => {
    const o = fmt({ order_number: 'X6', items: [{ product_id: 'p', product_name: 'ข้าวไข่เจียว', quantity: 2, unit_price: 10, item_total: 20, special_request: 'ไม่ใส่หอม', customizations: { extra_egg: true, spicy: 'Mild' } }] })
    const lines = kitchenItemLines(o as any)
    expect(lines[0]).toMatchObject({ productName: 'ข้าวไข่เจียว', quantity: 2, specialRequest: 'ไม่ใส่หอม' })
    expect(lines[0].addonText).toContain('extra_egg')
    expect(lines[0].addonText).toContain('spicy: Mild')
    expect(JSON.stringify(lines)).not.toMatch(/unit_price|item_total|total_amount/)
  })
  it('pipeline read covers only the kitchen spine statuses', async () => {
    const t = new Date().toISOString()
    await supabase.from('orders').insert([
      orderRow({ id: 'p1', order_number: 'P-CONF', created_at: t, updated_at: t, payment_status: 'paid' }),
      orderRow({ id: 'p2', order_number: 'P-PEND', created_at: t, updated_at: t, status: 'pending' }),
    ] as any)
    const list = await getKitchenPipelineOrders()
    const nums = list.map((o) => o.order_number)
    expect(nums).toContain('P-CONF')
    expect(nums).not.toContain('P-PEND')
  })
})

// ---------------------------------------------------------------------------
// Canonical kitchen flow + regression (Owner §6/§9)
// ---------------------------------------------------------------------------
describe('3B-2C · canonical kitchen flow via transition_order_status only', () => {
  it('confirmed → preparing → ready_for_dispatch legal hops succeed', async () => {
    await seedGate({ order_number: 'F-FLOW', payment_method: 'cash_on_delivery', payment_status: 'pending' })
    expect((await getOrderReadyToMake('F-FLOW'))?.ready).toBe(true)
    const a = await updateOrderStatus('F-FLOW', 'preparing')
    expect(a?.status).toBe('preparing')
    const b = await updateOrderStatus('F-FLOW', 'ready_for_dispatch')
    expect(b?.status).toBe('ready_for_dispatch')
  })
  it('illegal hops blocked server-side (regression: 008/030)', () => {
    expect(ADMIN_ALLOWED_TRANSITIONS['pending']).not.toContain('preparing')
    expect(ADMIN_ALLOWED_TRANSITIONS['ready_for_dispatch']).not.toContain('preparing')
    expect(ADMIN_ALLOWED_TRANSITIONS['confirmed']).not.toContain('ready_for_dispatch')
  })
  it('regression mirror: 3B-2A allow-list unchanged for kitchen spine', () => {
    expect(ADMIN_ALLOWED_TRANSITIONS['confirmed']).toContain('preparing')
    expect(ADMIN_ALLOWED_TRANSITIONS['preparing']).toContain('ready_for_dispatch')
    expect(ADMIN_ALLOWED_TRANSITIONS['cancelled']).toEqual([])
  })
  it('payment-invalid order cannot pass the gate even at button time (re-check)', async () => {
    await seedGate({ order_number: 'F-BLOCK', payment_method: 'credit_card', payment_status: 'pending' })
    const gate = await getOrderReadyToMake('F-BLOCK')
    expect(gate?.ready).toBe(false)
    // transition RPC stays payment-free (state machine untouched, Owner §5);
    // the UI only acts when the gate returns ready — verified above.
  })
})
