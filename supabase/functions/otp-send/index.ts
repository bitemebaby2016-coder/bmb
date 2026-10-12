// ============================================
// Bite Me Baby — Edge Function: otp-send (P0 security remediation)
// --------------------------------------------
// ออก OTP เพื่อยืนยัน "การควบคุมเบอร์โทร" เท่านั้น (Owner §1.2)
//   * ห้ามใช้เป็นหลักฐานการชำระเงิน
//   * ห้ามใช้เพื่อเข้าบัญชีเดิมโดยอัตโนมัตินอกเหนือจาก flow ที่อนุมัติ
//
// ออกแบบความปลอดภัย:
//   * เก็บเฉพาะ hash+salt — ไม่มี plaintext เด็ดขาด
//   * rate limit ต่อเบอร์ + ต่อ IP (กัน SMS fraud และค่าใช้จ่ายบาน)
//   * อายุ 5 นาที · ทายผิดได้ไม่เกิน 5 ครั้งต่อ challenge
//   * verify_jwt = false (เรียกก่อน login) — จึงต้อง rate limit เองเข้ม
//   * ไม่เปิดเผยว่าเบอร์มีบัญชีหรือไม่ (ไม่ได้ตรวจบัญชีใน EF นี้เลย)
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (หรือ bmb_backend_production_*)
//      + ต้อง deploy `sms-send` ไว้แล้ว (EF นี้เรียก sms-send ด้วย service key)
// ============================================

import {
  OTP_TTL_MS,
  generateOtpCode,
  newOtpSalt,
  hashOtpCode,
  normalizeOtpPhone,
  maskOtpPhone,
  isOtpLimited,
  recordOtpHit,
  OTP_SEND_RULE,
  otpSmsMessage,
  type OtpPurpose,
} from '../_shared/otpPolicy.ts'

const VALID_PURPOSES: OtpPurpose[] = ['quick_login', 'guest_checkout']

// in-memory limiter (interim — reset ตอน cold start) รูปแบบเดียวกับ phone-auto-login
const sendStore = new Map<string, number[]>()

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json', ...extra },
  })
}

function clientIpOf(headers: Headers): string {
  const xff = headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]
    if (first && first.trim()) return first.trim()
  }
  const cf = headers.get('cf-connecting-ip')
  if (cf && cf.trim()) return cf.trim()
  return 'unknown'
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
  const purpose = String(body?.purpose ?? 'quick_login') as OtpPurpose

  if (phone.length < 9) return json({ error: 'ERR_INVALID_PHONE' }, 400)
  if (!VALID_PURPOSES.includes(purpose)) return json({ error: 'ERR_INVALID_PURPOSE' }, 400)
  if (!serviceKey) return json({ error: 'ERR_NOT_CONFIGURED' }, 503)

  // ---- rate limit: ต่อเบอร์ + ต่อ IP ----
  const nowMs = Date.now()
  const phoneKey = 'p:' + phone
  const ipKey = 'i:' + clientIpOf(req.headers)
  const byPhone = isOtpLimited(sendStore, phoneKey, OTP_SEND_RULE, nowMs)
  const byIp = isOtpLimited(sendStore, ipKey, { limit: OTP_SEND_RULE.limit * 4, windowMs: OTP_SEND_RULE.windowMs }, nowMs)
  if (byPhone.limited || byIp.limited) {
    const retryAfterSec = Math.max(byPhone.retryAfterSec, byIp.retryAfterSec)
    // ไม่บอกว่าเป็นเพราะเบอร์หรือ IP (กัน oracle)
    return json({ error: 'ERR_RATE_LIMITED', retry_after_sec: retryAfterSec }, 429, { 'Retry-After': String(retryAfterSec) })
  }
  recordOtpHit(sendStore, phoneKey, OTP_SEND_RULE, nowMs)
  recordOtpHit(sendStore, ipKey, { limit: OTP_SEND_RULE.limit * 4, windowMs: OTP_SEND_RULE.windowMs }, nowMs)

  // ---- สร้าง + hash รหัส ----
  const code = generateOtpCode()
  const salt = newOtpSalt()
  const codeHash = await hashOtpCode(code, salt)
  const expiresAt = new Date(nowMs + OTP_TTL_MS).toISOString()

  // ---- บันทึก challenge (service role — ตารางนี้ deny-all สำหรับ anon/auth) ----
  const ins = await fetch(`${supabaseUrl}/rest/v1/otp_challenges`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: 'Bearer ' + serviceKey,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      phone_digits: phone,
      purpose,
      code_hash: codeHash,
      code_salt: salt,
      expires_at: expiresAt,
    }),
  })
  if (!ins.ok) {
    const t = await ins.text().catch(() => '')
    // ตารางอาจยังไม่ถูกสร้าง (migration 122 ยังไม่ได้ apply) -> honest BLOCKED
    return json({ error: 'ERR_OTP_STORE_FAILED', detail: t.slice(0, 160) }, 503)
  }

  // ---- ส่ง SMS ผ่าน sms-send (reuse — ไม่ duplicate provider logic) ----
  const send = await fetch(`${supabaseUrl}/functions/v1/sms-send`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: 'Bearer ' + serviceKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ to: phone, message: otpSmsMessage(code) }),
  })
  const sendText = await send.text().catch(() => '')
  if (!send.ok) {
    // ไม่เปิดเผยรายละเอียด provider ให้ caller (กัน leak credential/config)
    console.error('[otp-send] sms-send failed', send.status, sendText.slice(0, 160))
    return json({ error: 'ERR_SMS_SEND_FAILED' }, 502)
  }

  return json({
    ok: true,
    masked_phone: maskOtpPhone(phone),
    expires_in_sec: Math.floor(OTP_TTL_MS / 1000),
    purpose,
    note: 'รหัส OTP ถูกส่งทาง SMS แล้ว — ห้ามส่งรหัสกลับมาใน response นี้',
  })
})
