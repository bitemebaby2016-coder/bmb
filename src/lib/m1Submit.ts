// ============================================
// Bite Me Baby — M1 split-checkout SUBMISSION ENGINE (Wave 3.1 / 2D-3)
// Pure orchestration over an INJECTED createChild (no RPC import here).
//
// Idempotency findings (025:280-297): order_number = random 3-digit suffix,
// UNIQUE on orders — a retried request generates a NEW number ⇒ a NEW order.
// There is NO client-supplied idempotency key ⇒ DB cannot distinguish retry
// from new order. Policy implemented here (provable WITHOUT schema change):
//   • 'failed'   = RPC returned a definite error ⇒ the transaction rolled
//                  back ⇒ NO order exists ⇒ retrying this child is SAFE.
//   • 'ambiguous'= timeout/unknown ⇒ order MAY exist ⇒ NEVER auto-resubmit;
//                  surfaces a pending/reconciliation state instead.
//   • 'created'  = order_number returned ⇒ never resubmitted.
// Optional schema enhancement (NOT approved, NOT applied): stable per-child
// idempotency key column + unique index — see readiness doc §Idempotency.
// UI submit lock (lock.busy) prevents concurrent attempts but is NOT claimed
// as database idempotency.
// ============================================
import type { ChildOrderPlan, PaymentMethodT } from './m1CheckoutPlan'

export type ChildOutcome =
  | { status: 'created'; order_number: string }
  | { status: 'failed'; code?: string }
  | { status: 'ambiguous'; detail?: string }

export interface ChildSubmission {
  child: ChildOrderPlan
  outcome: ChildOutcome | null // null = unattempted
  attempts: number
}

export type SplitSubmitStatus = 'all_created' | 'partial' | 'pending' | 'failed' | 'blocked' | 'conflict'

export interface SplitSubmitResult {
  status: SplitSubmitStatus
  children: ChildSubmission[]
  reason?: string
}

export interface SubmitDeps {
  /** Must reject with a definite error on known server failure, or resolve
      'ambiguous' when the result cannot be determined (timeout etc.). */
  createChild: (child: ChildOrderPlan, attempt: number) => Promise<ChildOutcome>
  /** Shared in-flight lock (prevents double-click / concurrent submit). */
  lock: { busy: boolean }
}

/**
 * Runs (or resumes) a multi-child submission deterministically.
 * - Mixed children require cash_on_delivery — otherwise 'blocked' BEFORE any
 *   createChild call (no RPC is attempted).
 * - Retries only children whose last outcome is 'failed' or unattempted;
 *   'created' and 'ambiguous' children are skipped (duplicate-safe).
 * - Overall 'all_created' only when EVERY child is created — never claims
 *   success on partial results.
 */
export async function submitSplitOrders(
  children: ChildOrderPlan[],
  payment_method: PaymentMethodT,
  deps: SubmitDeps,
  prior?: ChildSubmission[],
): Promise<SplitSubmitResult> {
  if (deps.lock.busy) return { status: 'conflict', children: prior ?? [] }
  deps.lock.busy = true
  try {
    if (children.length > 1 && payment_method !== 'cash_on_delivery') {
      return {
        status: 'blocked',
        children: [],
        reason: `mixed checkout รองรับเงินสดปลายทาง (cash_on_delivery) เท่านั้น — ${payment_method} ใช้กับออเดอร์ผสมไม่ได้`,
      }
    }
    const state: ChildSubmission[] = children.map((child, i) => {
      const prev = prior?.find((p) => p.child.order_mode === child.order_mode && p.child.lines[0]?.product_id === child.lines[0]?.product_id)
      return prev ?? { child, outcome: null, attempts: 0 }
    })
    for (const sub of state) {
      if (sub.outcome && sub.outcome.status !== 'failed') continue // created/ambiguous: never resubmit
      sub.attempts += 1
      sub.outcome = await deps.createChild(sub.child, sub.attempts) // definite error ⇒ 'failed' (safe to retry later)
    }
    const created = state.filter((s) => s.outcome?.status === 'created').length
    const ambiguous = state.filter((s) => s.outcome?.status === 'ambiguous').length
    const status: SplitSubmitStatus =
      created === state.length && state.length > 0 ? 'all_created'
      : created > 0 ? 'partial'
      : ambiguous > 0 ? 'pending'
      : 'failed'
    return { status, children: state }
  } finally {
    deps.lock.busy = false
  }
}

/** Plain-language per-child summary for customer-facing UI (never all-success on partial). */
export function describeSplitResult(r: SplitSubmitResult): string {
  if (r.status === 'blocked') return r.reason ?? 'ไม่สามารถสั่งซื้อแบบผสมด้วยวิธีชำระนี้'
  if (r.status === 'conflict') return 'มีการสั่งซื้อค้างอยู่ — รอสักครู่แล้วตรวจสอบออเดอร์ของคุณ'
  const parts = r.children.map((s) => {
    const m = s.child.order_mode
    if (s.outcome?.status === 'created') return `${m}: สำเร็จ (${s.outcome.order_number})`
    if (s.outcome?.status === 'ambiguous') return `${m}: ยังตรวจสอบไม่ได้ — อย่าสั่งซ้ำ โปรดตรวจสอบออเดอร์ก่อน`
    return `${m}: ไม่สำเร็จ${s.outcome?.code ? ` (${s.outcome.code})` : ''}`
  })
  if (r.status === 'all_created') return 'สั่งซื้อครบถ้วนทุกออเดอร์: ' + parts.join(' · ')
  if (r.status === 'pending') return 'ผลการสั่งซื้อยังไม่แน่ชัด: ' + parts.join(' · ')
  return 'สั่งซื้อสำเร็จบางส่วนเท่านั้น — ห้ามถือว่าสำเร็จครบ: ' + parts.join(' · ')
}