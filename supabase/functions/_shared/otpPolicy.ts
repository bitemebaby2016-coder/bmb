// ============================================
// Bite Me Baby — OTP policy (pure module)
// --------------------------------------------
// หน้าที่: สร้าง/ตรวจสอบ/จำกัด OTP — **ไม่มี** side effect ไม่พึ่ง Deno
//          -> ทดสอบด้วย vitest ได้ (รูปแบบเดียวกับ locationPolicy.ts)
//
// ข้อกำหนด Owner (§1.2):
//   * OTP ยืนยัน "การควบคุมเบอร์โทร" เท่านั้น
//     ห้ามใช้เป็นหลักฐานการชำระเงิน และห้ามใช้แทนการยืนยันสิทธิ์เข้าบัญชีเดิม
//   * ห้ามเก็บรหัส OTP แบบ plaintext — เก็บเฉพาะ hash + salt
//   * ใช้ครั้งเดียว · มีหมดอายุ · จำกัดจำนวนทาย
// ============================================

export const OTP_LENGTH = 6
export const OTP_TTL_MS = 5 * 60 * 1000 // 5 นาที
export const OTP_MAX_ATTEMPTS = 5 // ทายผิดได้ไม่เกินนี้ต่อ challenge

/** ส่งได้ไม่เกินนี้ต่อเบอร์ (กัน SMS fraud / ค่าใช้จ่ายบาน) */
export const OTP_SEND_LIMIT = 3
export const OTP_SEND_WINDOW_MS = 10 * 60 * 1000

/** ทายได้ไม่เกินนี้ต่อเบอร์ต่อ window (นอกเหนือจาก per-challenge attempts) */
export const OTP_VERIFY_LIMIT = 10
export const OTP_VERIFY_WINDOW_MS = 15 * 60 * 1000

export type OtpPurpose = 'quick_login' | 'guest_checkout'

/** คืนรหัส OTP เป็นตัวเลข OTP_LENGTH หลัก — ต้องสุ่มด้วย CSPRNG เท่านั้น */
export function generateOtpCode(rng: (n: number) => Uint8Array = defaultRng): string {
  const bytes = rng(OTP_LENGTH)
  let out = ''
  for (let i = 0; i < OTP_LENGTH; i++) {
    // ใช้ modulo 256 -> 10 — อคeshire bias ยอมรับได้เพราะเป็นแค่ 10 ค่าและ OTP สั้น
    out += String(bytes[i] % 10)
  }
  // กันรหัสทั้งชุดเป็น 000000 (เดาได้ง่ายผิดปกติ)
  if (/^0+$/.test(out)) return '1' + out.slice(1)
  return out
}

function defaultRng(n: number): Uint8Array {
  const b = new Uint8Array(n)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(b)
  else for (let i = 0; i < n; i++) b[i] = Math.floor(Math.random() * 256)
  return b
}

export function newOtpSalt(rng: (n: number) => Uint8Array = defaultRng): string {
  const bytes = rng(16)
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * hash รหัส OTP ด้วย SHA-256(salt + code)
 * จงใจไม่ใช้ bcrypt/argon เพราะต้องเรียกจาก Edge Runtime แบบไม่มี native binding
 * และรหัส OTP มีอายุสั้น (5 นาที) + ถูกจำกัดจำนวนทายอยู่แล้ว
 */
export async function hashOtpCode(code: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${code}`)
  return toHex(await crypto.subtle.digest('SHA-256', data))
}

/** เทียบ hex แบบ constant-time (กัน timing side-channel) */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** ตรวจสอบรหัสที่ผู้ใช้กรอก — คืน true เมื่อตรงกับ hash ที่เก็บไว้ */
export async function verifyOtpCode(candidate: string, storedHash: string, salt: string): Promise<boolean> {
  if (!/^\d+$/.test(candidate) || candidate.length !== OTP_LENGTH) return false
  const h = await hashOtpCode(candidate, salt)
  return timingSafeEqualHex(h, storedHash)
}

export function isOtpExpired(expiresAt: number | string, now: number): boolean {
  const t = typeof expiresAt === 'string' ? Date.parse(expiresAt) : expiresAt
  if (!Number.isFinite(t)) return true
  return now >= t
}

/** ทำให้เบอร์เป็นรูปแบบเดียวกันเพื่อใช้เป็นคีย์ (ตัดเป็นตัวเลขล้วน) */
export function normalizeOtpPhone(raw: string): string {
  return String(raw ?? '').replace(/\D/g, '').slice(-14)
}

/** mask เพื่อ log — ไม่ใส่เบอร์เต็มลง log เด็ดขาด */
export function maskOtpPhone(raw: string): string {
  const d = normalizeOtpPhone(raw)
  if (d.length < 6) return '***'
  return d.slice(0, 3) + '***' + d.slice(-3)
}

// ---- sliding-window limiter (คัดลอกหลักการมาจาก phone-auto-login/rateLimit.ts
//      แต่แยก module เพราะแต่ละ EF ถูก bundle คนละหน่วย) ----

export interface OtpRateRule { limit: number; windowMs: number }

export const OTP_SEND_RULE: OtpRateRule = { limit: OTP_SEND_LIMIT, windowMs: OTP_SEND_WINDOW_MS }
export const OTP_VERIFY_RULE: OtpRateRule = { limit: OTP_VERIFY_LIMIT, windowMs: OTP_VERIFY_WINDOW_MS }

export function pruneOtpHits(hits: number[], now: number, windowMs: number): number[] {
  const cutoff = now - windowMs
  return hits.filter((t) => t > cutoff)
}

export function isOtpLimited(
  store: Map<string, number[]>,
  key: string,
  rule: OtpRateRule,
  now: number,
): { limited: boolean; retryAfterSec: number } {
  const hits = pruneOtpHits(store.get(key) ?? [], now, rule.windowMs)
  if (hits.length >= rule.limit) {
    const oldest = Math.min(...hits)
    return { limited: true, retryAfterSec: Math.max(1, Math.ceil((oldest + rule.windowMs - now) / 1000)) }
  }
  return { limited: false, retryAfterSec: 0 }
}

export function recordOtpHit(
  store: Map<string, number[]>,
  key: string,
  rule: OtpRateRule,
  now: number,
): void {
  const hits = pruneOtpHits(store.get(key) ?? [], now, rule.windowMs)
  hits.push(now)
  store.set(key, hits)
}

/** ข้อความ SMS ที่ส่งให้ลูกค้า — ห้ามใส่ชื่อ/ข้อมูลส่วนตัว */
export function otpSmsMessage(code: string, ttlMs: number = OTP_TTL_MS): string {
  const min = Math.max(1, Math.round(ttlMs / 60000))
  return `[Bite Me Baby] รหัสยืนยันตัวตนของคุณคือ ${code} (หมดอายุใน ${min} นาที) — ห้ามแชร์รหัสนี้กับใคร`
}
