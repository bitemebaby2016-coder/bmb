// ============================================
// Bite Me Baby — phone-auto-login: rate limiting (pure module)
// --------------------------------------------
// P0 interim hardening (SF-01) — ออกแบบให้:
//   * เป็น pure function ไม่พึ่ง Deno/edge runtime -> ทดสอบด้วย vitest ได้
//     (repo ทำแบบเดียวกับ locationPolicy.ts)
//   * ลดความเสี่ยง "รู้เบอร์ = เข้าบัญชีได้" แบบ brute force ได้ทันที
//     โดย **ไม่ต้องรอ OTP** และ **ไม่ทำให้ลูกค้าเดิม 33 รายใช้ไม่ได้**
//     (ค่า limit ตั้งให้เหลือทาง正常使用 มากกว่าพฤติกรรมจริงหลายเท่า)
//
// ข้อจำกัดที่ต้องรู้ (Owner ต้องเข้าใจ):
//   * เก็บในหน่วยความจำของ instance — reset เมื่อ cold start/redeploy
//     จึงเป็น **interim เท่านั้น** ไม่ใช่ permanent control
//   * ทางแก้ถาวรต้องใช้ OTP (ต้อง provision SMS_* secret ก่อน)
// ============================================

/** กฎ rate limit: กี่ครั้ง ต่อ ช่วงเวลา */
export interface RateLimitRule {
  limit: number
  windowMs: number
}

/**
 * ต่อ "เบอร์โทร 1 เบอร์" — 5 ครั้ง / 15 นาที
 * เหตุผล: ลูกค้าปกติพิมพ์เบอร์ตัวเองถูกตั้งแต่ครั้งแรก (1 ครั้ง)
 * การให้ 5 ครั้งเผื่อพิมพ์ผิด/เปลี่ยนใจ แต่ยังกัน brute force ได้มาก
 */
export const QUICK_LOGIN_PHONE_RULE: RateLimitRule = { limit: 5, windowMs: 15 * 60 * 1000 }

/**
 * ต่อ "IP" — 20 ครั้ง / 1 ชั่วโมง
 * เหตุผล: ต้องมากกว่ากฎเบอร์ เพราะผู้ใช้เครือข่ายมือถือไทยหลายคน
 * อยู่หลัง NAT/CGNAT ตัวเดียวกัน — ห้ามทำให้ลูกค้าจริงถูกบล็อก
 */
export const QUICK_LOGIN_IP_RULE: RateLimitRule = { limit: 20, windowMs: 60 * 60 * 1000 }

export const MAX_TRACKED_ENTRIES = 5000

/** คีย์สำหรับเบอร์โทร — ตัดเป็นตัวเลขล้วน 14 ตัวท้าย (ตรงกับ deterministic id ของ EF) */
export function normalizePhoneKey(raw: string): string {
  return String(raw ?? '').replace(/\D/g, '').slice(-14)
}

/** ดึง IP ของผู้เรียกจาก header ที่ Cloudflare/Proxy ใส่ให้ */
export function clientIpOf(headers: Headers): string {
  const xff = headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]
    if (first && first.trim()) return first.trim()
  }
  const cf = headers.get('cf-connecting-ip')
  if (cf && cf.trim()) return cf.trim()
  return 'unknown'
}

/** ตัดรายการที่เก่ากว่า window ออก ( sliding window ) */
export function pruneHits(hits: number[], now: number, windowMs: number): number[] {
  const cutoff = now - windowMs
  return hits.filter((t) => t > cutoff)
}

export interface RateLimitResult {
  limited: boolean
  remaining: number
  /** วินาทีที่ต้องรอจึงจะใช้ได้ใหม่ (0 ถ้าไม่ถูกบล็อก) */
  retryAfterSec: number
}

/** ตรวจว่า key นี้ถูกบล็อกอยู่หรือไม่ — ยังไม่บันทึกความพยายาม */
export function checkRateLimit(
  store: Map<string, number[]>,
  key: string,
  rule: RateLimitRule,
  now: number,
): RateLimitResult {
  const hits = pruneHits(store.get(key) ?? [], now, rule.windowMs)
  if (hits.length >= rule.limit) {
    const oldest = Math.min(...hits)
    const retryAfterMs = oldest + rule.windowMs - now
    return {
      limited: true,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    }
  }
  return { limited: false, remaining: rule.limit - hits.length, retryAfterSec: 0 }
}

/** บันทึกความพยายามครั้งนี้ (เรียกทุกครั้งที่ถึงขั้น auth ไม่ว่าจะสำเร็จหรือไม่) */
export function recordAttempt(
  store: Map<string, number[]>,
  key: string,
  rule: RateLimitRule,
  now: number,
): void {
  const hits = pruneHits(store.get(key) ?? [], now, rule.windowMs)
  hits.push(now)
  store.set(key, hits)
  sweep(store, now, rule.windowMs)
}

/** กันหน่วยความจำรั่ว — ลบ key ที่ไม่มี hit เหลือแล้ว และจำกัดจำนวน key รวม */
export function sweep(store: Map<string, number[]>, now: number, maxWindowMs: number): void {
  for (const [key, hits] of store) {
    if (pruneHits(hits, now, maxWindowMs).length === 0) store.delete(key)
  }
  if (store.size > MAX_TRACKED_ENTRIES) {
    // ตัด key ที่เก่าที่สุดออกก่อน — ยังดีกว่าปล่อยให้กินหน่วยความจำไม่จำกัด
    const entries = [...store.entries()].sort(
      (a, b) => Math.max(...a[1], 0) - Math.max(...b[1], 0),
    )
    for (let i = 0; i < store.size - MAX_TRACKED_ENTRIES && i < entries.length; i++) {
      store.delete(entries[i][0])
    }
  }
}
