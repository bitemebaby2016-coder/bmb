// ============================================
// Bite Me Baby — Passkeys / WebAuthn (P4)
// ============================================
// ใช้ SDK ที่ติดตั้งอยู่แล้ว: @supabase/supabase-js 2.116.0
//   supabase.auth.signInWithPasskey()  /  supabase.auth.registerPasskey()
//   supabase.auth.mfa.passkey.{list,delete}
//
// ขอบเขต (Owner): นี่คือ "วิธีเข้าสู่ระบบ" วิธีที่ 3 — ไม่แตะ
// business rules / RPC / Payment Authority / Order State Machine
// และไม่ให้สิทธิ์สูงกว่าที่บัญชีเดิมมีอยู่แล้ว
// ============================================

import { supabase } from './supabase'

export interface PasskeyResult {
  ok: boolean
  code?: string
  /** เฉพาะตอนสมัคร — คืนรายการที่เพิ่งสร้าง */
  label?: string
}

export interface PasskeyInfo {
  id: string
  label: string
  createdAt: string
}

/** ตรวจว่าเบราว์เซอร์รองรับ WebAuthn จริงหรือไม่ (ก่อนแสดงปุ่ม) */
export function isPasskeySupported(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return (
      typeof window.PublicKeyCredential !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      'credentials' in navigator
    )
  } catch {
    return false
  }
}

function codeOf(error: unknown): string {
  const e = error as { message?: string; code?: string; error_code?: string } | null
  if (!e) return 'ERR_PASSKEY_FAILED'
  return e.error_code || e.code || e.message || 'ERR_PASSKEY_FAILED'
}

/** เข้าสู่ระบบด้วย Passkey — เรียก WebAuthn ceremony แล้วเซ็ต session ให้เอง */
export async function signInWithPasskey(): Promise<PasskeyResult> {
  if (!isPasskeySupported()) return { ok: false, code: 'ERR_PASSKEY_UNSUPPORTED' }
  try {
    const { error } = await supabase.auth.signInWithPasskey()
    if (error) return { ok: false, code: codeOf(error) }
    return { ok: true }
  } catch (e) {
    return { ok: false, code: codeOf(e) }
  }
}

// สมัคร Passkey ใหม่ (ต้องมี session อยู่แล้ว — เรียกจากหน้าโปรไฟล์)
// NOTE: `registerPasskey()` ใน SDK 2.116.0 "ไม่รับ label" — คืนชื่อที่เซิร์ฟเวอร์ตั้งให้
export async function registerPasskey(): Promise<PasskeyResult> {
  if (!isPasskeySupported()) return { ok: false, code: 'ERR_PASSKEY_UNSUPPORTED' }
  try {
    const { data, error } = await supabase.auth.registerPasskey()
    if (error) return { ok: false, code: codeOf(error) }
    const meta = data as { friendly_name?: string } | undefined
    return { ok: true, label: meta?.friendly_name || 'Passkey ของฉัน' }
  } catch (e) {
    return { ok: false, code: codeOf(e) }
  }
}

/** รายชื่อ passkey ที่ผูกกับบัญชี (อ่านอย่างเดียว) — AuthPasskeyApi.list() */
export async function listPasskeys(): Promise<{ ok: boolean; items: PasskeyInfo[]; code?: string }> {
  try {
    const { data, error } = await supabase.auth.passkey.list()
    if (error) return { ok: false, items: [], code: codeOf(error) }
    const items = (Array.isArray(data) ? data : []).map((r: { id?: string; friendly_name?: string; created_at?: string }) => ({
      id: String(r.id ?? ''),
      label: r.friendly_name || 'Passkey',
      createdAt: String(r.created_at ?? ''),
    }))
    return { ok: true, items }
  } catch (e) {
    return { ok: false, items: [], code: codeOf(e) }
  }
}

/** ลบ passkey — ถ้าเหลือวิธีเข้าสู่ระบบอื่นอยู่ก็ไม่ทำให้ถูกล็อกออกจากบัญชี */
export async function removePasskey(id: string): Promise<PasskeyResult> {
  try {
    const { error } = await supabase.auth.passkey.delete({ passkeyId: id })
    if (error) return { ok: false, code: codeOf(error) }
    return { ok: true }
  } catch (e) {
    return { ok: false, code: codeOf(e) }
  }
}

/** แปลรหัส error ของ WebAuthn/Passkey เป็นภาษาไทย (ไม่ leak raw code ให้ลูกค้า) */
export function describePasskeyError(code?: string): string {
  const c = code || ''
  if (c.includes('aborted') || c.includes('ABORTED') || c.includes('NotAllowedError')) {
    return 'คุณยกเลิกการยืนยันตัวตน — ยังไม่ได้เข้าสู่ระบบ'
  }
  if (c.includes('challenge_expired')) {
    return 'รหัสท้าทายหมดอายุ (5 นาที) — กดเข้าสู่ระบบใหม่อีกครั้ง'
  }
  if (c.includes('not_registered') || c.includes('NO_PASSKEY')) {
    return 'ยังไม่มี Passkey ผูกกับบัญชีนี้ — ใช้วิธีเข้าสู่ระบบอื่นก่อน แล้วสร้าง Passkey ในหน้าโปรไฟล์'
  }
  if (c.includes('duplicate') || c.includes('already_registered')) {
    return 'บัญชีนี้มี Passkey ชื่อนี้อยู่แล้ว'
  }
  if (c.includes('unsupported') || c.includes('ERR_PASSKEY_UNSUPPORTED')) {
    return 'เบราว์เซอร์นี้ไม่รองรับ Passkey — ลองใช้ Chrome/Safari รุ่นใหม่ หรือใช้วิธีอื่น'
  }
  if (c.includes('invalid_response') || c.includes('InvalidResponse')) {
    return 'ข้อมูลจากอุปกรณ์ไม่ถูกต้อง — ลองใหม่ หรือใช้วิธีเข้าสู่ระบบอื่น'
  }
  if (c.includes('timeout') || c.includes('TimeoutError')) {
    return 'หมดเวลาการยืนยันตัวตน — กดเข้าสู่ระบบใหม่'
  }
  if (c.includes('network') || c.includes('ERR_NETWORK')) {
    return 'การเชื่อมต่อขัดข้อง — ตรวจสอบเน็ตเวิร์กแล้วลองใหม่'
  }
  return 'เข้าสู่ระบบด้วย Passkey ไม่สำเร็จ — กรุณาลองใหม่ หรือใช้วิธีอื่นแทน'
}
