// ============================================
// Bite Me Baby — Pre-order System
// GAP CLOSURE GROUP 2: Pre-order logic implementation
// ============================================

import { supabase } from './supabase'
import { storageGet, storageSet } from './bmbStorage'

// ============================================
// Pre-order Types
// ============================================

export type PreOrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'picked_up' | 'delivered' | 'cancelled' | 'expired'

export interface PreOrder {
  id: string
  order_number: string
  customer_id: string
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
  status: 'open' | 'closed' | 'full'
}

// ============================================
// Pre-order Rounds (scheduled delivery windows)
// ============================================

export function getPreOrderRounds(scheduledDate: string): PreOrderRound[] {
  const today = new Date(scheduledDate)
  
  return [
    {
      id: `round-${today.toISOString().split('T')[0]}-morning`,
      round_key: 'morning',
      display_name: 'เช้า (08:00 - 12:00)',
      date: scheduledDate,
      cutoff_time: `${today.toISOString().split('T')[0]}T06:00:00`,
      delivery_start: '08:00',
      delivery_end: '12:00',
      max_capacity: 50,
      current_count: 0,
      status: 'open',
    },
    {
      id: `round-${today.toISOString().split('T')[0]}-midday`,
      round_key: 'midday',
      display_name: 'เที่ยง (12:00 - 15:00)',
      date: scheduledDate,
      cutoff_time: `${today.toISOString().split('T')[0]}T10:00:00`,
      delivery_start: '12:00',
      delivery_end: '15:00',
      max_capacity: 40,
      current_count: 0,
      status: 'open',
    },
    {
      id: `round-${today.toISOString().split('T')[0]}-evening`,
      round_key: 'evening',
      display_name: 'เยน (17:00 - 20:00)',
      date: scheduledDate,
      cutoff_time: `${today.toISOString().split('T')[0]}T15:00:00`,
      delivery_start: '17:00',
      delivery_end: '20:00',
      max_capacity: 45,
      current_count: 0,
      status: 'open',
    },
  ]
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
  let orders: PreOrder[] = []
  
  // Try Supabase
  let query = supabase.from('pre_orders').select('*').order('created_at', { ascending: false })
  
  if (filters?.customerId) query = query.eq('customer_id', filters.customerId)
  if (filters?.status) query = query.eq('status', filters.status)
  if (filters?.startDate) query = query.gte('created_at', filters.startDate)
  if (filters?.endDate) query = query.lte('created_at', filters.endDate)
  
  const { data: dbData } = await query
  if (dbData && dbData.length > 0) {
    orders = dbData as PreOrder[]
  }
  
  // Fallback to localStorage
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

export async function createPreOrder(data: Omit<PreOrder, 'id' | 'order_number' | 'created_at' | 'updated_at'>): Promise<PreOrder | null> {
  const today = new Date()
  const orderNumber = `PO-${today.toISOString().slice(0, 10).replace(/-/g, '')}-${String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')}`
  
  const preOrder: PreOrder = {
    ...data,
    id: `po-${Date.now()}`,
    order_number: orderNumber,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  // Store in Supabase
  // E2E fix (2026-09-17): pre_orders.customer_id FK->customers; a guest
  // (anonymous) customer row must exist first.
  if (data.customer_id === 'guest') {
    await ensureGuestCustomer()
  }
  try {
    const { data: order, error } = await supabase.from('pre_orders').insert(preOrder).select().single()
    if (error) throw error
    return order as PreOrder
  } catch (e) {
    console.warn('[PreOrder] Supabase insert failed, using localStorage:', e)
    // Fallback to localStorage
    const orders = storageGet<PreOrder[]>('bmb_pre_orders', [])
    orders.push(preOrder)
    storageSet('bmb_pre_orders', orders)
    return preOrder
  }
}

/** Ensure an anonymous `guest` customer row exists (FK target for pre_orders). */
async function ensureGuestCustomer(): Promise<void> {
  try {
    const { error } = await supabase.from('customers').upsert(
      { id: 'guest', full_name: 'Guest', phone: '', email: '', address: '', loyalty_points: 0 },
      { onConflict: 'id', ignoreDuplicates: true }
    )
    if (error) console.warn('[PreOrder] ensureGuestCustomer:', error)
  } catch (e) {
    console.warn('[PreOrder] ensureGuestCustomer failed:', e)
  }
}

export async function updatePreOrderStatus(orderNumber: string, status: PreOrderStatus): Promise<PreOrder | null> {
  const orders = await getPreOrders()
  const order = orders.find(o => o.order_number === orderNumber)
  
  if (!order) return null

  const updated: PreOrder = {
    ...order,
    status,
    updated_at: new Date().toISOString(),
    confirmed_at: status === 'confirmed' ? new Date().toISOString() : order.confirmed_at,
    cancelled_at: status === 'cancelled' ? new Date().toISOString() : order.cancelled_at,
  }

  // Update in Supabase
  try {
    const { data, error } = await supabase.from('pre_orders').update(updated).eq('order_number', orderNumber).select().single()
    if (error) throw error
    return data as PreOrder
  } catch (e) {
    console.warn('[PreOrder] Update failed:', e)
    const allOrders = storageGet<PreOrder[]>('bmb_pre_orders', [])
    const index = allOrders.findIndex(o => o.order_number === orderNumber)
    if (index >= 0) {
      allOrders[index] = updated
      storageSet('bmb_pre_orders', allOrders)
    }
    return updated
  }
}

export async function cancelPreOrder(orderNumber: string, reason: string = ''): Promise<boolean> {
  return updatePreOrderStatus(orderNumber, 'cancelled') !== null
}

// ============================================
// Pre-order Validation
// ============================================

export function validatePreOrder(
  product: { is_preorder: boolean; delivery_round_id?: string; scheduled_date?: string },
  selectedRound: string,
  scheduledDate: string
): { valid: boolean; error?: string } {
  if (!product.is_preorder) {
    return { valid: false, error: 'สินค้านี้ไม่รับจองล่วงหน้า' }
  }
  
  if (!selectedRound) {
    return { valid: false, error: 'กรุาเลือกรอบการจัดส่ง' }
  }
  
  if (!scheduledDate) {
    return { valid: false, error: 'กรุาเลือกวันที่' }
  }
  
  // Check if date is in the future
  const selected = new Date(scheduledDate)
  const now = new Date()
  if (selected <= now) {
    return { valid: false, error: 'กรุาเลือกวันที่ในอนาคต' }
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
  
  const todayOrders = orders.filter(o => o.created_at.startsWith(today))
  
  const byRound: Record<string, number> = {}
  const byProduct: Array<{ product_name: string; quantity: number; revenue: number }> = []
  
  orders.forEach((o: PreOrder) => {
    byRound[o.delivery_round_id] = (byRound[o.delivery_round_id] || 0) + 1
    const existing = byProduct.find(p => p.product_name === o.product_name)
    if (existing) {
      existing.quantity += o.quantity
      existing.revenue += o.total_amount
    } else {
      byProduct.push({ product_name: o.product_name, quantity: o.quantity, revenue: o.total_amount })
    }
  })
  
  return {
    totalPending: orders.filter(o => o.status === 'pending').length,
    totalConfirmed: orders.filter(o => o.status === 'confirmed').length,
    totalReady: orders.filter(o => o.status === 'ready').length,
    todayPreOrders: todayOrders.length,
    byRound,
    byProduct: byProduct.sort((a, b) => b.revenue - a.revenue).slice(0, 10),
  }
}
