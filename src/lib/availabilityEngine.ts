// ============================================
// Bite Me Baby — Truth Table Validation Engine (Availability)
// ============================================
// Pure function per the Master Blueprint:
//   IsAvailable = (CurrentOrders < daily_quota)
//                 && (TargetDeliveryTime - CurrentTime >= cutoff_hours)
// daily_quota and cutoff_hours derive from the active platform config, so this
// function is intentionally pure (no imports) for deterministic unit testing.

export type AvailabilityReason = 'available' | 'quota_full' | 'cutoff_passed' | 'unknown'

export interface AvailabilityInput {
  currentOrders: number
  dailyQuota: number
  /** ISO timestamp of the target delivery slot. */
  targetDeliveryTime: string
  /** ISO timestamp of "now". Defaults to the real clock. */
  currentTime?: string
  /** Minimum lead time (hours) before the target slot. */
  cutoffHours: number
}

export interface AvailabilityResult {
  isAvailable: boolean
  reason: AvailabilityReason
  /** Hours remaining until the cutoff (negative = passed). */
  hoursRemaining: number
}

/** Parse an ISO timestamp into ms, clamping NaN to the real clock. */
function toTime(iso: string): number {
  const ms = new Date(iso).getTime()
  return Number.isNaN(ms) ? Date.now() : ms
}

/**
 * Compute purchase availability from the Truth Table.
 *   quota check   — current order count must not reach the daily ceiling.
 *   cutoff check  — target delivery must be at least `cutoffHours` ahead of now.
 */
export function isOrderAvailable(input: AvailabilityInput): AvailabilityResult {
  const nowMs = toTime(input.currentTime ?? new Date().toISOString())
  const targetMs = toTime(input.targetDeliveryTime)
  const hoursRemaining = (targetMs - nowMs) / 3_600_000

  const quotaOk = input.currentOrders < Math.max(0, input.dailyQuota)
  const cutoffOk = hoursRemaining >= input.cutoffHours

  if (!quotaOk) {
    return { isAvailable: false, reason: 'quota_full', hoursRemaining }
  }
  if (!cutoffOk) {
    return { isAvailable: false, reason: 'cutoff_passed', hoursRemaining }
  }
  return { isAvailable: true, reason: 'available', hoursRemaining }
}

/**
 * Convenience wrapper for the engine's `TargetDeliveryTime` semantics:
 * converts a target Date plus cutoff into the same result.
 */
export function isSlotAvailable(
  currentOrders: number,
  dailyQuota: number,
  targetDeliveryTime: string,
  cutoffHours: number,
  currentTime?: string,
): boolean {
  return isOrderAvailable({ currentOrders, dailyQuota, targetDeliveryTime, cutoffHours, currentTime }).isAvailable
}

/**
 * True when the quota is nearly full (a hint for the Bite AI micro-hook warnings),
 * but not yet closed. e.g. remaining <= 10% of quota.
 */
export function isNearQuota(currentOrders: number, dailyQuota: number, warnRatio = 0.9): boolean {
  if (dailyQuota <= 0) return false
  return currentOrders / dailyQuota >= warnRatio
}
