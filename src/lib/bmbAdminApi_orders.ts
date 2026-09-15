// ============================================
// Bite Me Baby Admin API - Orders
// ============================================

import { storageGet, storageSet, generateId } from './bmbStorage'

export interface OrderForm {
  id?: string
  order_number: string
  customer_id: string
  customer_name: string
  customer_phone: string
  delivery_round: string
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

export function getOrders(): OrderForm[] {
  return storageGet<OrderForm[]>('bmb_orders', [])
}

export function getOrder(orderNumber: string): OrderForm | undefined {
  return getOrders().find(o => o.order_number === orderNumber)
}

export function createOrder(data: OrderForm): OrderForm {
  const orders = getOrders()
  const order: OrderForm = {
    id: data.id || generateId('ord'),
    order_number: data.order_number || `BMB-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(orders.length + 1).padStart(3, '0')}`,
    customer_id: data.customer_id,
    customer_name: data.customer_name,
    customer_phone: data.customer_phone,
    delivery_round: data.delivery_round,
    status: data.status || 'pending',
    total_amount: data.total_amount,
    delivery_fee: data.delivery_fee,
    payment_method: data.payment_method,
    payment_status: data.payment_status || 'pending',
    delivery_address: data.delivery_address,
    dropoff_latitude: data.dropoff_latitude,
    dropoff_longitude: data.dropoff_longitude,
    items: data.items,
    created_at: data.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
  orders.push(order)
  storageSet('bmb_orders', orders)
  return order
}

export function updateOrderStatus(orderNumber: string, status: string): OrderForm | null {
  const orders = getOrders()
  const index = orders.findIndex(o => o.order_number === orderNumber)
  if (index === -1) return null
  orders[index].status = status
  orders[index].updated_at = new Date().toISOString()
  storageSet('bmb_orders', orders)
  return orders[index]
}

export function updateOrderPayment(orderNumber: string, paymentStatus: string): OrderForm | null {
  const orders = getOrders()
  const index = orders.findIndex(o => o.order_number === orderNumber)
  if (index === -1) return null
  orders[index].payment_status = paymentStatus
  orders[index].updated_at = new Date().toISOString()
  storageSet('bmb_orders', orders)
  return orders[index]
}