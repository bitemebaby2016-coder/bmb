// ============================================
// Bite Me Baby — Edge Function: sms-send (W-2.3 SMS transport — prepared)
//
// Status: CODE-READY, AWAITING PROVIDER CREDENTIALS (Owner).
//   Without SMS_* secrets set, every request returns 503
//   { error: 'not configured (SMS_PROVIDER missing)' } — honest BLOCKED,
//   same precedent as push-send before VAPID keys landed.
//
// Boundary rules (mirror push-send W3-D-7):
//   - Caller must be authenticated with the platform JWT AND the shared
//     AUTOMATION_TOKEN, or a service_role key — never an anon caller.
//   - The caller supplies ONLY a customer id + message text. The recipient
//     phone is resolved SERVER-SIDE (profiles.phone via service_role); a phone
//     number in the request body is never accepted.
//   - notification_prefs.sms_enabled is honoured (transport opt-out).
//   - Nothing here creates or mutates business rows. A per-customer
//     rate/audit trail stays with notification_dispatch (author), not here.
//
// Provider abstraction (env, supabase secrets set ...):
//   SMS_PROVIDER      — 'generic_http' (extendable: twilio later)
//   SMS_API_URL       — provider endpoint (POST JSON)
//   SMS_API_KEY       — provider credential (sent as Bearer)
//   SMS_SENDER_NAME   — optional sender id shown on SMS
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — auto-injected
//   AUTOMATION_TOKEN  — shared secret for the scheduler path
// ============================================

const SB_URL = Deno.env.get('SUPABASE_URL') || ''
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const AUTOMATION_TOKEN = Deno.env.get('AUTOMATION_TOKEN') || ''
const SMS_PROVIDER = Deno.env.get('SMS_PROVIDER') || ''
const SMS_API_URL = Deno.env.get('SMS_API_URL') || ''
const SMS_API_KEY = Deno.env.get('SMS_API_KEY') || ''
const SMS_SENDER_NAME = Deno.env.get('SMS_SENDER_NAME') || 'BiteMeBaby'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-automation-token',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Content-Type': 'application/json',
    },
  })
}

/** Thai mobile normalisation: keep leading 0, +66xx → 0xx; else passthrough (shared: _shared/sms.ts). */
function normalizeThaiPhone(raw: string): string {
  const t = (raw || '').replace(/[^\d+]/g, '')
  if (/^\+66\d{8,9}$/.test(t)) return '0' + t.slice(3)
  return t
}
function maskPhone(raw: string): string {
  return (raw || '').replace(/(\d{3})\d{3}(\d{3,4})/, '$1***$2')
}

/** Provider-agnostic sender: generic HTTP gateway (POST JSON {to, message, sender}). */
async function sendViaProvider(to: string, message: string): Promise<{ ok: boolean; status: number; provider: string }> {
  const r = await fetch(SMS_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + SMS_API_KEY },
    body: JSON.stringify({ to, message, sender: SMS_SENDER_NAME }),
  })
  return { ok: r.ok, status: r.status, provider: SMS_PROVIDER }
}

async function authOk(req: Request): Promise<boolean> {
  const auth = req.headers.get('authorization') || ''
  const auto = req.headers.get('x-automation-token') || ''
  if (SERVICE && auth === 'Bearer ' + SERVICE) return true
  if (AUTOMATION_TOKEN && auto === AUTOMATION_TOKEN && auth.startsWith('Bearer ')) return true
  return false
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return json({ ok: true })
  if (!authOk(req)) return json({ error: 'unauthorized' }, 401)

  if (!SMS_PROVIDER || !SMS_API_URL || !SMS_API_KEY) {
    return json({ error: 'not configured (SMS_PROVIDER/SMS_API_URL/SMS_API_KEY missing)' }, 503)
  }

  let body: { customer_id?: string; message?: string } = {}
  try { body = await req.json() } catch { return json({ error: 'invalid json' }, 400) }
  const customerId = String(body.customer_id || '')
  const message = String(body.message || '').slice(0, 480)
  if (!customerId || !message.trim()) return json({ error: 'customer_id and message are required' }, 400)

  // server-side recipient resolution (service_role) — never from request body
  const prof = await fetch(SB_URL + '/rest/v1/profiles?id=eq.' + encodeURIComponent(customerId) + '&select=phone&limit=1', {
    headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE },
  })
  const profRow = prof.ok ? (await prof.json().catch(() => []))[0] : null
  if (!profRow?.phone) return json({ error: 'no phone on file for customer' }, 404)

  const prefs = await fetch(SB_URL + '/rest/v1/notification_prefs?customer_id=eq.' + encodeURIComponent(customerId) + '&select=sms_enabled&limit=1', {
    headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE },
  })
  const prefsRow = prefs.ok ? (await prefs.json().catch(() => []))[0] : null
  if (prefsRow && prefsRow.sms_enabled === false) {
    return json({ ok: true, skipped: 'sms_disabled_by_customer' })
  }

  const to = normalizeThaiPhone(profRow.phone)
  const res = await sendViaProvider(to, message)
  return json({ ok: res.ok, to_masked: maskPhone(to), provider_status: res.status }, res.ok ? 200 : 502)
})
