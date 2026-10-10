// ============================================
// Bite Me Baby — Asia/Bangkok (UTC+7, no DST) deterministic time helpers
// ============================================
// WHY (P0-1 defect, 2026-10-10): the SAME_DAY cutoff gate in CheckoutPage
// derived "Bangkok now" with `(ictOffset - getTimezoneOffset()) * 60000` —
// but `getTimezoneOffset()` is NEGATIVE east of UTC (UTC+7 → -420), so on
// Thai browsers the +7h was applied TWICE (+14h). Result: the gate was
// inverted for real customers (blocked BEFORE cutoff, allowed AFTER it).
//
// Server authority is unchanged and remains the only real enforcement:
// `create_order_with_items` (migrations 025/118) raises ERR_CUTOFF_PASSED
// comparing `v_now time := (now() AT TIME ZONE 'Asia/Bangkok')::time` with
// the round cutoff using strict `>` (exactly at the cutoff second = allowed).
// This module mirrors that rule for the CLIENT-SIDE pre-check only, using
// UTC getters on an epoch-ms input → the result is identical in every
// browser timezone (ICT / UTC / UTC-5 / anything else).
// Pure (no imports) — deterministic unit tests, same convention as
// availabilityEngine.ts.
// ============================================

/** Bangkok is UTC+7 year-round (Thailand has no DST). */
export const BANGKOK_UTC_OFFSET_MINUTES = 7 * 60

/**
 * Bangkok wall-clock milliseconds-of-day for a UTC instant.
 * Uses ONLY getUTC* getters — never local-time APIs — so the value does not
 * depend on the runtime/browser timezone. Returns null for non-finite input.
 */
export function bangkokMsOfDay(utcMs: number): number | null {
  if (!Number.isFinite(utcMs)) return null
  const bkk = new Date(utcMs + BANGKOK_UTC_OFFSET_MINUTES * 60_000)
  return (
    bkk.getUTCHours() * 3_600_000 +
    bkk.getUTCMinutes() * 60_000 +
    bkk.getUTCSeconds() * 1_000 +
    bkk.getUTCMilliseconds()
  )
}

/**
 * SAME_DAY round cutoff gate — client mirror of the server rule in
 * create_order_with_items (migrations 025/118, Bangkok time):
 *   IF v_now > v_round_cutoff THEN RAISE EXCEPTION 'ERR_CUTOFF_PASSED'
 * Strictly-greater comparison: exactly AT the cutoff second is still allowed.
 * Accepts 'HH:mm' or 'HH:mm:ss' (seconds are truncated to :00, matching the
 * previous client behaviour). Invalid / non-numeric cutoff → false (never
 * blocks), matching the previous NaN-comparison behaviour.
 */
export function isBangkokCutoffPassed(cutoffTime: string, nowUtcMs: number = Date.now()): boolean {
  const parts = String(cutoffTime || '08:00').split(':')
  const cutoffH = Number(parts[0])
  const cutoffM = Number(parts[1] ?? 0)
  if (!Number.isFinite(cutoffH) || !Number.isFinite(cutoffM)) return false
  const nowMsOfDay = bangkokMsOfDay(nowUtcMs)
  if (nowMsOfDay === null) return false
  return nowMsOfDay > cutoffH * 3_600_000 + cutoffM * 60_000
}
