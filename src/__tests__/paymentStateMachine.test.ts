// ============================================
// Bite Me Baby — Payment (P0-5) + Order State Machine (P0-6) tests
// ============================================
// Verifies the client↔server contracts against the in-memory Supabase mock:
//   - payment intents recorded with the AUTHORITATIVE amount (tamper → ERR_AMOUNT_MISMATCH)
//   - credit_card goes through the `create-checkout` Edge Function (no fake success)
//   - PromptPay TXN submit (pending→processing) → admin confirmation → paid
//   - COD is only paid after the order is DELIVERED
//   - order status transitions follow the allow-list (skip/backward → denied)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockRef } from './helpers/mockRef'

vi.mock('@/lib/supabase', async () => {
  const { createSupabaseMock } = await import('./helpers/supabaseMock')
  const m = createSupabaseMock()
  mockRef.current = m
  return {
    supabase: m,
    supabaseAdmin: null,
    getCurrentUser: async () => null,
    isAdmin: async () => false,
    subscribeToTable: () => ({ unsubscribe: vi.fn() }),
    unsubscribeFromChannel: () => {},
    default: null,
  }
})

import { createOrder, updateOrderStatus, getOrders } from '@/lib/bmbAdminApi_orders'
import {
  createPaymentIntent,
  submitOfflinePaymentReference,
  confirmOfflinePayment,
  getPaymentIntents,
  markPaymentFailed,
} from '@/lib/paymentGateway'

async function makeOrder(paymentMethod = 'promptpay_qr') {
  return await createOrder({
    items: [{ product_id: 'prod-1', quantity: 2 }],
    delivery_round_id: 'round-1',
    delivery_method: 'self_delivery',
    customer_name: 'Test User',
    payment_method: paymentMethod,
  })
}

function txnId(orderNumber: string, idx = 0) {
  return (mockRef.current.__tables['payment_intents'] || [])
    .filter((i: any) => i.order_number === orderNumber)
    .sort((a: any, b: any) => (a.created_at > b.created_at ? -1 : 1))[idx]
}

describe('P0-5 Payment — server-authoritative intents', () => {
  beforeEach(() => {
    mockRef.current.__reset()
  })

  it('records non-card intents with the authoritative order amount', async () => {
    const order = await makeOrder('promptpay_qr')
    expect(order).not.toBeNull()
    const res = await createPaymentIntent(order!.order_number, order!.total_amount, 'promptpay_qr')
    expect(res.success).toBe(true)
    const intents = await getPaymentIntents({ orderNumber: order!.order_number })
    expect(intents.length).toBe(1)
    expect(intents[0].status).toBe('pending')
    expect(intents[0].amount).toBe(order!.total_amount)
  })

  it('refuses a client-supplied amount that does not match the order total', async () => {
    const order = await makeOrder('promptpay_qr')
    const res = await createPaymentIntent(order!.order_number, 1, 'promptpay_qr')
    expect(res.success).toBe(false)
    expect(res.error).toContain('ERR_AMOUNT_MISMATCH')
  })

  it('routes credit_card through the create-checkout Edge Function with the order number', async () => {
    const order = await makeOrder('credit_card')
    let invokedWith: any = null
    mockRef.current.__setInvokeHandler('create-checkout', async (body: any) => {
      invokedWith = body
      return {
        data: { ok: true, client_secret: 'pi_3test_secret_abc', payment_intent_id: 'pi_3test', amount: order!.total_amount, order_number: body.order_number },
        error: null,
      }
    })
    const res = await createPaymentIntent(order!.order_number, order!.total_amount, 'credit_card')
    expect(res.success).toBe(true)
    expect(invokedWith.order_number).toBe(order!.order_number)
    // the intent is pending — NO fake 'completed' from the browser
    expect(res.payment_intent!.status).toBe('pending')
    expect(res.payment_intent!.client_secret).toBe('pi_3test_secret_abc')
  })

  it('does NOT fabricate success when the checkout Edge Function is unavailable', async () => {
    const order = await makeOrder('credit_card')
    mockRef.current.__setInvokeHandler('create-checkout', async () => ({ data: { ok: false, error: 'ERR_STRIPE_NOT_CONFIGURED' }, error: null }))
    const res = await createPaymentIntent(order!.order_number, order!.total_amount, 'credit_card')
    expect(res.success).toBe(false)
    expect(res.error).toContain('ERR_STRIPE_NOT_CONFIGURED')
  })

  it('PromptPay: TXN submit → processing, then admin confirmation → paid (idempotent)', async () => {
    const order = await makeOrder('promptpay_qr')
    await createPaymentIntent(order!.order_number, order!.total_amount, 'promptpay_qr')

    const sub = await submitOfflinePaymentReference(order!.order_number, 'TXN-999')
    expect(sub.success).toBe(true)
    expect(txnId(order!.order_number).status).toBe('processing')

    const confirm = await confirmOfflinePayment(order!.order_number)
    expect(confirm.success).toBe(true)
    const orders = await getOrders()
    expect(orders.find((o: any) => o.order_number === order!.order_number)!.payment_status).toBe('paid')

    // idempotent second confirm
    const again = await confirmOfflinePayment(order!.order_number)
    expect(again.success).toBe(true)
  })
it('PromptPay: cannot confirm without a submitted TXN (intent still pending)', async () => {
    const order = await makeOrder('promptpay_qr')
    await createPaymentIntent(order!.order_number, order!.total_amount, 'promptpay_qr')
    const confirm = await confirmOfflinePayment(order!.order_number)
    expect(confirm.success).toBe(false)
    expect(confirm.error).toContain('ERR_INTENT_NOT_PROCESSING')
  })

  it('COD: can only be confirmed after the order is DELIVERED', async () => {
    const order = await makeOrder('cash_on_delivery')
    await createPaymentIntent(order!.order_number, order!.total_amount, 'cash_on_delivery')

    const early = await confirmOfflinePayment(order!.order_number)
    expect(early.success).toBe(false)
    expect(early.error).toContain('ERR_COD_NOT_DELIVERED')

    // walk the state machine to delivered
    for (const s of ['confirmed', 'preparing', 'ready_for_dispatch', 'dispatched', 'in_transit', 'arrived', 'delivered']) {
      const r = await updateOrderStatus(order!.order_number, s)
      expect(r, `transition to ${s} should succeed`).not.toBeNull()
    }
    const ok = await confirmOfflinePayment(order!.order_number)
    expect(ok.success).toBe(true)
  })

  it('record_payment_result: idempotent webhook + amount mismatch rejected', async () => {
    const order = await makeOrder('promptpay_qr')
    await createPaymentIntent(order!.order_number, order!.total_amount, 'promptpay_qr')
    const r = mockRef.current.rpc
    const res1 = await r('record_payment_result', {
      p_order_number: order!.order_number,
      p_payment_intent_id: 'pi_3webhook',
      p_amount: order!.total_amount,
      p_status: 'completed',
    })
    expect(res1.error).toBeNull()
    expect(res1.data.idempotent).toBe(false)
    const res2 = await r('record_payment_result', {
      p_order_number: order!.order_number,
      p_payment_intent_id: 'pi_3webhook',
      p_amount: order!.total_amount,
      p_status: 'completed',
    })
    expect(res2.data.idempotent).toBe(true)
    const bad = await r('record_payment_result', {
      p_order_number: order!.order_number,
      p_payment_intent_id: 'pi_3bad',
      p_amount: 1,
      p_status: 'completed',
    })
    expect(bad.error).not.toBeNull()
    expect(String(bad.error.message)).toContain('ERR_AMOUNT_MISMATCH')
  })
})

describe('P0-6 Order state machine — allow-list enforcement', () => {
  beforeEach(() => {
    mockRef.current.__reset()
  })

  it('walks the forward fulfillment chain', async () => {
    const order = await makeOrder()
    expect(order).not.toBeNull()
    const chain = ['confirmed', 'preparing', 'ready_for_dispatch', 'dispatched', 'in_transit', 'arrived', 'delivered']
    for (const s of chain) {
      const r = await updateOrderStatus(order!.order_number, s)
      expect(r, `transition to ${s}`).not.toBeNull()
      expect(r!.status).toBe(s)
    }
  })

  it('denies skip-state jumps (pending → delivered)', async () => {
    const order = await makeOrder()
    const r = await updateOrderStatus(order!.order_number, 'delivered')
    expect(r).toBeNull()
  })

  it('denies backward transitions (confirmed → pending)', async () => {
    const order = await makeOrder()
    await updateOrderStatus(order!.order_number, 'confirmed')
    const r = await updateOrderStatus(order!.order_number, 'pending')
    expect(r).toBeNull()
  })

  it('allows admin cancel from preparing', async () => {
    const order = await makeOrder()
    await updateOrderStatus(order!.order_number, 'confirmed')
    await updateOrderStatus(order!.order_number, 'preparing')
    const cancelled = await updateOrderStatus(order!.order_number, 'cancelled')
    expect(cancelled).not.toBeNull()
    expect(cancelled!.status).toBe('cancelled')
  })

  it('allows failed from in_transit', async () => {
    const order = await makeOrder()
    for (const s of ['confirmed', 'preparing', 'ready_for_dispatch', 'dispatched', 'in_transit']) {
      await updateOrderStatus(order!.order_number, s)
    }
    const failed = await updateOrderStatus(order!.order_number, 'failed')
    expect(failed).not.toBeNull()
    expect(failed!.status).toBe('failed')
  })

  it('mark_payment_failed flips pending/processing intents to failed', async () => {
    const order = await makeOrder('promptpay_qr')
    await createPaymentIntent(order!.order_number, order!.total_amount, 'promptpay_qr')
    const r = await markPaymentFailed(order!.order_number)
    expect(r.success).toBe(true)
    expect(txnId(order!.order_number).status).toBe('failed')
  })
})