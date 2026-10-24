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
//   window_passed  → disabled "หมดเวลาจัดส่งแล้ว" (same-day window already over)
//   full           → disabled "เต็มแล้ว"      (mirrors ERR_ROUND_FULL)
// Pure (no imports except bangkokTime) — deterministic tests via nowUtcMs.
// ============================================

import { bangkokMsOfDay } from './bangkokTime'

export type RoundBookability = 'open' | 'cutoff_passed' | 'window_passed' | 'full'

export interface RoundTimeInfo {
  cutoff_time?: string | null
  delivery_start?: string | null
  delivery_end?: string | null
  current_count?: number | string | null
  max_capacity?: number | string | null
}

export interface RoundBookabilityOpts {
  isToday: boolean
  nowUtcMs?: number
  /** PRE_ORDER = คัทออฟ cutoff_hours ชม. ก่อน delivery_start (Owner Q1 / migration 143)
   *  SAME_DAY (default) = cutoff_time ของรอบ (เดิม — เซมเดย์ส่งได้ตลอดเหมือนเดิม) */
  mode?: 'SAME_DAY' | 'PRE_ORDER'
  /** ค่า order_policy.cutoff_hours (default 2) */
  preOrderCutoffHours?: number
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
 *   PRE_ORDER → delivery_start − preOrderCutoffHours (อาจติดลบ = คัทออฟอยู่ "ก่อนเที่ยงคืน
 *     ของวันก่อนวันส่ง" — ผ่านเฉพาะการสั่งล่วงหน้า; วันส่งจริงเกินคัทออฟทุกเวลา)
 *   SAME_DAY  → cutoff_time ของรอบ (เดิม)
 */
export function roundCutoffMs(
  round: RoundTimeInfo,
  mode: 'SAME_DAY' | 'PRE_ORDER' = 'SAME_DAY',
  preOrderCutoffHours = 2,
): number | null {
  if (mode === 'PRE_ORDER') {
    const startMs = msOfDay(round.delivery_start)
    const hours = Number.isFinite(preOrderCutoffHours) && preOrderCutoffHours >= 0 ? preOrderCutoffHours : 2
    if (startMs !== null) return startMs - hours * 3_600_000
  }
  return msOfDay(round.cutoff_time)
}

/** ป้ายเวลาคัทออฟสำหรับโชว์ใน UI ('HH:MM' หรือข้อความเมื่อคำนวณไม่ได้/ติดลบ) */
export function roundCutoffLabel(
  round: RoundTimeInfo,
  mode: 'SAME_DAY' | 'PRE_ORDER' = 'SAME_DAY',
  preOrderCutoffHours = 2,
): string {
  const ms = roundCutoffMs(round, mode, preOrderCutoffHours)
  if (ms === null) return mode === 'PRE_ORDER' ? `${preOrderCutoffHours} ชม. ก่อนเวลาส่ง` : String(round.cutoff_time ?? '').slice(0, 5)
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

  if (opts.isToday) {
    // Server authority (143): SAME_DAY = cutoff_time / PRE_ORDER = delivery_start − cutoff_hours
    // (identical semantics to isBangkokCutoffPassed — seconds truncated to :00).
    const cutoffMs = roundCutoffMs(round, opts.mode, opts.preOrderCutoffHours ?? 2)
    const nowMs = bangkokMsOfDay(nowUtcMs)
    if (cutoffMs !== null && nowMs !== null && nowMs > cutoffMs) return 'cutoff_passed'
    // Anomaly guard (all-day template "ส่ง 08:00-20:00 · สั่งได้ถึง 23:59"):
    // when the delivery window itself is over, the round cannot deliver today
    // even if its cutoff is later — show it as closed instead of selectable.
    const endMs = msOfDay(round.delivery_end)
    if (endMs !== null && nowMs !== null && nowMs > endMs) return 'window_passed'
  }

  return 'open'
}

/** Human label for the picker row. */
export function roundStatusLabel(status: RoundBookability): string {
  switch (status) {
    case 'cutoff_passed': return 'ปิดรับแล้ว'
    case 'window_passed': return 'หมดเวลาจัดส่งแล้ว'
    case 'full': return 'เต็มแล้ว'
    default: return 'เปิดรับ'
  }
}
