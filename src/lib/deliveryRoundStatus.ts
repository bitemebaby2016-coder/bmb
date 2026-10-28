// ============================================
// Bite Me Baby — Delivery round bookability (client DISPLAY mirror)
// ============================================
// WHY (Owner 2026-10-17 "รอบส่งมั่ว"): checkout listed every `status='active'`
// round as selectable — even rounds whose cutoff / delivery window had already
// passed (e.g. 21:32 น. ยังเลือก "เที่ยง สั่งได้ถึง 10:30" ได้). The SERVER
// (create_order_with_items, migration 025/118) remains the only authority —
// this module only decides how the picker should DISPLAY each round:
//   open           → selectable
//   cutoff_passed  → disabled "ปิดรับแล้ว"   (mirrors ERR_CUTOFF_PASSED)
//   window_passed  → disabled "หมดเวลาจัดส่งแล้ว" (PRE_ORDER only — Owner Q1 2026-10-24
//                    "(ข) เอาออก = สั่งได้ทุกเวลาในวันนั้น": SAME_DAY เหลือแค่ full/closed)
//   full           → disabled "เต็มแล้ว"      (mirrors ERR_ROUND_FULL)
// Pure (no imports except bangkokTime) — deterministic tests via nowUtcMs.
// ============================================

import { bangkokMsOfDay } from './bangkokTime'
import { withinShopHours } from './shopHoursLogic'

export type RoundBookability = 'open' | 'cutoff_passed' | 'window_passed' | 'full' | 'shop_closed'

export interface RoundTimeInfo {
  cutoff_time?: string | null
  /** 145: ปิดรอบพรีออเดอร์ตั้งตรง — ไม่มีค่า = กฎเดิม delivery_start − cutoff_hours */
  pre_order_cutoff?: string | null
  delivery_start?: string | null
  delivery_end?: string | null
  current_count?: number | string | null
  max_capacity?: number | string | null
  /** SYNC (Owner 2026-10-26): round_key ของแถว = คีย์เปิด/ปิดใน operating_hours (morning/midday/evening) */
  round_key?: string | null
}

export interface RoundBookabilityOpts {
  isToday: boolean
  nowUtcMs?: number
  /** PRE_ORDER = ปิดรอบ cutoff_hours ชม. ก่อน delivery_start (Owner Q1 / migration 143)
   *  SAME_DAY (default) = cutoff_time ของรอบ (เดิม — เซมเดย์ส่งได้ตลอดเหมือนเดิม) */
  mode?: 'SAME_DAY' | 'PRE_ORDER'
  /** ค่า order_policy.cutoff_hours (default 2) */
  preOrderCutoffHours?: number
  /** SYNC (Owner 2026-10-26 "ปิด 20:00 แต่ยังสั่งได้"): business_settings.hours เป็น ms-of-day
   *  null/ไม่ส่ง = ไม่มีข้อมูล → ห้ามเดาปิด (ZERO-FAKE · server ยังตัดสินซ้ำตอนสั่งจริง) */
  shopHoursMs?: { openMs: number; closeMs: number } | null
  /** SYNC: business_settings.operating_hours (same_day_open/pre_order_open/morning_open/…) */
  operatingHours?: Record<string, boolean | undefined> | null
}

/** 'HH:mm' or 'HH:mm:ss' → ms-of-day, or null when absent/invalid.
 *  NOTE: `Number('')` is 0 — empty/blank must be rejected BEFORE Number() or a
 *  missing time would read as 00:00 and wrongly close every round. */
function msOfDay(value: string | null | undefined): number | null {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const parts = raw.split(':')
  const h = Number(parts[0])
  const m = Number(parts[1] ?? 0)
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) return null
  return h * 3_600_000 + m * 60_000
}

/**
 * ms-of-day cutoff for the round in the given mode:
 *   PRE_ORDER → pre_order_cutoff ของรอบ ถ้าตั้งไว้ ไม่งั้น delivery_start − preOrderCutoffHours
 *     (อาจติดลบ = ปิดรอบอยู่ "ก่อนเที่ยงคืนของวันก่อนวันส่ง" — ผ่านเฉพาะการสั่งล่วงหน้า)
 *   SAME_DAY  → **ไม่มีปิดรอบ** (Owner 2026-10-24 / migration 148: เปิดร้านถึงปิดร้าน)
 *     → คืน null เสมอ = ไม่มีทางเข้าสู่สถานะ cutoff_passed
 */
export function roundCutoffMs(
  round: RoundTimeInfo,
  mode: 'SAME_DAY' | 'PRE_ORDER' = 'SAME_DAY',
  preOrderCutoffHours = 2,
): number | null {
  if (mode === 'PRE_ORDER') {
    const override = msOfDay(round.pre_order_cutoff)
    if (override !== null) return override
    const startMs = msOfDay(round.delivery_start)
    const hours = Number.isFinite(preOrderCutoffHours) && preOrderCutoffHours >= 0 ? preOrderCutoffHours : 2
    if (startMs !== null) return startMs - hours * 3_600_000
    return null
  }
  // 148: SAME_DAY = ไม่มีปิดรอบ (เดิม: same_day_cutoff ?? cutoff_time — ถูกรื้อตามคำสั่ง Owner)
  return null
}

/** ป้ายเวลาปิดรอบสำหรับโชว์ใน UI ('HH:MM' / "ไม่มีปิดรอบ" / ข้อความเมื่อคำนวณไม่ได้) */
export function roundCutoffLabel(
  round: RoundTimeInfo,
  mode: 'SAME_DAY' | 'PRE_ORDER' = 'SAME_DAY',
  preOrderCutoffHours = 2,
): string {
  const ms = roundCutoffMs(round, mode, preOrderCutoffHours)
  if (ms === null) {
    if (mode === 'SAME_DAY') return 'ไม่มีปิดรอบ'
    return `${preOrderCutoffHours} ชม. ก่อนเวลาส่ง`
  }
  if (ms < 0) return `${preOrderCutoffHours} ชม. ก่อนเวลาส่ง`
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Client display mirror of the server's round gates.
 * - `isToday` = the round's scheduled date is the SAME day (same-day rounds or
 *   a pre-order date of "today"); future dates are always window-open.
 * - Unknown/invalid times never block (server re-decides at order time).
 */
export function roundBookability(
  round: RoundTimeInfo,
  opts: RoundBookabilityOpts,
): RoundBookability {
  const nowUtcMs = opts.nowUtcMs ?? Date.now()

  // Capacity first: a full round is unusable regardless of time.
  const cap = Number(round.max_capacity)
  const used = Number(round.current_count)
  if (Number.isFinite(cap) && Number.isFinite(used) && cap > 0 && used >= cap) return 'full'

  // ---- SYNC กับค่าแอดมิน (Owner 2026-10-26 "ทุกฟีเจอร์ที่แอดมินตั้งได้ต้องซิงค์จริง") ----
  const mode = opts.mode ?? 'SAME_DAY'
  const oh = opts.operatingHours
  if (oh) {
    if (mode !== 'PRE_ORDER' && oh.same_day_open === false) return 'shop_closed'
    if (mode === 'PRE_ORDER' && oh.pre_order_open === false) return 'shop_closed'
    const rk = String(round.round_key ?? '').trim()
    if (rk && oh[`${rk}_open`] === false) return 'shop_closed'
  }
  // business_settings.hours (open..close) — เซมเดย์นอกเวลาเปิดร้าน = ปิด (mirror server ที่จะเพิ่ม)
  if (mode !== 'PRE_ORDER' && opts.isToday && opts.shopHoursMs) {
    const nowMs0 = bangkokMsOfDay(opts.nowUtcMs ?? Date.now())
    if (!withinShopHours(nowMs0, opts.shopHoursMs)) return 'shop_closed'
  }

  if (opts.isToday) {
    // Server authority (143): SAME_DAY = cutoff_time / PRE_ORDER = delivery_start − cutoff_hours
    // (identical semantics to isBangkokCutoffPassed — seconds truncated to :00).
    const cutoffMs = roundCutoffMs(round, opts.mode, opts.preOrderCutoffHours ?? 2)
    const nowMs = bangkokMsOfDay(nowUtcMs)
    if (cutoffMs !== null && nowMs !== null && nowMs > cutoffMs) return 'cutoff_passed'
    // Q1 (Owner 2026-10-24 "(ข) เอาออก = สั่งได้ทุกเวลาในวันนั้น"): เซมเดย์ไม่มี
    // time-gate เลย — เหลือแค่ full (ความจุ) + สถานะรอบ (closed ปิดโดยแอดมิน) ·
    // หน้าต่างส่ง (delivery_end) ยังปิดเฉพาะ PRE_ORDER (พรีออเดอร์วันนี้)
    if (opts.mode === 'PRE_ORDER') {
      const endMs = msOfDay(round.delivery_end)
      if (endMs !== null && nowMs !== null && nowMs > endMs) return 'window_passed'
    }
  }

  return 'open'
}

/** Human label for the picker row. */
export function roundStatusLabel(status: RoundBookability): string {
  switch (status) {
    case 'cutoff_passed': return 'ปิดรับแล้ว'
    case 'window_passed': return 'หมดเวลาจัดส่งแล้ว'
    case 'full': return 'เต็มแล้ว'
    case 'shop_closed': return 'ปิดในการตั้งค่าร้าน'
    default: return 'เปิดรับ'
  }
}
