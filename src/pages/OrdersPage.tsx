// ============================================
// Bite Me Baby — OrdersPage (Phase 3B · ONE canonical order history)
// ============================================
// Reads ONLY `orders` (+ order_items hydration) — SAME_DAY and PRE_ORDER are
// rows of the same canonical table (orders.order_mode, migration 023/024).
// The pre_orders archive is NOT rendered here (read-only archive; migrated
// rows would duplicate the canonical ones). Customer cancellation goes
// through `cancel_order` (owner: pending-only inside the D-5 window).
// ============================================

import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { getOrders, hydrateOrderItems, cancelOrder, type OrderForm } from '@/lib/bmbAdminApi_orders'
import { getServerStatusLabel } from '@/lib/orderVocabulary'
import { showToast } from '@/components/ui/ToastContainer'

const PAYMENT_LABEL: Record<string, string> = {
  pending: 'รอชำระ',
  processing: 'รอตรวจสอบ',
  paid: 'ชำระแล้ว',
  failed: 'ชำระไม่สำเร็จ',
  refund: 'คืนเงินแล้ว',
  partially_refunded: 'คืนเงินบางส่วน',
}

export function OrdersPage() {
  const customer = useAuthStore((s) => s.customer)
  const [orders, setOrders] = useState<OrderForm[]>([])
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const list = await getOrders()
      setOrders(await hydrateOrderItems(list || []))
    } catch (e) {
      console.error('[OrdersPage] load error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    async function run() {
      if (!customer?.id) { setLoading(false); return }
      await load()
      if (!active) return
    }
    run()
    return () => { active = false }
  }, [customer?.id, load])

  async function handleCancel(orderNumber: string) {
    if (cancelling) return
    setCancelling(orderNumber)
    const res = await cancelOrder(orderNumber, 'customer cancel (order history)')
    if (res.success) {
      showToast(res.idempotent ? 'ออเดอร์ถูกยกเลิกอยู่แล้ว' : 'ยกเลิกออเดอร์สำเร็จ', 'success')
      await load()
    } else {
      showToast(res.error || 'ยกเลิกไม่สำเร็จ (อาจพ้นเงื่อนไขการยกเลิก)', 'error')
    }
    setCancelling(null)
  }

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
      <div className="max-w-3xl mx-auto px-4 py-16 text-center text-brand-muted">กำลังโหลดออเดอร์…</div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 min-h-screen">
      <h1 className="text-2xl font-display font-bold text-brand-accent mb-5">📦 ออเดอร์ของฉัน</h1>

      {orders.length === 0 && (
        <p className="text-brand-muted text-center py-10">ยังไม่มีออเดอร์ — ไปสั่งเมนูได้เลยจ้า</p>
      )}

      {/* ONE canonical list — both modes, newest first (RLS: own only) */}
      <ul className="space-y-3" data-testid="orders-list">
        {orders.map((o) => {
          const mode = ((o as any).order_mode ?? 'SAME_DAY') as 'SAME_DAY' | 'PRE_ORDER'
          const cancellable = o.status === 'pending'
          return (
            <li key={o.order_number} className="card p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-brand-accent">#{o.order_number}</p>
                  <p className="text-sm text-brand-muted">
                    <span className="badge badge-info mr-1">{mode === 'PRE_ORDER' ? '📅 จองล่วงหน้า' : '🔥 วันนี้'}</span>
                    {getServerStatusLabel(String(o.status), mode)}
                    {' · '}{PAYMENT_LABEL[o.payment_status] || o.payment_status}
                    {mode === 'PRE_ORDER' && o.scheduled_date ? ` · รับวันที่ ${o.scheduled_date}` : ''}
                    {' · '}{Number(o.total_amount).toFixed(2)} ฿
                  </p>
                  {String(o.status) === 'cancelled' && o.payment_status === 'paid' && (
                    <p className="text-xs text-yellow-700 mt-1">ชำระแล้ว + ยกเลิก — รอดำเนินการคืนเงิน (ยังไม่ได้คืนเงิน)</p>
                  )}
                </div>
                <div className="flex flex-col gap-2 items-end">
                  <Link to={`/track/${o.order_number}`} className="btn btn-outline btn-sm whitespace-nowrap">ติดตาม</Link>
                  {cancellable && (
                    <button
                      onClick={() => handleCancel(o.order_number)}
                      disabled={cancelling === o.order_number}
                      data-testid={'cancel-' + o.order_number}
                      className="btn btn-outline btn-sm text-red-600 whitespace-nowrap disabled:opacity-50"
                    >
                      {cancelling === o.order_number ? 'กำลังยกเลิก…' : 'ยกเลิก'}
                    </button>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
