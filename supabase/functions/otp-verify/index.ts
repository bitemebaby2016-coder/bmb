// ============================================
// Bite Me Baby — Edge Function: otp-verify (R130)
// --------------------------------------------
// ตรวจสอบ OTP challenge ที่ออกโดย `otp-send` (ทุก purpose ที่รองรับ)
//   * ใช้ร่วมกัน `consumeOtpChallenge` กับ phone-auto-login (ไม่ duplicate logic)
//   * ออก session ไม่ได้ — ยืนยันแค่ "การควบคุมเบอร์" เท่านั้น (Owner §1.2)
//   * ห้ามใช้เป็นหลักฐานการชำระเงิน
//
// Request: { phone, code, purpose }  (purpose: quick_login | guest_checkout | phone_login)
// Response: { ok: true } | { error: 'ERR_...' }
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (หรือ bmb_backend_production_*)
// verify_jwt = false (เรียกก่อน login) — rate limit ฝังที่ consumeOtpChallenge แล้ว
// ============================================

import { consumeOtpChallenge } from '../_shared/otpVerify.ts'
import { normalizeOtpPhone, type OtpPurpose } from '../_shared/otpPolicy.ts'

const VALID_PURPOSES: OtpPurpose[] = ['quick_login', 'guest_checkout', 'phone_login']

// in-memory limiter ชั้นที่สอง (ตาข่ายของ consumeOtpChallenge — กัน brute-force ต่อเบอร์)
const verifyStore = new Map<string, number[]>()

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

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() })
  if (req.method !== 'POST') return json({ error: 'ERR_METHOD_NOT_ALLOWED' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ('https://' + new URL(req.url).host)
  const serviceKey =
    Deno.env.get('bmb_backend_production_supabase_service_role_key') ||
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
    ''

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* body ว่าง */ }

  const phone = normalizeOtpPhone(String(body?.phone ?? ''))
  const code = String(body?.code ?? '').trim()
  const purpose = String(body?.purpose ?? '') as OtpPurpose

  if (phone.length < 9) return json({ error: 'ERR_INVALID_PHONE' }, 400)
  if (!VALID_PURPOSES.includes(purpose)) return json({ error: 'ERR_INVALID_PURPOSE' }, 400)
  if (!/^\d{6}$/.test(code)) return json({ error: 'ERR_INVALID_CODE' }, 400)
  if (!serviceKey) return json({ error: 'ERR_NOT_CONFIGURED' }, 503)

  const result = await consumeOtpChallenge({
    supabaseUrl,
    serviceKey,
    phone,
    code,
    purpose,
    verifyStore,
  })

  if (!result.ok) {
    const status = result.reason === 'ERR_RATE_LIMITED' ? 429 : 400
    return json({ ok: false, error: result.reason, retry_after_sec: result.retryAfterSec }, status)
  }
  return json({ ok: true, purpose })
})