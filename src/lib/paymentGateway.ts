// ============================================
// Bite Me Baby — Payment Gateway Service (P0-5)
// ============================================
// REAL integration contract (2026-09-18) — NO simulation, NO fake success:
//
//   credit_card  → Edge Function `create-checkout` creates a Stripe
//                  PaymentIntent SERVER-SIDE (amount re-derived from the DB).
//                  Confirmation happens in Stripe (client_secret + Stripe.js),
//                  and the stripe-webhook EF records the result idempotently.
//   promptpay_qr → create_payment_intent_record RPC (authoritative amount) →
//                  customer submits TXN id (submit_offline_payment_reference,
//                  intent pending→processing) → admin confirms
//                  (confirm_offline_payment, intent → completed, order → paid).
//   cash_on_delivery → create_payment_intent_record RPC → admin collects at the
//                  door; confirm_offline_payment requires order = delivered.
//
// Failure paths return explicit errors. If the Edge Function is not deployed,
// the client reports ERR_STRIPE_NOT_CONFIGURED — never a fabricated success.
// ============================================

import { supabase } from './supabase'

export type PaymentProvider = 'stripe' | 'promptpay' | 'cod'
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'expired'
export type PaymentMethod = 'credit_card' | 'promptpay_qr' | 'cash_on_delivery' | 'bank_transfer'

export interface PaymentIntent {
  id: string
  order_number: string
  amount: number
  currency: string
  status: PaymentStatus
  method: PaymentMethod
  provider: PaymentProvider
  client_secret?: string
  payment_intent_id?: string
  receipt_url?: string
  metadata: Record<string, any>
  created_at: string
  updated_at: string
  completed_at?: string
  failure_reason?: string
}

export interface PaymentConfirmResult {
  success: boolean
  payment_intent?: PaymentIntent
  error?: string
  receiptUrl?: string
}

export interface CardCheckoutResult {
  ok: boolean
  client_secret?: string
  payment_intent_id?: string
  amount?: number
  order_number?: string
  error?: string
}

// ============================================
// REAL Stripe checkout — via Edge Function (no Stripe secret on the client)
// ============================================
export async function createCheckout(orderNumber: string): Promise<CardCheckoutResult> {
  try {
    const { data, error } = await supabase.functions.invoke('create-checkout', {
      body: { order_number: orderNumber },
    })

    if (error) {
      console.error('[paymentGateway] create-checkout invoke error:', error)
      return { ok: false, error: error.message }
    }

    const result = data as { ok?: boolean; client_secret?: string; payment_intent_id?: string; amount?: number; order_number?: string; error?: string }
    if (!result?.ok) {
      return { ok: false, error: result?.error || 'ERR_CHECKOUT_FAILED' }
    }
    return {
      ok: true,
      client_secret: result.client_secret,
      payment_intent_id: result.payment_intent_id,
      amount: result.amount,
      order_number: result.order_number,
    }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'ERR_CHECKOUT_NETWORK' }
  }
}

/**
 * Create a Payment Intent for an order.
 * - credit_card : delegated to the create-checkout Edge Function.
 * - non-card    : recorded via create_payment_intent_record RPC — the server
 *                 re-validates p_amount against orders.total_amount.
 */
export async function createPaymentIntent(
  orderNumber: string,
  amount: number,
  method: PaymentMethod,
  metadata: Record<string, any> = {},
): Promise<PaymentConfirmResult> {
  const intentBase = {
    order_number: orderNumber,
    amount,
    currency: 'thb',
    method,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as PaymentIntent

  if (method === 'credit_card') {
    const checkout = await createCheckout(orderNumber)
    if (!checkout.ok) {
      return { success: false, error: checkout.error || 'ERR_CHECKOUT_FAILED' }
    }
    return {
      success: true,
      payment_intent: {
        ...intentBase,
        id: `pi-${checkout.payment_intent_id}`,
        status: 'pending' as PaymentStatus,
        provider: 'stripe',
        client_secret: checkout.client_secret,
        payment_intent_id: checkout.payment_intent_id,
        metadata: { ...metadata, provider: 'stripe', source: 'create-checkout' },
      },
    }
  }

  // Non-card methods: authoritative record on the server (amount re-checked).
  const provider: PaymentProvider = method === 'cash_on_delivery' ? 'cod' : 'promptpay'
  const { data, error } = await supabase.rpc('create_payment_intent_record', {
    p_order_number: orderNumber,
    p_amount: amount,
    p_method: method,
    p_provider: provider,
    p_metadata: metadata ?? {},
  })

  if (error) {
    console.error('[paymentGateway] create_payment_intent_record error:', error)
    return { success: false, error: error.message }
  }

  const row = data as { id?: string; amount?: number; status?: string }
  return {
    success: true,
    payment_intent: {
      ...intentBase,
      id: row.id || intentBase.id,
      status: (row.status as PaymentStatus) || 'pending',
      provider,
      metadata,
    },
  }
}
/**
 * Card confirmation is handled end-to-end by Stripe (client_secret → Stripe.js →
 * webhook → record_payment_result). This function only reports the current
 * intent state; it NEVER marks an order paid from the browser.
 */
export async function confirmPayment(
  paymentIntentId: string,
  _paymentMethodId: string,
): Promise<PaymentConfirmResult> {
  const { data, error } = await supabase
    .from('payment_intents')
    .select('*')
    .eq('id', paymentIntentId)
    .maybeSingle()

  if (error || !data) {
    return { success: false, error: 'Payment intent not found' }
  }
  const intent = data as PaymentIntent
  if (!intent.client_secret) {
    return {
      success: false,
      error: 'NO_CLIENT_SECRET — card payment must be confirmed in Stripe (Payment Element)',
    }
  }
  return {
    success: true,
    payment_intent: intent,
    receiptUrl: intent.receipt_url,
  }
}

/** Customer submits a PromptPay transaction id (pending → processing). */
export async function submitOfflinePaymentReference(orderNumber: string, reference: string): Promise<PaymentConfirmResult> {
  const { data, error } = await supabase.rpc('submit_offline_payment_reference', {
    p_order_number: orderNumber,
    p_reference: reference,
  })
  if (error) {
    return { success: false, error: error.message }
  }
  return { success: true }
}

/** ADMIN confirms an offline payment (PromptPay after TXN, COD after delivery). */
export async function confirmOfflinePayment(orderNumber: string): Promise<PaymentConfirmResult> {
  const { data, error } = await supabase.rpc('confirm_offline_payment', {
    p_order_number: orderNumber,
  })
  if (error) {
    return { success: false, error: error.message }
  }
  return { success: true }
}

/** ADMIN marks a pending/processing payment failed. */
export async function markPaymentFailed(orderNumber: string, reason: string = ''): Promise<PaymentConfirmResult> {
  const { data, error } = await supabase.rpc('mark_payment_failed', {
    p_order_number: orderNumber,
    p_reason: reason,
  })
  if (error) {
    return { success: false, error: error.message }
  }
  return { success: true }
}

/**
 * Refunds are server-side only (requires service-role + Stripe API).
 * Admin flow lives in the `stripe-refund` Edge Function once deployed; the
 * browser NEVER touches money-out operations.
 */
export async function refundPayment(_paymentIntentId: string, _reason: string = ''): Promise<PaymentConfirmResult> {
  return { success: false, error: 'REFUND_SERVER_SIDE_ONLY — use the stripe-refund Edge Function (admin)' }
}

// ============================================
// Query helpers (read-only; DB driven)
// ============================================

export async function getPaymentIntents(filters?: {
  orderNumber?: string
  status?: PaymentStatus
  startDate?: string
  endDate?: string
}): Promise<PaymentIntent[]> {
  let query = supabase.from('payment_intents').select('*').order('created_at', { ascending: false })

  if (filters?.orderNumber) query = query.eq('order_number', filters.orderNumber)
  if (filters?.status) query = query.eq('status', filters.status)
  if (filters?.startDate) query = query.gte('created_at', filters.startDate)
  if (filters?.endDate) query = query.lte('created_at', filters.endDate)

  const { data } = await query
  return (data || []) as PaymentIntent[]
}

export async function getPaymentSummary(): Promise<{
  totalRevenue: number
  totalTransactions: number
  pendingAmount: number
  completedToday: number
  failedToday: number
  byMethod: Record<string, number>
}> {
  const intents = await getPaymentIntents()
  const today = new Date().toISOString().split('T')[0]

  const completed = intents.filter((i: PaymentIntent) => i.status === 'completed')
  const todayCompleted = completed.filter((i: PaymentIntent) => i.completed_at?.startsWith(today))

  const byMethod: Record<string, number> = {}
  completed.forEach((i: PaymentIntent) => {
    byMethod[i.method] = (byMethod[i.method] || 0) + i.amount
  })

  return {
    totalRevenue: completed.reduce((sum: number, i: PaymentIntent) => sum + i.amount, 0),
    totalTransactions: completed.length,
    pendingAmount: intents.filter((i: PaymentIntent) => i.status === 'pending').reduce((sum: number, i: PaymentIntent) => sum + i.amount, 0),
    completedToday: todayCompleted.length,
    failedToday: intents.filter((i: PaymentIntent) => i.status === 'failed' && i.created_at.startsWith(today)).length,
    byMethod,
  }
}