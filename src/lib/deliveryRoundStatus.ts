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
 * Client display mirror of the server's round gates.
 * - `isToday` = the round's scheduled date is the SAME day (same-day rounds or
 *   a pre-order date of "today"); future dates are always window-open.
 * - Unknown/invalid times never block (server re-decides at order time).
 */
export function roundBookability(
  round: RoundTimeInfo,
  opts: { isToday: boolean; nowUtcMs?: number },
): RoundBookability {
  const nowUtcMs = opts.nowUtcMs ?? Date.now()

  // Capacity first: a full round is unusable regardless of time.
  const cap = Number(round.max_capacity)
  const used = Number(round.current_count)
  if (Number.isFinite(cap) && Number.isFinite(used) && cap > 0 && used >= cap) return 'full'

  if (opts.isToday) {
    // Server authority (025/118): cutoff compared with strict `>` Bangkok time
    // (identical semantics to isBangkokCutoffPassed — seconds truncated to :00).
    const cutoffMs = msOfDay(round.cutoff_time)
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
