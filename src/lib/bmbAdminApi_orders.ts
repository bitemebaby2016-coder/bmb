// ============================================
// Bite Me Baby Admin API - Orders
// ============================================

import { supabase } from './supabase'

// P0-4 SPLIT (2026-09-18):
//   OrderInput  — client payload (INPUT ONLY, no financial authority)
//   OrderResult — server-authoritative result from RPC `create_order_with_items`
//   OrderForm   — hydrated admin/read model (DB row + items)
// Client MUST NOT send price/subtotal/discount/delivery_fee/total_amount.
export interface OrderItemInput {
  product_id: string
  quantity: number
  options?: Record<string, any>
  special_request?: string
}

export interface OrderInput {
  items: OrderItemInput[]
  delivery_round_id: string
  delivery_method?: string
  delivery_address?: string
  dropoff_latitude?: number
  dropoff_longitude?: number
  customer_name: string
  customer_phone?: string
  payment_method?: string
  special_instructions?: string
  promotion_code?: string
  distance_km?: number
  // ✅ Phase 3B (migration 025 v3): canonical order mode + scheduled date
  order_mode?: 'SAME_DAY' | 'PRE_ORDER'
  scheduled_date?: string
  // intentionally NO price/subtotal/discount/delivery_fee/total_amount
}

export interface OrderResult {
  id: string
  order_number: string
  status: string
  subtotal: number
  discount_amount: number
  delivery_fee: number
  service_fee: number
  tax_amount: number
  total_amount: number
  payment_status: string
  payment_method: string
  delivery_round_id: string
  customer_ref: string
}

export interface OrderForm {
  id?: string
  order_number: string
  customer_id: string
  customer_name: string
  customer_phone: string
  delivery_round_id: string
  delivery_method?: string
  provider_id?: string
  provider_name?: string
  status: string
  total_amount: number
  delivery_fee: number
  payment_method: string
  payment_status: string
  delivery_address: string
  dropoff_latitude: number
  dropoff_longitude: number
  items: Array<{
    product_id: string
    product_name: string
    quantity: number
    unit_price: number
    item_total?: number
    special_request?: string
    customizations?: Record<string, any>
  }>
  // ✅ Phase 3B (migration 025): canonical order mode + scheduled delivery date
  order_mode?: 'SAME_DAY' | 'PRE_ORDER'
  scheduled_date?: string
  // ✅ STEP 3B-2A: channel attribution + external reference (display only)
  source_channel?: string
  external_ref_id?: string
  created_at: string
  updated_at: string
}

/**
 * Hydrate OrderForm rows with their order_items children (including the
 * add-on/topping snapshot stored in order_items.customizations by migration 016).
 * Keeps the existing OrderForm.items contract used across Admin/Orders pages.
 */
export async function hydrateOrderItems(orders: OrderForm[]): Promise<OrderForm[]> {
  const withId = (orders || []).filter((o) => !!o.id)
  if (withId.length === 0) return orders || []
  const ids = Array.from(new Set(withId.map((o) => o.id as string)))
  let data: any[] | null = null
  try {
    const r = await supabase.from('order_items').select('*').in('order_id', ids)
    if (r.error) { console.error('[hydrateOrderItems] Error:', r.error); return orders || [] }
    data = r.data
  } catch (e) {
    // Degrade gracefully (e.g. test mocks without .in()) — items stay as requested.
    console.warn('[hydrateOrderItems] unavailable, skipping hydration:', String(e).slice(0, 120))
    return orders || []
  }
  if (!data) return orders || []
  for (const o of withId) {
    const children = data.filter((oi) => oi.order_id === o.id)
    o.items = children.map((oi) => ({
      product_id: oi.product_id,
      product_name: oi.product_name,
      quantity: oi.quantity,
      unit_price: Number(oi.unit_price || 0),
      item_total: Number(oi.item_total || 0),
      special_request: oi.special_request || '',
      customizations: oi.customizations || {},
    }))
  }
  return orders || []
}

// ============================================
// Orders API — Supabase-backed
// ============================================

// W4-A: paged order fetch for Admin (server-side filter + range) — canonical data untouched.
// `getOrders()` is preserved unchanged for existing callers.
// STEP 3B-2A: optional orderMode filter (SAME_DAY / PRE_ORDER) — server-side eq.
export async function getOrdersPaged(opts: { page: number; pageSize?: number; status?: string; orderMode?: 'SAME_DAY' | 'PRE_ORDER' }): Promise<{ orders: OrderForm[]; total: number }> {
  const pageSize = Math.max(1, Math.min(100, opts.pageSize ?? 25))
  const page = Math.max(0, opts.page)
  const from = page * pageSize
  const to = from + pageSize - 1
  let q = supabase.from('orders').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(from, to)
  if (opts.status) q = q.eq('status', opts.status)
  if (opts.orderMode) q = q.eq('order_mode', opts.orderMode)
  const { data, error, count } = await q
  if (error) { console.error('[getOrdersPaged] Error:', error); return { orders: [], total: 0 } }
  const orders = await hydrateOrderItems((data || []) as OrderForm[])
  return { orders, total: count ?? orders.length }
}

export async function getOrders(): Promise<OrderForm[]> {
  const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false })
  if (error) { console.error('[getOrders] Error:', error); return [] }
  return await hydrateOrderItems((data || []) as OrderForm[])
}

// W4-E-1 (D1): aggregated/filtered read helpers — replace full-table getOrders()
// fetches in analytics/admin paths. READ-ONLY; no business logic change.
export async function getOrdersAggregated(): Promise<{ total: number; totalRevenue: number }> {
  try {
    const { count, error } = await supabase
      .from('orders')
      .select('total_amount', { count: 'exact', head: true })
    if (error) { console.error('[getOrdersAggregated] count error:', error); return { total: 0, totalRevenue: 0 } }
    const total = count ?? 0
    let totalRevenue = 0
    const PAGE = 1000
    for (let from = 0; from < total; from += PAGE) {
      const { data, error: sumErr } = await supabase
        .from('orders')
        .select('total_amount')
        .range(from, from + PAGE - 1)
      if (sumErr) { console.error('[getOrdersAggregated] sum error:', sumErr); break }
      for (const r of (data || []) as any[]) totalRevenue += Number(r.total_amount || 0)
      if (!data || data.length < PAGE) break
    }
    return { total, totalRevenue }
  } catch (e) {
    console.error('[getOrdersAggregated] Error:', e)
    return { total: 0, totalRevenue: 0 }
  }
}

export async function getOrdersByStatuses(statuses: string[]): Promise<OrderForm[]> {
  if (!statuses || statuses.length === 0) return []
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .in('status', statuses)
    .order('created_at', { ascending: false })
  if (error) { console.error('[getOrdersByStatuses] Error:', error); return [] }
  return await hydrateOrderItems((data || []) as OrderForm[])
}

export async function getOrdersSince(opts: { sinceISO: string; columns?: string[] }): Promise<any[]> {
  const cols = opts.columns && opts.columns.length > 0 ? opts.columns.join(',') : '*'
  const { data, error } = await supabase
    .from('orders')
    .select(cols)
    .gte('created_at', opts.sinceISO)
    .order('created_at', { ascending: false })
  if (error) { console.error('[getOrdersSince] Error:', error); return [] }
  return (data || []) as any[]
}

// W4-E-1: getOrdersAdmin() removed — dead duplicate of getOrders() (0 callers, verified W4-E-1 audit).

export async function getOrdersByCustomer(customerId: string): Promise<OrderForm[]> {
  const { data, error } = await supabase.from('orders').select('*').eq('customer_id', customerId).order('created_at', { ascending: false })
  if (error) { console.error('[getOrdersByCustomer] Error:', error); return [] }
  return await hydrateOrderItems((data || []) as OrderForm[])
}

export async function getOrder(orderNumber: string): Promise<OrderForm | null> {
  const { data, error } = await supabase.from('orders').select('*').eq('order_number', orderNumber).single()
  if (error) {
    console.error('[getOrder] Error:', error)
    return null
  }
  const hydrated = await hydrateOrderItems([data as OrderForm])
  return hydrated[0]
}

// P0-4: createOrder per RPC (server-authoritative). Client sends ONLY input.
// NOTE (2026-09-19): payload keys MUST match the RPC parameter names exactly
// (p_* prefix) — PostgREST returns PGRST202 "no matches found" otherwise.
export async function createOrder(input: OrderInput): Promise<OrderResult | null> {
  const payload = {
    p_items: input.items.map((it) => ({
      product_id: it.product_id,
      quantity: it.quantity,
      options: it.options ?? {},
      special_request: it.special_request ?? '',
    })),
    p_delivery_round_id: input.delivery_round_id,
    p_delivery_method: input.delivery_method ?? 'self_delivery',
    p_delivery_address: input.delivery_address ?? '',
    p_dropoff_latitude: input.dropoff_latitude,
    p_dropoff_longitude: input.dropoff_longitude,
    p_customer_name: input.customer_name,
    p_customer_phone: input.customer_phone ?? '',
    p_payment_method: input.payment_method ?? 'promptpay_qr',
    p_special_instructions: input.special_instructions ?? '',
    p_promotion_code: input.promotion_code ?? undefined,
    p_distance_km: input.distance_km ?? undefined,
    // ✅ Phase 3B (migration 025 v3): canonical mode + scheduled date — the server
    // remains the authority (mode gate / cutoff / lead time / round-date invariant).
    p_order_mode: input.order_mode ?? 'SAME_DAY',
    p_scheduled_date: input.scheduled_date ?? undefined,
  }
  const { data, error } = await supabase.rpc('create_order_with_items', payload)
  if (error) { console.error('[createOrder] RPC error:', error); return null }
  return data as OrderResult
}
// P0-6 (2026-09-18): order status changes go through the state machine RPC
// `transition_order_status` (allow-list validated server-side + trigger guard).
// Direct `orders.update({status})` from the client is no longer possible:
// RLS denies non-admin updates and the guard trigger rejects illegal jumps.
export async function updateOrderStatus(orderNumber: string, status: string): Promise<OrderForm | null> {
  const oldOrder = await getOrder(orderNumber)

  const { data, error } = await supabase.rpc('transition_order_status', {
    p_order_number: orderNumber,
    p_new_status: status,
  })

  if (error) {
    console.error('[updateOrderStatus] transition error:', error)
    return null
  }

  void data

  // Audit log for order status change
  if (oldOrder && status !== oldOrder.status) {
    const { writeAuditLog } = await import('@/lib/auditLog')
    writeAuditLog({
      action: 'order_status_change' as any,
      entity_type: 'order',
      entity_id: orderNumber,
      description: `[BMB] order #${orderNumber} status changed "${oldOrder.status}" -> "${status}"`,
      metadata: { fromStatus: oldOrder.status, toStatus: status }
    })
  }

  return await getOrder(orderNumber)
}

// P0-5 (2026-09-18): payment confirmations are server-authoritative.
// `confirmOfflinePayment` marks an order paid ONLY when the business rules are
// met (COD -> order delivered; PromptPay -> TXN submitted). No direct write.
export async function confirmOfflinePayment(orderNumber: string): Promise<{ success: boolean; error?: string }> {
  const r = await supabase.rpc('confirm_offline_payment', { p_order_number: orderNumber })
  if (r.error) {
    console.error('[confirmOfflinePayment] RPC error:', r.error)
    return { success: false, error: r.error.message }
  }
  return { success: true }
}

// REMOVED: markPaymentFailed (dead code - canonical failed path is webhook -> record_payment_result)

// ============================================
// ✅ Phase 3B (migration 025 §3): canonical atomic cancellation.
// Authz (owner pending-only inside the D-5 window; admin any non-delivered),
// capacity release + inventory restore + delivery-assignment cancel + audit all
// happen server-side in ONE transaction. Cancel ≠ refund — payment_status is
// untouched; a paid cancelled order is refunded later via the admin stripe-refund EF.
// ============================================
export interface CancelOrderResult {
  success: boolean
  idempotent?: boolean
  order_number?: string
  status?: string
  order_mode?: string
  previous_status?: string
  capacity_released?: boolean
  inventory_restored?: boolean
  note?: string
  error?: string
}

export async function cancelOrder(orderNumber: string, reason: string = ''): Promise<CancelOrderResult> {
  const r = await supabase.rpc('cancel_order', { p_order_number: orderNumber, p_reason: reason })
  if (r.error) {
    console.error('[cancelOrder] RPC error:', r.error)
    return { success: false, error: r.error.message }
  }
  const data = (r.data ?? {}) as Record<string, any>
  return {
    success: data.ok !== false,
    idempotent: data.idempotent === true,
    order_number: data.order_number ?? orderNumber,
    status: data.status ?? 'cancelled',
    order_mode: data.order_mode,
    previous_status: data.previous_status,
    capacity_released: data.capacity_released === true,
    inventory_restored: data.inventory_restored === true,
    note: data.note,
  }
}

// W4-E-1 (D1): the orders-table getDashboardStats() duplicate was removed —
// it was a dead full-table read (0 callers; the canonical stats live in
// bmbAdminApi_users.getDashboardStats, now hardened with aggregated reads).

// ============================================
// C-6 (2026-09-19): server-side Stripe refund via Edge Function (admin-only).
// The EF verifies the caller is an admin, validates the order/intent, calls the
// Stripe Refund API with an Idempotency-Key, then persists the result.
// ============================================
export async function stripeRefundOrder(
  orderNumber: string,
  reason?: string,
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('stripe-refund', {
      body: { order_number: orderNumber, reason },
    })
    if (error || (data && data.error)) {
      return { success: false, error: (data && data.error) || error?.message || 'refund failed' }
    }
    return { success: true, data }
  } catch (e) {
    return { success: false, error: String(e).slice(0, 200) }
  }
}

// ============================================
// STEP 3B-2A — Operational visibility read helpers (Phase B/C)
// ============================================
// All three are READ-ONLY table reads protected by existing RLS:
//   - order_status_history → migration 040 policy `osh_admin_read` (is_admin only)
//   - delivery_assignments → migration 020 policy `assignments_auth_read`
//     (is_admin OR own-driver scope) — Admin Orders is admin-scoped
//   - audit_logs           → migration 018 admin read (AuditLogPage pattern)
// No new authority, no new RPC, no client-side mutation anywhere.

export interface OrderStatusHistoryRow {
  id: string
  order_number: string
  from_status: string | null
  to_status: string
  changed_at: string
  actor_type: string
  actor_id: string | null
  reason: string | null
  metadata: Record<string, any>
}

/** Authoritative lifecycle trace for one order (oldest→newest). Admin-only per RLS. */
export async function getOrderStatusHistory(orderNumber: string): Promise<OrderStatusHistoryRow[]> {
  try {
    const { data, error } = await supabase
      .from('order_status_history')
      .select('*')
      .eq('order_number', orderNumber)
      .order('changed_at', { ascending: true })
    if (error) { console.error('[getOrderStatusHistory] Error:', error); return [] }
    return (data || []) as OrderStatusHistoryRow[]
  } catch (e) {
    console.warn('[getOrderStatusHistory] unavailable:', String(e).slice(0, 120))
    return []
  }
}

export interface DeliveryAssignmentLiteRow {
  id: string
  order_number: string
  driver_id: string
  status: string
  assigned_at: string | null
  accepted_at: string | null
  picked_up_at: string | null
  in_transit_at: string | null
  delivered_at: string | null
  cancelled_at: string | null
}

/** Assignment rows for a page of orders (020 lifecycle) — admin/driver RLS scoped. */
export async function getDeliveryAssignmentsFor(orderNumbers: string[]): Promise<DeliveryAssignmentLiteRow[]> {
  if (!orderNumbers || orderNumbers.length === 0) return []
  try {
    const { data, error } = await supabase
      .from('delivery_assignments')
      .select('*')
      .in('order_number', orderNumbers)
    if (error) { console.error('[getDeliveryAssignmentsFor] Error:', error); return [] }
    return (data || []) as DeliveryAssignmentLiteRow[]
  } catch (e) {
    console.warn('[getDeliveryAssignmentsFor] unavailable:', String(e).slice(0, 120))
    return []
  }
}

/** Generic audit-log read for one order (entity_type='order', entity_id=order_number). */
export async function getOrderAuditTrail(orderNumber: string, limit = 25): Promise<Record<string, any>[]> {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('entity_type', 'order')
      .eq('entity_id', orderNumber)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) { console.error('[getOrderAuditTrail] Error:', error); return [] }
    return (data || []) as Record<string, any>[]
  } catch (e) {
    console.warn('[getOrderAuditTrail] unavailable:', String(e).slice(0, 120))
    return []
  }
}

// ============================================
// STEP 3B-2B — Pre-order queue round reads (Phase B)
// ============================================
// READ-ONLY read of `delivery_rounds` — the canonical capacity/cutoff source of
// truth (migration 017/024/025/038). RLS: `delivery_rounds_public_read`
// (anon+authenticated SELECT). DISPLAY ONLY: the client never enforces
// cutoff/capacity — the server RPCs (025/038) remain the authority.

export async function getRoundsByIds(roundIds: string[]): Promise<Record<string, any>[]> {
  if (!roundIds || roundIds.length === 0) return []
  try {
    const { data, error } = await supabase
      .from('delivery_rounds')
      .select('*')
      .in('id', roundIds)
    if (error) { console.error('[getRoundsByIds] Error:', error); return [] }
    return (data || []) as Record<string, any>[]
  } catch (e) {
    console.warn('[getRoundsByIds] unavailable:', String(e).slice(0, 120))
    return []
  }
}
