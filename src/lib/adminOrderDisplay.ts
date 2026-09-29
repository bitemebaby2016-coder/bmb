// ============================================
// Bite Me Baby — Admin Orders display helpers (STEP 3B-2A)
// ============================================
// PURE display layer for Admin Orders. NO business authority lives here:
//   - the server (migration 008/030 order_transition_allowed + transition_order_status
//     RPC) remains the SOLE transition authority — this module only mirrors the
//     canonical allow-list to decide which action buttons to RENDER.
//   - any off-allow-list attempt is still rejected server-side (RPC + guard
//     trigger), so a stale mirror can never widen authority.
//   - payment/delivery labels are display-only; payment state is written ONLY by
//     the canonical payment paths (record_payment_result / confirm_offline_payment /
//     stripe-refund EF).

// ---------------------------------------------------------------------------
// 1. Canonical admin transition allow-list — MIRROR of migration 008 §C.1 (+030)
// ---------------------------------------------------------------------------
export const ADMIN_ALLOWED_TRANSITIONS: Record<string, readonly string[]> = {
  pending: ['confirmed', 'cancelled', 'failed'],
  confirmed: ['preparing', 'cancelled', 'failed'],
  preparing: ['ready_for_dispatch', 'cancelled', 'failed'],
  ready_for_dispatch: ['dispatched', 'cancelled', 'failed'],
  dispatched: ['in_transit', 'cancelled', 'failed'],
  in_transit: ['arrived', 'cancelled', 'failed'],
  arrived: ['delivered', 'cancelled', 'failed'],
  delivered: [],
  cancelled: [],
  failed: [],
}

/** True when the canonical state machine (008) allows admin from→to. */
export function canAdminTransition(from: string, to: string): boolean {
  return (ADMIN_ALLOWED_TRANSITIONS[from] ?? []).includes(to)
}

/** Canonical next-step action button for the current status (first allowed forward hop). */
export function nextForwardAction(status: string): { to: string; label: string } | null {
  const FORWARD: Record<string, { to: string; label: string }> = {
    pending: { to: 'confirmed', label: '✅ Confirm' },
    confirmed: { to: 'preparing', label: '🍳 Start cooking' },
    preparing: { to: 'ready_for_dispatch', label: '📦 Ready to dispatch' },
    ready_for_dispatch: { to: 'dispatched', label: '🚚 Dispatch' },
    dispatched: { to: 'in_transit', label: '🛵 Mark in transit' },
    in_transit: { to: 'arrived', label: '📍 Mark arrived' },
    arrived: { to: 'delivered', label: '🏁 Mark delivered' },
  }
  const a = FORWARD[status]
  return a && canAdminTransition(status, a.to) ? a : null
}

/** Admin cancellation is canonical for ANY non-terminal state (008 allow-list). */
export function isCancellable(status: string): boolean {
  return canAdminTransition(status, 'cancelled')
}

// ---------------------------------------------------------------------------
// 2. Order mode (SAME_DAY / PRE_ORDER) — Phase D: display only (queue = 3B-2B)
// ---------------------------------------------------------------------------
export interface OrderModeBadge {
  mode: 'SAME_DAY' | 'PRE_ORDER' | 'UNKNOWN'
  label: string
  scheduledDate: string | null
}

export function orderModeBadge(mode?: string | null, scheduledDate?: string | null): OrderModeBadge {
  if (mode === 'PRE_ORDER') {
    return { mode: 'PRE_ORDER', label: `📅 PRE_ORDER${scheduledDate ? ` · ${scheduledDate}` : ''}`, scheduledDate: scheduledDate ?? null }
  }
  if (mode === 'SAME_DAY') {
    return { mode: 'SAME_DAY', label: '⚡ SAME_DAY', scheduledDate: null }
  }
  return { mode: 'UNKNOWN', label: '⚠ mode?', scheduledDate: scheduledDate ?? null }
}


// ---------------------------------------------------------------------------
// 3. Payment states — display of the canonical payment vocabulary
// ---------------------------------------------------------------------------
export const PAYMENT_STATES = ['pending', 'processing', 'paid', 'failed', 'partially_refunded', 'refunded'] as const

export const PAYMENT_STATE_BADGES: Record<string, { label: string; cls: string }> = {
  pending: { label: '⏳ pending', cls: 'badge-warning' },
  processing: { label: '🔄 processing', cls: 'badge-info' },
  paid: { label: '✅ paid', cls: 'badge-success' },
  failed: { label: '❌ failed', cls: 'badge-danger' },
  partially_refunded: { label: '↩️ partially_refunded', cls: 'badge-warning' },
  refunded: { label: '↩️ refunded', cls: 'badge-danger' },
}

export function paymentStateBadge(paymentStatus?: string | null): { label: string; cls: string } {
  if (!paymentStatus) return { label: '⚠ no payment', cls: 'badge-danger' }
  return PAYMENT_STATE_BADGES[paymentStatus] ?? { label: paymentStatus, cls: 'badge-primary' }
}

// ---------------------------------------------------------------------------
// 4. Delivery/assignment states — display of delivery_assignments lifecycle (020)
// ---------------------------------------------------------------------------
export const DELIVERY_STATES = ['unassigned', 'assigned', 'accepted', 'picked_up', 'in_transit', 'delivered', 'exception'] as const
export type DeliveryState = (typeof DELIVERY_STATES)[number]

export const DELIVERY_STATE_BADGES: Record<DeliveryState, { label: string; cls: string }> = {
  unassigned: { label: '📭 unassigned', cls: 'badge-primary' },
  assigned: { label: '👤 assigned', cls: 'badge-info' },
  accepted: { label: '🙋 accepted', cls: 'badge-info' },
  picked_up: { label: '📦 picked up', cls: 'badge-info' },
  in_transit: { label: '🛵 in transit', cls: 'badge-info' },
  delivered: { label: '🏁 delivered', cls: 'badge-success' },
  exception: { label: '⚠ exception', cls: 'badge-danger' },
}

export interface DeliveryAssignmentLite {
  status?: string | null
  driver_id?: string | null
}

/**
 * Resolve the delivery state shown on the order card:
 *  - no assignment row             → 'unassigned'
 *  - assignment status 'cancelled' → 'exception' (admin follow-up required)
 *  - otherwise pass the canonical assignment status through
 */
export function deliveryStateBadge(assignment?: DeliveryAssignmentLite | null): { label: string; cls: string } {
  const raw = assignment?.status
  let state: DeliveryState
  if (!raw) state = 'unassigned'
  else if (raw === 'cancelled') state = 'exception'
  else if ((DELIVERY_STATES as readonly string[]).includes(raw)) state = raw as DeliveryState
  else state = 'exception'
  return DELIVERY_STATE_BADGES[state]
}
