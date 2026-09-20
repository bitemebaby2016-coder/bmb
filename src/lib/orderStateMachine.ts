// ============================================
// Bite Me Baby — Three-Party Order Status State Machine
// ============================================
// Deterministic state transitions locked by literal types (no free typing).
// Two chains:
//   Same-Day : Created -> Accepted -> Preparing -> Ready for Pickup
//              -> Dispatched -> Delivered
//   Pre-Order: Booked -> Allocated -> Batch Production -> Ready for Pickup
//              -> Dispatched -> Delivered
// A single shared terminal "Delivered" unifies both chains for the customer
// timeline while production/distribution semantics stay distinct.

import type { OrderMode } from '@/config/platformConfig'

export type SameDayStatus =
  | 'Created'
  | 'Accepted'
  | 'Preparing'
  | 'Ready for Pickup'
  | 'Dispatched'
  | 'Delivered'

export type PreOrderStatus =
  | 'Booked'
  | 'Allocated'
  | 'Batch Production'
  | 'Ready for Pickup'
  | 'Dispatched'
  | 'Delivered'

export type OrderPhaseStatus = SameDayStatus | PreOrderStatus
export type OrderFlowStatus = OrderPhaseStatus | 'Cancelled' | 'Failed'

export const SAME_DAY_CHAIN: readonly SameDayStatus[] = [
  'Created',
  'Accepted',
  'Preparing',
  'Ready for Pickup',
  'Dispatched',
  'Delivered',
]

export const PRE_ORDER_CHAIN: readonly PreOrderStatus[] = [
  'Booked',
  'Allocated',
  'Batch Production',
  'Ready for Pickup',
  'Dispatched',
  'Delivered',
]

/** Build a forward-only map: current -> allowed next states (no skips/backward). */
function buildTransitions<T extends string>(chain: readonly T[]): Record<T, readonly T[]> {
  const map = {} as Record<T, readonly T[]>
  chain.forEach((state, i) => {
    map[state] = i < chain.length - 1 ? [chain[i + 1]] : []
  })
  return map
}

// Cancelled is allowed from any non-terminal; Failed only from Dispatched.
const SAME_DAY_TRANSITIONS = buildTransitions(SAME_DAY_CHAIN)
const PRE_ORDER_TRANSITIONS = buildTransitions(PRE_ORDER_CHAIN)

/**
 * Validate a single transition. Returns `{ ok, reason, next }`.
 * Violates: skipping, backward movement, unknown states, wrong-chain reuse.
 */
export function canTransition(
  mode: OrderMode,
  current: OrderFlowStatus,
  target: OrderFlowStatus,
): { ok: boolean; reason: string; next: OrderFlowStatus | null } {
  if (current === 'Delivered') return { ok: false, reason: 'TERMINAL', next: null }
  if (current === 'Cancelled' || current === 'Failed') return { ok: false, reason: 'TERMINAL_ABORT', next: null }

  // Admin aborts
  if (target === 'Cancelled') return { ok: true, reason: 'ADMIN_CANCEL', next: 'Cancelled' }
  if (target === 'Failed' && current === 'Dispatched') return { ok: true, reason: 'DELIVERY_FAILURE', next: 'Failed' }
  if (target === 'Failed') return { ok: false, reason: 'FAIL_ONLY_FROM_DISPATCHED', next: null }

  const chain = mode === 'SAME_DAY' ? SAME_DAY_CHAIN : PRE_ORDER_CHAIN

  // Ensure both states belong to the same chain.
  if (!(chain as readonly string[]).includes(current)) {
    return { ok: false, reason: `STATE_NOT_IN_${mode}_CHAIN`, next: null }
  }
  if (!(chain as readonly string[]).includes(target)) {
    return { ok: false, reason: `TARGET_NOT_IN_${mode}_CHAIN`, next: null }
  }

  const table = (mode === 'SAME_DAY' ? SAME_DAY_TRANSITIONS : PRE_ORDER_TRANSITIONS) as Record<
    string,
    readonly OrderFlowStatus[]
  >
  const allowed = table[current] ?? []
  if (allowed.includes(target)) {
    return { ok: true, reason: 'OK', next: target }
  }
  return { ok: false, reason: 'ILLEGAL_TRANSITION', next: null }
}

/** Alias used by consumers that treat the result as a boolean guard. */
export function transitionIsAllowed(
  mode: OrderMode,
  current: OrderFlowStatus,
  target: OrderFlowStatus,
): boolean {
  return canTransition(mode, current, target).ok
}

/** Initial status for a given order mode. */
export function initialStatus(mode: OrderMode): OrderFlowStatus {
  return mode === 'SAME_DAY' ? 'Created' : 'Booked'
}
