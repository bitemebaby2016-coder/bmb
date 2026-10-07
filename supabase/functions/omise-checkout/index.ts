// ============================================
// Bite Me Baby — Edge Function: omise-checkout
// Stripe -> Omise cutover (TEST MODE first) — handoff §5.2 step 2.
//
// Creates an Omise charge SERVER-SIDE for an order's card payment:
//   - Requires a valid Supabase user JWT (Authorization: Bearer <access_token>).
//   - Amount is RE-DERIVED from orders.total_amount (authoritative DB value);
//     the client cannot influence the charged amount.
//   - Order must belong to the caller and be paid with credit_card.
//   - OMISE_SECRET_API_KEY_TEST_MODE lives ONLY in the Edge Function env
//     (server-side; never in the client bundle).
//   - Optional card_token (tok_...) created in the browser by Omise.js: the
//     charge is created directly on that token. WITHOUT a token the charge is
//     authorize-only and the customer completes payment on Omise's hosted page
//     (return_uri flow) — both paths return authorize_uri when 3-D Secure is
//     required; the client redirects there and comes back to /payment/:order.
//   - The payment RESULT is recorded by omise-webhook through the idempotent
//     record_payment_result RPC — the browser never marks an order paid.
//   - Single-open-intent guard (mirror of create-checkout W5-2): resume/retry
//     reuses the latest still-open omise intent instead of minting a second
//     charge.
//
// Env (supabase secrets set ...):
//   OMISE_SECRET_API_KEY_TEST_MODE (live cutover later: OMISE_SECRET_API_KEY),
//   SUPABASE_URL, SUPABASE_ANON_KEY,
//   bmb_backend_production_supabase_service_role_key (fallback:
//   SUPABASE_SERVICE_ROLE_KEY — same binding as create-checkout),
//   OMISE_RETURN_URI_BASE (optional fallback when the request carries no Origin)
//
// Called from src/lib/paymentGateway.ts via supabase.functions.invoke('omise-checkout')
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
  // Test-mode key first (current cutover stage, handoff §5.2 step 1). A live
  // key can later be provided under a *_LIVE name without a code change.
  return Deno.env.get('OMISE_SECRET_API_KEY_TEST_MODE') || Deno.env.get('OMISE_SECRET_API_KEY') || ''
}

async function omiseFetch(path: string, form: URLSearchParams | null, method = 'POST'): Promise<{ ok: boolean; status: number; data: any }> {
  // NOTE: the Omise API key authenticates with HTTP Basic (secret key as the
  // username, empty password) — this is NOT the Supabase service-role key.
  const sk = omiseSecretKey()
  const res = await fetch(`${OMISE_API}${path}`, {
    method,
    headers: {
      Authorization: 'Basic ' + btoa(`${sk}:`),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form ? form.toString() : undefined,
  })
  let data: any = {}
  try {
    data = await res.json()
  } catch {
    // non-JSON error body
  }
  return { ok: res.ok, status: res.status, data }
}

function buildReturnUri(req: Request, orderNumber: string): string {
  // The Origin header is the page that invoked the function (browser). The
  // optional env covers non-browser callers. return_uri is navigation only —
  // Omise validates it against the account's allowed domains; money authority
  // stays with the DB + webhook.
  const origin = (req.headers.get('origin') || '').replace(/\/+$/, '')
  const base = (origin || Deno.env.get('OMISE_RETURN_URI_BASE') || 'http://localhost:5173').replace(/\/+$/, '')
  return `${base}/payment/${encodeURIComponent(orderNumber)}`
}

/** Charge still awaiting 3-D Secure / hosted completion -> safe to re-offer. */
function isChargeAwaitingAuthorization(charge: any): boolean {
  return charge?.status === 'pending' && typeof charge?.authorize_uri === 'string' && charge.authorize_uri.length > 0
}



Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() })
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const authHeader = req.headers.get('Authorization') || ''
  if (!authHeader.startsWith('Bearer ')) {
    return json({ error: 'ERR_NOT_AUTHENTICATED' }, 401)
  }

  const sk = omiseSecretKey()
  if (!sk) {
    return json({ error: 'ERR_OMISE_NOT_CONFIGURED' }, 500)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
  const serviceKey = Deno.env.get('bmb_backend_production_supabase_service_role_key')
    || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

  // ---- 1. Verify the caller (Supabase Auth JWT) ----
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: authHeader },
  })
  if (!userRes.ok) {
    return json({ error: 'ERR_NOT_AUTHENTICATED' }, 401)
  }
  const user: any = await userRes.json()

  // ---- 2. Read input ----
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
  // Card token from Omise.js (tok_...). Optional: without it the customer
  // completes the payment on Omise's hosted page (return_uri flow).
  const cardToken: string = String(body?.card_token ?? '').trim()

  // ---- 3. Load the order through the USER's token (RLS guarantees ownership) ----
  const orderRes = await fetch(
    `${supabaseUrl}/rest/v1/orders?select=order_number,total_amount,payment_method,status,payment_status,customer_ref&order_number=eq.${encodeURIComponent(orderNumber)}`,
    { headers: { apikey: anonKey, Authorization: authHeader } },
  )
  if (!orderRes.ok) {
    return json({ error: 'ERR_ORDER_READ_DENIED' }, 403)
  }
  const orders: any[] = await orderRes.json()
  const order = orders?.[0]
  if (!order) {
    return json({ error: 'ERR_ORDER_NOT_FOUND' }, 404)
  }
  if (order.payment_method !== 'credit_card') {
    return json({ error: 'ERR_NOT_CARD_PAYMENT' }, 400)
  }
  if (order.customer_ref !== user.id) {
    return json({ error: 'ERR_FORBIDDEN' }, 403)
  }

  const amount = Number(order.total_amount)
  if (!(amount > 0)) {
    return json({ error: 'ERR_INVALID_AMOUNT' }, 400)
  }

  // ---- 3.5 Single-open-intent guard (mirror create-checkout W5-2) ----
  //  a) already-terminal payment -> refuse (no new charge possible)
  //  b) else REUSE the latest still-open omise intent instead of minting a
  //     second charge (resume/retry returns the SAME charge + authorize_uri)
  if (['paid', 'completed', 'refunded', 'partially_refunded'].includes(String(order.payment_status))) {
    return json({ error: 'ERR_ORDER_ALREADY_PAID', detail: `order ${orderNumber} already has payment_status=${order.payment_status}` }, 409)
  }
  const openRes = await fetch(
    `${supabaseUrl}/rest/v1/payment_intents?select=id,status&order_number=eq.${encodeURIComponent(orderNumber)}&status=in.(pending,processing)&order=created_at.desc&limit=1`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
  )
  let openRows: any[] = []
  try { if (openRes.ok) openRows = await openRes.json() } catch { /* ignore */ }
  const openRow = openRows?.[0]
  if (openRow && typeof openRow.id === 'string' && openRow.id.startsWith('pi-chrg_')) {
    const omiseChargeId = openRow.id.slice(3)
    const exist = await omiseFetch(`/charges/${omiseChargeId}`, null, 'GET')
    const charge = exist.data
    if (exist.ok && isChargeAwaitingAuthorization(charge)) {
      return json({
        ok: true,
        provider: 'omise',
        order_number: orderNumber,
        charge_id: charge.id,
        charge_status: charge.status,
        authorize_uri: charge.authorize_uri,
        amount,
        currency: charge.currency || 'thb',
        status: 'pending',
        reused: true,
      })
    }
    if (exist.ok && charge?.status === 'successful') {
      // Charge already succeeded; the webhook / record_payment_result settles
      // the order idempotently — never create a second charge here.
      return json({
        ok: true,
        provider: 'omise',
        order_number: orderNumber,
        charge_id: charge.id,
        charge_status: charge.status,
        amount,
        currency: charge.currency || 'thb',
        status: 'pending',
        reused: true,
      })
    }
    // Charge expired/failed but the row is still open (webhook not landed yet):
    // close the stale row so the ledger stays clean, then fall through and
    // create a fresh charge.
    if (exist.ok && charge) {
      await fetch(
        `${supabaseUrl}/rest/v1/payment_intents?id=eq.${encodeURIComponent(openRow.id)}`,
        {
          method: 'PATCH',
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: 'failed', updated_at: new Date().toISOString() }),
        },
      ).catch(() => { /* best effort */ })
    }
  }

  // ---- 4. Create the Omise charge with the AUTHORITATIVE amount ----
  const form = new URLSearchParams()
  form.set('amount', String(Math.round(amount * 100))) // THB minor units (satang)
  form.set('currency', 'thb')
  form.set('capture', 'true')
  form.set('description', `Bite Me Baby order ${orderNumber}`)
  form.set('return_uri', buildReturnUri(req, orderNumber))
  form.set('metadata[order_number]', orderNumber)
  form.set('metadata[customer_ref]', String(user.id))
  if (cardToken) form.set('card', cardToken)

  const created = await omiseFetch('/charges', form)
  if (!created.ok) {
    return json({ error: 'ERR_OMISE_API', detail: created.data?.message ?? created.data?.error ?? 'omise error' }, 502)
  }
  const charge = created.data
  if (!charge?.id || !String(charge.id).startsWith('chrg_')) {
    return json({ error: 'ERR_OMISE_API', detail: 'unexpected charge response' }, 502)
  }

  // ---- 5. Record the intent row (service role = authoritative server write) ----
  const recRes = await fetch(`${supabaseUrl}/rest/v1/payment_intents`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      id: `pi-${charge.id}`,
      order_number: orderNumber,
      amount,
      currency: 'thb',
      status: 'pending',
      method: 'credit_card',
      provider: 'omise',
      client_secret: null,
      // payment_intent_id stays NULL at checkout — the real value is written by
      // omise-webhook (record_payment_result) on the first REAL event.
      // Pre-filling it would make the RPC treat the first event as a replay
      // (idempotent) and skip the update → order stuck pending forever
      // (STRIPE GATE finding, 2026-09-19 — same rule as create-checkout).
      payment_intent_id: null, // set by omise-webhook -> record_payment_result
      metadata: { provider: 'omise', source: 'omise-checkout', charge_status: charge.status, livemode: !!charge.livemode },
    }),
  })
  if (!recRes.ok) {
    // F1 FIX parity with create-checkout (2026-09-28): never return success when
    // the intent insert failed — otherwise the single-open-intent guard is
    // bypassed and duplicate charges become possible.
    const errText = await recRes.text().catch(() => '')
    console.error('[omise-checkout] payment_intents insert FAILED:', recRes.status, errText)
    return json({ error: 'ERR_PI_INSERT_FAILED', detail: `payment_intents insert failed: ${recRes.status}` }, 500)
  }

  return json({
    ok: true,
    provider: 'omise',
    order_number: orderNumber,
    charge_id: charge.id,
    charge_status: charge.status,
    authorize_uri: charge.authorize_uri ?? null,
    amount,
    currency: charge.currency || 'thb',
    status: 'pending',
  })
})


