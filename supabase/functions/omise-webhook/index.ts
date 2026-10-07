// ============================================
// Bite Me Baby — Edge Function: omise-webhook
// Stripe -> Omise cutover (handoff §5.2 step 4): verify Omise-Signature →
// idempotent payment recording.
//
// Security:
//   - OMISE_WEBHOOK_SECRET (set in the Omise Dashboard → Webhooks) lives ONLY
//     in the EF env — never in the client bundle.
//   - Signature: header `Omise-Signature: t=<unix>,v1=<hex>` where v1 is
//     HMAC-SHA256(secret, `${t}.${payload}`) — the same t/v1 scheme Stripe
//     uses (Omise documents the identical algorithm); constant-time compare +
//     300 s replay window.
//   - Amount match + event idempotency are enforced INSIDE the RPC
//     record_payment_result (EXECUTE granted ONLY to service_role).
//   - Replays/unknown events return 202 without side effects.
//
// Events handled:
//   - charge.complete  → record_payment_result(completed | failed)
//   - refund.complete  → refund ledger sync (payment_intents + orders), mirror
//                        of stripe-webhook's charge.refunded handler
//   - anything else    → 202 acknowledged, no side effects
//
// Env (supabase secrets set ...):
//   OMISE_WEBHOOK_SECRET, SUPABASE_URL,
//   bmb_backend_production_supabase_service_role_key (fallback:
//   SUPABASE_SERVICE_ROLE_KEY — same binding as stripe-webhook).
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

/**
 * Verify an Omise webhook signature (`Omise-Signature: t=...,v1=...`).
 * v1 = hex(HMAC-SHA256(secret, `${t}.${payload}`)) — identical construction to
 * the Stripe scheme so the fixed WebCrypto pattern below is reused verbatim.
 */
async function verifyOmiseSignature(
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
    return false // event older than 5 minutes — reject (replay window)
  }

  try {
    // WebCrypto requires an imported CryptoKey — raw bytes are NOT accepted by
    // crypto.subtle.sign (STRIPE GATE, 2026-09-19: without importKey every
    // signature check throws → caught → false → all deliveries rejected).
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

// Permanent business rejections → HTTP 400 (Omise must NOT retry these).
// Anything else → 500 (transient, Omise retries with backoff).
const PERMANENT_ERRORS = ['ERR_ORDER_NOT_FOUND', 'ERR_AMOUNT_MISMATCH', 'ERR_MISSING_ORDER', 'ERR_MISSING_PAYMENT_INTENT_ID']

function rpcErrorStatus(message: string): number {
  return PERMANENT_ERRORS.some((e) => message.includes(e)) ? 400 : 500
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'GET') {
    return json({ ok: true, service: 'omise-webhook' })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const payload = await req.text()
  const signature = req.headers.get('omise-signature') || ''
  const secret = Deno.env.get('OMISE_WEBHOOK_SECRET') || ''
  if (!secret) {
    return json({ error: 'ERR_WEBHOOK_NOT_CONFIGURED' }, 500)
  }
  if (!(await verifyOmiseSignature(payload, signature, secret))) {
    // 400: a bad signature is permanent, never retried (same rule as Stripe)
    return json({ error: 'ERR_INVALID_SIGNATURE' }, 400)
  }

  let event: any
  try {
    event = JSON.parse(payload)
  } catch {
    return json({ error: 'ERR_INVALID_EVENT' }, 400)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  // Canonical service-role binding (matches create-checkout / stripe-webhook):
  // prefer the rotated custom name, fall back to the platform-injected key.
  const serviceKey = Deno.env.get('bmb_backend_production_supabase_service_role_key')
    || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  const admin = createClient(supabaseUrl, serviceKey)

  const obj = event?.data?.object ?? {}
  const orderNumber = obj?.metadata?.order_number

  switch (event.type) {
    case 'charge.complete': {
      // charge.complete carries the CHARGE object (metadata[order_number] set
      // by omise-checkout). Pending (3DS not finished yet) → 202, wait for the
      // settled event; the RPC enforces amount-match + replay protection.
      if (!orderNumber) {
        return json({ received: true, note: 'no order_number in metadata' }, 202)
      }
      const chargeStatus = String(obj?.status || '')
      if (chargeStatus === 'successful') {
        const { error } = await admin.rpc('record_payment_result', {
          p_order_number: orderNumber,
          p_payment_intent_id: obj.id,
          p_amount: intMinorToMajor(Number(obj.amount)),
          p_currency: obj.currency || 'thb',
          p_status: 'completed',
        })
        if (error) {
          console.error('[omise-webhook] record_payment_result error:', error)
          // Permanent rule violations → 400 (no retry); transient → 500.
          return json({ received: false, error: error.message }, rpcErrorStatus(String(error.message)))
        }
        return json({ received: true, result: 'paid' })
      }
      if (chargeStatus === 'failed') {
        const { error } = await admin.rpc('record_payment_result', {
          p_order_number: orderNumber,
          p_payment_intent_id: obj.id,
          p_amount: intMinorToMajor(Number(obj.amount)),
          p_currency: obj.currency || 'thb',
          p_status: 'failed',
          p_failure_reason: obj.failure_message || obj.failure_code || 'card declined',
        })
        if (error) {
          console.error('[omise-webhook] record_payment_result error:', error)
          return json({ received: false, error: error.message }, rpcErrorStatus(String(error.message)))
        }
        return json({ received: true, result: 'failed' })
      }
      // pending / reversed / expired — acknowledged, wait for the final event.
      return json({ received: true, note: `charge status ${chargeStatus || 'unknown'} — not final`, charge_status: chargeStatus }, 202)
    }

    case 'refund.complete': {
      // refund.complete carries the REFUND object: { id: rfnd_..., charge:
      // chrg_..., amount, currency, metadata }. Mirror of stripe-webhook's
      // charge.refunded handler: ledger sync (idempotent — replays append once).
      const refund = obj
      const chargeId = refund?.charge
      if (!chargeId) {
        console.warn('[omise-webhook] refund.complete: no charge on refund')
        return json({ received: true, note: 'refund without charge reference' }, 202)
      }

      // order_number: refund metadata (set by omise-refund) or the charge's
      // payment_intents row (authoritative link written at checkout).
      const { data: piRow, error: piErr } = await admin
        .from('payment_intents')
        .select('order_number, metadata, amount')
        .eq('payment_intent_id', chargeId)
        .maybeSingle()

      const refundOrderNumber = refund?.metadata?.order_number || piRow?.order_number
      if (piErr || !refundOrderNumber) {
        console.warn('[omise-webhook] refund.complete: payment_intent not found', { chargeId, error: piErr })
        return json({ received: true, note: 'payment_intent not found' }, 202)
      }

      const currentMetadata = piRow?.metadata ?? {}
      const refundIds = Array.isArray(currentMetadata.refund_ids) ? [...currentMetadata.refund_ids] : []
      if (!refundIds.includes(refund.id)) {
        refundIds.push(refund.id)
      }
      const refundedTotalMinor = Number(currentMetadata.refunded_total_minor || 0) + Number(refund.amount || 0)
      // Full vs partial: compare the running total against the CHARGED amount
      // stored on the intent row (authoritative), never the event's claim alone.
      const chargedMinor = Math.round(Number(piRow?.amount || 0) * 100)
      const isFullRefund = chargedMinor > 0 && refundedTotalMinor >= chargedMinor
      const nextPiStatus = isFullRefund ? 'refunded' : 'partially_refunded'
      const nextOrderPaymentStatus = isFullRefund ? 'refund' : 'partially_refunded'

      const nextMetadata = {
        ...currentMetadata,
        refund_ids: refundIds,
        refunded_total_minor: refundedTotalMinor,
        last_refund_at: new Date().toISOString(),
      }
      const { error: refundErr } = await admin
        .from('payment_intents')
        .update({
          metadata: nextMetadata,
          status: nextPiStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('payment_intent_id', chargeId)

      if (refundErr) {
        console.error('[omise-webhook] refund.complete DB update error:', refundErr)
        return json({ received: false, error: refundErr.message }, 500)
      }

      const { error: orderErr } = await admin
        .from('orders')
        .update({ payment_status: nextOrderPaymentStatus, updated_at: new Date().toISOString() })
        .eq('order_number', refundOrderNumber)

      if (orderErr) {
        console.error('[omise-webhook] refund.complete order update error:', orderErr)
        return json({ received: false, error: orderErr.message }, 500)
      }

      console.log('[omise-webhook] refund.complete synced:', { order_number: refundOrderNumber, refund_id: refund.id })
      return json({ received: true, result: 'refund_synced', order_number: refundOrderNumber, full_refund: isFullRefund })
    }

    default:
      // Unhandled events are acknowledged but do nothing (idempotent by design).
      return json({ received: true, unhandled: event.type }, 202)
  }
})


