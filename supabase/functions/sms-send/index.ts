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
// Provider abstraction (supabase secrets):
//   SMS_PROVIDER      — 'thsms_org' (ปัจจุบัน, api.thsms.org/v1) | 'thsms' (legacy thsms.com)
//   SMS_API_URL       — endpoint POST JSON (thsms_org: https://api.thsms.org/v1/sms/send)
//   SMS_API_KEY       — credential (thsms_org: header 'X-API-Key'; thsms.com: 'Authorization: Bearer')
//   SMS_SENDER_NAME   — sender id ที่ลงทะเบียน (thsms_org body field: sender_name)
//   SMS_MESSAGE_TYPE  — thsms_org เท่านั้น: 'standard' = 1 เครดิต · 'express' = 2 · 'superfast' = 3 (default 'standard')
//   thsms_org body: { sender_name, recipient, message, message_type }   (docs api.thsms.org/v1)
//   thsms.com body: { msisdn: ['08...'], message, sender }              (legacy)
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — auto-injected
//   AUTOMATION_TOKEN  — shared secret for the scheduler path
//   (ย้าย thsms.com → thsms.org 2026-10-07: คีย์เดิมเป็นคนละบัญชี → 404 'User Not Found')
// ============================================
import { normalizeThaiPhone, maskPhone } from '../_shared/sms.ts'

const SB_URL = Deno.env.get('SUPABASE_URL') || ''
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const AUTOMATION_TOKEN = Deno.env.get('AUTOMATION_TOKEN') || ''
const SMS_PROVIDER = Deno.env.get('SMS_PROVIDER') || ''
const SMS_API_URL = Deno.env.get('SMS_API_URL') || ''
const SMS_API_KEY = Deno.env.get('SMS_API_KEY') || ''
const SMS_SENDER_NAME = Deno.env.get('SMS_SENDER_NAME') || 'BiteMeBaby'
const SMS_MESSAGE_TYPE = Deno.env.get('SMS_MESSAGE_TYPE') || 'standard'

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

/**
 * Provider send.
 *  - thsms_org (api.thsms.org/v1): header 'X-API-Key' + body { sender_name, recipient, message, message_type }
 *  - thsms (legacy thsms.com):     header 'Authorization: Bearer' + body { msisdn: [to], message, sender }
 * Success = HTTP ok && (JSON.success !== false). คืน snippet ของ provider body เพื่อวินิจฉัย (≤160 ตัวอักษร)
 */
async function sendViaProvider(to: string, message: string): Promise<{ ok: boolean; status: number; provider: string; body: string }> {
  const isOrg = SMS_PROVIDER === 'thsms_org'
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const payload = isOrg
    ? { sender_name: SMS_SENDER_NAME, recipient: to, message, message_type: SMS_MESSAGE_TYPE }
    : { msisdn: [to], message, sender: SMS_SENDER_NAME }
  if (isOrg) headers['X-API-Key'] = SMS_API_KEY
  else headers['Authorization'] = 'Bearer ' + SMS_API_KEY
  const r = await fetch(SMS_API_URL, { method: 'POST', headers, body: JSON.stringify(payload) })
  const text = await r.text().catch(() => '')
  let ok = r.ok
  if (ok) { try { const j = JSON.parse(text); if (j && j.success === false) ok = false } catch { /* non-JSON = ok */ } }
  return { ok, status: r.status, provider: SMS_PROVIDER, body: text.slice(0, 160) }
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
  return json(
    { ok: res.ok, to_masked: maskPhone(to), provider: res.provider, provider_status: res.status, provider_body: res.body },
    res.ok ? 200 : 502,
  )
})
