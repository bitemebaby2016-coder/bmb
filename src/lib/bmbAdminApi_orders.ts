// ============================================
// Bite Me Baby Admin API - Orders
// ✅ v3.1: Using Supabase (replaces localStorage)
// ============================================

import { supabase } from './supabase'

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
  if (error) { console.error('[getOrder] Error:', error); return null }
  return data as OrderForm
}

export async function createOrder(data: OrderForm): Promise<OrderForm | null> {
  const orderData = {
    id: data.id || `ord-${Date.now()}`,
    order_number: data.order_number || `BMB-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
    customer_id: data.customer_id,
    customer_name: data.customer_name,
    customer_phone: data.customer_phone,
    delivery_round_id: data.delivery_round_id,
    status: data.status || 'pending',
    total_amount: data.total_amount,
    delivery_fee: data.delivery_fee,
    payment_method: data.payment_method as any,
    payment_status: data.payment_status || 'pending',
    dropoff_detail: data.delivery_address,
    dropoff_latitude: data.dropoff_latitude,
    dropoff_longitude: data.dropoff_longitude,
  }

  const { data: order, error: orderError } = await supabase.from('orders').insert(orderData).select().single()
  if (orderError) { console.error('[createOrder] Error:', orderError); return null }

  // Insert order items
  if (data.items && data.items.length > 0) {
    const itemsData = data.items.map((item, idx) => ({
      id: `oi-${order!.id}-${idx}`,
      order_id: order!.id,
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
    }))

    const { error: itemsError } = await supabase.from('order_items').insert(itemsData)
    if (itemsError) { console.error('[createOrder] Items Error:', itemsError) }
  }

  return order as OrderForm
}

export async function updateOrderStatus(orderNumber: string, status: string): Promise<OrderForm | null> {
  const oldOrder = await getOrder(orderNumber)
  
  const { data, error } = await supabase.from('orders').update({ 
    status,
    updated_at: new Date().toISOString()
  }).eq('order_number', orderNumber).select().single()
  
  if (error) { console.error('[updateOrderStatus] Error:', error); return null }
  
  // Audit log for order status change
  if (oldOrder && status !== oldOrder.status) {
    const { writeAuditLog } = await import('@/lib/auditLog')
    writeAuditLog({
      action: 'order_status_change' as any,
      entity_type: 'order',
      entity_id: orderNumber,
      description: `สถานะออเดอร์ #${orderNumber} เปลี่ยนจาก "${oldOrder.status}" → "${status}"`,
      metadata: { fromStatus: oldOrder.status, toStatus: status }
    })
  }
  
  return data as OrderForm
}

export async function updateOrderPayment(orderNumber: string, paymentStatus: string): Promise<OrderForm | null> {
  const { data, error } = await supabase.from('orders').update({ payment_status: paymentStatus }).eq('order_number', orderNumber).select().single()
  if (error) { console.error('[updateOrderPayment] Error:', error); return null }
  return data as OrderForm
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