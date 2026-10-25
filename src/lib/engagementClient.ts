// ============================================
// Bite Me Baby — Engagement & Play client (G&R STAGE 4 · mirror ของ migration 156)
// --------------------------------------------
// Client-side MIRROR ของ server-authoritative ระบบ Stage 4:
//   • Spin & Win:   `spin_status` / `spin_reward` — รางวัลจริงจากเซิร์ฟเวอร์ มีเพดานรายวัน
//                   (หน้าล้อสุ่มห้ามสัญญาแต้มเมื่อ policy ปิด — ZERO-FAKE)
//   • Creator Affiliate: `affiliate_my_code` / `affiliate_claim` — แต้มล้วน ไม่มีเงินสด
//                   (§4.1 ข้อ 5) · ?aff= deep-link (mirror ?ref= ของ 154)
//   • Rewards catalog: `rewards_catalog_list` — ย้าย hardcode → ตาราง admin (§2 ข้อ 7)
//
// ทุกกติกาถูก validate ซ้ำฝั่งเซิร์ฟเวอร์ใน RPC — โมดูลนี้ = precheck/แสดงผลเท่านั้น ·
// อัตรา/เพดาน = ตั้งโดยแอดมินใน AI Marketing Center แท็บ Rules (ห้ามเดา §3.1)
// ============================================

import { supabase } from './supabase'

// ---------- policy mirrors (คู่สัญญา seed ใน migration 156) ----------

export const DEFAULT_SPIN_POLICY = {
  enabled: false,
  daily_limit: 1,
  points_per_spin: 0,
} as const

export const DEFAULT_AFFILIATE_POLICY = {
  enabled: false,
  points_per_qualified_order: 0,
  monthly_cap: 0,
  qualify_status: 'delivered',
} as const

export interface SpinPolicy {
  enabled: boolean
  daily_limit: number
  points_per_spin: number
}

export interface AffiliatePolicy {
  enabled: boolean
  points_per_qualified_order: number
  monthly_cap: number
  qualify_status: string
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

/** mirror ของ SQL `spin_policy_state` — ค่าผิด/หาย → ชุดเริ่มต้น (ไม่แสร้งว่าเปิด) */
export function normalizeSpinPolicy(raw: unknown): SpinPolicy {
  const r = (raw ?? {}) as Record<string, unknown>
  return {
    enabled: typeof r.enabled === 'boolean' ? r.enabled : DEFAULT_SPIN_POLICY.enabled,
    daily_limit: num(r.daily_limit, DEFAULT_SPIN_POLICY.daily_limit),
    points_per_spin: num(r.points_per_spin, DEFAULT_SPIN_POLICY.points_per_spin),
  }
}

/** mirror ของ SQL `affiliate_policy_state` */
export function normalizeAffiliatePolicy(raw: unknown): AffiliatePolicy {
  const r = (raw ?? {}) as Record<string, unknown>
  const status =
    typeof r.qualify_status === 'string' && r.qualify_status.trim()
      ? r.qualify_status.trim()
      : DEFAULT_AFFILIATE_POLICY.qualify_status
  return {
    enabled: typeof r.enabled === 'boolean' ? r.enabled : DEFAULT_AFFILIATE_POLICY.enabled,
    points_per_qualified_order: num(r.points_per_qualified_order, DEFAULT_AFFILIATE_POLICY.points_per_qualified_order),
    monthly_cap: num(r.monthly_cap, DEFAULT_AFFILIATE_POLICY.monthly_cap),
    qualify_status: status,
  }
}

// ---------- types ----------

export interface SpinStatus extends SpinPolicy {
  used_today: number
  remaining_today: number
  balance: number
}

export interface SpinResult {
  ok: boolean
  points: number
  used_today: number
  remaining_today: number
  balance: number
}

export type SpinAttempt =
  | { ok: true; result: SpinResult }
  | { ok: false; reason: 'disabled' | 'no_rate' | 'limit' | 'signed_out' | 'load_failed' }

export interface RewardsCatalogItem {
  id: string
  name: string
  description: string
  points_cost: number
  sort_order: number
}

export interface AffiliateStatus {
  code: string
  orders_pending: number
  orders_qualified: number
  points_total: number
  points_this_month: number
  policy: AffiliatePolicy
}

export interface AffiliateClaimResult {
  ok: boolean
  state: 'pending' | 'qualified' | 'reversed'
}

export type AffiliateIssue = 'load_failed' | 'signed_out'

// ---------- spin ----------

/** สถานะล้อสุ่มสำหรับหน้า — null = โหลดไม่ได้/รูปผิด (ห้ามเดาค่าเอง — เข้มทุก key) */
export async function fetchSpinStatus(): Promise<SpinStatus | null> {
  const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
  try {
    const { data, error } = await supabase.rpc('spin_status')
    if (error || !data) return null
    const d = data as Record<string, unknown>
    if (
      typeof d.enabled !== 'boolean' ||
      !isNum(d.daily_limit) || !isNum(d.points_per_spin) ||
      !isNum(d.used_today) || !isNum(d.remaining_today) || !isNum(d.balance)
    ) return null
    return {
      enabled: d.enabled,
      daily_limit: d.daily_limit,
      points_per_spin: d.points_per_spin,
      used_today: d.used_today,
      remaining_today: d.remaining_today,
      balance: d.balance,
    }
  } catch {
    return null
  }
}

/** หมุนรับแต้มจริง — ข้อผิดพลาดแปลเป็น reason ไทย (หน้าห้ามสัญญาแต้มล่วงหน้า) */
export async function trySpinReward(): Promise<SpinAttempt> {
  try {
    const { data, error } = await supabase.rpc('spin_reward')
    if (error) {
      const msg = String(error.message ?? '')
      if (msg.includes('ERR_SPIN_DISABLED')) return { ok: false, reason: 'disabled' }
      if (msg.includes('ERR_SPIN_NO_RATE')) return { ok: false, reason: 'no_rate' }
      if (msg.includes('ERR_SPIN_LIMIT')) return { ok: false, reason: 'limit' }
      if (msg.includes('ERR_NOT_AUTHENTICATED')) return { ok: false, reason: 'signed_out' }
      return { ok: false, reason: 'load_failed' }
    }
    const d = data as Partial<SpinResult> | null
    if (!d || typeof d.ok !== 'boolean' || typeof d.points !== 'number') {
      return { ok: false, reason: 'load_failed' }
    }
    return { ok: true, result: d as SpinResult }
  } catch {
    return { ok: false, reason: 'load_failed' }
  }
}

/** ข้อความไทยครบทุกสถานะ (คู่สัญญา test: ไม่มี string ว่าง) */
export function describeSpinIssue(reason: 'disabled' | 'no_rate' | 'limit' | 'signed_out' | 'load_failed'): string {
  switch (reason) {
    case 'disabled':
      return 'ยังไม่เปิดรางวัลล้อสุ่ม — แอดมินยังไม่ได้เปิดใช้งานค่ะ'
    case 'no_rate':
      return 'ยังไม่ได้กำหนดจำนวนแต้มต่อการหมุน — แอดมินยังไม่ได้ตั้งอัตราค่ะ'
    case 'limit':
      return 'หมุนครบจำนวนครั้งของวันนี้แล้ว — กลับมาใหม่พรุ่งนี้นะคะ'
    case 'signed_out':
      return 'กรุณาเข้าสู่ระบบก่อนหมุนล้อรับแต้มค่ะ'
    case 'load_failed':
      return 'ระบบแต้มขัดข้องชั่วคราว — ยังไม่ได้รับแต้ม กรุณาลองใหม่อีกครั้งค่ะ'
  }
}

// ---------- rewards catalog (ย้าย hardcode → ตาราง admin) ----------

/** รายการแลกของจริงจาก server — null = โหลดไม่ได้ (ห้าม fallback เป็น hardcode) */
export async function fetchRewardsCatalog(): Promise<RewardsCatalogItem[] | null> {
  try {
    const { data, error } = await supabase.rpc('rewards_catalog_list')
    if (error || !Array.isArray(data)) return null
    const items: RewardsCatalogItem[] = []
    for (const raw of data as Record<string, unknown>[]) {
      if (
        typeof raw?.id !== 'string' || typeof raw?.name !== 'string' ||
        typeof raw?.points_cost !== 'number' || !Number.isFinite(raw.points_cost) ||
        raw.points_cost <= 0
      ) return null // ข้อมูลผิดรูป = ไม่แสร้งว่าใช้ได้
      items.push({
        id: raw.id,
        name: raw.name,
        description: typeof raw.description === 'string' ? raw.description : '',
        points_cost: raw.points_cost,
        sort_order: typeof raw.sort_order === 'number' ? raw.sort_order : 0,
      })
    }
    return items
  } catch {
    return null
  }
}

// ---------- creator affiliate (แต้มล้วน ไม่มีเงินสด) ----------

export const AFFILIATE_CODE_RE = /^AFF-[A-Z0-9]{6,}$/

/** normalize = trim whitespace ทั้งหมด + upper (mirror affiliate_normalize_code) */
export function normalizeAffiliateCode(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\s+/g, '').toUpperCase()
}

/** ดึง/สร้างโค้ดครีเอเตอร์ของตัวเอง (server สร้างให้ถ้ายังไม่มี) */
export async function fetchAffiliateStatus(): Promise<AffiliateStatus | null> {
  try {
    const { data, error } = await supabase.rpc('affiliate_my_code')
    if (error || !data) return null
    const d = data as Record<string, unknown>
    if (typeof d.code !== 'string' || !AFFILIATE_CODE_RE.test(d.code)) return null
    return {
      code: d.code,
      orders_pending: num(d.orders_pending, 0),
      orders_qualified: num(d.orders_qualified, 0),
      points_total: num(d.points_total, 0),
      points_this_month: num(d.points_this_month, 0),
      policy: normalizeAffiliatePolicy(d.policy),
    }
  } catch {
    return null
  }
}

/**
 * ผูกออเดอร์เข้าโค้ดครีเอเตอร์ — เรียกหลังสร้างออเดอร์สำเร็จ (CheckoutPage) ·
 * ทุกกติกา (self/ซ้ำ/ออเดอร์ตาย) validate ฝั่งเซิร์ฟเวอร์ใน affiliate_claim
 */
export async function claimAffiliate(
  orderNumber: string,
  code: string,
): Promise<AffiliateClaimResult | null> {
  try {
    const normalized = normalizeAffiliateCode(code)
    if (!AFFILIATE_CODE_RE.test(normalized)) return null
    const { data, error } = await supabase.rpc('affiliate_claim', {
      p_order_number: orderNumber,
      p_code: normalized,
    })
    if (error || !data) return null
    const d = data as Partial<AffiliateClaimResult>
    if (typeof d.ok !== 'boolean' || typeof d.state !== 'string') return null
    return d as AffiliateClaimResult
  } catch {
    return null
  }
}

/** ข้อความไทยจากผลผูกออเดอร์ (toast หลังสั่งซื้อ) */
export function describeAffiliateClaim(r: AffiliateClaimResult): {
  message: string
  tone: 'success' | 'info' | 'error'
} {
  if (r.state === 'qualified') {
    return { message: 'มอบรางวัลครีเอเตอร์จากออเดอร์นี้ให้เรียบร้อยแล้วค่ะ', tone: 'success' }
  }
  if (r.state === 'reversed') {
    return { message: 'ออเดอร์นี้ถูกปรับรางวัลครีเอเตอร์กลับตามต้นทางแล้ว', tone: 'info' }
  }
  return {
    message: 'บันทึกการสนับสนุนครีเอเตอร์ไว้แล้ว — จะได้รับรางวัลเมื่อออเดอร์สำเร็จ',
    tone: 'success',
  }
}

/** ข้อความไทยครบทุกเหตุผลที่ fetch ล้มเหลว */
export function describeAffiliateIssue(reason: AffiliateIssue): string {
  if (reason === 'signed_out') return 'กรุณาเข้าสู่ระบบเพื่อดูโค้ดครีเอเตอร์ของคุณค่ะ'
  return 'โหลดข้อมูลครีเอเตอร์ไม่สำเร็จ — กรุณาลองใหม่อีกครั้งค่ะ'
}

// ---------- ?aff= deep-link (mirror ?ref= ของ 154) ----------

/** ลิงก์แชร์ของครีเอเตอร์: `<origin>/?aff=CODE` */
export function affiliateShareUrl(code: string): string {
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://biteme-baby.com'
  return `${origin}/?aff=${encodeURIComponent(code)}`
}

/** ดึง `?aff=` จาก query string — คืนโค้ดที่ผ่าน format แล้ว หรือ null */
export function affiliateCodeFromSearch(search: string): string | null {
  try {
    const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`)
    const code = normalizeAffiliateCode(params.get('aff'))
    return AFFILIATE_CODE_RE.test(code) ? code : null
  } catch {
    return null
  }
}

/** session key เก็บโค้ด aff ที่ได้จากลิงก์ ระหว่างรอสร้างออเดอร์ (Layout → Checkout) */
export const AFFILIATE_CLAIM_STORAGE_KEY = 'bmb_affiliate_claim_code'

export function saveAffiliateClaimCode(code: string): void {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(AFFILIATE_CLAIM_STORAGE_KEY, normalizeAffiliateCode(code))
    }
  } catch { /* storage ถูกบล็อก = เงียบ ไม่ตาย */ }
}

export function readAffiliateClaimCode(): string | null {
  try {
    if (typeof sessionStorage === 'undefined') return null
    const code = normalizeAffiliateCode(sessionStorage.getItem(AFFILIATE_CLAIM_STORAGE_KEY))
    return AFFILIATE_CODE_RE.test(code) ? code : null
  } catch {
    return null
  }
}

/** เอาโค้ดไปใช้แล้วลบทิ้ง (ครั้งเดียวต่อ session — กันผูกซ้ำ) */
export function takeAffiliateClaimCode(): string | null {
  const code = readAffiliateClaimCode()
  try {
    if (code && typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(AFFILIATE_CLAIM_STORAGE_KEY)
    }
  } catch { /* noop */ }
  return code
}