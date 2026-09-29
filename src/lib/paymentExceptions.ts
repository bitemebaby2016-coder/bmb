// ============================================
// Bite Me Baby — Payment exceptions (STEP 3B-2E)
// ============================================
// PURE display/READ-ONLY classification for the Admin payment-exception view.
// NO payment authority lives here — the canonical payment paths remain:
//   - webhook (stripe-webhook EF) → record_payment_result RPC (idempotent)
//   - admin offline confirm       → confirm_offline_payment RPC (COD/PromptPay)
//   - refund                      → stripe-refund EF (admin-only, idempotency
//     key, ledger in payment_intents.metadata.refunded_total_minor)
// Canonical vocabulary (REAL schema — migration 001 CHECK + prod data):
//   orders.payment_status  ∈ pending | paid | refund | partially_refunded
//   orders.payment_method  ∈ promptpay_qr | credit_card | cash_on_delivery
//   payment_intents.status ∈ pending | processing | completed | failed
//                          | refunded | partially_refunded
// Exception classification = grouping of existing canonical states/events for
// operator attention. NOTHING here mutates orders/status/payment state, and it
// never bypasses order_ready_to_make() (3B-2C) — kitchen gate is server-side.
// NO card/CVV/secret/provider credentials are read or displayed.

import { supabase } from './supabase'
import type { OrderForm } from './bmbAdminApi_orders'

// Operator attention threshold for stuck unpaid orders (display classification
// only — no business rule change; matches the >24h QA batch observed in prod).
export const STALE_UNPAID_HOURS = 24

export type PaymentExceptionKind =
  | 'OK_PAID'
  | 'OK_COD_AWAITED'
  | 'PENDING_UNPAID'
  | 'STALE_UNPAID'
  | 'PROCESSING'
  | 'INTENT_FAILED'
  | 'PARTIAL_REFUND'
  | 'REFUNDED'
  | 'WEBHOOK_MISMATCH'
  | 'MISSING_INTENT'

export const PAYMENT_EXCEPTION_META: Record<PaymentExceptionKind, { label: string; cls: string; attention: boolean }> = {
  OK_PAID: { label: '✅ paid', cls: 'badge-success', attention: false },
  OK_COD_AWAITED: { label: '💵 COD — รอเก็บเงินตอนส่ง', cls: 'badge-info', attention: false },
  PENDING_UNPAID: { label: '⏳ pending — รอชำระ', cls: 'badge-warning', attention: true },
  STALE_UNPAID: { label: '⚠ ค้างชำระ >24ชม.', cls: 'badge-danger', attention: true },
  PROCESSING: { label: '🔄 processing', cls: 'badge-info', attention: true },
  INTENT_FAILED: { label: '❌ payment failed', cls: 'badge-danger', attention: true },
  PARTIAL_REFUND: { label: '↩️ partial refund', cls: 'badge-warning', attention: true },
  REFUNDED: { label: '↩️ refunded', cls: 'badge-danger', attention: true },
  WEBHOOK_MISMATCH: { label: '⚠ webhook mismatch (intent สำเร็จ แต่ order ยังไม่ paid)', cls: 'badge-danger', attention: true },
  MISSING_INTENT: { label: '⚠ ไม่พบ payment intent', cls: 'badge-danger', attention: true },
}

export interface PaymentIntentLite {
  order_number: string
  status: string
  method: string
  amount: number
  payment_intent_id: string | null
  failure_reason: string | null
  updated_at: string
}

/**
 * Classify one order's payment state from CANONICAL data only.
 * `intents` = existing payment_intents rows of this order (read-only join).
 * Never invents a state: every kind maps to real columns/events.
 */
export function classifyPaymentException(
  o: OrderForm,
  intents: PaymentIntentLite[],
  nowMs: number = Date.now(),
): { kind: PaymentExceptionKind; attention: boolean } {
  const meta = (k: PaymentExceptionKind) => ({ kind: k, attention: PAYMENT_EXCEPTION_META[k].attention })
  const ps = o.payment_status
  const method = (o.payment_method || '').trim()
  const latest = intents[0]
  if (ps === 'refund') return meta('REFUNDED')
  if (ps === 'partially_refunded') return meta('PARTIAL_REFUND')
  if (ps === 'paid') return meta('OK_PAID')
  // ps === 'pending' (canonical remaining state)
  if (latest?.status === 'completed') return meta('WEBHOOK_MISMATCH') // intent สำเร็จ แต่ order ยัง pending → inconsistency
  if (latest?.status === 'processing') return meta('PROCESSING')
  if (latest?.status === 'failed') return meta('INTENT_FAILED')
  if (method === 'cash_on_delivery') return meta('OK_COD_AWAITED') // COD รอเก็บตอนส่ง — canonical ปกติ
  if (!latest) return meta('MISSING_INTENT') // non-COD pending แต่ไม่มี intent เลย
  if (nowMs - new Date(o.created_at).getTime() > STALE_UNPAID_HOURS * 3600_000) return meta('STALE_UNPAID')
  return meta('PENDING_UNPAID')
}

/** READ-ONLY: orders with attention-worthy payment states (RLS admin scope). */
export async function getPaymentExceptionOrders(): Promise<OrderForm[]> {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .in('payment_status', ['pending', 'refund', 'partially_refunded'])
      .order('updated_at', { ascending: false })
      .limit(200)
    if (error) { console.error('[paymentExceptions] read failed:', error); return [] }
    return (data || []) as unknown as OrderForm[]
  } catch (e) {
    console.warn('[paymentExceptions] unavailable:', String(e).slice(0, 120))
    return []
  }
}

/** READ-ONLY: existing payment_intents for the given orders (RLS admin scope). */
export async function getPaymentIntentsFor(orderNumbers: string[]): Promise<PaymentIntentLite[]> {
  if (!orderNumbers || orderNumbers.length === 0) return []
  try {
    const { data, error } = await supabase
      .from('payment_intents')
      .select('order_number, status, method, amount, payment_intent_id, failure_reason, updated_at, created_at')
      .in('order_number', orderNumbers)
      .order('created_at', { ascending: false })
    if (error) { console.error('[paymentExceptions] intents read failed:', error); return [] }
    return (data || []) as unknown as PaymentIntentLite[]
  } catch (e) {
    console.warn('[paymentExceptions] intents unavailable:', String(e).slice(0, 120))
    return []
  }
}

/** Group classified rows into the Owner §7 view sections (display only). */
export function groupPaymentExceptions<T extends { kind: PaymentExceptionKind }>(rows: T[]): Record<PaymentExceptionKind, T[]> {
  const groups = Object.fromEntries(
    (Object.keys(PAYMENT_EXCEPTION_META) as PaymentExceptionKind[]).map((k) => [k, []]),
  ) as unknown as Record<PaymentExceptionKind, T[]>
  for (const r of rows) groups[r.kind].push(r)
  return groups
}
