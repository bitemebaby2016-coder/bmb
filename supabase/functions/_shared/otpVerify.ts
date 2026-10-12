// ============================================
// Bite Me Baby — OTP verification (shared, side-effecting helper)
// --------------------------------------------
// ใช้ร่วมกันได้ทั้ง `phone-auto-login` (P0) และ guest checkout (P2)
// คืนเหตุผลที่ชัดเจนเพื่อ map เป็นข้อความ UI ได้โดยไม่ต้องเดา
//
// สำคัญ: ฟังก์ชันนี้ "ไม่ออก session" และ "ไม่ให้สิทธิ์เข้าบัญชี"
//   มันยืนยันอย่างเดียวว่า "ผู้เรียกควบคุมเบอร์นี้จริง" —
//   การจะให้สิทธิ์อะไรเป็นเรื่องของ caller (Owner §1.2)
// ============================================

import {
  verifyOtpCode,
  isOtpExpired,
  isOtpLimited,
  recordOtpHit,
  maskOtpPhone,
  OTP_MAX_ATTEMPTS,
  OTP_VERIFY_RULE,
} from './otpPolicy.ts'

export type OtpVerifyReason =
  | 'OK'
  | 'ERR_OTP_NOT_FOUND'     // ไม่มี challenge ของเบอร์+purpose นี้
  | 'ERR_OTP_EXPIRED'       // หมดอายุ
  | 'ERR_OTP_ALREADY_USED'  // เคยใช้ไปแล้ว (replay)
  | 'ERR_OTP_TOO_MANY_TRIES'// ทายผิดเกินจำนวน
  | 'ERR_OTP_INVALID'       // รหัสไม่ถูกต้อง
  | 'ERR_RATE_LIMITED'      // ทายถี่เกินไปต่อเบอร์
  | 'ERR_STORE_FAILED'      // อ่าน/อัปเดตตารางไม่ได้

export interface OtpVerifyResult {
  ok: boolean
  reason: OtpVerifyReason
  retryAfterSec?: number
}

async function restJson(
  supabaseUrl: string,
  serviceKey: string,
  path: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const headers = new Headers(init.headers)
  headers.set('apikey', serviceKey)
  headers.set('Authorization', 'Bearer ' + serviceKey)
  headers.set('Content-Type', 'application/json')
  const res = await fetch(`${supabaseUrl}/rest/v1${path}`, { ...init, headers })
  let data: unknown = null
  try { data = await res.json() } catch { /* empty body */ }
  return { ok: res.ok, status: res.status, data }
}

/**
 * ตรวจสอบและ "บริโภค" OTP challenge หนึ่งครั้ง
 * - สำเร็จ -> ตั้ง consumed_at ทันที (กัน replay) และคืน ok
 * - ล้มเหลว -> เพิ่ม attempts (ยกเว้น expired/used ที่ไม่ต้องเพิ่ม)
 *
 * หมายเหตุ rate limit: caller ควรกันที่ชั้นก่อนด้วย (ip/phone) —
 * ตัวนี้เป็นตาข่ายชั้นที่สองที่ผูกกับ challenge โดยตรง
 */
export async function consumeOtpChallenge(input: {
  supabaseUrl: string
  serviceKey: string
  phone: string
  code: string
  purpose: string
  now?: number
  verifyStore?: Map<string, number[]>
}): Promise<OtpVerifyResult> {
  const { supabaseUrl, serviceKey, phone, code, purpose } = input
  const now = input.now ?? Date.now()
  const verifyStore = input.verifyStore

  // ตาข่ายชั้นที่ 1: จำกัดจำนวนทายต่อเบอร์
  if (verifyStore) {
    const lim = isOtpLimited(verifyStore, 'v:' + phone, OTP_VERIFY_RULE, now)
    if (lim.limited) return { ok: false, reason: 'ERR_RATE_LIMITED', retryAfterSec: lim.retryAfterSec }
    recordOtpHit(verifyStore, 'v:' + phone, OTP_VERIFY_RULE, now)
  }

  // ดึง challenge ล่าสุดที่ยังไม่ถูกใช้
  const latest = await restJson(
    supabaseUrl,
    serviceKey,
    `/otp_challenges?phone_digits=eq.${encodeURIComponent(phone)}` +
      `&purpose=eq.${encodeURIComponent(purpose)}` +
      `&consumed_at=is.null&order=created_at.desc&limit=1`,
  )
  if (!latest.ok) return { ok: false, reason: 'ERR_STORE_FAILED' }

  const rows = Array.isArray(latest.data) ? (latest.data as Record<string, unknown>[]) : []
  const row = rows[0]
  if (!row) return { ok: false, reason: 'ERR_OTP_NOT_FOUND' }

  const challengeId = String(row.id)

  if (isOtpExpired(String(row.expires_at), now)) {
    return { ok: false, reason: 'ERR_OTP_EXPIRED' }
  }
  if (Number(row.attempts ?? 0) >= OTP_MAX_ATTEMPTS) {
    return { ok: false, reason: 'ERR_OTP_TOO_MANY_TRIES' }
  }

  const matched = await verifyOtpCode(code, String(row.code_hash), String(row.code_salt))
  if (!matched) {
    // เพิ่มจำนวนทาย — ถึงเกณฑ์รอบถัดไปจะคืน ERR_OTP_TOO_MANY_TRIES
    await restJson(supabaseUrl, serviceKey, `/otp_challenges?id=eq.${encodeURIComponent(challengeId)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ attempts: Number(row.attempts ?? 0) + 1 }),
    })
    return { ok: false, reason: 'ERR_OTP_INVALID' }
  }

  // สำเร็จ -> บริโภคทันที (consumed_at) กัน replay
  const consume = await restJson(
    supabaseUrl,
    serviceKey,
    `/otp_challenges?id=eq.${encodeURIComponent(challengeId)}`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ consumed_at: new Date(now).toISOString() }),
    },
  )
  if (!consume.ok) {
    // อัปเดตไม่ได้ = ยังถือว่าไม่ยืนยัน (fail-closed) เพื่อกันใช้ซ้ำ
    console.error('[otpVerify] consume failed', consume.status, maskOtpPhone(phone))
    return { ok: false, reason: 'ERR_STORE_FAILED' }
  }

  return { ok: true, reason: 'OK' }
}
