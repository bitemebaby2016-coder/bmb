// ============================================
// Bite Me Baby — CAP-21 Customer Intelligence (ระบบเจาะกลุ่มลูกค้า อัตโนมัติ)
// ============================================
// Owner directive 2026-10-26 (ย้ำคำสั่งเดิมจาก audit D11): "ถ้าไม่มีฟีเจอร์ ต้องทำเป็น
// อัตโนมัติ ไม่ต้องมากำหนดโดยแอดมิน"
//
// กติกาของระบบชุดนี้ (ทุกข้อถูกคุมด้วย test):
//   1. AUTOMATIC — คำนวณทุกครั้งที่อ่านจากสถิติออเดอร์จริง · ไม่มีปุ่ม "บันทึกกลุ่ม"
//      ไม่มีช่องให้แอดมินกรอกเกณฑ์ · ไม่มี localStorage/cache ที่ค้างได้
//   2. DETERMINISTIC — ผลลัพธ์ขึ้นกับ input กับ `now` เท่านั้น (ห้ามอ่านนาฬิกาเองกลางทาง)
//   3. TRUTHFUL — ใช้เฉพาะตัวเลขที่มีจริง (orders/customers/loyalty/reviews) ไม่เดา ไม่มีคะแนนปลอม
//   4. PRESENTATION ONLY — ไม่ใช่สิทธิ์ใหม่ ไม่มีตารางใหม่ (RLS ยังเป็นประตูจริง)
//
// ส่วน "การจำ" บทสนทนา AI = `lib/aiServerMemory` (ของเดิม ยังใช้อยู่) —
// ไฟล์นี้รับผิดชอบเฉพาะ "เจาะกลุ่ม/สรุปอัตโนมัติ" ให้หน้าแอดมิน
// ============================================

/** ความถี่ในการสั่ง — แบ่งจาก "จำนวนออเดอร์" ล้วน ๆ (ไม่มีค่าที่แอดมินตั้ง) */
export type OrderFrequency = 'new_customer' | 'occasional' | 'regular' | 'loyal'

/** กลุ่มลูกค้าที่ระบบให้เองอัตโนมัติ */
export type CustomerSegment =
  | 'high_value'      // ยอดใช้จ่ายรวมสูง
  | 'loyal_customer'   // สั่งบ่อย
  | 'new_customer'     // ยังไม่เคยสั่ง
  | 'at_risk'          // เคยสั่งแต่เงียบไปนาน (มีโอกาสเสียลูกค้า)
  | 'active_reviewer'  // เคยรีวิว
  | 'satisfied'        // ค่าเฉลี่ยคะแนนรีวิวสูง
  | 'referral_source'  // มีแต้มสะสม (สัญญาณการมีส่วนร่วมที่วัดได้จริง)

/** สถิติที่ `bmbAdminApi_customers.getCustomersWithStats()` คืนมาอยู่แล้ว */
export interface CustomerStats {
  order_count: number
  order_total: number
  last_order_at?: string | null
  loyalty_points?: number | null
}

/** ผลลัพธ์ที่หน้าแอดมิน/รายงานใช้แสดง */
export interface CustomerInsight {
  frequency: OrderFrequency
  segments: CustomerSegment[]
  average_order_value: number
  days_since_last_order: number | null
  /** สรุปภาษาไทย 1 บรรทัดสำหรับโชว์ใต้ชื่อลูกค้า (ระบบเขียนให้เอง) */
  summary: string
}

/** เงื่อนไขคงที่ของระบบ — export เพื่อให้ test อ้างค่าเดียวกับโค้ด (ไม่ใช่ค่าที่ตั้งได้จาก UI) */
export const INTELLIGENCE_THRESHOLDS = {
  /** ยอดใช้จ่ายรวมถึง/เกินนี้ = กลุ่ม high_value */
  highValueTotalBaht: 3000,
  /** สั่งถึง/เกินนี้ = loyal */
  loyalMinOrders: 6,
  /** 1-3 ออเดอร์ = occasional */
  occasionalMaxOrders: 3,
  /** เคยสั่งแล้วเงียบเกินนี้วัน = at_risk */
  dormantDays: 45,
  /** คะแนนรีวิวเฉลี่ยถึง/เกินนี้ = satisfied */
  satisfiedMinRating: 4,
} as const

/** แบ่งความถี่จากจำนวนออเดอร์ (pure · deterministic) */
export function classifyOrderFrequency(totalOrders: number): OrderFrequency {
  if (totalOrders <= 0) return 'new_customer'
  if (totalOrders <= INTELLIGENCE_THRESHOLDS.occasionalMaxOrders) return 'occasional'
  if (totalOrders < INTELLIGENCE_THRESHOLDS.loyalMinOrders) return 'regular'
  return 'loyal'
}

/** จำนวนวันที่ผ่านไปจาก lastOrder ถึง `now` (null เมื่อไม่เคยสั่ง/ข้อมูลผิดรูป) */
export function daysSince(lastOrderAt: string | null | undefined, now: number): number | null {
  if (!lastOrderAt) return null
  const t = Date.parse(lastOrderAt)
  if (Number.isNaN(t)) return null
  return Math.max(0, Math.floor((now - t) / 86_400_000))
}

/**
 * เจาะกลุ่มลูกค้าอัตโนมัติ — คำนวณจากสถิติจริงเท่านั้น (ไม่มี input จากแอดมิน)
 * @param stats สถิติจาก getCustomersWithStats()
 * @param opts.reviewsAvgRating คะแนนรีวิวเฉลี่ย (ไม่มีก็อย่าส่ง — ห้ามเดาค่า)
 * @param opts.reviewCount จำนวนรีวิว
 * @param opts.now เวลาอ้างอิง (ms) เพื่อให้ผลทดสอบซ้ำได้เป๊ะ
 */
export function deriveCustomerInsight(
  stats: CustomerStats,
  opts: { now?: number; reviewsAvgRating?: number; reviewCount?: number } = {},
): CustomerInsight {
  const now = opts.now ?? Date.now()
  const totalOrders = Number(stats.order_count || 0)
  const totalSpent = Number(stats.order_total || 0)
  const frequency = classifyOrderFrequency(totalOrders)
  const days = daysSince(stats.last_order_at, now)
  const segments: CustomerSegment[] = []

  if (totalOrders > 0 && totalSpent >= INTELLIGENCE_THRESHOLDS.highValueTotalBaht) segments.push('high_value')
  if (frequency === 'loyal') segments.push('loyal_customer')
  if (totalOrders === 0) segments.push('new_customer')
  if (totalOrders > 0 && days !== null && days >= INTELLIGENCE_THRESHOLDS.dormantDays) segments.push('at_risk')
  if ((opts.reviewCount ?? 0) > 0) segments.push('active_reviewer')
  if ((opts.reviewsAvgRating ?? 0) >= INTELLIGENCE_THRESHOLDS.satisfiedMinRating) segments.push('satisfied')
  if (Number(stats.loyalty_points || 0) > 0) segments.push('referral_source')

  const aov = totalOrders > 0 ? totalSpent / totalOrders : 0
  return {
    frequency,
    segments,
    average_order_value: aov,
    days_since_last_order: days,
    summary: summarizeInsight({ frequency, segments, totalOrders, totalSpent, aov, days }),
  }
}

const SEGMENT_LABEL_TH: Record<CustomerSegment, string> = {
  high_value: 'ยอดสูง',
  loyal_customer: 'ประจำร้าน',
  new_customer: 'ลูกค้าใหม่',
  at_risk: 'ห่างหาย',
  active_reviewer: 'นักรีวิว',
  satisfied: 'พึงพอใจสูง',
  referral_source: 'มีแต้มสะสม',
}

const FREQUENCY_LABEL_TH: Record<OrderFrequency, string> = {
  new_customer: 'ยังไม่เคยสั่ง',
  occasional: 'สั่งเป็นครั้งคราว',
  regular: 'สั่งสม่ำเสมอ',
  loyal: 'สั่งบ่อย',
}

export function segmentLabelTh(s: CustomerSegment): string {
  return SEGMENT_LABEL_TH[s] ?? s
}

export function frequencyLabelTh(f: OrderFrequency): string {
  return FREQUENCY_LABEL_TH[f] ?? f
}

/** สรุป 1 บรรทัดภาษาไทย — ระบบเขียนให้เองจากตัวเลขจริง (ไม่มีช่องให้พิมพ์/ตั้งค่าจากหน้าแอดมิน) */
export function summarizeInsight(input: {
  frequency: OrderFrequency
  segments: CustomerSegment[]
  totalOrders: number
  totalSpent: number
  aov: number
  days: number | null
}): string {
  const parts: string[] = [frequencyLabelTh(input.frequency)]
  if (input.totalOrders > 0) {
    parts.push(
      `สั่ง ${input.totalOrders} ครั้ง · รวม ฿${Math.round(input.totalSpent).toLocaleString('th-TH')} · เฉลี่ย ฿${Math.round(input.aov).toLocaleString('th-TH')}/ออเดอร์`,
    )
    if (input.days !== null) parts.push(`ล่าสุด ${input.days} วันที่แล้ว`)
  }
  if (input.segments.length > 0) {
    parts.push('กลุ่ม: ' + input.segments.map(segmentLabelTh).join(' · '))
  }
  return parts.join(' | ')
}

/** สรุปภาพรวมทั้งหน้า (แถบสถิติด้านบนตาราง — คำนวณอัตโนมัติทุกครั้งที่โหลดหน้า) */
export function segmentTally(insights: CustomerInsight[]): Record<CustomerSegment, number> {
  const out: Record<CustomerSegment, number> = {
    high_value: 0, loyal_customer: 0, new_customer: 0, at_risk: 0,
    active_reviewer: 0, satisfied: 0, referral_source: 0,
  }
  for (const i of insights) for (const s of i.segments) out[s] += 1
  return out
}