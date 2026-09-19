// ============================================
// Bite Me Baby — Edge Function: stripe-webhook
// P0-5: Stripe webhook → verify signature → idempotent payment recording.
//
// Security:
//   - STRIPE_WEBHOOK_SECRET (whsec_...) lives ONLY in the EF env.
//   - Signature verified with HMAC-SHA256 (t=timestamp, v1=signature scheme).
//   - Amount match + event idempotency enforced inside RPC record_payment_result
//     (EXECUTE granted ONLY to service_role).
//   - Replays/unknown events return 202 without side effects.
//
// Env (supabase secrets set ...):
//   STRIPE_WEBHOOK_SECRET, SUPABASE_URL,
//   bmb_backend_production_supabase_service_role_key (2026-09-19 rotation; legacy
//   SUPABASE_SERVICE_ROLE_KEY kept as fallback until retired)
// ============================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Constant-time hex comparison (avoids timing side-channels on the signature). */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** Verify a Stripe webhook signature (t=timestamp, v1=scheme) with HMAC-SHA256. */
async function verifyStripeSignature(
  payload: string,
  signatureHeader: string,
  secret: string,
): Promise<boolean> {
  const fields = new Map<string, string>()
  for (const part of signatureHeader.split(',')) {
    const [key, value] = part.trim().split('=', 2)
    if (key && value) fields.set(key, value)
  }
  const timestamp = fields.get('t')
  const signature = fields.get('v1')
  if (!timestamp || !signature) return false

  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
    return false // event older than 5 minutes — reject
  }

  try {
    // WebCrypto requires an imported CryptoKey — raw bytes are NOT accepted
    // by crypto.subtle.sign. Without importKey the call throws, every
    // signature check fails, and all real Stripe deliveries get 400.
    const keyBytes = new TextEncoder().encode(secret)
    const data = new TextEncoder().encode(`${timestamp}.${payload}`)
    const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const sig = await crypto.subtle.sign('HMAC', cryptoKey, data)
    const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
    return timingSafeEqualHex(hex, signature)
  } catch {
    return false
  }
}

function intMinorToMajor(amountMinor: number): number {
  return Number(amountMinor) / 100
}

// Permanent business rejections → HTTP 400 (Stripe must NOT retry these).
// Anything else → 500 (transient, Stripe retries with backoff).
const PERMANENT_ERRORS = ['ERR_ORDER_NOT_FOUND', 'ERR_AMOUNT_MISMATCH', 'ERR_MISSING_ORDER', 'ERR_MISSING_PAYMENT_INTENT_ID']

function rpcErrorStatus(message: string): number {
  return PERMANENT_ERRORS.some((e) => message.includes(e)) ? 400 : 500
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'GET') {
    return json({ ok: true, service: 'stripe-webhook' })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const payload = await req.text()
  const signature = req.headers.get('stripe-signature') || ''
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || ''

  if (!secret) {
    return json({ error: 'ERR_WEBHOOK_NOT_CONFIGURED' }, 500)
  }
  if (!(await verifyStripeSignature(payload, signature, secret))) {
    // 400 (not 401): Stripe: a bad signature is permanent, never retried
    return json({ error: 'ERR_INVALID_SIGNATURE' }, 400)
  }

  let event: any
  try {
    event = JSON.parse(payload)
  } catch {
    return json({ error: 'ERR_INVALID_EVENT' }, 400)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const serviceKey = Deno.env.get('bmb_backend_production_supabase_service_role_key') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  const admin = createClient(supabaseUrl, serviceKey)

  const pi = event?.data?.object ?? {}
  const orderNumber = pi?.metadata?.order_number

  if (!orderNumber) {
    return json({ received: true, note: 'no order_number in metadata' }, 202)
  }

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const { error } = await admin.rpc('record_payment_result', {
        p_order_number: orderNumber,
        p_payment_intent_id: pi.id,
        p_amount: intMinorToMajor(Number(pi.amount)),
        p_currency: pi.currency || 'thb',
        p_status: 'completed',
      })
      if (error) {
        console.error('[stripe-webhook] record_payment_result error:', error)
        // Permanent rule violations (missing/amount mismatch) → 400 (no retry);
        // anything else → 500 (Stripe retries with backoff).
        return json({ received: false, error: error.message }, rpcErrorStatus(String(error.message)))
      }
      return json({ received: true, result: 'paid' })
    }
    case 'payment_intent.payment_failed': {
      const { error } = await admin.rpc('record_payment_result', {
        p_order_number: orderNumber,
        p_payment_intent_id: pi.id,
        p_amount: intMinorToMajor(Number(pi.amount)),
        p_currency: pi.currency || 'thb',
        p_status: 'failed',
        p_failure_reason: pi.last_payment_error?.message ?? 'card declined',
      })
      if (error) {
        console.error('[stripe-webhook] record_payment_result error:', error)
        // Permanent rule violations → 400 (no retry); transient → 500.
        return json({ received: false, error: error.message }, rpcErrorStatus(String(error.message)))
      }
      return json({ received: true, result: 'failed' })
    }
    default:
      // Unhandled events are acknowledged but do nothing (idempotent by design).
      return json({ received: true, unhandled: event.type }, 202)
  }
})