// ============================================
// Bite Me Baby — Payment Gateway Service (P0-5 · Omise cutover)
// ============================================
// REAL integration contract — NO simulation, NO fake success:
//
//   credit_card  → OMISE cutover (handoff §5.2): when a real Omise published
//                  key is configured, createCheckout invokes the
//                  `omise-checkout` Edge Function — the charge (amount
//                  re-derived from the DB) is created SERVER-SIDE with the
//                  Omise secret key. Confirmation happens on Omise
//                  (Omise.js card token → charge → 3-D Secure authorize_uri),
//                  and the `omise-webhook` EF records the result idempotently.
//                  When Omise is NOT yet configured the legacy Stripe path
//                  (`create-checkout` + Stripe.js + stripe-webhook) keeps
//                  working as a fallback so card payment never breaks mid-way.
//   promptpay_qr → create_payment_intent_record RPC (authoritative amount) →
//                  customer submits TXN id (submit_offline_payment_reference,
//                  intent pending→processing) → admin confirms
//                  (confirm_offline_payment, intent → completed, order → paid).
//   cash_on_delivery → create_payment_intent_record RPC → admin collects at the
//                  door; confirm_offline_payment requires order = delivered.
//
// Failure paths return explicit errors. If the Edge Function is not deployed,
// the client reports the EF error — never a fabricated success.
// ============================================

import { supabase } from './supabase'
import { isOmiseConfigured, OMISE_CHECKOUT_FUNCTION } from './omise'

export type PaymentProvider = 'stripe' | 'omise' | 'promptpay' | 'cod'
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
  /** Storage path of the customer's transfer slip (private bucket `payment-slips`). */
  slip_path?: string | null
  slip_uploaded_at?: string | null
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
  /** Which provider minted this checkout (absent on the legacy Stripe path). */
  provider?: 'stripe' | 'omise'
  /** Omise charge id (`chrg_...`) — present on the Omise path. */
  charge_id?: string
  /** 3-D Secure / hosted authorization page — redirect here when present. */
  authorize_uri?: string
  /** Omise charge status: `pending` | `successful` | `failed` | ... */
  charge_status?: string
}

// ============================================
// REAL card checkout — via Edge Function (no provider secret on the client)
// ============================================
export async function createCheckout(orderNumber: string, options?: { cardToken?: string }): Promise<CardCheckoutResult> {
  try {
    // ---- Omise cutover (handoff §5.2 step 5): used once a real published key
    // is configured. Without it the legacy Stripe branch below keeps card
    // payment working — the switch is env-driven, never a hard break.
    if (isOmiseConfigured()) {
      const { data, error } = await supabase.functions.invoke(OMISE_CHECKOUT_FUNCTION, {
        body: { order_number: orderNumber, card_token: options?.cardToken },
      })
      if (error) {
        console.error('[paymentGateway] omise-checkout invoke error:', error)
        return { ok: false, error: error.message, provider: 'omise' }
      }
      const result = data as {
        ok?: boolean
        provider?: 'omise'
        charge_id?: string
        charge_status?: string
        authorize_uri?: string
        amount?: number
        order_number?: string
        error?: string
      }
      if (!result?.ok) {
        return { ok: false, error: result?.error || 'ERR_CHECKOUT_FAILED', provider: 'omise' }
      }
      return {
        ok: true,
        provider: 'omise',
        charge_id: result.charge_id,
        payment_intent_id: result.charge_id,
        charge_status: result.charge_status,
        authorize_uri: result.authorize_uri ?? undefined,
        amount: result.amount,
        order_number: result.order_number,
      }
    }

    // ---- Legacy Stripe path (fallback until the Omise cutover is verified) ----
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
    // ---- Omise cutover: the charge is created server-side at CARD SUBMIT
    // (CardPaymentForm → createCheckout(orderNumber, { cardToken })). Nothing is
    // written here — the browser never fabricates an intent row and never marks
    // an order paid; this pending object is UI-only until the EF responds.
    if (isOmiseConfigured()) {
      return {
        success: true,
        payment_intent: {
          ...intentBase,
          id: `omise-pending-${orderNumber}`,
          status: 'pending' as PaymentStatus,
          provider: 'omise',
          metadata: { ...metadata, provider: 'omise', source: 'omise-card-form' },
        },
      }
    }
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

  // WAVE 5A B5/B10: NEVER a second ACTIVE intent for the same order+method —
  // an ambiguous first response (เช่น timeout หลัง commit ไปแล้ว) ต้องไม่ทับ
  // แถวเดิม R1.2 (2026-10-23, R0 พบ BMB-20261023-841/205 มี intent ซ้ำ 2 แถว):
  // ถ้ามี active (pending/processing) อยู่แล้ว คืนแถวเดิม ไม่ INSERT เพิ่ม
  // (ความพยายามที่ failed แล้วไม่ block — ปุ่มลองใหม่ยังสร้าง attempt ใหม่ได้)
  // R3 (D-08, migration 138): dedupe จริงอยู่ฝั่ง server แล้ว (create_payment_intent_record
  // คืนแถวเดิม + unique index กัน concurrency) — ถ้า read สำรวจนี้ล้ม ต้องรายงาน
  // error (ไม่เงียบ) แต่ยัง proceed ต่อได้โดยไม่เสี่ยงสร้างแถวซ้ำ
  let existingActive: PaymentIntent | undefined
  try {
    existingActive = (await getPaymentIntents({ orderNumber })).find(
      (i) => i.method === method && (i.status === 'pending' || i.status === 'processing'),
    )
  } catch (e) {
    console.error('[paymentGateway] dedupe pre-check failed (server dedupe still protects):', e)
  }
  if (existingActive) {
    return { success: true, payment_intent: existingActive }
  }

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
 * Card confirmation is handled end-to-end by the provider (Stripe.js
 * client_secret / Omise.js token + authorize_uri → webhook →
 * record_payment_result). This function only reports the current
 * intent state; it NEVER marks an order paid from the browser.
 */
export async function confirmPayment(
  paymentIntentId: string,
  _paymentMethodId: string,
): Promise<PaymentConfirmResult> {
  // R3 (D-08, migration 138): read via the canonical RPC — table access is
  // REVOKE'd; a read failure is reported (never a silent "not found").
  const { data, error } = await supabase.rpc('get_payment_intents_for_orders', {
    p_intent_id: paymentIntentId,
  })

  if (error) {
    console.error('[paymentGateway] intent read failed:', error.message)
    return { success: false, error: `ERR_PAYMENT_INTENTS_READ: ${error.message}` }
  }
  const intent = ((data || []) as PaymentIntent[])[0]
  if (!intent) {
    return { success: false, error: 'Payment intent not found' }
  }
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

// ============================================
// PromptPay transfer slip (evidence upload — mig 133)
// ============================================
export interface SlipUploadResult {
  success: boolean
  path?: string
  error?: string
}

/**
 * Upload the transfer slip into the PRIVATE `payment-slips` bucket.
 * Path is forced under the caller's own folder (`<uid>/<order>-<ts>.<ext>`) —
 * storage RLS rejects any other folder, and `submit_payment_slip` re-checks.
 */
export async function uploadPaymentSlip(orderNumber: string, file: File): Promise<SlipUploadResult> {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData?.user) {
    return { success: false, error: 'ERR_NOT_AUTHENTICATED' }
  }
  const uid = userData.user.id
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const path = `${uid}/${orderNumber}-${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('payment-slips').upload(path, file, {
    contentType: file.type || 'image/jpeg',
    upsert: false,
  })
  if (error) {
    return { success: false, error: error.message }
  }
  return { success: true, path }
}

/**
 * Record the uploaded slip on the order's payment intent (mig 133).
 * pending → processing (evidence attached) — admin still confirms via
 * confirm_offline_payment; the client can NEVER mark paid.
 */
export async function submitPaymentSlip(orderNumber: string, slipPath: string): Promise<PaymentConfirmResult> {
  const { error } = await supabase.rpc('submit_payment_slip', {
    p_order_number: orderNumber,
    p_slip_path: slipPath,
  })
  if (error) {
    return { success: false, error: error.message }
  }
  return { success: true }
}

/** Signed URL (1h) for slip preview — owner or admin only (storage RLS). */
export async function getPaymentSlipSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('payment-slips').createSignedUrl(path, 3600)
  if (error) return null
  return data?.signedUrl ?? null
}

/**
 * Refunds are server-side only (requires service-role + provider API).
 * Admin flows live in the `omise-refund` / `stripe-refund` Edge Functions
 * (selected by payment_intents.provider); the browser NEVER touches
 * money-out operations.
 */
export async function refundPayment(_paymentIntentId: string, _reason: string = ''): Promise<PaymentConfirmResult> {
  return { success: false, error: 'REFUND_SERVER_SIDE_ONLY — use the omise-refund / stripe-refund Edge Function (admin)' }
}

// ============================================
// Query helpers (read-only; DB driven)
// ============================================

export async function getPaymentIntents(filters?: {
  orderNumber?: string
  /** M5 (2026-10-22): batch read for admin lists — one query per page of orders. */
  orderNumbers?: string[]
  status?: PaymentStatus
  startDate?: string
  endDate?: string
}): Promise<PaymentIntent[]> {
  // R3 (D-08, migration 138): the ONLY read path — SECURITY DEFINER RPC
  // get_payment_intents_for_orders. The table stays REVOKE'd for `authenticated`
  // (canonical 034) and the old direct PostgREST table read was a silent []
  // in production (permission denied swallowed) — that blinded the slip review
  // AND the R1.2 dedupe (duplicate intents 841/205). Never swallow again:
  // a read failure now THROWS a clear code so every caller must surface it.
  const { data, error } = await supabase.rpc('get_payment_intents_for_orders', {
    p_order_numbers:
      filters?.orderNumbers && filters.orderNumbers.length > 0
        ? filters.orderNumbers
        : filters?.orderNumber
          ? [filters.orderNumber]
          : null,
    p_intent_id: null,
    p_status: filters?.status ?? null,
    p_created_from: filters?.startDate ?? null,
    p_created_to: filters?.endDate ?? null,
  })
  if (error) {
    console.error('[paymentGateway] get_payment_intents_for_orders failed:', error.message)
    throw new Error(`ERR_PAYMENT_INTENTS_READ: ${error.message || 'read failed'}`)
  }
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