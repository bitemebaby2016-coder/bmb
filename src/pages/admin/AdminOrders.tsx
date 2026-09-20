import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useNotificationStore } from '@/store/notificationStore'
import { showToast } from '@/components/ui/ToastContainer'
import { getOrders, updateOrderStatus, confirmOfflinePayment, markPaymentFailed, stripeRefundOrder } from '@/lib/bmbAdminApi_orders'
import { getProductsAdmin } from '@/lib/bmbAdminApi_products'
import { addOnLinesFromChoices } from '@/lib/addonDisplay'
import type { OrderForm } from '@/lib/bmbAdminApi_orders'
import type { Product } from '@/types'

export function AdminOrders() {
  const [orders, setOrders] = useState<OrderForm[]>([])
  const [filterStatus, setFilterStatus] = useState('all')
  const [productById, setProductById] = useState<Record<string, Product>>({})

  useEffect(() => { loadOrders() }, [])

  async function loadOrders() {
    const orders = await getOrders()
    setOrders(orders)
    const products = await getProductsAdmin()
    const map: Record<string, Product> = {}
    for (const p of products || []) map[p.id] = p
    setProductById(map)
  }

  const statusEventMap: Record<string, 'order_confirmed' | 'order_preparing' | 'order_ready_for_dispatch' | 'order_dispatched' | 'order_delivered'> = {
    confirmed: 'order_confirmed',
    preparing: 'order_preparing',
    ready_for_dispatch: 'order_ready_for_dispatch',
    dispatched: 'order_dispatched',
    delivered: 'order_delivered',
  }

  async function handleStatusUpdate(orderNumber: string, newStatus: string) {
    // P0-6: transitions are validated server-side (allow-list + trigger);
    // an illegal jump (e.g. skip state) returns null and nothing changes.
    const updated = await updateOrderStatus(orderNumber, newStatus)
    loadOrders()

    if (!updated) {
      showToast(`Cannot change status -> ${newStatus} (state machine rule)`, 'error')
      return
    }

    const eventType = statusEventMap[newStatus]
    if (eventType) {
      useNotificationStore.getState().triggerEvent(eventType, { orderNumber })
    }

    showToast(`Status updated to ${newStatus}`, 'success')
  }

  async function handleConfirmPayment(orderNumber: string) {
    // P0-5: server-authoritative — COD requires delivered, PromptPay requires TXN submitted.
    const r = await confirmOfflinePayment(orderNumber)
    loadOrders()

    if (r.success) {
      useNotificationStore.getState().triggerEvent('payment_confirmed', { orderNumber })
      showToast('Payment confirmed', 'success')
    } else {
      showToast(r.error || 'Cannot confirm (rule: delivered/TXN)', 'error')
    }
  }

  async function handleMarkFailed(orderNumber: string) {
    await markPaymentFailed(orderNumber, 'admin')
    loadOrders()
    showToast('Payment marked as failed', 'success')
  }
async function handleStripeRefund(orderNumber: string) {
    // C-6: server-side Stripe refund (admin-only EF). Full refund by default.
    const r = await stripeRefundOrder(orderNumber)
    loadOrders()
    if (r.success) {
      showToast(`Refund successful (${r.data?.payment_status || 'refund'})`, 'success')
    } else {
      showToast(r.error || 'Refund failed', 'error')
    }
  }

  const filteredOrders = filterStatus === 'all' ? orders : orders.filter(o => o.status === filterStatus)

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-brand-accent">📋 Manage Orders</h1>
        <Link to="/admin" className="btn btn-outline">← Dashboard</Link>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto">
        {[
          { key: 'all', label: 'All' },
          { key: 'pending', label: 'Pending' },
          { key: 'confirmed', label: 'Confirmed' },
          { key: 'preparing', label: 'Preparing' },
          { key: 'ready_for_dispatch', label: 'Ready to dispatch' },
          { key: 'delivered', label: 'Delivered' },
          { key: 'cancelled', label: 'Cancelled' }
        ].map((status) => (
          <button
            key={status.key}
            onClick={() => setFilterStatus(status.key)}
            className={`px-4 py-2 rounded-full font-medium whitespace-nowrap transition-all ${
              filterStatus === status.key ? 'bg-brand-primary text-white' : 'bg-brand-surface text-brand-accent hover:bg-brand-bg'
            }`}
          >
            {status.label}
          </button>
        ))}
      </div>
<div className="space-y-4">
        {filteredOrders.map((order) => (
          <div key={order.id} className="card">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-brand-primary rounded-full flex items-center justify-center text-white font-bold">
                  {order.order_number.slice(-3)}
                </div>
                <div>
                  <div className="font-bold text-brand-accent">{order.order_number}</div>
                  <div className="text-sm text-brand-muted">
                    {order.customer_name} • {order.customer_phone} • Round {order.delivery_round_id || 'Morning'} • {new Date(order.created_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-brand-primary">฿{order.total_amount}</div>
                <span className={`badge ${
                  order.status === 'delivered' ? 'badge-success' :
                  order.status === 'preparing' ? 'badge-info' :
                  order.status === 'pending' ? 'badge-warning' : 'badge-primary'
                }`}>
                  {order.status}
                </span>
              </div>
            </div>

            <div className="text-sm text-brand-muted mb-3">
              <strong>Items:</strong>
              <ul className="mt-1 space-y-1" data-testid="admin-order-items">
                {order.items.map((i) => {
                  const addonLines = addOnLinesFromChoices(productById[i.product_id]?.addons, i.customizations?.addOns)
                  return (
                    <li key={i.product_id} className="flex items-baseline justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="font-medium text-brand-accent">{i.product_name}</span>
                        <span className="text-brand-muted"> × {i.quantity}</span>
                        {addonLines.length > 0 && (
                          <ul className="pl-3 text-xs text-brand-muted list-disc list-inside">
                            {addonLines.map((line) => (
                              <li key={line.groupName}>
                                {line.groupName}{line.selections.length > 0 ? `: ${line.selections.join(', ')}` : ''}{line.note ? ` · "${line.note.trim()}"` : ''}
                                {line.linePrice > 0 ? `  +฿${line.linePrice}` : ''}
                              </li>
                            ))}
                          </ul>
                        )}
                        {i.special_request && <div className="text-xs text-brand-muted italic">“{i.special_request}”</div>}
                      </div>
                      <span className="whitespace-nowrap">฿{Number(i.unit_price || 0).toFixed(2)}</span>
                    </li>
                  )
                })}
              </ul>
            </div>

            <div className="flex flex-wrap gap-2">
              {order.status === 'pending' && (
                <button onClick={() => handleStatusUpdate(order.order_number, 'confirmed')} className="btn btn-primary text-sm">✅ Confirm</button>
              )}
              {order.status === 'confirmed' && (
                <button onClick={() => handleStatusUpdate(order.order_number, 'preparing')} className="btn btn-info text-sm">🍳 Start cooking</button>
              )}
              {order.status === 'preparing' && (
                <button onClick={() => handleStatusUpdate(order.order_number, 'ready_for_dispatch')} className="btn btn-success text-sm">📦 Ready to dispatch</button>
              )}
              {order.status === 'ready_for_dispatch' && (
                <button onClick={() => handleStatusUpdate(order.order_number, 'delivered')} className="btn btn-info text-sm">🛵 Delivered</button>
              )}

              {(order.status === 'pending' || order.status === 'preparing') && (
                <button onClick={() => handleStatusUpdate(order.order_number, 'cancelled')} className="btn btn-danger text-sm">✖ Cancel</button>
              )}

              {order.payment_status === 'pending' && (
                <button onClick={() => handleConfirmPayment(order.order_number)} className="btn btn-success text-sm">💰 Confirm payment</button>
              )}
              {order.payment_status === 'pending' && (
                <button onClick={() => handleMarkFailed(order.order_number)} className="btn btn-outline text-sm">🚫 Mark failed</button>
              )}
{order.payment_method === 'credit_card' && (order.payment_status === 'paid' || order.payment_status === 'partially_refunded') && (
                    <button onClick={() => handleStripeRefund(order.order_number)} className="btn btn-outline text-sm">💸 Refund (Stripe)</button>
                  )}

              <button className="btn btn-outline text-sm ml-auto">📞 Call</button>
            </div>
          </div>
        ))}
      </div>

      {filteredOrders.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📋</div>
          <h3 className="text-xl font-bold text-brand-accent">No orders found</h3>
        </div>
      )}
    </div>
  )
}