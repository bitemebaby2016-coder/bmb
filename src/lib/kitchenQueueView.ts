// ============================================
// Bite Me Baby — Kitchen queue display helpers (STEP 3B-2C)
// ============================================
// PURE display layer for the Kitchen queue. NO business authority lives here:
//   - the SERVER gate `order_ready_to_make()` (migration 054) is the SOLE
//     authority for whether an order may enter preparation. This module only
//     MIRRORS the Owner-approved rule to render badges/buttons and to explain
//     NOT_READY reason codes. A stale mirror can never widen authority: the
//     buttons still call only transition_order_status (008/019/030).
//   - payment vocabulary comes from the canonical orders columns
//     (payment_method ∈ promptpay_qr|credit_card|cash_on_delivery;
//     payment_status CHECK ∈ pending|paid|refund — migration 035).
//   - NO cost/unit_price/inventory/supplier fields are exposed here (kitchen
//     sees production data only).

import type { OrderForm } from '@/lib/bmbAdminApi_orders'
import { canAdminTransition } from '@/lib/adminOrderDisplay'

// ---------------------------------------------------------------------------
// 1. NOT_READY reason codes — mirror of migration 054 (display only)
// ---------------------------------------------------------------------------
export const READY_TO_MAKE_REASONS: Record<string, string> = {
  ORDER_NOT_FOUND: 'ไม่พบออเดอร์',
  TERMINAL_STATE: 'ออเดอร์ปิดสิ้นสุดแล้ว (cancelled/failed/delivered)',
  INVALID_ORDER_STATE: 'สถานะไม่อยู่ในช่วงเตรียมทำ (ต้องเป็น confirmed/preparing)',
  PAYMENT_REFUNDED: 'ออเดอร์ถูกคืนเงินแล้ว',
  PAYMENT_NOT_PAID: 'ยังไม่ชำระเงิน (ต้องรอ paid ก่อนเริ่มทำ)',
  PAYMENT_METHOD_UNKNOWN: 'ไม่ทราบวิธีชำระเงิน — ต้องเป็น paid เท่านั้น',
  EMPTY_ORDER: 'ออเดอร์ไม่มีรายการอาหาร',
  PRODUCT_INVALID: 'มีเมนูที่อ้างอิงไม่ถูกต้อง',
  MISSING_SCHEDULE: 'PRE_ORDER ไม่มีวันที่กำหนดส่ง',
  SCHEDULE_PAST_DUE: 'วันกำหนดส่งย้อนหลัง — ต้องตรวจกับผู้ดูแล',
}

export function readyReasonLabel(reasonCode?: string | null): string {
  if (!reasonCode) return '—'
  return READY_TO_MAKE_REASONS[reasonCode] ?? reasonCode
}

// ---------------------------------------------------------------------------
// 2. Client MIRROR of the 054 payment rule — for badge/button RENDERING only.
//    The server `order_ready_to_make()` decides at action time.
// ---------------------------------------------------------------------------
export function paymentReadyToMake(
  paymentMethod?: string | null,
  paymentStatus?: string | null,
): { ok: boolean; reasonCode: string | null; codPrepaid: boolean } {
  const method = (paymentMethod || '').trim()
  const ps = paymentStatus || ''
  if (ps === 'refund') return { ok: false, reasonCode: 'PAYMENT_REFUNDED', codPrepaid: false }
  if (method === 'cash_on_delivery') {
    if (ps === 'pending') return { ok: true, reasonCode: null, codPrepaid: false } // COD settle at delivery
    if (ps === 'paid') return { ok: true, reasonCode: null, codPrepaid: true }
    return { ok: false, reasonCode: 'PAYMENT_NOT_READY', codPrepaid: false }
  }
  if (!method) return ps === 'paid' ? { ok: true, reasonCode: null, codPrepaid: false } : { ok: false, reasonCode: 'PAYMENT_METHOD_UNKNOWN', codPrepaid: false }
  if (ps !== 'paid') return { ok: false, reasonCode: 'PAYMENT_NOT_PAID', codPrepaid: false }
  return { ok: true, reasonCode: null, codPrepaid: false }
}

/**
 * Full client expectation for the kitchen gate of one order (render only):
 * status hop legality (canonical mirror) + payment rule + non-empty items.
 * The authoritative answer comes from the server RPC at action time.
 */
export function kitchenGatePreview(o: OrderForm): { canStart: boolean; canReady: boolean; reasonCode: string | null; codPrepaid: boolean } {
  const pay = paymentReadyToMake(o.payment_method, o.payment_status)
  const hasItems = (o.items || []).length > 0
  const base = { codPrepaid: pay.codPrepaid }
  if (!pay.ok) return { canStart: false, canReady: false, reasonCode: pay.reasonCode, ...base }
  if (!hasItems) return { canStart: false, canReady: false, reasonCode: 'EMPTY_ORDER', ...base }
  if (o.order_mode === 'PRE_ORDER' && !o.scheduled_date) {
    return { canStart: false, canReady: false, reasonCode: 'MISSING_SCHEDULE', ...base }
  }
  const canStart = canAdminTransition(o.status, 'preparing')
  const canReady = canAdminTransition(o.status, 'ready_for_dispatch')
  return { canStart, canReady, reasonCode: canStart || canReady ? null : 'INVALID_ORDER_STATE', ...base }
}

// ---------------------------------------------------------------------------
// 3. Kitchen queue grouping — same canonical spine columns as 3B-2B
// ---------------------------------------------------------------------------
export interface KitchenQueueGroup {
  key: string
  scheduledDate: string
  roundId: string
  orders: OrderForm[]
}

/** Group kitchen-pipeline orders (confirmed/preparing/ready) by date+round. */
export function groupKitchenOrders(orders: OrderForm[]): KitchenQueueGroup[] {
  const map = new Map<string, KitchenQueueGroup>()
  for (const o of orders) {
    const date = o.scheduled_date || '—'
    const round = o.delivery_round_id || '—'
    const key = `${date}|${round}`
    let g = map.get(key)
    if (!g) {
      g = { key, scheduledDate: date, roundId: round, orders: [] }
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

/** Display-only split: today's work vs scheduled later (no client authority). */
export function splitSameDayPreOrder(orders: OrderForm[], todayISO: string): { sameDay: OrderForm[]; preOrderToday: OrderForm[]; preOrderLater: OrderForm[] } {
  const sameDay: OrderForm[] = []
  const preOrderToday: OrderForm[] = []
  const preOrderLater: OrderForm[] = []
  for (const o of orders) {
    if (o.order_mode === 'PRE_ORDER') {
      ;((o.scheduled_date && o.scheduled_date <= todayISO) ? preOrderToday : preOrderLater).push(o)
    } else {
      sameDay.push(o)
    }
  }
  return { sameDay, preOrderToday, preOrderLater }
}

// ---------------------------------------------------------------------------
// 4. Kitchen-visible item lines — NO price/cost/supplier fields
// ---------------------------------------------------------------------------
export interface KitchenItemLine {
  productName: string
  quantity: number
  addonText: string
  specialRequest: string
}

const flattenAddonChoices = (customizations?: Record<string, any> | null): string => {
  if (!customizations || typeof customizations !== 'object') return ''
  const lines: string[] = []
  for (const [key, val] of Object.entries(customizations)) {
    if (val == null || key === 'notes' || key === 'note') continue
    if (Array.isArray(val)) { if (val.length) lines.push(`${key}: ${val.join(', ')}`) }
    else if (typeof val === 'boolean') { if (val) lines.push(key) }
    else if (typeof val !== 'object') lines.push(`${key}: ${String(val)}`)
  }
  return lines.join(' · ')
}

/** Production view of order items (name/qty/addons/special request only). */
export function kitchenItemLines(o: OrderForm): KitchenItemLine[] {
  return (o.items || []).map((it) => ({
    productName: it.product_name || it.product_id,
    quantity: Number(it.quantity) || 0,
    addonText: flattenAddonChoices(it.customizations as Record<string, any> | undefined),
    specialRequest: it.special_request || '',
  }))
}
