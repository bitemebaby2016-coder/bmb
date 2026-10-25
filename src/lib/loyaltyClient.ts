// ============================================
// Bite Me Baby — Loyalty client (G&R STAGE 3 · mirror ของ migration 155)
// --------------------------------------------
// Client-side MIRROR ของ server-authoritative ทั้งหมด (แบบ referralClient):
//   • tier math: tierForNetSales = mirror `loyalty_tier_of`
//                (member ค่าเริ่มต้น · silver ≥1,500 · gold ≥4,000 · platinum ≥8,000)
//   • net sales: orderNetSales   = mirror `loyalty_order_net`
//                (subtotal − ส่วนลด − คืนเงิน · ไม่รวมค่าส่ง · ยกเลิก/คืนเงินเต็ม = 0)
//   • progress:  progressTowardTier = mirror สูตรใน `loyalty_my_status`
//
// โมดูลนี้ = "แสดงผล/พรีวิว" เท่านั้น — ตัวเลขที่ลูกค้าเห็นมาจาก RPC จริง
// (`loyalty_my_status` / `loyalty_my_history`) ไม่มีแกล้งเพิ่มแต้มฝั่งเครื่อง (ZERO-FAKE)
// อัตราแต้ม = ตั้งใน AI Marketing Center แท็บ Rules (ค่าเริ่มต้น = ยังไม่เปิด — ห้ามฝังค่า)
// ============================================

import { supabase } from './supabase'

export type LoyaltyTier = 'member' | 'silver' | 'gold' | 'platinum'

export interface LoyaltyThresholds {
  silver: number
  gold: number
  platinum: number
}

/** mirror ของ seed `loyalty_policy` ใน migration 155 (ห้ามแก้ฝั่งเดียว — คู่สัญญา SQL) */
export const DEFAULT_LOYALTY_POLICY = {
  tiers_enabled: true,
  window_months: 12,
  tier_silver_min: 1500,
  tier_gold_min: 4000,
  tier_platinum_min: 8000,
  points_enabled: false,
  points_per_baht: 0,
  earn_qualify_status: 'delivered',
} as const

export const DEFAULT_THRESHOLDS: LoyaltyThresholds = {
  silver: DEFAULT_LOYALTY_POLICY.tier_silver_min,
  gold: DEFAULT_LOYALTY_POLICY.tier_gold_min,
  platinum: DEFAULT_LOYALTY_POLICY.tier_platinum_min,
}

export const LOYALTY_TIER_KEYS = ['member', 'silver', 'gold', 'platinum'] as const

export interface LoyaltyTierInfo {
  key: LoyaltyTier
  /** ยอดสุทธิขั้นต่ำ (฿) — member = 0 */
  min: number
  label: string
  emoji: string
  description: string
}

/** ข้อมูลแสดงผล 4 ระดับ (เกณฑ์ §5.2 — mirror ค่า seed เดียวกัน) */
export function loyaltyTierCatalog(thresholds: LoyaltyThresholds = DEFAULT_THRESHOLDS): LoyaltyTierInfo[] {
  const fmt = (n: number) => n.toLocaleString('th-TH')
  return [
    { key: 'member', min: 0, label: 'Member', emoji: '🌱', description: 'สมาชิกเริ่มต้น' },
    { key: 'silver', min: thresholds.silver, label: 'Silver', emoji: '🥈', description: `ยอดสุทธิ ≥ ฿${fmt(thresholds.silver)} ต่อรอบ 12 เดือน` },
    { key: 'gold', min: thresholds.gold, label: 'Gold', emoji: '🥇', description: `ยอดสุทธิ ≥ ฿${fmt(thresholds.gold)} ต่อรอบ 12 เดือน` },
    { key: 'platinum', min: thresholds.platinum, label: 'Platinum', emoji: '💎', description: `ยอดสุทธิ ≥ ฿${fmt(thresholds.platinum)} ต่อรอบ 12 เดือน` },
  ]
}

/**
 * mirror ของ SQL `loyalty_tier_of`:
 * ค่า/null/ติดลบ = member · เทียบจากบนลงล่าง (platinum → gold → silver)
 */
export function tierForNetSales(
  net: number | null | undefined,
  thresholds: LoyaltyThresholds = DEFAULT_THRESHOLDS,
): LoyaltyTier {
  const n = Number(net ?? 0)
  if (!Number.isFinite(n) || n <= 0) return 'member'
  if (n >= thresholds.platinum) return 'platinum'
  if (n >= thresholds.gold) return 'gold'
  if (n >= thresholds.silver) return 'silver'
  return 'member'
}

export function tierLabel(tier: LoyaltyTier): string {
  return tier === 'silver' ? 'Silver' : tier === 'gold' ? 'Gold' : tier === 'platinum' ? 'Platinum' : 'Member'
}

/** ระดับถัดไป (platinum = ไม่มี) — mirror ลอจิกใน loyalty_my_status */
export function nextTierOf(tier: LoyaltyTier): LoyaltyTier | null {
  return tier === 'member' ? 'silver' : tier === 'silver' ? 'gold' : tier === 'gold' ? 'platinum' : null
}

/** ความคืบหน้าสู่ระดับถัดไป 0..1 — mirror สูตรใน loyalty_my_status (กันหารศูนย์) */
export function progressTowardTier(net: number, nextThreshold: number | null): number {
  if (nextThreshold === null || nextThreshold <= 0) return 0
  const n = Number.isFinite(net) ? net : 0
  return Math.min(1, Math.max(0, n / nextThreshold))
}

export interface OrderNetInput {
  status: string
  payment_status: string
  subtotal: number
  discount_amount: number
  /** ยอดคืนเงินสะสม (฿) — mirror metadata.refunded_total_minor/100 */
  refunded_baht?: number
}

/**
 * mirror ของ SQL `loyalty_order_net` — มูลค่าสุทธิของออเดอร์:
 * ยกเลิก/failed = 0 · คืนเงินเต็ม = 0 · หักส่วนลด + คืนเงิน (ไม่รวมค่าส่ง/ค่าบริการ)
 */
export function orderNetSales(order: OrderNetInput): number {
  if (order.status === 'cancelled' || order.status === 'failed') return 0
  if (order.payment_status === 'refund') return 0
  const goods = Math.max(0, Number(order.subtotal || 0) - Number(order.discount_amount || 0))
  const refunded = Math.max(0, Number(order.refunded_baht || 0))
  return Math.max(0, goods - Math.min(goods, refunded))
}

// ---------- types (RPC payloads) ----------

export interface LoyaltyStatus {
  tier: LoyaltyTier
  tier_label: string
  tiers_enabled: boolean
  window_months: number
  net_sales: number
  thresholds: LoyaltyThresholds
  next_tier: LoyaltyTier | null
  next_threshold: number | null
  remaining: number
  progress: number
  points_balance: number
  points_enabled: boolean
  points_per_baht: number
  earn_qualify_status: string
}

export interface LoyaltyHistoryEntry {
  id: string
  points: number
  entry_type: 'purchase' | 'reversal' | 'adjustment'
  order_number: string | null
  basis_amount: number
  rate_used: number
  reason: string
  created_at: string
}

export interface LoyaltyHistory {
  entries: LoyaltyHistoryEntry[]
  balance: number
  points_enabled: boolean
  window_months: number
}

// ---------- fetchers ----------

/** ดึงสถานะจริงของตัวเอง (authenticated · server-authoritative) — null = โหลดไม่สำเร็จ */
export async function fetchLoyaltyStatus(): Promise<LoyaltyStatus | null> {
  try {
    const { data, error } = await supabase.rpc('loyalty_my_status')
    if (error || !data || typeof data !== 'object') return null
    const d = data as Partial<LoyaltyStatus>
    if (!LOYALTY_TIER_KEYS.includes(d.tier as LoyaltyTier)) return null
    if (typeof d.net_sales !== 'number' || typeof d.points_balance !== 'number') return null
    if (!d.thresholds || typeof d.thresholds !== 'object') return null
    return d as LoyaltyStatus
  } catch {
    return null
  }
}

/** ประวัติแต้มจาก ledger จริง (append-only · limit 1..100 ฝั่งเซิร์ฟเวอร์) */
export async function fetchLoyaltyHistory(limit = 50): Promise<LoyaltyHistory | null> {
  try {
    const { data, error } = await supabase.rpc('loyalty_my_history', { p_limit: limit })
    if (error || !data || typeof data !== 'object') return null
    const d = data as Partial<LoyaltyHistory>
    if (!Array.isArray(d.entries) || typeof d.balance !== 'number') return null
    return d as LoyaltyHistory
  } catch {
    return null
  }
}

// ---------- ข้อความไทย ----------

export function describeLoyaltyTier(tier: LoyaltyTier): string {
  switch (tier) {
    case 'platinum': return 'ระดับ Platinum — สิทธิพิเศษสูงสุด'
    case 'gold': return 'ระดับ Gold — สิทธิพิเศษขั้นสูง'
    case 'silver': return 'ระดับ Silver — สิทธิพิเศษขั้นกลาง'
    default: return 'ระดับ Member — เริ่มต้นสะสมยอดสุทธิ'
  }
}

/** ข้อความจากเหตุผล (ใช้ตอนโหลดไม่สำเร็จ/ไม่ได้ล็อกอิน/ระบบปิด) */
export function describeLoyaltyIssue(reason: 'load_failed' | 'signed_out' | 'disabled_tiers'): string {
  switch (reason) {
    case 'signed_out': return 'เข้าสู่ระบบเพื่อดูระดับสมาชิกและแต้มสะสม'
    case 'disabled_tiers': return 'ระบบระดับสมาชิกปิดรับชั่วคราว'
    default: return 'โหลดข้อมูลแต้มไม่สำเร็จ — ลองใหม่อีกครั้ง'
  }
}

export function describeLoyaltyEntryType(type: LoyaltyHistoryEntry['entry_type']): string {
  switch (type) {
    case 'purchase': return 'ได้แต้มจากการสั่งซื้อ'
    case 'reversal': return 'ปรับกลับ (ยกเลิก/คืนเงิน)'
    default: return 'ปรับแต้มพิเศษ'
  }
}