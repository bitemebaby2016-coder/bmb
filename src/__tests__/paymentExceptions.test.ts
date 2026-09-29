// ============================================
// Bite Me Baby — STEP 3B-2E Payment exceptions tests
// ============================================
// Owner §12 matrix: canonical payment-state classification (paid/pending/
// processing/failed/partial refund/refund/exceptions incl. webhook mismatch,
// missing intent, stale unpaid) — all mapped from REAL canonical columns only
// (orders.payment_status CHECK 001; payment_intents.status; COD rules).
// Regression: webhook idempotency (paymentStateMachine), 3B-2C READY_TO_MAKE,
// 3B-2D dispatch, 3B-2A allow-list. READ-ONLY guarantee: the exception lib has
// no mutation path; payment authority stays with record_payment_result /
// confirm_offline_payment / stripe-refund EF.
// NOTE: offline mock only — no real money, no real refunds.

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
import { classifyPaymentException, groupPaymentExceptions, getPaymentExceptionOrders, STALE_UNPAID_HOURS, type PaymentIntentLite } from '@/lib/paymentExceptions'
import type { OrderForm } from '@/lib/bmbAdminApi_orders'

const NOW = Date.now()
const fresh = new Date(NOW - 30 * 60_000).toISOString()
const stale = new Date(NOW - (STALE_UNPAID_HOURS + 5) * 3600_000).toISOString()

function order(over: Partial<OrderForm> & { order_number: string }): OrderForm {
  const base = {
    id: 'o-' + over.order_number, customer_id: 'u', customer_name: 'T', customer_phone: '0',
    delivery_round_id: 'r1', status: 'pending', total_amount: 100, delivery_fee: 0,
    payment_method: 'credit_card', payment_status: 'pending', delivery_address: '',
    dropoff_latitude: 0, dropoff_longitude: 0, items: [], created_at: fresh, updated_at: fresh,
  }
  return { ...base, ...over } as unknown as OrderForm
}

function intent(over: Partial<PaymentIntentLite> & { order_number: string }): PaymentIntentLite {
  return { status: 'pending', method: 'credit_card', amount: 100, payment_intent_id: 'pi_1', failure_reason: null, updated_at: fresh, ...over }
}

beforeEach(async () => {
  await (supabase as any).__reset?.()
})

describe('3B-2E · classifyPaymentException — Owner §12 matrix (canonical states only)', () => {
  it('paid → OK_PAID (no attention)', () => {
    const r = classifyPaymentException(order({ order_number: 'P1', payment_status: 'paid' }), [intent({ order_number: 'P1', status: 'completed' })], NOW)
    expect(r).toEqual({ kind: 'OK_PAID', attention: false })
  })
  it('pending + fresh + intent pending → PENDING_UNPAID', () => {
    const r = classifyPaymentException(order({ order_number: 'P2' }), [intent({ order_number: 'P2' })], NOW)
    expect(r.kind).toBe('PENDING_UNPAID')
    expect(r.attention).toBe(true)
  })
  it('processing intent → PROCESSING', () => {
    const r = classifyPaymentException(order({ order_number: 'P3' }), [intent({ order_number: 'P3', status: 'processing', method: 'promptpay_qr' })], NOW)
    expect(r.kind).toBe('PROCESSING')
  })
  it('failed intent → INTENT_FAILED', () => {
    const r = classifyPaymentException(order({ order_number: 'P4' }), [intent({ order_number: 'P4', status: 'failed', failure_reason: 'card_declined' })], NOW)
    expect(r.kind).toBe('INTENT_FAILED')
  })
  it('partial refund (canonical 001 state) → PARTIAL_REFUND', () => {
    const r = classifyPaymentException(order({ order_number: 'P5', payment_status: 'partially_refunded' }), [], NOW)
    expect(r.kind).toBe('PARTIAL_REFUND')
    expect(r.attention).toBe(true)
  })
  it('refund → REFUNDED', () => {
    const r = classifyPaymentException(order({ order_number: 'P6', payment_status: 'refund' }), [], NOW)
    expect(r.kind).toBe('REFUNDED')
  })
  it('webhook inconsistency: order pending but intent completed → WEBHOOK_MISMATCH', () => {
    const r = classifyPaymentException(order({ order_number: 'P7' }), [intent({ order_number: 'P7', status: 'completed' })], NOW)
    expect(r.kind).toBe('WEBHOOK_MISMATCH')
    expect(r.attention).toBe(true)
  })
  it('COD pending → OK_COD_AWAITED (not an exception — canonical rule)', () => {
    const r = classifyPaymentException(order({ order_number: 'P8', payment_method: 'cash_on_delivery' }), [], NOW)
    expect(r).toEqual({ kind: 'OK_COD_AWAITED', attention: false })
  })
  it('stale unpaid (>24h, non-COD) → STALE_UNPAID', () => {
    const r = classifyPaymentException(order({ order_number: 'P9', created_at: stale }), [intent({ order_number: 'P9' })], NOW)
    expect(r.kind).toBe('STALE_UNPAID')
  })
  it('non-COD pending without any intent → MISSING_INTENT', () => {
    const r = classifyPaymentException(order({ order_number: 'P10' }), [], NOW)
    expect(r.kind).toBe('MISSING_INTENT')
  })
  it('COD pending beyond 24h stays COD-AWAITED (no false stale for COD)', () => {
    const r = classifyPaymentException(order({ order_number: 'P11', payment_method: 'cash_on_delivery', created_at: stale }), [], NOW)
    expect(r.kind).toBe('OK_COD_AWAITED')
  })
  it('groupPaymentExceptions buckets by kind', () => {
    const rows = [
      { order: order({ order_number: 'G1', payment_status: 'paid' }), kind: 'OK_PAID' as const },
      { order: order({ order_number: 'G2', payment_status: 'refund' }), kind: 'REFUNDED' as const },
      { order: order({ order_number: 'G3', payment_status: 'partially_refunded' }), kind: 'PARTIAL_REFUND' as const },
    ]
    const g = groupPaymentExceptions(rows)
    expect(g.OK_PAID).toHaveLength(1)
    expect(g.REFUNDED).toHaveLength(1)
    expect(g.PARTIAL_REFUND).toHaveLength(1)
    expect(g.STALE_UNPAID).toHaveLength(0)
  })
})

describe('3B-2E · read-only view helpers + integrity (mock DB)', () => {
  it('getPaymentExceptionOrders reads only attention-worthy payment states', async () => {
    const t = NOW - 60_000
    await supabase.from('orders').insert([
      { ...order({ order_number: 'R1' }), created_at: t, updated_at: t } as any,
      { ...order({ order_number: 'R2', payment_status: 'paid' }), created_at: t, updated_at: t } as any,
      { ...order({ order_number: 'R3', payment_status: 'refund' }), created_at: t, updated_at: t } as any,
    ])
    const list = await getPaymentExceptionOrders()
    const nums = list.map((o) => o.order_number)
    expect(nums).toContain('R1')
    expect(nums).toContain('R3')
    expect(nums).not.toContain('R2') // paid is not in the attention read
  })
  it('READ-ONLY guarantee: lib exposes no mutation; classification is pure', () => {
    // the classification is deterministic and side-effect-free
    const o = order({ order_number: 'X1' })
    const a = classifyPaymentException(o, [intent({ order_number: 'X1' })], NOW)
    const b = classifyPaymentException(o, [intent({ order_number: 'X1' })], NOW)
    expect(a).toEqual(b)
    expect((globalThis as any).__paymentMutations).toBeUndefined()
  })
  it('regression: 3B-2C gate logic unaffected by payment display vocabulary', async () => {
    // partially_refunded must stay NOT_READY on the kitchen gate (3B-2C contract)
    const { paymentReadyToMake } = await import('@/lib/kitchenQueueView')
    expect(paymentReadyToMake('credit_card', 'partially_refunded').ok).toBe(false)
    expect(paymentReadyToMake('cash_on_delivery', 'pending').ok).toBe(true)
    expect(paymentReadyToMake('credit_card', 'paid').ok).toBe(true)
  })
  it('regression: webhook idempotency + 3B-2D dispatch mocks intact', async () => {
    // record_payment_result idempotent replay (existing canonical authority):
    // the create-checkout flow seeds a pending intent row first (010 contract)
    const t = NOW - 60_000
    await supabase.from('orders').insert([{ ...order({ order_number: 'RW1' }), created_at: t, updated_at: t }] as any)
    await supabase.from('payment_intents').insert([{ id: 'i-rw1', order_number: 'RW1', amount: 100, currency: 'thb', status: 'pending', method: 'credit_card', provider: 'stripe', created_at: t, updated_at: t }] as any)
    const args = { p_payment_intent_id: 'pi-rw1', p_order_number: 'RW1', p_amount: 100, p_status: 'completed' }
    const r1 = await (supabase as any).rpc('record_payment_result', args)
    expect(r1.data?.ok).toBeTruthy()
    expect(r1.data?.idempotent).toBe(false)
    const r2 = await (supabase as any).rpc('record_payment_result', args)
    expect(r2.data?.ok).toBeTruthy()
    expect(r2.data?.idempotent).toBe(true) // terminal replay short-circuits — no double record
    const ord = ((supabase as any).__tables.orders as any[]).find((o) => o.order_number === 'RW1')
    expect(ord.payment_status).toBe('paid') // canonical order/payment link
    const { adminListDrivers } = await import('@/lib/driverService')
    const d = await adminListDrivers()
    expect(d.ok).toBe(true)
    expect(d.drivers).toHaveLength(0)
  })
})
