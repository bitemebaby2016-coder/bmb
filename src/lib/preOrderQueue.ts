// ============================================
// Bite Me Baby — PRE_ORDER queue helpers (STEP 3B-2B)
// ============================================
// PURE grouping/display layer for the Admin pre-order queue on the canonical
// order spine. NO authority lives here:
//   - grouping = display of orders.order_mode='PRE_ORDER' grouped by
//     (scheduled_date, delivery_round_id) — the canonical spine columns.
//   - capacity/cutoff values are DISPLAYED from `delivery_rounds` (DB source of
//     truth). Enforcement stays server-side: migration 025 (cutoff authority,
//     atomic capacity lock) + 038 (2h pre-order cutoff + cancel window).
//     The client NEVER computes or bypasses cutoff/capacity rules.
//   - actions reuse the 3B-2A canonical buttons (transition_order_status /
//     cancel_order) — no new transitions.

import type { OrderForm } from '@/lib/bmbAdminApi_orders'

export interface RoundLite {
  id: string
  round_key?: string | null
  display_name?: string | null
  cutoff_time?: string | null
  delivery_start?: string | null
  delivery_end?: string | null
  max_capacity?: number | null
  current_count?: number | null
  scheduled_date?: string | null
  status?: string | null
}

export interface PreOrderQueueGroup {
  key: string
  scheduledDate: string
  roundId: string
  round: RoundLite | null
  orders: OrderForm[]
}

/** Group PRE_ORDER orders by (scheduled_date, delivery_round_id), date desc. */
export function groupPreOrders(orders: OrderForm[]): PreOrderQueueGroup[] {
  const map = new Map<string, PreOrderQueueGroup>()
  for (const o of orders) {
    const date = o.scheduled_date || '—'
    const round = o.delivery_round_id || '—'
    const key = `${date}|${round}`
    let g = map.get(key)
    if (!g) {
      g = { key, scheduledDate: date, roundId: round, round: null, orders: [] }
      map.set(key, g)
    }
    g.orders.push(o)
  }
  return Array.from(map.values()).sort((a, b) =>
    a.scheduledDate === b.scheduledDate
      ? a.roundId.localeCompare(b.roundId)
      : b.scheduledDate.localeCompare(a.scheduledDate),
  )
}

export interface CapacityState {
  used: number | null
  max: number | null
  remaining: number | null
  label: string
  cls: string
  /** display-only fullness flag — the SERVER enforces capacity (ERR_CAPACITY_FULL). */
  full: boolean
}

/** Capacity display from the DB row (delivery_rounds). No client authority. */
export function roundCapacityState(round: RoundLite | null, orderCount: number): CapacityState {
  if (!round || round.max_capacity == null) {
    return { used: null, max: null, remaining: null, label: `⚠ round? (${orderCount})`, cls: 'badge-danger', full: false }
  }
  const max = Number(round.max_capacity)
  const used = round.current_count != null ? Number(round.current_count) : orderCount
  const remaining = Math.max(0, max - used)
  const full = remaining <= 0
  return {
    used, max, remaining,
    label: full ? `🔴 FULL ${used}/${max}` : `🟢 ${used}/${max} slots`,
    cls: full ? 'badge-danger' : 'badge-success',
    full,
  }
}

export interface CutoffState {
  label: string
  /** true when the round row has no cutoff/delivery_start — server rejects with ERR_PRE_ORDER_CUTOFF_UNKNOWN */
  unknown: boolean
}

/** Cutoff/delivery window DISPLAY from raw DB values — never recomputed/derived client-side. */
export function roundCutoffState(round: RoundLite | null): CutoffState {
  if (!round || (!round.cutoff_time && !round.delivery_start)) {
    return { label: '⚠ cutoff unknown', unknown: true }
  }
  const parts: string[] = []
  if (round.cutoff_time) parts.push(`cutoff ${String(round.cutoff_time).slice(0, 5)}`)
  if (round.delivery_start) parts.push(`delivery ${String(round.delivery_start).slice(0, 5)}${round.delivery_end ? `–${String(round.delivery_end).slice(0, 5)}` : ''}`)
  return { label: parts.join(' · '), unknown: false }
}

/** Payment states that need operator attention on the queue (display classification). */
export function isPaymentException(paymentStatus?: string | null): boolean {
  return paymentStatus != null && ['pending', 'processing', 'failed', 'refund', 'partially_refunded', 'refunded'].includes(paymentStatus)
}

/** Queue status chips a row can carry — mirror of the canonical status vocabulary. */
export function queueStatusChip(status?: string | null): string {
  return status || 'unknown'
}
