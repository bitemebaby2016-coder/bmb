// ============================================
// Bite Me Baby — Social login (P3: Facebook)
// ============================================
// หน้าที่: เริ่ม OAuth กับ Facebook และแปล error ของ callback เป็นภาษาไทย
//
// ข้อจำกัดด้านความปลอดภัยที่ "ห้ามแก้ไข" (Owner OD — บัญชีต้องไม่ถูกย้าย/รวม):
//   * บัญชี phone-keyed ใช้ synthetic email `<phone>@phone.bmb.local`
//     → Facebook ไม่มีทางคืนอีเมลรูปนี้ **การยืนยันผ่าน Facebook จึงไม่มีทาง
//       เข้าถึงบัญชี Quick Login / Guest Checkout ได้เลย**
//   * ระบบ **ไม่รวมบัญชีอัตโนมัติ** ระหว่าง Facebook กับอีเมล/รหัสผ่านเดิม
//     ถ้าอีเมลจาก Facebook มีเจ้าของอยู่แล้ว → ให้เข้าสู่ระบบด้วยวิธีเดิมแทน
//   * นี่คือการยืนยันตัวตน "เท่านั้น" — ไม่เกี่ยวกับการชำระเงิน และ
//     ไม่ให้สิทธิ์สูงกว่าที่บัญชีนั้นมีอยู่แล้ว
// ============================================

import { supabase } from './supabase'

export type SocialProvider = 'facebook'

export interface SocialCallbackResult {
  ok: boolean
  /** รหัสข้อผิดพลาดจาก callback (ถ้ามี) — ใช้ผ่าน describeSocialError() */
  code?: string
}

/**
 * สร้าง redirectTo ที่ชี้กลับหน้า login พร้อมเก็บปลายทางเดิมไว้เป็น **query param**
 * (`/login?next=%2Fcheckout`) — เหตุผลที่ต้องเป็น query ไม่ใช่ hash:
 *   * Supabase implicit flow ทับค่าลง `#access_token=...` ทำให้ hash เดิมหาย
 *   * แต่ `?next=` อยู่คนละส่วนจึงรอดพ้น
 * กัน open-redirect โดยรับเฉพาะ path ที่ขึ้นต้นด้วย `/` และไม่ใช่ `//`
 */
export function socialRedirectTo(returnTo?: string): string {
  const safe = returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/'
  return `${window.location.origin}/login?next=${encodeURIComponent(safe)}`
}

/** อ่านปลายทางเดิมจาก `?next=` (คืน fallback ถ้าไม่ใช่ path ที่ปลอดภัย) */
export function readSocialNext(fallback = '/'): string {
  if (typeof window === 'undefined') return fallback
  try {
    const v = new URLSearchParams(window.location.search).get('next')
    if (!v) return fallback
    const decoded = decodeURIComponent(v)
    return decoded.startsWith('/') && !decoded.startsWith('//') ? decoded : fallback
  } catch {
    return fallback
  }
}

/**
 * เริ่ม Facebook Login — ย้ายหน้าทั้งหน้าไปที่ Supabase `/authorize`
 * (ไม่ใช่ popup: มือถือ/WebView บล็อก popup บ่อย และ flow นี้ผ่าน redirect จึงเชื่อถือได้)
 */
export async function signInWithFacebook(returnTo?: string): Promise<SocialCallbackResult> {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'facebook' as SocialProvider,
      options: {
        redirectTo: socialRedirectTo(returnTo),
        scopes: 'email,public_profile',
      },
    })
    if (error) return { ok: false, code: 'ERR_SOCIAL_START_FAILED' }
    return { ok: true }
  } catch {
    return { ok: false, code: 'ERR_NETWORK' }
  }
}

/**
 * อ่าน error จาก callback URL ได้ทั้งแบบ hash (`#error=...`) และ query (`?error=...`)
 * และ "ล้าง parameter เหล่านั้นออกจาก URL" กัน user กด refresh แล้วเจอ error ซ้ำ
 */
export function consumeSocialCallbackError(): string | undefined {
  if (typeof window === 'undefined') return undefined
  let code: string | undefined
  try {
    const search = new URLSearchParams(window.location.search)
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    code =
      search.get('error_code') || search.get('error') ||
      hash.get('error_code') || hash.get('error') ||
      undefined

    // ล้างเฉพาะพารามิเตอร์ error — เก็บ `?next=` ไว้ให้ login ต่อหลัง OAuth
    const keep = new URLSearchParams(search.toString())
    for (const k of ['error', 'error_code', 'error_description']) keep.delete(k)
    const qs = keep.toString()
    if (code) {
      window.history.replaceState({}, '', window.location.pathname + (qs ? '?' + qs : ''))
    }
  } catch {
    /* malformed URL — ปล่อยผ่าน */
  }
  return code
}

/** แปลรหัส OAuth error เป็นข้อความภาษาไทย (ไม่ leak raw code ให้ลูกค้า) */
export function describeSocialError(code?: string): string {
  switch (code) {
    case 'access_denied':
    case 'ERR_ACCESS_DENIED':
      return 'คุณยกเลิกการอนุญาต Facebook — ยังไม่ได้เข้าสู่ระบบ'
    case 'provider_email_needs_verification':
    case 'email_needs_verification':
      return 'Facebook ยังไม่ได้ยืนยันอีเมลนี้ — กรุณายืนยันอีเมลใน Facebook แล้วลองใหม่'
    case 'both_email_and_id_must_be_present':
      return 'บัญชี Facebook นี้ไม่ได้เปิดสิทธิ์อีเมล — โปรดใช้วิธีเข้าสู่ระบบอื่น'
    case 'user_already_exists':
    case 'USER_ALREADY_EXISTS':
      return 'อีเมลนี้มีบัญชีอยู่แล้ว — กรุณาเข้าสู่ระบบด้วยวิธีที่เคยสมัครไว้'
    case 'validation_failed':
      return 'Facebook ไม่ส่งข้อมูลที่จำเป็นกลับมา — กรุณาลองใหม่'
    case 'ERR_SOCIAL_START_FAILED':
      return 'เริ่มการเข้าสู่ระบบด้วย Facebook ไม่สำเร็จ — กรุณาลองใหม่อีกครั้ง'
    case 'ERR_NETWORK':
      return 'การเชื่อมต่อขัดข้อง — ตรวจสอบเน็ตเวิร์กแล้วลองใหม่'
    default:
      return 'เข้าสู่ระบบด้วย Facebook ไม่สำเร็จ — กรุณาลองใหม่ หรือใช้วิธีอื่นแทน'
  }
}
