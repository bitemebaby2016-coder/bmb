import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useNotificationStore } from '@/store/notificationStore'
import { showToast } from '@/components/ui/ToastContainer'
import { getOrders, updateOrderStatus, confirmOfflinePayment, markPaymentFailed } from '@/lib/bmbAdminApi_orders'
import type { OrderForm } from '@/lib/bmbAdminApi_orders'

export function AdminOrders() {
  const [orders, setOrders] = useState<OrderForm[]>([])
  const [filterStatus, setFilterStatus] = useState('all')

  useEffect(() => { loadOrders() }, [])

  async function loadOrders() {
    const orders = await getOrders()
    setOrders(orders)
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
      showToast(`ไม่สามารถเปลี่ยนสถานะ -> ${newStatus} (กฎ state machine)`, 'error')
      return
    }

    const eventType = statusEventMap[newStatus]
    if (eventType) {
      useNotificationStore.getState().triggerEvent(eventType, { orderNumber })
    }

    showToast(`อัপডেটสถานা ${newStatus} สำเร็จ`, 'success')
  }

  async function handleConfirmPayment(orderNumber: string) {
    // P0-5: server-authoritative — COD requires delivered, PromptPay requires TXN submitted.
    const r = await confirmOfflinePayment(orderNumber)
    loadOrders()

    if (r.success) {
      useNotificationStore.getState().triggerEvent('payment_confirmed', { orderNumber })
      showToast('ยকনয়ানการচำระเงินสำเร็จ', 'success')
    } else {
      showToast(r.error || 'ไม่สามารถยকনয়ান (กฎ: delivered/TXN)', 'error')
    }
  }

  async function handleMarkFailed(orderNumber: string) {
    await markPaymentFailed(orderNumber, 'admin')
    loadOrders()
    showToast('การচำระเงินถูกทำล้ม', 'success')
  }

  const filteredOrders = filterStatus === 'all' ? orders : orders.filter(o => o.status === filterStatus)

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-brand-accent">📋 จัดকার অর্ডার</h1>
        <Link to="/admin" className="btn btn-outline">← গ্লব দ্যাশবোর্ড</Link>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto">
        {[
          { key: 'all', label: 'সব' },
          { key: 'pending', label: 'অপেক্ষা' },
          { key: 'confirmed', label: 'নিশ্চিত' },
          { key: 'preparing', label: 'প্রস্তুতি' },
          { key: 'ready_for_dispatch', label: 'পাঠানোর জন্য প্রস্তুত' },
          { key: 'delivered', label: 'পাঠানো হয়েছে' },
          { key: 'cancelled', label: 'বাতিল' }
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
                    {order.customer_name} • {order.customer_phone} • রাউন্ড {order.delivery_round_id || 'সকাল'} • {new Date(order.created_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
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
              <strong>আইটেম:</strong> {order.items.map(i => `${i.product_name} x${i.quantity}`).join(', ')}
            </div>

            <div className="flex flex-wrap gap-2">
              {order.status === 'pending' && (
                <button onClick={() => handleStatusUpdate(order.order_number, 'confirmed')} className="btn btn-primary text-sm">✅ নিশ্চিত করুন</button>
              )}
              {order.status === 'confirmed' && (
                <button onClick={() => handleStatusUpdate(order.order_number, 'preparing')} className="btn btn-info text-sm">🍳 রান্না শুরু</button>
              )}
              {order.status === 'preparing' && (
                <button onClick={() => handleStatusUpdate(order.order_number, 'ready_for_dispatch')} className="btn btn-success text-sm">📦 পাঠানোর প্রস্তুতি</button>
              )}
              {order.status === 'ready_for_dispatch' && (
                <button onClick={() => handleStatusUpdate(order.order_number, 'delivered')} className="btn btn-info text-sm">🛵 ডেলিভারি</button>
              )}

              {(order.status === 'pending' || order.status === 'preparing') && (
                <button onClick={() => handleStatusUpdate(order.order_number, 'cancelled')} className="btn btn-danger text-sm">✖ বাতিল</button>
              )}

              {order.payment_status === 'pending' && (
                <button onClick={() => handleConfirmPayment(order.order_number)} className="btn btn-success text-sm">💰 পেমেন্ট নিশ্চিত</button>
              )}
              {order.payment_status === 'pending' && (
                <button onClick={() => handleMarkFailed(order.order_number)} className="btn btn-outline text-sm">🚫 ব্যর্থ</button>
              )}

              <button className="btn btn-outline text-sm ml-auto">📞 কল</button>
            </div>
          </div>
        ))}
      </div>

      {filteredOrders.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📋</div>
          <h3 className="text-xl font-bold text-brand-accent">অর্ডার পাওয়া যায়নি</h3>
        </div>
      )}
    </div>
  )
}