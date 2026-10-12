// ============================================
// Bite Me Baby — Guest Checkout client (P2 / Owner OD-2 option A)
// --------------------------------------------
// ลูกค้าใหม่สั่งได้โดย "ไม่ต้องสมัครสมาชิกเต็มรูปแบบ"
// แยกจาก Quick Login โดยเจตตา — คนละ EF, คนละ purpose ของ OTP
//
// ขอบเขตที่ต้องไม่ลืม (Owner §1.2):
//   * OTP ยืนยัน "การควบคุมเบอร์" เท่านั้น — ไม่ใช่หลักฐานการชำระเงิน
//   * ฟังก์ชันนี้ "ไม่แตะ" business rules / RPC / Payment Authority
//     การสร้างออเดอร์ยังคงผ่าน `create_order_with_items` เดิมทุกประการ
// ============================================

import { supabase } from './supabase'

export const GUEST_OTP_TIMEOUT_MS = 30_000
export const GUEST_SESSION_TIMEOUT_MS = 45_000

export interface GuestOtpResult {
  ok: boolean
  error?: string
  maskedPhone?: string
  expiresInSec?: number
}

export interface GuestSessionResult {
  ok: boolean
  error?: string
  maskedPhone?: string
}

function unwrapError(error: unknown): string | undefined {
  const e = error as { message?: string } | null
  if (!e?.message) return undefined
  try {
    const body = JSON.parse(e.message) as { error?: string }
    return body?.error ?? e.message
  } catch {
    return e.message
  }
}

/** ขอยรหัส OTP สำหรับ guest checkout (purpose='guest_checkout' — แยกจาก quick_login) */
export async function sendGuestCheckoutOtp(phone: string): Promise<GuestOtpResult> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), GUEST_OTP_TIMEOUT_MS)
    const { data, error } = await supabase.functions.invoke('otp-send', {
      body: { phone, purpose: 'guest_checkout' },
      signal: ctrl.signal,
    })
    clearTimeout(timer)
    if (error) return { ok: false, error: unwrapError(error) ?? 'ERR_OTP_SEND' }
    if (data?.error) return { ok: false, error: data.error }
    return {
      ok: !!data?.ok,
      maskedPhone: data?.masked_phone,
      expiresInSec: data?.expires_in_sec,
      error: data?.ok ? undefined : (data?.error ?? 'ERR_OTP_SEND'),
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.name === 'AbortError' ? 'ERR_TIMEOUT' : 'ERR_NETWORK' }
  }
}

/**
 * ยืนยัน OTP แล้วขอ session สำหรับสั่งซื้อ
 * - ถ้า OTP ไม่ถูกต้อง/หมดอายุ/ถูกใช้แล้ว -> ไม่มี session และไม่มีออเดอร์ใด ๆ เกิดขึ้น
 * - session นี้ "ไม่" ให้สิทธิ์เข้าบัญชีอื่นนอกจากบัญชี phone-keyed ของเบอร์นี้
 */
export async function createGuestCheckoutSession(input: {
  phone: string
  otpCode: string
  name?: string
  addressDetail?: string
}): Promise<GuestSessionResult> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), GUEST_SESSION_TIMEOUT_MS)
    const { data, error } = await supabase.functions.invoke('guest-checkout-session', {
      body: {
        phone: input.phone,
        otp_code: input.otpCode,
        name: input.name ?? '',
        address_detail: input.addressDetail ?? '',
      },
      signal: ctrl.signal,
    })
    clearTimeout(timer)
    if (error) return { ok: false, error: unwrapError(error) ?? 'ERR_SESSION_MINT_FAILED' }
    if (data?.error) return { ok: false, error: data.error }

    // เซ็ต session ลง client เพื่อให้ `create_order_with_items` (authenticated) ใช้ได้ทันที
    if (data?.session?.access_token && data?.session?.refresh_token) {
      const { error: setErr } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      })
      if (setErr) return { ok: false, error: setErr.message || 'ERR_SESSION_MINT_FAILED' }
    }
    return { ok: !!data?.ok, maskedPhone: data?.masked_phone, error: data?.ok ? undefined : (data?.error ?? 'ERR_SESSION_MINT_FAILED') }
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.name === 'AbortError' ? 'ERR_TIMEOUT' : 'ERR_NETWORK' }
  }
}

/** ข้อความภาษาไทยครบทุก reason ที่ EF คืนได้ */
export function describeGuestOtpError(code?: string): string {
  switch (code) {
    case 'ERR_OTP_REQUIRED':
      return 'ยังไม่ได้กรอกรหัสยืนยัน — กรุณากรอกรหัส 6 หลักที่ได้รับทาง SMS'
    case 'ERR_OTP_INVALID':
      return 'รหัสยืนยันไม่ถูกต้อง — กรุณาตรวจสอบและกรอกใหม่อีกครั้ง'
    case 'ERR_OTP_EXPIRED':
      return 'รหัสยืนยันหมดอายุแล้ว — กรุณากดขอรหัสใหม่'
    case 'ERR_OTP_ALREADY_USED':
      return 'รหัสนี้ถูกใช้ไปแล้ว — กรุณากดขอรหัสใหม่'
    case 'ERR_OTP_TOO_MANY_TRIES':
      return 'กรอกรหัสผิดบ่อยเกินไป — กรุณารอสักครู่แล้วขอยรหัสใหม่'
    case 'ERR_OTP_NOT_FOUND':
      return 'ยังไม่ได้ขอยรหัสยืนยัน — กรุณากด "ส่งรหัสยืนยัน" ก่อน'
    case 'ERR_RATE_LIMITED':
      return 'พยายามมากเกินไป — กรุณารอสักครู่แล้วลองใหม่'
    case 'ERR_TIMEOUT':
      return 'ระบบช้าเกินไป — ตรวจสอบเน็ตเวิร์กแล้วลองใหม่อีกครั้ง'
    default:
      return 'ยืนยันตัวตนไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'
  }
}
