// ============================================
// Bite Me Baby — Admin Pre-Orders Page (P1 — DB-backed)
// Shows all PRE_ORDER orders with payment status, address, cancellation
// Data source: canonical orders table filtered by order_mode=PRE_ORDER
// ============================================

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { OrderForm } from '@/lib/bmbAdminApi_orders'
import { cancelOrder } from '@/lib/bmbAdminApi_orders'
import { writeAuditLog } from '@/lib/auditLog'
import { showToast } from '@/components/ui/ToastContainer'

export function AdminPreOrders() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [cancelling, setCancelling] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      var { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('order_mode', 'PRE_ORDER')
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) { console.error('[AdminPreOrders] Load failed:', error); return }
      // Hydrate items count for each order
      var enriched: any[] = []
      for (var o of (data || []) as any[]) {
        var { data: items, error: itemError } = await supabase
          .from('order_items').select('id').eq('order_id', o.id).limit(100)
        enriched.push({ ...o, items_count: itemError ? 0 : (items?.length ?? 0) })
      }
      setOrders(enriched)
    } catch (e) {
      console.error('[AdminPreOrders] Load error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function handleCancel(orderNumber: string) {
    if (!confirm('ต้องการยกเลิกออเดอร ' + orderNumber + '?')) return
    setCancelling(orderNumber)
    try {
      var res = await cancelOrder(orderNumber, 'admin pre-order cancel')
      if (res.success) {
        showToast('ยกเลิก ' + orderNumber + ' สำเรจ', 'success')
        writeAuditLog({ action: 'order_status_change', entity_type: 'order', entity_id: orderNumber, description: 'Pre-order cancelled by admin: ' + orderNumber })
        await load()
      } else {
        showToast('ไม่สามารถยกเลิกได้: ' + (res.error || ''), 'error')
      }
    } catch (e) {
      console.error('[AdminPreOrders] Cancel failed:', e)
      showToast('เกิดข้อผิดพลาด', 'error')
    } finally {
      setCancelling(null)
    }
  }

  var filtered = filterStatus === 'all' ? orders : orders.filter(function(o) { return o.status === filterStatus })
  if (searchTerm) {
    var lower = searchTerm.toLowerCase()
    filtered = filtered.filter(function(o) {
      return (o.order_number || '').toLowerCase().includes(lower) ||
             (o.customer_name || '').toLowerCase().includes(lower)
    })
  }

  function paymentBadge(status: string) {
    switch (status) {
      case 'paid': return '<span className="badge badge-success">Paid</span>'
      case 'pending': return '<span className="badge badge-warning">Pending</span>'
      case 'refund': return '<span className="badge badge-info">Refunded</span>'
      default: return '<span className="badge badge-warning">Unknown</span>'
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h1 className="text-3xl font-bold text-brand-accent mb-6">📋 ออเดอรจองล่วงหน้า (Pre-Orders)</h1>

      {/* Search */}
      <input type="text" placeholder="ค้นหาเลขออเดอรหรือชื่อลกค้า..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="input mb-4 max-w-md" />

      {/* Filter */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {['all', 'pending', 'confirmed', 'preparing', 'cancelled'].map(function(s) {
          return (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={'px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap ' +
                (filterStatus === s ? 'bg-brand-primary text-white' : 'bg-brand-surface text-brand-accent')}>
              {s === 'all' ? 'ทั้งหมด' : s}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="card text-center py-8"><p className="text-brand-muted">กำลังหลด...</p></div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-5xl mb-3">📅</div>
          <p className="text-brand-muted">ยังไม่มีออเดอรจองล่วงหน้า</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-brand-bg">
              <tr>
                <th className="p-3">เลขออเดอร</th>
                <th className="p-3">ลกค้า</th>
                <th className="p-3">วันที่จัดส่ง</th>
                <th className="p-3">ที่อย่จัดส่ง</th>
                <th className="p-3">ยอดรวม</th>
                <th className="p-3">ชำระเงิน</th>
                <th className="p-3">สถานะ</th>
                <th className="p-3">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(function(order) {
                var isDone = order.status === 'cancelled' || order.status === 'delivered'
                return (
                  <tr key={order.id} className="border-b border-brand-border hover:bg-brand-bg">
                    <td className="p-3 font-mono text-sm">{order.order_number}</td>
                    <td className="p-3">{order.customer_name}<br/><span className="text-xs text-brand-muted">{order.customer_phone}</span></td>
                    <td className="p-3">{order.scheduled_date}</td>
                    <td className="p-3 text-xs max-w-[200px] truncate" title={order.delivery_address}>{order.delivery_address || '-'}</td>
                    <td className="p-3 font-bold">฿{order.total_amount.toFixed(2)}</td>
                    <td className="p-3"><span className={'badge ' + (order.payment_status === 'paid' ? 'badge-success' : order.payment_status === 'refund' ? 'badge-info' : 'badge-warning')}>{order.payment_status}</span></td>
                    <td className="p-3"><span className={'badge ' + (order.status === 'confirmed' ? 'badge-success' : order.status === 'cancelled' ? 'badge-danger' : 'badge-info')}>{order.status}</span></td>
                    <td className="p-3">
                      {!isDone && (
                        <button onClick={() => void handleCancel(order.order_number)} disabled={cancelling === order.order_number}
                          className="btn btn-outline text-xs text-red-500 disabled:opacity-50">
                          {cancelling === order.order_number ? '⏳...' : '❌ ยกเลิก'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
