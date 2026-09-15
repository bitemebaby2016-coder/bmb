import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { showToast } from '@/components/ui/ToastContainer'
import { getOrders, createOrder, updateOrderStatus, updateOrderPayment } from '@/lib/bmbAdminApi_orders'
import type { OrderForm } from '@/lib/bmbAdminApi_orders'

export function AdminOrders() {
  const [orders, setOrders] = useState<OrderForm[]>([])
  const [filterStatus, setFilterStatus] = useState('all')

  useEffect(() => {
    loadOrders()
  }, [])

  function loadOrders() {
    setOrders(getOrders())
  }

  function handleStatusUpdate(orderNumber: string, newStatus: string) {
    updateOrderStatus(orderNumber, newStatus)
    loadOrders()
    showToast(`อัปเดตสถานะ ${newStatus} สำเร็จ`, 'success')
  }

  function handlePaymentUpdate(orderNumber: string, paymentStatus: string) {
    updateOrderPayment(orderNumber, paymentStatus)
    loadOrders()
    showToast('อัปเดตการชำระเงินสำเร็จ', 'success')
  }

  const filteredOrders = filterStatus === 'all' ? orders : orders.filter(o => o.status === filterStatus)

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-brand-accent">📋 จัดการออเดอร์</h1>
        <Link to="/admin" className="btn btn-outline">← กลับแดชบอร์ด</Link>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto">
        {[
          { key: 'all', label: 'ทั้งหมด' },
          { key: 'pending', label: 'รอ' },
          { key: 'confirmed', label: 'ยืนยัน' },
          { key: 'preparing', label: 'กำลังทำ' },
          { key: 'ready_for_dispatch', label: 'พร้อมส่ง' },
          { key: 'delivered', label: 'ส่งแล้ว' },
          { key: 'cancelled', label: 'ยกเลิก' }
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
                    {order.customer_name} • {order.customer_phone} • {order.delivery_round} • {new Date(order.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
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
              <strong>รายการ:</strong> {order.items.map(i => `${i.product_name} x${i.quantity}`).join(', ')}
            </div>
            
            <div className="flex flex-wrap gap-2">
              {order.status === 'pending' && (
                <button onClick={() => handleStatusUpdate(order.order_number, 'confirmed')} className="btn btn-primary text-sm">✅ ยืนยัน</button>
              )}
              {order.status === 'confirmed' && (
                <button onClick={() => handleStatusUpdate(order.order_number, 'preparing')} className="btn btn-info text-sm">‍🍳 เริ่มทำ</button>
              )}
              {order.status === 'preparing' && (
                <button onClick={() => handleStatusUpdate(order.order_number, 'ready_for_dispatch')} className="btn btn-success text-sm"> พร้อมส่ง</button>
              )}
              {order.status === 'ready_for_dispatch' && (
                <button onClick={() => handleStatusUpdate(order.order_number, 'delivered')} className="btn btn-info text-sm">🛵 ส่ง</button>
              )}
              
              {order.payment_status === 'pending' && (
                <button onClick={() => handlePaymentUpdate(order.order_number, 'paid')} className="btn btn-success text-sm">💰 ยืนยันชำระเงิน</button>
              )}
              
              <button className="btn btn-outline text-sm ml-auto">📞 โทรหา</button>
            </div>
          </div>
        ))}
      </div>

      {filteredOrders.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📋</div>
          <h3 className="text-xl font-bold text-brand-accent">ไม่พบออเดอร์</h3>
        </div>
      )}
    </div>
  )
}