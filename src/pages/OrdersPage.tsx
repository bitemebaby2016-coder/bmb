// ============================================
// Bite Me Baby — OrdersPage (UI v5, BottomNav 'Orders')
// Lists the signed-in customer's orders + pre-orders (RLS own) with tracking links.
// ============================================

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { getOrders, type OrderForm } from '@/lib/bmbAdminApi_orders'
import { getPreOrders, type PreOrder } from '@/lib/preOrderService'
import { getServerStatusLabel } from '@/lib/orderVocabulary'



const PAYMENT_LABEL: Record<string, string> = {
  pending: 'รอชำระ',
  paid: 'ชำระแล้ว',
  refund: 'คืนเงินแล้ว',
  partially_refunded: 'คืนเงินบางส่วน',
}

const PRE_ORDER_STATUS_LABEL: Record<string, string> = {
  pending: '⏳ รอการยืนยัน',
  confirmed: '✅ ยืนยันแล้ว',
  paid: '💳 ชำระแล้ว',
  cancelled: '✖️ ยกเลิก',
  completed: '✅ สำเร็จ',
  failed: '⚠️ ล้มเหลว',
}

export function OrdersPage() {
  const customer = useAuthStore((s) => s.customer)
  const [orders, setOrders] = useState<OrderForm[]>([])
  const [preOrders, setPreOrders] = useState<PreOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function load() {
      if (!customer?.id) {
        setLoading(false)
        return
      }
      try {
        const [o, p] = await Promise.all([getOrders(), getPreOrders({ customerId: customer.id })])
        if (!active) return
        setOrders(o || [])
        setPreOrders(p || [])
      } catch (e) {
        console.error('[OrdersPage] load error:', e)
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [customer?.id])

  if (!customer) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4" role="img" aria-hidden="true">📦</div>
        <h1 className="text-2xl font-bold text-brand-accent mb-2">ดูออเดอร์ของคุณ</h1>
        <p className="text-brand-muted mb-6">เข้าสู่ระบบเพื่อดูคำสั่งซื้อและติดตามสถานะ</p>
        <Link to="/login" className="btn btn-primary">เข้าสู่ระบบ</Link>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center text-brand-muted">
        กำลังโหลดออเดอร์…
      </div>
    )
  }

  const hasAny = orders.length > 0 || preOrders.length > 0

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 min-h-screen">
      <h1 className="text-2xl font-display font-bold text-brand-accent mb-5">📦 ออเดอร์ของฉัน</h1>

      {!hasAny && (
        <p className="text-brand-muted text-center py-10">ยังไม่มีออเดอร์ — ไปสั่งเมนูได้เลยจ้า</p>
      )}

      {orders.length > 0 && (
        <section className="mb-8" aria-labelledby="orders-heading">
          <h2 id="orders-heading" className="text-xl font-bold text-brand-accent mb-3">คำสั่งซื้อ (Same-day)</h2>
          <ul className="space-y-3">
            {orders.map((o) => (
              <li key={o.order_number} className="card p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-brand-accent">#{o.order_number}</p>
                  <p className="text-sm text-brand-muted">{getServerStatusLabel(o.status)}
                    {' · '}{PAYMENT_LABEL[o.payment_status] || o.payment_status}</p>
                </div>
                <Link to={`/track/${o.order_number}`} className="btn btn-outline btn-sm whitespace-nowrap">ติดตาม</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {preOrders.length > 0 && (
        <section className="mb-8" aria-labelledby="preorders-heading">
          <h2 id="preorders-heading" className="text-xl font-bold text-brand-accent mb-3">📅 การจองล่วงหน้า</h2>
          <ul className="space-y-3">
            {preOrders.map((p) => (
              <li key={p.order_number} className="card p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-brand-accent">#{p.order_number} · {p.product_name}</p>
                  <p className="text-sm text-brand-muted">{PRE_ORDER_STATUS_LABEL[p.status] || p.status}
                    {p.scheduled_date ? ` · รอบ ${p.scheduled_date}` : ''}</p>
                </div>
                <Link to={`/track/${p.order_number}`} className="btn btn-outline btn-sm whitespace-nowrap">ติดตาม</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}