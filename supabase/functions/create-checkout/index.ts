// ============================================
// Bite Me Baby — Edge Function: create-checkout
// P0-5: real Stripe PaymentIntent creation (server-side).
//
// Security:
//   - Requires a valid Supabase user JWT (Authorization: Bearer <access_token>).
//   - Amount is RE-DERIVED from orders.total_amount (authoritative DB value);
//     the client cannot influence the charged amount.
//   - Order must belong to the caller and be paid with credit_card.
//   - STRIPE_SECRET_KEY lives ONLY in the Edge Function env (server-side).
//
// Env (supabase secrets set STRIPE_SECRET_KEY=...):
//   STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
//
// Called from src/lib/paymentGateway.ts via supabase.functions.invoke('create-checkout')
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

async function stripeFetch(path: string, form: URLSearchParams): Promise<{ ok: boolean; status: number; data: any }> {
  const sk = Deno.env.get('STRIPE_SECRET_KEY') || ''
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sk}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  })
  let data: any = {}
  try {
    data = await res.json()
  } catch {
    // non-JSON error body
  }
  return { ok: res.ok, status: res.status, data }
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

  const sk = Deno.env.get('STRIPE_SECRET_KEY') || ''
  if (!sk) {
    return json({ error: 'ERR_STRIPE_NOT_CONFIGURED' }, 500)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

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

  // ---- 3. Load the order through the USER's token (RLS guarantees ownership) ----
  const orderRes = await fetch(
    `${supabaseUrl}/rest/v1/orders?select=order_number,total_amount,payment_method,status,customer_ref&order_number=eq.${encodeURIComponent(orderNumber)}`,
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

  // ---- 4. Create Stripe PaymentIntent with the AUTHORITATIVE amount ----
  const form = new URLSearchParams()
  form.set('amount', String(Math.round(amount * 100))) // THB minor units
  form.set('currency', 'thb')
  form.set('payment_method_types[]', 'card')
  form.set('metadata[order_number]', orderNumber)
  form.set('metadata[customer_ref]', String(user.id))

  const pi = await stripeFetch('/v1/payment_intents', form)
  if (!pi.ok) {
    return json({ error: 'ERR_STRIPE_API', detail: pi.data?.error?.message ?? 'stripe error' }, 502)
  }
  const intent = pi.data

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
      id: `pi-${intent.id}`,
      order_number: orderNumber,
      amount,
      currency: 'thb',
      status: 'pending',
      method: 'credit_card',
      provider: 'stripe',
      client_secret: intent.client_secret,
      payment_intent_id: intent.id,
      metadata: { provider: 'stripe', source: 'create-checkout' },
    }),
  })
  if (!recRes.ok) {
    console.warn('[create-checkout] payment_intents insert failed (may be duplicate):', recRes.status)
  }

  return json({
    ok: true,
    order_number: orderNumber,
    payment_intent_id: intent.id,
    client_secret: intent.client_secret,
    amount,
    currency: 'thb',
    status: 'pending',
  })
})