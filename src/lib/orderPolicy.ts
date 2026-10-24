// ============================================
// Bite Me Baby — Order/delivery policy settings (typed, admin-editable)
// ============================================
// WHY (Owner 2026-10-24): ค่า policy ต้อง "ตั้งจากฝั่งแอดมินได้" — เดิมพิมพ์ JSON ดิบ
// ใน AdminSettings จนค่าพัง (pre_order_lead_days = "มี7") ทำให้ server cast 22P02
// ทุกพรีออเดอร์ → ฟอร์มแบบมีชนิดข้อมูล + normalize/validate ที่นี่ที่เดียว
// (server อ่านค่าจาก business_settings.order_policy ผ่าน order_setting())
// ============================================

export interface OrderPolicy {
  /** คัทออฟพรีออเดอร์: ปิดรับก่อน delivery_start กี่ชั่วโมง (Owner Q1 / migration 143 = 2) */
  cutoff_hours: number
  /** legacy — ไม่บังคับแล้ว (143 ใช้คัทออฟแทน) เก็บไว้แสดง/ถอยหลัง */
  pre_order_lead_days: number
  /** จองล่วงหน้าได้สูงสุดกี่วัน (enforce_pre_order_window) */
  preorder_max_days: number
  /** โควตาออเดอร์ต่อวัน (availability engine) */
  daily_quota: number
  /** จำนวนสูงสุดต่อ 1 ออเดอร์ (create_order_with_items) */
  max_items_per_order: number
  /** หน้าต่างยกเลิก (นาที) */
  cancel_window_minutes: number
}

export const ORDER_POLICY_DEFAULTS: OrderPolicy = {
  cutoff_hours: 2,
  pre_order_lead_days: 7,
  preorder_max_days: 50,
  daily_quota: 100,
  max_items_per_order: 50,
  cancel_window_minutes: 5,
}

export interface OrderPolicyField {
  key: keyof OrderPolicy
  label: string
  hint: string
  min: number
  max: number
  step: number
}

export const ORDER_POLICY_FIELDS: OrderPolicyField[] = [
  { key: 'cutoff_hours', label: 'คัทออฟก่อนส่ง (ชม.)', hint: 'ปิดรับพรีออเดอร์ก่อนเวลาส่งกี่ ชม. (Q1 = 2 — เซมเดย์ไม่ใช้ค่านี้)', min: 0, max: 48, step: 0.5 },
  { key: 'preorder_max_days', label: 'จองล่วงหน้าได้สูงสุด (วัน)', hint: 'เมนูปฏิทินไกลสุดกี่วัน', min: 1, max: 365, step: 1 },
  { key: 'daily_quota', label: 'โควตาออเดอร์ต่อวัน', hint: 'เพดานออเดอร์รวมต่อวัน', min: 1, max: 10000, step: 1 },
  { key: 'max_items_per_order', label: 'จำนวนสูงสุดต่อออเดอร์ (ชิ้น)', hint: 'รวมทุกบรรทัดในตะกร้า', min: 1, max: 500, step: 1 },
  { key: 'cancel_window_minutes', label: 'ยกเลิกได้ภายใน (นาที)', hint: 'หน้าต่างยกเลิกออเดอร์', min: 0, max: 1440, step: 1 },
  { key: 'pre_order_lead_days', label: 'lead days (ค่าเดิม — ไม่บังคับ)', hint: 'ยกเลิกการบังคับแล้ว (143 ใช้คัทออฟแทน) — เก็บไว้เฉย ๆ', min: 0, max: 60, step: 1 },
]

/** ค่าเดิม/พัง (ข้อความ) -> ตัวเลขตาม default — ใช้ก่อนโชว์/บันทึกเสมอ */
export function normalizeOrderPolicy(raw: unknown): OrderPolicy {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const out = { ...ORDER_POLICY_DEFAULTS }
  for (const f of ORDER_POLICY_FIELDS) {
    const n = Number(src[f.key])
    if (Number.isFinite(n) && n >= f.min && n <= f.max) out[f.key] = n
  }
  return out
}

/** คืนข้อความ error หรือ null เมื่อผ่าน */
export function validateOrderPolicy(p: OrderPolicy): string | null {
  for (const f of ORDER_POLICY_FIELDS) {
    const n = Number(p[f.key])
    if (!Number.isFinite(n)) return `${f.label} ต้องเป็นตัวเลข`
    if (n < f.min || n > f.max) return `${f.label} ต้องอยู่ระหว่าง ${f.min}–${f.max}`
  }
  return null
}

// ---- แพทเทิร์นรอบ 3 รอบ/วัน (order_pattern · migration 144) ----

export type RoundPatternKey = 'morning' | 'midday' | 'evening'
export const ROUND_PATTERN_KEYS: RoundPatternKey[] = ['morning', 'midday', 'evening']

export interface RoundPatternRow {
  round_key: RoundPatternKey
  display_name: string
  cutoff_time: string // HH:mm
  delivery_start: string // HH:mm
  delivery_end: string // HH:mm
  max_capacity: number
}

export const ROUND_PATTERN_DEFAULTS: RoundPatternRow[] = [
  { round_key: 'morning', display_name: 'เช้า', cutoff_time: '08:00', delivery_start: '06:00', delivery_end: '09:00', max_capacity: 60 },
  { round_key: 'midday', display_name: 'เที่ยง', cutoff_time: '10:30', delivery_start: '11:00', delivery_end: '14:00', max_capacity: 80 },
  { round_key: 'evening', display_name: 'เย็น', cutoff_time: '16:00', delivery_start: '17:00', delivery_end: '20:00', max_capacity: 100 },
]

const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/

export function validateRoundPatternRow(row: RoundPatternRow): string | null {
  if (!String(row.display_name ?? '').trim()) return 'ต้องมีชื่อรอบ (display_name)'
  if (!TIME_RE.test(String(row.cutoff_time ?? ''))) return 'เวลาปิดรับ (cutoff_time) ไม่ถูกต้อง'
  if (!TIME_RE.test(String(row.delivery_start ?? ''))) return 'เวลาเริ่มส่ง (delivery_start) ไม่ถูกต้อง'
  if (!TIME_RE.test(String(row.delivery_end ?? ''))) return 'เวลาสิ้นสุดส่ง (delivery_end) ไม่ถูกต้อง'
  const cap = Number(row.max_capacity)
  if (!Number.isFinite(cap) || cap <= 0) return 'max_capacity ต้องมากกว่า 0'
  return null
}

/** raw (order_pattern.rounds) -> ครบ 3 คีย์เสมอ (ขาด = ใช้ default) */
export function normalizeRoundPattern(raw: unknown): RoundPatternRow[] {
  const rows = Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : []
  return ROUND_PATTERN_KEYS.map((key, i) => {
    const found = rows.find((r) => r && r.round_key === key)
    const base = ROUND_PATTERN_DEFAULTS[i]
    if (!found) return { ...base }
    return {
      round_key: key,
      display_name: String(found.display_name ?? base.display_name),
      cutoff_time: String(found.cutoff_time ?? base.cutoff_time),
      delivery_start: String(found.delivery_start ?? base.delivery_start),
      delivery_end: String(found.delivery_end ?? base.delivery_end),
      max_capacity: Number.isFinite(Number(found.max_capacity)) ? Number(found.max_capacity) : base.max_capacity,
    }
  })
}