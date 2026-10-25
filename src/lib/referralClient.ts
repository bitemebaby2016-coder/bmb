// ============================================
// Bite Me Baby — Referral client (G&R STAGE 2 · mirror ของ migration 154)
// --------------------------------------------
// Client-side MIRROR ของ server-authoritative `referral_claim` (154):
//   • รูปแบบโค้ด:      BMB- + [A-Z0-9]{6,16} (mirror `referral_preview` regex)
//   • normalize code:  trim whitespace ทั้งหมด + upper (mirror referral_normalize_code)
//   • normalize phone: ตัวเลขล้วน 14 หลักท้าย · 66xxx → 0xxx
//                       (mirror referral_normalize_phone = otpPolicy + 66 mapping)
//   • กัน self:        โค้ดตัวเอง = ห้ามใช้ (mirror hard block 'self_referral')
//
// โมดูลนี้ = "PREVIEW/กันกดล่วงหน้า" เท่านั้น — ทุกกติกาถูก validate ซ้ำฝั่งเซิร์ฟเวอร์
// ใน RPC `referral_claim` (เรียกทันทีหลังสร้างออเดอร์สำเร็จจาก CheckoutPage)
// รูปแบบเดียวกับ promotionClient + coupon gate: client ต้อง "ปฏิเสธก่อนสั่ง"
// มากกว่าปล่อยให้ระบบเมินเงียบ (ลูกค้าต้องไม่ถูกบอกว่าได้รางวัลทั้งที่ไม่ได้)
// ============================================

import { supabase } from './supabase'

export const REFERRAL_CODE_RE = /^BMB-[A-Z0-9]{6,16}$/

/** Normalized referral code: ตัด whitespace ทั้งหมด + uppercase (server เทียบ upper(code)). */
export function normalizeReferralCode(code: string | null | undefined): string {
  return (code ?? '').replace(/\s+/g, '').toUpperCase()
}

/** Mirror ของ SQL `referral_normalize_phone` (อ้างอิง _shared/otpPolicy.normalizeOtpPhone). */
export function normalizeReferralPhone(raw: string | null | undefined): string {
  const digits = String(raw ?? '').replace(/\D/g, '').slice(-14)
  if (/^66[0-9]{9}$/.test(digits)) return '0' + digits.slice(2)
  if (/^0066[0-9]{9}$/.test(digits)) return '0' + digits.slice(4)
  return digits
}

// ---------- types ----------

export type ReferralCodeIssue = 'empty_code' | 'bad_format' | 'own_code' | 'load_failed'

export type ReferralPreviewResult =
  | { ok: true }
  | { ok: false; reason: 'bad_format' | 'unknown_code' | 'disabled' | 'load_failed' }

export interface ReferralReward {
  coupon_code: string
  amount: number
  state: 'issued' | 'reversed'
  role: 'referrer' | 'friend'
  reversal_reason?: string | null
  created_at: string
}

export interface MyReferralStatus {
  code: string
  enabled: boolean
  share_base_url: string
  referrer_reward_baht: number
  friend_reward_baht: number
  rewards: ReferralReward[]
  stats: { attributed_orders: number; qualified: number; held: number }
}

export interface ReferralClaimResult {
  status: 'held' | 'qualified' | 'blocked' | 'reversed' | 'void'
       | 'invalid' | 'disabled' | 'ineligible'
  reason?: string | null
  risk?: 'none' | 'review'
  already_claimed?: boolean
  order_number?: string
}

// ---------- validation (client precheck) ----------

/**
 * Format + self-check ก่อนส่ง (server ตรวจซ้ำทุกข้อใน referral_claim):
 * - ownCode = โค้ดของตัวเอง (ดึงจาก referral_my_status) — ตรงกัน = hard block 'self_referral'
 */
export function validateReferralCode(
  raw: string,
  ownCode?: string | null,
): { ok: true; code: string } | { ok: false; issue: ReferralCodeIssue } {
  const code = normalizeReferralCode(raw)
  if (!code) return { ok: false, issue: 'empty_code' }
  if (!REFERRAL_CODE_RE.test(code)) return { ok: false, issue: 'bad_format' }
  const own = ownCode ? normalizeReferralCode(ownCode) : ''
  if (own && code === own) return { ok: false, issue: 'own_code' }
  return { ok: true, code }
}

/** ข้อความไทยครบทุก issue (mirror describeCouponResult philosophy). */
export function describeReferralIssue(issue: ReferralCodeIssue): string {
  switch (issue) {
    case 'empty_code':
      return 'กรุณากรอกรหัสแนะนำเพื่อนก่อน'
    case 'bad_format':
      return 'รูปแบบโค้ดไม่ถูกต้อง — โค้ดแนะนำเพื่อนขึ้นต้นด้วย BMB- ตามด้วยตัวอักษร/ตัวเลข'
    case 'own_code':
      return 'นี่คือโค้ดของคุณเอง — ใช้โค้ดของเพื่อนคนอื่นเพื่อรับรางวัลแนะนำได้เท่านั้น (ระบบป้องกันการแนะนำตัวเอง)'
    case 'load_failed':
      return 'ตรวจสอบโค้ดไม่ได้ในตอนนี้ — กรุณาลองใหม่อีกครั้ง'
  }
}

// ---------- server calls ----------

/** precheck ฝั่ง server (anon ใช้ได้ · ไม่เปิดเผยตัวตนเจ้าของโค้ด). */
export async function fetchReferralPreview(raw: string): Promise<ReferralPreviewResult> {
  const code = normalizeReferralCode(raw)
  if (!REFERRAL_CODE_RE.test(code)) return { ok: false, reason: 'bad_format' }
  try {
    const { data, error } = await supabase.rpc('referral_preview', { p_code: code })
    if (error) return { ok: false, reason: 'load_failed' }
    const valid = (data as { valid?: boolean } | null)?.valid === true
    if (valid) return { ok: true }
    const reason = (data as { reason?: string } | null)?.reason
    return {
      ok: false,
      reason: reason === 'disabled' || reason === 'unknown_code' ? reason : 'bad_format',
    }
  } catch {
    return { ok: false, reason: 'load_failed' }
  }
}

/** ข้อความไทยจากผล preview. */
export function describeReferralPreview(r: ReferralPreviewResult): string {
  if (r.ok) return 'ใช้โค้ดแนะนำเพื่อนได้ — ระบบจะบันทึกสิทธิ์ให้ทันทีหลังสั่งซื้อสำเร็จ'
  switch (r.reason) {
    case 'unknown_code':
      return 'ไม่พบรหัสแนะนำเพื่อนนี้ — ตรวจสอบโค้ดอีกครั้ง'
    case 'disabled':
      return 'ระบบแนะนำเพื่อนปิดรับชั่วคราว — ยังไม่บันทึกสิทธิ์ในตอนนี้'
    case 'load_failed':
      return 'ตรวจสอบโค้ดไม่ได้ในตอนนี้ — กรุณาลองใหม่อีกครั้ง'
    default:
      return describeReferralIssue('bad_format')
  }
}

/** โค้ดของฉัน + รางวัลที่ได้ + นโยบาย (หน้าแชร์/โปรไฟล์) — ต้อง login. */
export async function fetchMyReferralStatus(): Promise<MyReferralStatus | null> {
  try {
    const { data, error } = await supabase.rpc('referral_my_status')
    if (error || !data) return null
    const d = data as Partial<MyReferralStatus>
    if (typeof d.code !== 'string') return null
    return {
      code: d.code,
      enabled: d.enabled !== false,
      share_base_url: typeof d.share_base_url === 'string' ? d.share_base_url : '',
      referrer_reward_baht: Number(d.referrer_reward_baht ?? 0),
      friend_reward_baht: Number(d.friend_reward_baht ?? 0),
      rewards: Array.isArray(d.rewards) ? (d.rewards as ReferralReward[]) : [],
      stats: d.stats ?? { attributed_orders: 0, qualified: 0, held: 0 },
    }
  } catch {
    return null
  }
}

/**
 * ผูกโค้ดกับออเดอร์ — เรียกทันทีหลัง createOrder สำเร็จ (server = ที่เดียวที่ตัดสิน).
 * ล้มเหลว = คืน null (caller แจ้งลูกค้าให้ลองใหม่ — ไม่แสร้งว่าได้สิทธิ์).
 */
export async function claimReferralCode(
  orderNumber: string,
  code: string,
): Promise<ReferralClaimResult | null> {
  try {
    const { data, error } = await supabase.rpc('referral_claim', {
      p_order_number: orderNumber,
      p_referral_code: normalizeReferralCode(code),
    })
    if (error || !data) return null
    const d = data as Partial<ReferralClaimResult>
    if (typeof d.status !== 'string') return null
    return d as ReferralClaimResult
  } catch {
    return null
  }
}

/** ข้อความไทยจากผล claim (ใช้ toast หลังสั่งซื้อ). */
export function describeReferralClaim(
  r: ReferralClaimResult,
): { message: string; tone: 'success' | 'info' | 'error' } {
  if (r.already_claimed && (r.status === 'held' || r.status === 'qualified')) {
    return { message: 'บันทึกโค้ดแนะนำเพื่อนไว้แล้ว — รอออเดอร์สำเร็จเพื่อรับรางวัล', tone: 'info' }
  }
  switch (r.status) {
    case 'held':
      return { message: 'ใช้โค้ดแนะนำเพื่อนแล้ว — รอออเดอร์ผ่านสถานะจึงจะได้รับรางวัล', tone: 'success' }
    case 'qualified':
      return { message: 'ได้รับรางวัลแนะนำเพื่อนแล้ว! ดูโค้ดคูปองได้ที่หน้า "ชวนเพื่อน"', tone: 'success' }
    case 'invalid':
      return {
        message: r.reason === 'unknown_code' ? 'ไม่พบรหัสแนะนำเพื่อนนี้' : 'รูปแบบโค้ดไม่ถูกต้อง',
        tone: 'error',
      }
    case 'disabled':
      return { message: 'ระบบแนะนำเพื่อนปิดรับชั่วคราว', tone: 'info' }
    case 'ineligible':
      return { message: 'ออเดอร์นี้ไม่เข้าเงื่อนไขรับรางวัลแนะนำเพื่อน', tone: 'info' }
    case 'blocked':
      return { message: describeBlockedReason(r.reason), tone: 'error' }
    default:
      return { message: 'บันทึกโค้ดแนะนำเพื่อนไม่สำเร็จ', tone: 'error' }
  }
}

function describeBlockedReason(reason?: string | null): string {
  switch (reason) {
    case 'self_referral':
      return 'ไม่สามารถใช้โค้ดของตัวเองได้ (ระบบป้องกันการแนะนำตัวเอง)'
    case 'same_phone':
      return 'เบอร์นี้ซ้ำกับผู้แนะนำ — ไม่เข้าเงื่อนไขรับรางวัล'
    case 'not_new':
      return 'บัญชีนี้เคยสั่งซื้อแล้ว — รางวัลมอบให้สำหรับลูกค้าใหม่เท่านั้น'
    case 'already_referred':
      return 'บัญชีนี้ถูกแนะนำโดยผู้อื่นไปแล้ว'
    case 'claim_window_expired':
      return 'เกินระยะเวลาในการระบุผู้แนะนำ (72 ชั่วโมงหลังสั่งซื้อ)'
    case 'referrer_cap_exceeded':
      return 'ผู้แนะนำครบเพดานรางวัลรอบเดือนนี้ — อยู่ระหว่างรอแอดมินตรวจสอบ'
    default:
      return 'ไม่เข้าเงื่อนไขรับรางวัลแนะนำเพื่อน'
  }
}

// ---------- share link ----------

/**
 * ลิงก์แชร์จริง: `<base>/?ref=CODE` — base = นโยบายแอดมิน (share_base_url) ถ้าตั้งไว้
 * มิฉะนั้นใช้ origin ปัจจุบัน (Owner: "เชื่อมจากลิงก์จริงที่แอดมินตั้งแล้วต้องปรับได้ตลอด")
 */
export function referralShareUrl(baseUrl: string | null | undefined, code: string): string {
  const explicit = String(baseUrl ?? '').trim().replace(/\/+$/, '')
  const origin =
    explicit ||
    (typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'https://biteme-baby.com')
  return `${origin}/?ref=${encodeURIComponent(code)}`
}

/**
 * ดึง `?ref=` จาก query string — คืนโค้ดที่ validate ผ่านแล้ว หรือ null.
 * (ใช้ตอนเปิดลิงก์แชร์ — App.tsx เก็บลง cartStore แล้ว strip พารามิเตอร์ทิ้ง)
 */
export function referralCodeFromSearch(search: string): string | null {
  try {
    const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`)
    const raw = params.get('ref')
    if (!raw) return null
    const code = normalizeReferralCode(raw)
    return REFERRAL_CODE_RE.test(code) ? code : null
  } catch {
    return null
  }
}