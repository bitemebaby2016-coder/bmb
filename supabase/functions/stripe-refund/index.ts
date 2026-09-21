// ============================================
// Bite Me Baby — Edge Function: stripe-refund
// P0-5 extension / Phase C-D item C-6: ADMIN-only server-side Stripe refunds.
//
// Security:
//   - Requires a valid Supabase user JWT AND profiles.role='admin' (verified server-side).
//   - Refund is created with the server-side STRIPE_SECRET_KEY (never exposed to the browser).
//   - Idempotency-Key (Stripe) = bmb-refund-<order>-<amountMinor> so retries never double-refund.
//   - Amount authority: refund may never exceed the charged amount tracked in the DB
//     (payment_intents.amount + metadata.refunded_total_minor ledger).
//   - DB writes use the Supabase service-role key (server-side authority).
//
// Env (supabase secrets set ...): STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_ANON_KEY,
//   bmb_backend_production_supabase_service_role_key (fallback: SUPABASE_SERVICE_ROLE_KEY)
//
// Called from the Admin UI via supabase.functions.invoke('stripe-refund').
// ============================================

const STRIPE_API = 'https://api.stripe.com'

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
  })
}

function intMinorToMajor(amountMinor: number): number {
  return Number(amountMinor) / 100
}

// Permanent rejections -> 400 (caller should not retry as-is).
const PERMANENT = [
  'ERR_NOT_AUTHENTICATED',
  'ERR_FORBIDDEN',
  'ERR_ORDER_NOT_FOUND',
  'ERR_NOT_CARD_PAYMENT',
  'ERR_NOT_PAID',
  'ERR_MISSING_PAYMENT_INTENT',
  'ERR_REFUND_AMOUNT_EXCEEDS',
  'ERR_REFUND_ALREADY_EXISTS',
  'ERR_MISSING_ORDER',
]

function statusForError(message: string): number {
  return PERMANENT.some((e) => message.includes(e)) ? 400 : 500
}

type RefundLedger = {
  refund_ids: string[]
  refunded_total_minor: number
  last_refund_at?: string
}

function readLedger(metadata: any): RefundLedger {
  const m = metadata ?? {}
  const refundIds = Array.isArray(m.refund_ids) ? m.refund_ids.map(String) : []
  const total = Number(m.refunded_total_minor || 0)
  return { refund_ids: refundIds, refunded_total_minor: Number.isFinite(total) ? Math.trunc(total) : 0, last_refund_at: m.last_refund_at }
}
Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() })
  if (req.method === 'GET') {
    return json({ ok: true, service: 'stripe-refund' })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const authHeader = req.headers.get('Authorization') || ''
  if (!authHeader.startsWith('Bearer ')) {
    return json({ error: 'ERR_NOT_AUTHENTICATED' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
  const sk = Deno.env.get('STRIPE_SECRET_KEY') || ''
  const serviceKey = Deno.env.get('bmb_backend_production_supabase_service_role_key') || ''

  if (!sk || !serviceKey || !supabaseUrl) {
    return json({ error: 'ERR_NOT_CONFIGURED' }, 500)
  }

  // ---- 1. Verify the caller is a logged-in user ----
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: authHeader },
  })
  if (!userRes.ok) {
    return json({ error: 'ERR_NOT_AUTHENTICATED' }, 401)
  }
  const user: any = await userRes.json()
  const uid: string | undefined = user?.id
  if (!uid) {
    return json({ error: 'ERR_NOT_AUTHENTICATED' }, 401)
  }

  // ---- 2. Verify the caller is an ADMIN (profiles.role, read with the user's own token) ----
  const profileRes = await fetch(
    `${supabaseUrl}/rest/v1/profiles?select=role,is_active&id=eq.${encodeURIComponent(uid)}`,
    { headers: { apikey: anonKey, Authorization: authHeader } },
  )
  if (!profileRes.ok) {
    return json({ error: 'ERR_FORBIDDEN' }, 403)
  }
  const profiles: any[] = await profileRes.json()
  const isAdmin = Array.isArray(profiles) && profiles.some((p) => p?.role === 'admin' && p?.is_active !== false)
  if (!isAdmin) {
    return json({ error: 'ERR_FORBIDDEN' }, 403)
  }

  // ---- 3. Read input ----
  let body: any
  try {
    body = await req.json()
  } catch {
    return json({ error: 'ERR_INVALID_BODY' }, 400)
  }
  const orderNumber: string = String(body?.order_number ?? '').trim()
  if (!orderNumber) {
    return json({ error: 'ERR_MISSING_ORDER' }, 400)
  }
  const STRIPE_REASONS = ['duplicate', 'fraudulent', 'requested_by_customer']
  const reason: string | undefined = body?.reason && STRIPE_REASONS.includes(String(body.reason))
    ? String(body.reason)
    : undefined
  const requestedMinor = body?.amount == null || Number.isNaN(Number(body.amount))
    ? null
    : Math.round(Number(body.amount) * 100)

  // ---- 4. Load order + payment intent (service role, authoritative) ----
  const hSvc = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
  const orderRes = await fetch(
    `${supabaseUrl}/rest/v1/orders?select=order_number,total_amount,payment_status,payment_method&order_number=eq.${encodeURIComponent(orderNumber)}`,
    { headers: hSvc },
  )
  if (!orderRes.ok) return json({ error: 'ERR_ORDER_READ_DENIED' }, 500)
  const orders: any[] = await orderRes.json()
  const order = orders?.[0]
  if (!order) return json({ error: 'ERR_ORDER_NOT_FOUND' }, 404)
if (order.payment_method !== 'credit_card') return json({ error: 'ERR_NOT_CARD_PAYMENT' }, 400)
  if (order.payment_status === 'refund') return json({ error: 'ERR_REFUND_ALREADY_EXISTS' }, 400)
  if (order.payment_status !== 'paid' && order.payment_status !== 'partially_refunded') {
    return json({ error: 'ERR_NOT_PAID' }, 400)
  }

  const piRes = await fetch(
    `${supabaseUrl}/rest/v1/payment_intents?select=id,order_number,amount,status,payment_intent_id,metadata,provider&order_number=eq.${encodeURIComponent(orderNumber)}`,
    { headers: hSvc },
  )
  if (!piRes.ok) return json({ error: 'ERR_PI_READ_DENIED' }, 500)
  const intents: any[] = await piRes.json()
  const pi = (intents || []).find(
    (i) => i?.provider === 'stripe' && i?.payment_intent_id && i?.status === 'completed',
  )
  if (!pi) return json({ error: 'ERR_MISSING_PAYMENT_INTENT' }, 400)

  const chargedMinor = Math.round(Number(pi.amount || 0) * 100)
  const ledger = readLedger(pi.metadata)
  const remainingMinor = chargedMinor - ledger.refunded_total_minor
  if (remainingMinor <= 0) return json({ error: 'ERR_REFUND_ALREADY_EXISTS' }, 400)

  const refundMinor = requestedMinor == null ? remainingMinor : Math.min(requestedMinor, remainingMinor)
  if (refundMinor <= 0) return json({ error: 'ERR_REFUND_AMOUNT_EXCEEDS' }, 400)
  if (requestedMinor != null && requestedMinor > remainingMinor) {
    return json({ error: 'ERR_REFUND_AMOUNT_EXCEEDS' }, 400)
  }

  // ---- 5. Create the Stripe refund (idempotent per order+amount) ----
  const idempotencyKey = `bmb-refund-${orderNumber}-${refundMinor}`
  const form = new URLSearchParams()
  form.set('payment_intent', pi.payment_intent_id)
  if (refundMinor !== chargedMinor) form.set('amount', String(refundMinor))
  if (reason) form.set('reason', reason)
  form.set('metadata[order_number]', orderNumber)
  form.set('metadata[refunded_by]', uid)

  let refund: any
  try {
    const res = await fetch(`${STRIPE_API}/v1/refunds`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sk}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': idempotencyKey,
      },
      body: form.toString(),
    })
    const data: any = await res.json()
    if (!res.ok || data?.error) {
      console.error('[stripe-refund] stripe error:', data?.error)
      return json({ error: 'ERR_REFUND_FAILED', detail: data?.error?.message ?? 'stripe error' }, 502)
    }
    refund = data
  } catch (e) {
    console.error('[stripe-refund] network error:', e)
    return json({ error: 'ERR_REFUND_FAILED', detail: String(e).slice(0, 200) }, 502)
  }

  if (refund?.status === 'failed' || refund?.status === 'canceled') {
    return json({ error: 'ERR_REFUND_FAILED', detail: `refund ${refund.status}` }, 502)
  }

  // ---- 6. Persist the result (service role; payment_status is NOT guarded by the status trigger) ----
  const now = new Date().toISOString()
  const refundedTotal = ledger.refunded_total_minor + Number(refund.amount || 0)
  const refundIds = [...ledger.refund_ids, refund?.id].filter(Boolean)
  const nextMetadata = {
    ...(pi.metadata ?? {}),
    refund_ids: refundIds,
    refunded_total_minor: refundedTotal,
    last_refund_at: now,
  }
  const newPaymentStatus = refundedTotal >= chargedMinor ? 'refund' : 'partially_refunded'

  const piPatch = await fetch(`${supabaseUrl}/rest/v1/payment_intents?id=eq.${encodeURIComponent(pi.id)}`, {
    method: 'PATCH',
    headers: { ...hSvc, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'refunded', metadata: nextMetadata, updated_at: now }),
  })
  const orderPatch = await fetch(
    `${supabaseUrl}/rest/v1/orders?order_number=eq.${encodeURIComponent(orderNumber)}`,
    {
      method: 'PATCH',
      headers: { ...hSvc, 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_status: newPaymentStatus, updated_at: now }),
    },
  )
  if (!piPatch.ok || !orderPatch.ok) {
    console.warn('[stripe-refund] DB persist warning (stripe refund already created):', piPatch.status, orderPatch.status)
  }

  return json({
    ok: true,
    order_number: orderNumber,
    payment_status: newPaymentStatus,
    refund: {
      id: refund?.id,
      status: refund?.status,
      amount: intMinorToMajor(Number(refund?.amount || 0)),
      currency: refund?.currency || 'thb',
      idempotency_key: idempotencyKey,
    },
  })
})