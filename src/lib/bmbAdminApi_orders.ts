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
  options?: Record<string, string | string[]>
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
  }>
  created_at: string
  updated_at: string
}

// ============================================
// Orders API — Supabase-backed
// ============================================

export async function getOrders(): Promise<OrderForm[]> {
  const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false })
  if (error) { console.error('[getOrders] Error:', error); return [] }
  return (data || []) as OrderForm[]
}

export async function getOrdersAdmin(): Promise<OrderForm[]> {
  const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false })
  if (error) { console.error('[getOrdersAdmin] Error:', error); return [] }
  return (data || []) as OrderForm[]
}

export async function getOrdersByCustomer(customerId: string): Promise<OrderForm[]> {
  const { data, error } = await supabase.from('orders').select('*').eq('customer_id', customerId).order('created_at', { ascending: false })
  if (error) { console.error('[getOrdersByCustomer] Error:', error); return [] }
  return (data || []) as OrderForm[]
}

export async function getOrder(orderNumber: string): Promise<OrderForm | null> {
  const { data, error } = await supabase.from('orders').select('*').eq('order_number', orderNumber).single()
  if (error) {
    console.error('[getOrder] Error:', error)
    return null
  }
  return data as OrderForm
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

export async function markPaymentFailed(orderNumber: string, reason: string = ''): Promise<{ success: boolean; error?: string }> {
  const r = await supabase.rpc('mark_payment_failed', { p_order_number: orderNumber, p_reason: reason })
  if (r.error) {
    console.error('[markPaymentFailed] RPC error:', r.error)
    return { success: false, error: r.error.message }
  }
  return { success: true }
}

export async function getDashboardStats(): Promise<{
  todayOrders: number
  todayRevenue: number
  pendingOrders: number
  totalOrders: number
  totalRevenue: number
}> {
  const today = new Date().toISOString().split('T')[0]

  const { data: orders, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false })
  if (error) { console.error('[getDashboardStats] Error:', error); return { todayOrders: 0, todayRevenue: 0, pendingOrders: 0, totalOrders: 0, totalRevenue: 0 } }

  const allOrders = orders as OrderForm[]
  const todayOrders = allOrders.filter(o => o.created_at.startsWith(today))

  return {
    todayOrders: todayOrders.length,
    todayRevenue: todayOrders.reduce((sum, o) => sum + o.total_amount, 0),
    pendingOrders: todayOrders.filter(o => o.status === 'pending' || o.status === 'confirmed').length,
    totalOrders: allOrders.length,
    totalRevenue: allOrders.reduce((sum, o) => sum + o.total_amount, 0),
  }
}
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