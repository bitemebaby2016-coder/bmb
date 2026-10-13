// ============================================
// Bite Me Baby — M1 split-checkout PLAN + read-only delivery MANIFEST
// (Wave 2D-2 / 2D-4 — pure, non-mutating; no RPC calls here)
// - planSplitCheckout: deterministic child-order payloads grouped by mode;
//   never merges identities/payment/audit/state. Mixed carts allowed ONLY for
//   cash_on_delivery (payment safety policy — other methods single-mode only).
// - buildDeliveryManifest: read-only grouping by ACTUAL scheduled_date +
//   delivery_round_id (never inferred from order_mode); no status changes.
// ============================================
import type { OrderMode } from '@/config/platformConfig'

export type PaymentMethodT = 'promptpay_qr' | 'cash_on_delivery' | 'credit_card'

export interface PlanLine {
  product_id: string
  name?: string
  quantity: number
  line_mode?: OrderMode
  /** optional fulfillment requirements carried by the line (reject on conflict) */
  required_scheduled_date?: string | null
  required_round_id?: string | null
}

export interface SplitContext {
  fallback_mode?: OrderMode // legacy carts without line_mode
  payment_method: PaymentMethodT
  delivery_round_id: string // round chosen at checkout (kept independent of mode)
  scheduled_date?: string | null // PRE_ORDER fulfillment date
}

export interface ChildOrderPlan {
  order_mode: OrderMode
  lines: PlanLine[]
  delivery_round_id: string
  scheduled_date: string | null
  payment_method: PaymentMethodT
}

export interface SplitError { code: string; detail?: string }

export interface SplitPlanResult {
  ok: boolean
  children: ChildOrderPlan[]
  errors: SplitError[]
}

const MODE_ORDER: OrderMode[] = ['SAME_DAY', 'PRE_ORDER']

/** Deterministic split plan — same input ⇒ same output (sorted, no guessing). */
export function planSplitCheckout(lines: PlanLine[], ctx: SplitContext): SplitPlanResult {
  const errors: SplitError[] = []
  if (!ctx.delivery_round_id) errors.push({ code: 'ERR_MISSING_ROUND' })
  if (!ctx.payment_method) errors.push({ code: 'ERR_MISSING_PAYMENT_METHOD' })

  const grouped = new Map<OrderMode, PlanLine[]>()
  for (const ln of lines) {
    const mode = ln.line_mode ?? ctx.fallback_mode
    if (!mode || (mode !== 'SAME_DAY' && mode !== 'PRE_ORDER')) {
      errors.push({ code: 'ERR_AMBIGUOUS_LINE', detail: ln.product_id })
      continue
    }
    // Round/date conflicts are REJECTED, never guessed.
    if (ln.required_round_id && ctx.delivery_round_id && ln.required_round_id !== ctx.delivery_round_id) {
      errors.push({ code: 'ERR_ROUND_CONFLICT', detail: ln.product_id })
      continue
    }
    if (ln.required_scheduled_date && ctx.scheduled_date && ln.required_scheduled_date !== ctx.scheduled_date) {
      errors.push({ code: 'ERR_DATE_CONFLICT', detail: ln.product_id })
      continue
    }
    if (mode === 'PRE_ORDER' && ln.required_scheduled_date && !ctx.scheduled_date) {
      errors.push({ code: 'ERR_DATE_CONFLICT', detail: ln.product_id })
      continue
    }
    grouped.set(mode, [...(grouped.get(mode) ?? []), ln])
  }

  const isMixed = grouped.size > 1
  // Payment safety: mixed carts must not run through an unverified payment path.
  if (isMixed && ctx.payment_method !== 'cash_on_delivery') {
    errors.push({ code: 'MIXED_PAYMENT_UNSUPPORTED', detail: `mixed cart supports cash_on_delivery only (got ${ctx.payment_method})` })
  }
  if (grouped.has('PRE_ORDER') && !ctx.scheduled_date) {
    errors.push({ code: 'ERR_MISSING_SCHEDULED_DATE' })
  }

  const children: ChildOrderPlan[] = errors.length > 0
    ? [] // nothing submittable while any error stands (no partial/guessed plan)
    : MODE_ORDER.filter((m) => grouped.has(m)).map((m) => ({
        order_mode: m,
        lines: grouped.get(m)!,
        delivery_round_id: ctx.delivery_round_id,
        scheduled_date: m === 'PRE_ORDER' ? (ctx.scheduled_date ?? null) : null,
        payment_method: ctx.payment_method,
      }))

  return { ok: errors.length === 0 && children.length > 0, children, errors }
}

// ---------- 2D-4: read-only delivery manifest ----------

export interface ManifestOrder {
  order_number: string
  scheduled_date: string | null
  delivery_round_id: string | null
  order_mode: OrderMode
  payment_method: string
}

export interface ManifestGroup {
  scheduled_date: string | null
  delivery_round_id: string | null
  orders: ManifestOrder[]
}

/**
 * Groups orders by their ACTUAL (scheduled_date, delivery_round_id) — never
 * inferred from order_mode. Order identities stay separate (no merge); rows
 * with missing date/round land in an `unassigned` bucket. Read-only: changes
 * nothing, dispatches nothing.
 */
export function buildDeliveryManifest(orders: ManifestOrder[]): ManifestGroup[] {
  const buckets = new Map<string, ManifestGroup>()
  for (const o of orders) {
    const key = `${o.scheduled_date ?? '∅'}|${o.delivery_round_id ?? '∅'}`
    const g = buckets.get(key) ?? { scheduled_date: o.scheduled_date, delivery_round_id: o.delivery_round_id, orders: [] }
    g.orders.push(o)
    buckets.set(key, g)
  }
  const groups = [...buckets.values()]
  groups.forEach((g) => g.orders.sort((a, b) => a.order_number.localeCompare(b.order_number)))
  groups.sort((a, b) =>
    `${a.scheduled_date ?? '∅'}|${a.delivery_round_id ?? '∅'}`.localeCompare(`${b.scheduled_date ?? '∅'}|${b.delivery_round_id ?? '∅'}`))
  return groups
}