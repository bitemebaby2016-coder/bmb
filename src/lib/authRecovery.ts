// ============================================
// Bite Me Baby — Account recovery (P1 / SF-04, SF-05)
// --------------------------------------------
// หน้าที่:
//   1. sendPasswordReset(email) — ส่งลิงก์ตั้งรหัสผ่านใหม่ (Supabase Auth)
//   2. updatePassword(pw)        — ตั้งรหัสผ่านใหม่หลังผู้ใช้กดลิงก์จากอีเมล
//
// ข้อกำหนดที่ออกแบบไว้:
//   * กัน account enumeration — ถ้าอีเมลไม่มีในระบบ ต้องตอบ "สำเร็จ"
//     เหมือนกรณีปกติ ห้ามให้ผู้โจมตีแยกแยะได้ว่าอีเมลไหนมีบัญชี
//   * ห้ามรีเซ็ตรหัสผ่านให้ "บัญชีที่ยืนยันตัวตนแล้วเท่านั้น" —
//     จุดนี้เป็นหน้าที่ของ Supabase (ลิงก์มี token หมดอายุ)
//   * ห้ามใช้หน้านี้เพื่อยืนยันสิทธิ์เข้าบัญชีอื่น — updateUser
//     ทำงานกับ session ปัจจุบันของผู้ใช้เท่านั้น (ไม่รับ uid from client)
// ============================================

import { supabase } from './supabase'

/** ข้อความ error ของ Supabase ที่แปลว่า "อีเมลไม่มีในระบบ" — ห้ามส่งต่อให้ UI */
const ENUMERATION_PATTERNS = [
  /user not found/i,
  /not found/i,
  /no user found/i,
  /signups? not allowed/i,
]

/** รหัสผ่านใหม่ต้องไม่สั้นกว่านี้ (ตรงกับข้อกำหนดฝั่ง server ของ Supabase ที่ 6 ตัวขึ้นไป) */
export const MIN_PASSWORD_LENGTH = 8

export const PASSWORD_RESET_SENT = 'PASSWORD_RESET_SENT'

function isEnumerationMessage(raw: string): boolean {
  return ENUMERATION_PATTERNS.some((re) => re.test(raw))
}

/**
 * ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่อีเมลที่ให้มา
 * **ออกแบบกัน enumeration**: ผลลัพธ์จะเป็น ok:true เสมอ เว้นแต่
 * เกิดข้อผิดพลาดที่ "ไม่เกี่ยวกับตัวอีเมล" จริง ๆ (เช่น โครงข่าย/เซิร์ฟเวอร์)
 */
export async function sendPasswordReset(email: string): Promise<{ ok: boolean; error?: string }> {
  const trimmed = (email || '').trim().toLowerCase()
  if (!trimmed) return { ok: false, error: 'ERR_MISSING_EMAIL' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return { ok: false, error: 'ERR_INVALID_EMAIL' }

  const redirectTo =
    typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined

  const { error } = await supabase.auth.resetPasswordForEmail(trimmed, { redirectTo })
  if (!error) return { ok: true }

  // อีเมลไม่มีในระบบ -> แกล้งว่าสำเร็จ (กัน account enumeration)
  if (isEnumerationMessage(error.message || '')) return { ok: true }
  return { ok: false, error: error.message || 'ERR_RESET_FAILED' }
}

/**
 * ตั้งรหัสผ่านใหม่ให้ "ผู้ใช้ที่มี session อยู่ตอนนี้" เท่านั้น
 * (ผู้ใช้ต้องกดลิงก์จากอีเมลมาก่อน — Supabase สร้าง session ชั่วคราวให้)
 */
export async function updatePassword(password: string): Promise<{ ok: boolean; error?: string }> {
  if ((password || '').length < MIN_PASSWORD_LENGTH) return { ok: false, error: 'ERR_PASSWORD_TOO_SHORT' }
  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { ok: false, error: error.message || 'ERR_UPDATE_FAILED' }
  return { ok: true }
}

/** มี session ที่ใช้ตั้งรหัสผ่านใหม่ได้หรือยัง (หน้า /reset-password ใช้กันแสดงฟอร์มผิดจังหวะ) */
export async function canUpdatePassword(): Promise<boolean> {
  const { data } = await supabase.auth.getSession()
  return !!data.session
}
