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
// M5 (2026-10-22): payment_intents reads go through paymentGateway.getPaymentIntents
// (single read service) — no private query of payment_intents lives here.

import { supabase } from './supabase'
import { getPaymentIntents } from './paymentGateway'
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
  /** mig 133: transfer slip object path (private bucket payment-slips). */
  slip_path?: string | null
  slip_uploaded_at?: string | null
  /** metadata.reference = customer-submitted PromptPay TXN id (008 B.4). */
  metadata?: Record<string, any> | null
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

/**
 * READ-ONLY: existing payment_intents for the given orders (RLS admin scope).
 * M5 (2026-10-22): ONE read path — delegates to paymentGateway.getPaymentIntents
 * (the single payment read service). This module keeps no private
 * payment_intents query of its own anymore.
 */
export async function getPaymentIntentsFor(orderNumbers: string[]): Promise<PaymentIntentLite[]> {
  if (!orderNumbers || orderNumbers.length === 0) return []
  try {
    const rows = await getPaymentIntents({ orderNumbers })
    return (rows || []).map((r) => ({
      order_number: r.order_number,
      status: r.status,
      method: r.method,
      amount: r.amount,
      payment_intent_id: r.payment_intent_id ?? null,
      failure_reason: r.failure_reason ?? null,
      updated_at: r.updated_at,
      slip_path: r.slip_path ?? null,
      slip_uploaded_at: r.slip_uploaded_at ?? null,
      metadata: r.metadata ?? null,
    }))
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

// ============================================
// R1.2 (2026-10-23, D-04) — confirmability ของ confirm_offline_payment
// ============================================
// PURE display helper ที่ mirror เงื่อนไข server จริง (008 B.5):
//   · cash_on_delivery → ต้อง order.status = 'delivered' ก่อน
//   · อื่น ๆ           → intent ล่าสุด (method เดียวกับ order) ต้อง status = 'processing'
//     (ลูกค้าส่งสลิป/เลข TXN แล้ว — submit_payment_slip / submit_offline_payment_reference)
// คืนเหตุผลเป็นข้อความไทยชัดเจนเสมอ — ปุ่มยืนยันในแผงตรวจสลิปจะปิดพร้อมบอกเหตุผล
// เมื่อ server จะปฏิเสธอยู่แล้ว (ห้ามกดแล้ว error ลอย ๆ อีก)

export interface PaymentConfirmability {
  confirmable: boolean
  reason: string
}

export function paymentConfirmability(o: OrderForm, intents: PaymentIntentLite[]): PaymentConfirmability {
  const method = (o.payment_method || '').trim()
  if (o.payment_status === 'paid') {
    return { confirmable: false, reason: 'ชำระเงินแล้ว — ไม่ต้องยืนยันซ้ำ' }
  }
  if (method === 'cash_on_delivery') {
    return o.status === 'delivered'
      ? { confirmable: true, reason: 'ส่งถึงแล้ว (delivered) — ยืนยันการเก็บเงินสดได้' }
      : { confirmable: false, reason: 'เงินสดเก็บตอนรับของ — ยืนยันได้เมื่อสถานะเป็น delivered เท่านั้น' }
  }
  if (method === 'credit_card') {
    return {
      confirmable: false,
      reason: 'บัตรเครดิต/เดบิต ยืนยันอัตโนมัติผ่านระบบชำระเงิน (webhook) — ไม่ต้องกดยืนยันเอง',
    }
  }
  // promptpay_qr / bank_transfer: เงื่อนไขเดียวกับ confirm_offline_payment (008 B.5)
  const latest = intents.find((i) => i.method === method) ?? intents[0]
  if (!latest) {
    return { confirmable: false, reason: 'ไม่พบ payment intent — ให้ลูกค้าเปิดหน้า /payment เพื่อสร้างรายการชำระ (ระบบจะสร้างให้อัตโนมัติ)' }
  }
  switch (latest.status) {
    case 'processing':
      return { confirmable: true, reason: 'มีหลักฐานการโอนแล้ว (สลิป/เลข TXN) — พร้อมยืนยัน' }
    case 'pending':
      return { confirmable: false, reason: 'ยังไม่มีหลักฐานการโอน (สลิป/เลข TXN) — รอให้ลูกค้าส่งหลักฐานที่หน้า /payment ก่อน' }
    case 'completed':
      return { confirmable: false, reason: 'รายการชำระสำเร็จแล้ว แต่ออเดอร์ยังไม่เป็น paid — ตรวจสอบอีกครั้งหรือติดต่อทีม (webhook mismatch)' }
    case 'failed':
      return { confirmable: false, reason: 'การชำระล้มเหลว — ให้ลูกค้ากด "ลองชำระเงินอีกครั้ง" ที่หน้า /payment' }
    default:
      return { confirmable: false, reason: `รายการชำระอยู่ในสถานะ ${latest.status} — ยังยืนยันไม่ได้` }
  }
}

/**
 * PURE display mapping ของ error จาก confirm_offline_payment (008 B.5) →
 * ข้อความไทยที่บอก "ทำไมยืนยันไม่ได้" ชัดเจน (แทน ERR code ลอย ๆ บน toast)
 */
export function describePaymentConfirmError(raw: string | undefined | null): string {
  const msg = String(raw || '')
  if (msg.includes('ERR_COD_NOT_DELIVERED')) {
    return 'ยืนยันไม่ได้: เงินสดเก็บตอนรับของ — ต้องส่งถึงมือลูกค้า (delivered) ก่อน'
  }
  if (msg.includes('ERR_NO_PAYMENT_INTENT')) {
    return 'ยืนยันไม่ได้: ไม่พบ payment intent — ให้ลูกค้าเปิดหน้า /payment เพื่อสร้างรายการชำระ (ระบบจะสร้างให้อัตโนมัติ)'
  }
  if (msg.includes('ERR_INTENT_NOT_PROCESSING')) {
    return 'ยืนยันไม่ได้: ยังไม่มีหลักฐานการโอนในระบบ (สลิป/เลข TXN) — รอให้ลูกค้าส่งหลักฐานที่หน้า /payment ก่อน'
  }
  if (msg.includes('ERR_ORDER_NOT_FOUND')) {
    return 'ยืนยันไม่ได้: ไม่พบออเดอร์นี้ในระบบ'
  }
  if (msg.includes('ERR_FORBIDDEN')) {
    return 'ยืนยันไม่ได้: บัญชีนี้ไม่มีสิทธิ์ยืนยันการชำระเงิน'
  }
  return msg ? `ยืนยันไม่สำเร็จ: ${msg}` : 'ยืนยันไม่สำเร็จ (กฎ: ต้อง delivered สำหรับเงินสด / ต้องมีหลักฐานโอนสำหรับ PromptPay)'
}

/**
 * PURE display mapping ของ error ฝั่งลูกค้า (submit_payment_slip /
 * submit_offline_payment_reference) — D-05: ข้อความต้องบอกชัดว่า
 * "คนสั่ง = คนจ่าย" เมื่อผู้เปิดหน้าไม่ใช่เจ้าของออเดอร์
 */
export function describePaymentEvidenceError(raw: string | undefined | null): string {
  const msg = String(raw || '')
  if (msg.includes('ERR_NOT_AUTHENTICATED')) {
    return 'กรุณาเข้าสู่ระบบด้วยบัญชีที่สั่งซื้อเพื่อส่งหลักฐานการชำระเงิน (คนสั่ง = คนจ่าย)'
  }
  if (msg.includes('ERR_NO_PENDING_PROMPTPAY')) {
    return 'ส่งหลักฐานไม่ได้: ต้องส่งจากบัญชีผู้สั่งซื้อ (คนสั่ง = คนจ่าย) และออเดอร์ต้องอยู่ในสถานะรอชำระ — ถ้าเห็นหน้านี้จากบัญชีอื่น ให้เข้าสู่ระบบด้วยบัญชีที่สั่งซื้อ'
  }
  if (msg.includes('ERR_SLIP_PATH_FORBIDDEN') || msg.includes('ERR_POD_PATH_FORBIDDEN')) {
    return 'ไฟล์หลักฐานไม่ถูกต้อง — กรุณาเลือกรูปสลิปใหม่อีกครั้ง'
  }
  return msg ? `ส่งหลักฐานไม่สำเร็จ: ${msg}` : 'ส่งหลักฐานไม่สำเร็จ กรุณาลองใหม่'
}

/**
 * PURE display decision ของ "การ์ดลองชำระใหม่" บนหน้า /payment —
 * เดิมเช็ค `order.payment_status === 'failed'` ซึ่งเป็นไปไม่ได้ตาม CHECK ของ
 * orders.payment_status ('pending'|'paid'|'refund'|'partially_refunded' — 001/035)
 * ทำให้การ์ด retry ไม่เคยแสดง = ทางรอดของลูกค้าหาย (dead UI, R1.2/D-04).
 * สถานะ failed จริงอยู่ที่ payment_intents.status — เช็คจาก intent ล่าสุดแทน
 */
export function shouldOfferPaymentRetry(
  order: { payment_status?: string | null } | null | undefined,
  latestIntent: { status?: string | null } | null | undefined,
): boolean {
  if (!order) return false
  if (order.payment_status === 'paid') return false
  return latestIntent?.status === 'failed'
}
