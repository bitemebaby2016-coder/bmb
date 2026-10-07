// ============================================
// Bite Me Baby — Edge Function: omise-refund
// Stripe -> Omise cutover (handoff §5.2 step 6): ADMIN-only server-side Omise
// refunds (Omise Refunds API replaces stripe-refund for omise-paid orders).
//
// Security (mirror of stripe-refund):
//   - Requires a valid Supabase user JWT AND profiles.role='admin' (verified
//     server-side via the canonical is_admin() RPC).
//   - Refund is created with the server-side OMISE_SECRET_API_KEY_TEST_MODE
//     (HTTP Basic auth — never exposed to the browser).
//   - Ledger idempotency: refund may never exceed the charged amount tracked
//     in the DB (payment_intents.amount + metadata.refunded_total_minor), so
//     retries never double-refund; a deterministic key
//     `bmb-omise-refund-<order>-<amountMinor>` is also attached.
//   - DB writes use the Supabase service-role key (server-side authority).
//
// Env (supabase secrets set ...): OMISE_SECRET_API_KEY_TEST_MODE (live later:
//   OMISE_SECRET_API_KEY), SUPABASE_URL, SUPABASE_ANON_KEY,
//   bmb_backend_production_supabase_service_role_key (fallback:
//   SUPABASE_SERVICE_ROLE_KEY)
//
// Called from the Admin UI via supabase.functions.invoke('omise-refund').
// ============================================

const OMISE_API = 'https://api.omise.co'

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

function omiseSecretKey(): string {
  return Deno.env.get('OMISE_SECRET_API_KEY_TEST_MODE') || Deno.env.get('OMISE_SECRET_API_KEY') || ''
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
    return json({ ok: true, service: 'omise-refund' })
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
  const sk = omiseSecretKey()
  const serviceKey = Deno.env.get('bmb_backend_production_supabase_service_role_key')
    || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

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

  // ---- 2. Verify the caller is an ADMIN (canonical is_admin(); profiles is
  //     RLS-locked so a raw user-token SELECT on it is 42501 — see RLS_MATRIX) ----
  const adminRes = await fetch(`${supabaseUrl}/rest/v1/rpc/is_admin`, {
    method: 'POST',
    headers: { apikey: anonKey, Authorization: authHeader, 'content-type': 'application/json' },
    body: '{}',
  })
  if (!adminRes.ok) {
    return json({ error: 'ERR_FORBIDDEN' }, 403)
  }
  let isAdmin = false
  try {
    isAdmin = (await adminRes.json()) === true
  } catch {
    /* treat an unreadable result as not-admin */
  }
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
  const reason: string | undefined = body?.reason ? String(body.reason) : undefined
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
    (i) => i?.provider === 'omise' && i?.payment_intent_id && i?.status === 'completed',
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

  // ---- 5. Create the Omise refund (deterministic key per order+amount) ----
  const idempotencyKey = `bmb-omise-refund-${orderNumber}-${refundMinor}`
  const form = new URLSearchParams()
  form.set('charge', pi.payment_intent_id)
  if (refundMinor !== chargedMinor) form.set('amount', String(refundMinor))
  form.set('metadata[order_number]', orderNumber)
  form.set('metadata[refunded_by]', uid)
  form.set('metadata[idempotency_key]', idempotencyKey)
  if (reason) form.set('metadata[reason]', reason)

  let refund: any
  try {
    const res = await fetch(`${OMISE_API}/refunds`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + btoa(`${sk}:`),
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': idempotencyKey,
      },
      body: form.toString(),
    })
    const data: any = await res.json()
    if (!res.ok || data?.object === 'error') {
      console.error('[omise-refund] omise error:', data?.message ?? data?.code)
      return json({ error: 'ERR_REFUND_FAILED', detail: data?.message ?? 'omise error' }, 502)
    }
    refund = data
  } catch (e) {
    console.error('[omise-refund] network error:', e)
    return json({ error: 'ERR_REFUND_FAILED', detail: String(e).slice(0, 200) }, 502)
  }

  if (refund?.status === 'failed' || refund?.status === 'reversed') {
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
    body: JSON.stringify({ status: newPaymentStatus === 'refund' ? 'refunded' : 'partially_refunded', metadata: nextMetadata, updated_at: now }),
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
    console.warn('[omise-refund] DB persist warning (omise refund already created):', piPatch.status, orderPatch.status)
  }

  return json({
    ok: true,
    provider: 'omise',
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
