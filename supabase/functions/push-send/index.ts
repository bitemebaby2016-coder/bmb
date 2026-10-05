// ============================================
// Bite Me Baby — Edge Function: push-send (W3-D-7 Web Push transport)
//
// Sends ONE web-push payload to ONE canonical customer id. It is intentionally
// NOT a second notification authority: the durable in-app notification is
// already written by automation-worker/notification_dispatch (migration 021 +
// the audit-backed create_notification RPC). This function only TRANSPORTS an
// already-authorised notification to the customer's devices.
//
// Boundary rules (W3-D / G6-G7 precedent):
//   - Caller must be authenticated with the platform JWT AND the shared
//     automation token, or a service_role key — never an anon caller.
//   - The caller supplies ONLY a customer id + title/body/tag/url. The recipient
//     is resolved server-side via claim_push_targets (service_role-only RPC);
//     no endpoint token is ever accepted from the request body.
//   - push_enabled (transport opt-out) is honoured here, so a customer who
//     turned push off is never sent to.
//   - Terminal push-service statuses (404/410) prune the endpoint through
//     mark_push_result so dead endpoints cannot accumulate.
//
// Env (supabase secrets set ...):
//   VAPID_PUBLIC_KEY   — public key, ALSO stored in business_settings.push_config
//                        (that copy is what the browser reads; they must match)
//   VAPID_PRIVATE_KEY  — SECRET. Never in the database, never in the bundle.
//   VAPID_SUBJECT      — admin-configurable contact for the push service
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — auto-injected by the platform
//   AUTOMATION_TOKEN   — shared secret for the scheduler path
//
// Nothing here creates or mutates business rows.
// ============================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
// web-push is CommonJS; esm.sh wraps it as a default export object. Import the
// namespace AND keep the default so either interop shape resolves — a bare
// default import alone yields an object whose methods are not callable.
import * as webpushNs from 'https://esm.sh/web-push@3.6.7'
import webpushDefault from 'https://esm.sh/web-push@3.6.7'

const webpush: any =
  (webpushNs as any)?.setVapidDetails
    ? webpushNs
    : (webpushDefault as any)?.default?.setVapidDetails
      ? (webpushDefault as any).default
      : webpushDefault

const SB_URL = Deno.env.get('SUPABASE_URL') || ''
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const AUTOMATION_TOKEN = Deno.env.get('AUTOMATION_TOKEN') || ''
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') || ''
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || ''
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@biteme-baby.com'

const MAX_TARGETS_PER_CUSTOMER = 10

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-automation-token',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Content-Type': 'application/json',
    },
  })
}

/** Terminal push-service statuses mean the endpoint is gone forever. */
function isTerminalStatus(status: number): boolean {
  return status === 404 || status === 410 || status === 401 || status === 403
}

async function rpc(fn: string, args: Record<string, unknown>): Promise<any> {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  })
  const text = await r.text()
  let j: any = null
  try { j = JSON.parse(text) } catch { /* non-JSON error body */ }
  if (r.status >= 400) throw new Error(`${fn} failed: ${r.status} ${text.slice(0, 200)}`)
  return j
}

/** Constant-time compare for the automation token (avoids timing side channels). */
function tokenMatches(provided: string): boolean {
  if (!AUTOMATION_TOKEN) return false
  if (provided.length !== AUTOMATION_TOKEN.length) return false
  let diff = 0
  for (let i = 0; i < AUTOMATION_TOKEN.length; i++) diff |= provided.charCodeAt(i) ^ AUTOMATION_TOKEN.charCodeAt(i)
  return diff === 0
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200 })

  // Diagnostics: reports which dependency/config piece is missing without ever
  // echoing a secret value. Required to distinguish "bad import" from
  // "missing env" from "auth rejected" — a bare 500 tells us nothing.
  if (req.method === 'GET' && new URL(req.url).searchParams.get('diag') === '1') {
    return json({
      ok: true,
      module: {
        webpushResolved: !!webpush,
        hasSetVapidDetails: typeof webpush?.setVapidDetails === 'function',
        hasSendNotification: typeof webpush?.sendNotification === 'function',
      },
      env: {
        SUPABASE_URL: SB_URL !== '',
        SERVICE_ROLE: SERVICE !== '',
        AUTOMATION_TOKEN: AUTOMATION_TOKEN !== '',
        VAPID_PUBLIC_KEY: VAPID_PUBLIC_KEY !== '',
        VAPID_PRIVATE_KEY: VAPID_PRIVATE_KEY !== '',
        VAPID_SUBJECT: VAPID_SUBJECT !== '',
      },
    })
  }

  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  // --- auth: platform JWT + shared automation token (mirrors automation-worker) ---
  const authHeader = req.headers.get('authorization') || ''
  const automationToken = req.headers.get('x-automation-token') || ''
  const hasServiceKey = SERVICE !== '' && authHeader === `Bearer ${SERVICE}`
  const hasAutomationToken = tokenMatches(automationToken)
  if (!hasServiceKey && !hasAutomationToken) return json({ error: 'unauthorized' }, 401)

  if (!VAPID_PRIVATE_KEY) {
    // Honest failure: the transport is not configured yet (Owner sets the secret).
    return json({ error: 'ERR_PUSH_NOT_CONFIGURED', hint: 'set VAPID_PRIVATE_KEY secret' }, 503)
  }
  try {
    // web-push validates the keypair eagerly and THROWS on a malformed key.
    // That must surface as a typed 503, never as an opaque 500.
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
  } catch (e) {
    return json({ error: 'ERR_VAPID_REJECTED', detail: (e as Error)?.message ?? 'setVapidDetails failed' }, 503)
  }

  let body: { customerId?: string; title?: string; body?: string; url?: string; tag?: string; notificationId?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid json' }, 400)
  }

  const customerId = (body.customerId || '').trim()
  const title = (body.title || '').trim()
  if (!customerId) return json({ error: 'ERR_INVALID_CUSTOMER' }, 400)
  if (!title) return json({ error: 'ERR_INVALID_TITLE' }, 400)

  const supabase = createClient(SB_URL, SERVICE, { auth: { persistSession: false } })

  // 1) transport opt-out (push_enabled) — a prefs read failure is NOT silent success
  const { data: prefs, error: prefErr } = await supabase
    .from('notification_prefs')
    .select('push_enabled')
    .eq('customer_id', customerId)
    .maybeSingle()
  if (prefErr) return json({ error: 'prefs read failed', status: prefErr.message }, 502)
  if (prefs && prefs.push_enabled === false) {
    return json({ ok: true, sent: 0, skipped: 'push_disabled' })
  }

  // 2) resolve the device endpoints server-side (never from the request body)
  const claimed = await rpc('claim_push_targets', {
    p_customer_id: customerId,
    p_limit: MAX_TARGETS_PER_CUSTOMER,
  })
  const targets: Array<{ id: string; endpoint: string; p256dh: string; auth_secret: string }> =
    claimed?.targets ?? []

  if (targets.length === 0) return json({ ok: true, sent: 0, skipped: 'no_subscriptions' })

  // 3) send to each device; a dead endpoint is pruned, a transient one is counted
  const payload = JSON.stringify({
    title,
    body: body.body || '',
    url: body.url || '/notifications',
    tag: body.tag || 'bmb-notification',
    notificationId: body.notificationId || null,
  })

  let sent = 0
  let failed = 0
  let pruned = 0
  const errors: string[] = []

  for (const t of targets) {
    try {
      await webpush.sendNotification(
        { endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth_secret } },
        payload,
        { TTL: 60 * 60, urgency: 'high' },
      )
      await rpc('mark_push_result', { p_subscription_id: t.id, p_success: true })
      sent++
    } catch (e: any) {
      const status = Number(e?.statusCode ?? 0)
      const terminal = isTerminalStatus(status)
      try {
        const res = await rpc('mark_push_result', { p_subscription_id: t.id, p_success: !terminal })
        if (res?.pruned) pruned++
      } catch (markErr: any) {
        errors.push(`mark_push_result ${t.id}: ${markErr?.message ?? 'failed'}`)
      }
      if (terminal) pruned++
      else {
        failed++
        errors.push(`send ${t.id}: status=${status || 'unknown'}`)
      }
    }
  }

  return json({ ok: true, sent, failed, pruned, targets: targets.length, errors })
})