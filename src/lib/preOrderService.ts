// ============================================
// Bite Me Baby — Pre-order System (PHASE 1: server-authoritative pricing)
// PAY-01 / S-2: unit_price + total_amount re-derived by RPC
//   create_pre_order_with_items (migration 017). Client price fields are NOT
//   accepted — server is the only authority, matching the 007 principle.
// PRE-01: rounds read from `delivery_rounds` (DB), never hardcoded client-side.
// ============================================

import { supabase } from './supabase'
import { storageGet, storageSet } from './bmbStorage'

// ============================================
// Pre-order Types
// ============================================

export type PreOrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'picked_up'
  | 'delivered'
  | 'cancelled'
  | 'expired'

export interface PreOrder {
  id: string
  order_number: string
  customer_id: string
  customer_ref?: string | null
  customer_name: string
  customer_phone: string
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  total_amount: number
  delivery_round_id: string
  scheduled_date: string
  delivery_latitude: number
  delivery_longitude: number
  delivery_address: string
  status: PreOrderStatus
  special_instructions: string
  created_at: string
  updated_at: string
  confirmed_at?: string
  cancelled_at?: string
}

/**
 * Client input for creating a pre-order — INPUT ONLY, no price fields
 * (007 principle: price/subtotal/total are ignored if sent).
 */
export interface PreOrderInput {
  product_id: string
  quantity: number
  delivery_round_id?: string
  scheduled_date?: string
  customer_name?: string
  customer_phone?: string
  delivery_latitude?: number | null
  delivery_longitude?: number | null
  delivery_address?: string
  special_instructions?: string
}

/**
 * Pre-order round read model — mirrors the `delivery_rounds` row (PRE-01).
 */
export interface PreOrderRound {
  id: string
  round_key: string
  display_name: string
  date: string
  cutoff_time: string
  delivery_start: string
  delivery_end: string
  max_capacity: number
  current_count: number
  status: 'active' | 'open' | 'scheduled' | 'closed' | 'full' | 'cancelled'
}

// ============================================
// Pre-order Rounds — DB-backed (PRE-01)
// ============================================

/**
 * Read the pre-order rounds for a scheduled date from `delivery_rounds`.
 * Only accepting rounds (active/open/scheduled) are returned.
 */
export async function getPreOrderRounds(scheduledDate: string): Promise<PreOrderRound[]> {
  try {
    const qDate = scheduledDate ? new Date(scheduledDate).toISOString().slice(0, 10) : null
    let query = supabase
      .from('delivery_rounds')
      .select('*')
      .in('status', ['active', 'open', 'scheduled'])
    if (qDate) {
      query = query.eq('scheduled_date', qDate)
    }
    const { data, error } = await query.order('delivery_start', { ascending: true })
    if (error) throw error
    if (!data || data.length === 0) return []
    return data.map((r: any) => ({
      id: r.id,
      round_key: r.round_key || r.name || 'round',
      display_name: r.display_name,
      date: r.scheduled_date ?? r.date ?? scheduledDate,
      cutoff_time: r.cutoff_time ? String(r.cutoff_time).slice(0, 5) : '',
      delivery_start: r.delivery_start ? String(r.delivery_start).slice(0, 5) : '',
      delivery_end: r.delivery_end ? String(r.delivery_end).slice(0, 5) : '',
      max_capacity: Number(r.max_capacity ?? 0),
      current_count: Number(r.current_count ?? 0),
      status: r.status,
    }))
  } catch (e) {
    console.warn('[PreOrder] getPreOrderRounds failed:', e)
    return []
  }
}
// ============================================
// Pre-order API Functions
// ============================================

export async function getPreOrders(filters?: {
  customerId?: string
  status?: PreOrderStatus
  startDate?: string
  endDate?: string
}): Promise<PreOrder[]> {
  const orders: PreOrder[] = []

  let query = supabase.from('pre_orders').select('*').order('created_at', { ascending: false })
  if (filters?.customerId) query = query.eq('customer_id', filters.customerId)
  if (filters?.status) query = query.eq('status', filters.status)
  if (filters?.startDate) query = query.gte('created_at', filters.startDate)
  if (filters?.endDate) query = query.lte('created_at', filters.endDate)

  const { data: dbData } = await query
  if (dbData && dbData.length > 0) orders.push(...(dbData as PreOrder[]))

  try {
    const localOrders = storageGet<PreOrder[]>('bmb_pre_orders', [])
    const existingIds = new Set(orders.map((o: PreOrder) => o.id))
    localOrders.forEach((o: PreOrder) => {
      if (!existingIds.has(o.id)) orders.push(o)
    })
  } catch {
    // ignore
  }

  return orders
}

/**
 * Create a pre-order through the server-authoritative RPC (migration 017).
 * Client price fields are NOT accepted — the server re-derives unit price
 * and total from products.price and locks delivery_rounds capacity atomically.
 */
export async function createPreOrder(input: PreOrderInput): Promise<PreOrder | null> {
  const { data, error } = await supabase.rpc('create_pre_order_with_items', {
    p_product_id: input.product_id,
    p_quantity: input.quantity,
    p_delivery_round_id: input.delivery_round_id ?? null,
    p_scheduled_date: input.scheduled_date ?? null,
    p_customer_name: input.customer_name ?? '',
    p_customer_phone: input.customer_phone ?? '',
    p_delivery_latitude: input.delivery_latitude ?? null,
    p_delivery_longitude: input.delivery_longitude ?? null,
    p_delivery_address: input.delivery_address ?? '',
    p_special_instructions: input.special_instructions ?? '',
  })
  if (error) {
    console.warn('[PreOrder] create_pre_order_with_items failed:', error)
    return null
  }
  return data as unknown as PreOrder
}

/** Authoritative price quote for pre-order display (no write). */
export async function quotePreOrder(
  productId: string,
  quantity: number,
): Promise<{ unit_price: number; total_amount: number } | null> {
  const { data, error } = await supabase.rpc('quote_pre_order', {
    p_product_id: productId,
    p_quantity: quantity,
  })
  if (error) return null
  return data as unknown as { unit_price: number; total_amount: number }
}

/**
 * Update a pre-order status.
 * - 'cancelled' always goes through the server RPC cancel_pre_order
 *   (owner/admin only + capacity refund).
 * - Other transitions may be applied directly for admins (RLS admin allows);
 *   customers have write authority only via the server RPCs.
 */
export async function updatePreOrderStatus(orderNumber: string, status: PreOrderStatus): Promise<PreOrder | null> {
  if (status === 'cancelled') {
    const ok = await cancelPreOrder(orderNumber)
    if (!ok) return null
    const orders = await getPreOrders()
    return orders.find((o) => o.order_number === orderNumber) || null
  }
  try {
    const { data, error } = await supabase
      .from('pre_orders')
      .update({
        status,
        updated_at: new Date().toISOString(),
        confirmed_at: status === 'confirmed' ? new Date().toISOString() : null,
      })
      .eq('order_number', orderNumber)
      .select()
      .single()
    if (error) throw error
    return data as PreOrder
  } catch (e) {
    console.warn('[PreOrder] Update failed (may require admin):', e)
    return null
  }
}

// ============================================
// Pre-order Validation
// ============================================

export function validatePreOrder(
  product: { is_preorder: boolean; delivery_round_id?: string; scheduled_date?: string },
  selectedRound: string,
  scheduledDate: string,
): { valid: boolean; error?: string } {
  if (!product.is_preorder) {
    return { valid: false, error: 'สินค้านี้ไม่รับจองล่วงหน้า' }
  }

  if (!selectedRound) {
    return { valid: false, error: 'กรุณาเลือกรอบการจัดส่ง' }
  }

  if (!scheduledDate) {
    return { valid: false, error: 'กรุณาเลือกวันที่' }
  }

  // Check if date is in the future
  const selected = new Date(scheduledDate)
  const now = new Date()
  if (selected <= now) {
    return { valid: false, error: 'กรุณาเลือกวันที่ในอนาคต' }
  }

  return { valid: true }
}

// ============================================
// Pre-order Statistics
// ============================================

export async function getPreOrderStats(): Promise<{
  totalPending: number
  totalConfirmed: number
  totalReady: number
  todayPreOrders: number
  byRound: Record<string, number>
  byProduct: Array<{ product_name: string; quantity: number; revenue: number }>
}> {
  const orders = await getPreOrders()
  const today = new Date().toISOString().split('T')[0]

  const todayOrders = orders.filter((o) => o.created_at.startsWith(today))

  const byRound: Record<string, number> = {}
  const byProduct: Array<{ product_name: string; quantity: number; revenue: number }> = []

  orders.forEach((o: PreOrder) => {
    byRound[o.delivery_round_id] = (byRound[o.delivery_round_id] || 0) + 1
    const existing = byProduct.find((p) => p.product_name === o.product_name)
    if (existing) {
      existing.quantity += o.quantity
      existing.revenue += o.total_amount
    } else {
      byProduct.push({ product_name: o.product_name, quantity: o.quantity, revenue: o.total_amount })
    }
  })

  return {
    totalPending: orders.filter((o) => o.status === 'pending').length,
    totalConfirmed: orders.filter((o) => o.status === 'confirmed').length,
    totalReady: orders.filter((o) => o.status === 'ready').length,
    todayPreOrders: todayOrders.length,
    byRound,
    byProduct: byProduct.sort((a, b) => b.revenue - a.revenue).slice(0, 10),
  }
}
export async function cancelPreOrder(orderNumber: string): Promise<boolean> {
  const { error } = await supabase.rpc('cancel_pre_order', { p_order_number: orderNumber })
  if (error) {
    console.warn('[PreOrder] cancel_pre_order failed:', error)
    return false
  }
  return true
}