// ============================================
// Bite Me Baby — Order Tracking (Phase 3B · canonical, read-only)
// ============================================
// READS canonical order state (orders + order_items + payment_intents) and
// renders it. The UI may poll/refresh — it MUST NOT mutate the lifecycle:
// no hardcoded progression, no timers that change status, no literal order
// data. Migration 023/025 order domain is the only authority.
// ============================================

import { useParams, Link } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import { getOrder, hydrateOrderItems, cancelOrder, type OrderForm } from '@/lib/bmbAdminApi_orders'
import { getServerStatusLabel } from '@/lib/orderVocabulary'
import { getPaymentIntents } from '@/lib/paymentGateway'
import { showToast } from '@/components/ui/ToastContainer'
import { MascotBadge } from '@/components/MascotBadge'

// Canonical server order_status chain (migration 001 enum) → display.
const TIMELINE = [
  { key: 'pending', label: 'รอการยืนยัน', icon: '⏳' },
  { key: 'confirmed', label: 'ยืนยันแล้ว', icon: '✅' },
  { key: 'preparing', label: 'กำลังทำ', icon: '👨‍🍳' },
  { key: 'ready_for_dispatch', label: 'พร้อมส่ง', icon: '📦' },
  { key: 'dispatched', label: 'กำลังจัดส่ง', icon: '🛵' },
  { key: 'in_transit', label: 'กำลังจัดส่ง', icon: '🛵' },
  { key: 'arrived', label: 'ถึงปลายทาง', icon: '📍' },
  { key: 'delivered', label: 'ส่งสำเร็จ', icon: '🏁' },
] as const

const REFRESH_MS = 20000 // READ-ONLY polling cadence (never mutates status)

export function OrderTrackPage() {
  const { orderNumber } = useParams()
  const [order, setOrder] = useState<OrderForm | null>(null)
  const [intents, setIntents] = useState<Array<Record<string, any>>>([])
  const [missing, setMissing] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  // GET/READ → server state → render. Polling refetches; it never writes.
  const load = useCallback(async () => {
    if (!orderNumber) return
    try {
      const o = await getOrder(orderNumber)
      if (!o) { setMissing(true); return }
      const hydrated = await hydrateOrderItems([o])
      setOrder(hydrated[0] ?? o)
      setIntents((await getPaymentIntents({ orderNumber })) as Array<Record<string, any>>)
      setMissing(false)
    } finally {
      setLoaded(true)
    }
  }, [orderNumber])

  useEffect(() => {
    void load()
    const t = setInterval(() => void load(), REFRESH_MS)
    return () => clearInterval(t)
  }, [load])

  async function handleCancel() {
    if (!orderNumber || cancelling) return
    setCancelling(true)
    const res = await cancelOrder(orderNumber, 'customer cancel (PWA)')
    if (res.success) {
      showToast(res.idempotent ? 'ออเดอร์ถูกยกเลิกอยู่แล้ว' : 'ยกเลิกออเดอร์สำเร็จ', 'success')
      await load()
    } else {
      showToast(res.error || 'ยกเลิกไม่สำเร็จ', 'error')
    }
    setCancelling(false)
  }

  if (missing) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <div className="text-6xl mb-4">🔍</div>
        <h1 className="text-2xl font-bold text-brand-accent mb-2">ไม่พบออเดอร์</h1>
        <p className="text-brand-muted mb-6">เลขที่ #{orderNumber} ไม่มีในระบบ หรือไม่ใช่ของคุณ</p>
        <Link to="/orders" className="btn btn-primary">ดูออเดอร์ของฉัน</Link>
      </div>
    )
  }

  if (!loaded || !order) {
    return <div className="max-w-4xl mx-auto px-4 py-6 text-center text-brand-muted">กำลังโหลดสถานะจากระบบ…</div>
  }

  const status = String(order.status)
  const mode = ((order as any).order_mode ?? 'SAME_DAY') as 'SAME_DAY' | 'PRE_ORDER'
  const isTerminalBad = status === 'cancelled' || status === 'failed'
  const stepIndex = TIMELINE.findIndex((s) => s.key === status)
  const activeIdx = stepIndex >= 0 ? stepIndex : TIMELINE.length
  const intent = intents.find((i) => i.status === 'pending' || i.status === 'processing') ?? intents[0]
  const canCancel = status === 'pending'
  const paidCancelled = status === 'cancelled' && order.payment_status === 'paid'

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <Link to="/orders" className="text-brand-primary mb-4 inline-block hover:underline">← กลับหน้าออเดอร์</Link>

      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-brand-accent">📍 ติดตามออเดอร์</h1>
          <span data-testid="track-order-number" className="badge badge-primary">#{order.order_number}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4 text-sm">
          <span className="badge badge-info">{mode === 'PRE_ORDER' ? '📅 จองล่วงหน้า' : '🔥 วันนี้'}</span>
          {order.scheduled_date ? <span className="badge">วันที่จัดส่ง: {order.scheduled_date}</span> : null}
          <span className="badge">รอบ: {String(order.delivery_round_id)}</span>
          <span className="badge">ชำระเงิน: {order.payment_status}</span>
        </div>

        {/* Canonical progress steps — rendered from server state only */}
        {!isTerminalBad && (
          <div className="mb-6">
            <div className="flex items-center justify-between relative">
              <div className="absolute top-6 left-0 right-0 h-1 bg-brand-border z-0"></div>
              <div
                className="absolute top-6 left-0 h-1 w-full bg-brand-primary z-0 origin-left transition-transform duration-500"
                style={{ transform: `scaleX(${Math.min(100, (activeIdx / (TIMELINE.length - 1)) * 100) / 100})` }}
              ></div>
              {TIMELINE.map((step, index) => (
                <div key={step.key} className="relative z-10 flex flex-col items-center">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl ${index <= activeIdx ? 'bg-brand-primary text-white' : 'bg-brand-border text-brand-muted'}`}>
                    {step.icon}
                  </div>
                  <span className={`text-xs mt-2 text-center ${index <= activeIdx ? 'text-brand-primary font-bold' : 'text-brand-muted'}`}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Current status — strictly what the server says */}
        <div className="bg-brand-bg p-4 rounded-xl mb-4" data-testid="track-status">
          <h3 className="font-bold text-brand-accent">{getServerStatusLabel(status, mode)}</h3>
          {status === 'pending' && <p className="text-sm text-brand-muted">กำลังรอยืนยันคำสั่งซื้อจากร้าน</p>}
          {status === 'preparing' && <p className="text-sm text-brand-muted">กำลังจัดเตรียมอาหารของคุณ</p>}
          {status === 'ready_for_dispatch' && <p className="text-sm text-brand-muted">อาหารพร้อมส่ง รอคนส่งรับ</p>}
          {(status === 'dispatched' || status === 'in_transit' || status === 'arrived') && <p className="text-sm text-brand-muted">คนส่งกำลังเดินทาง</p>}
          {status === 'delivered' && <p className="text-sm text-brand-muted">ส่งสำเร็จ! ขอบคุณที่ใช้บริการ</p>}
          {status === 'cancelled' && <p className="text-sm text-brand-muted">ออเดอร์นี้ถูกยกเลิกแล้ว</p>}
          {status === 'failed' && <p className="text-sm text-brand-muted">ออเดอร์นี้ไม่สำเร็จ — ติดต่อร้านได้เลย</p>}
        </div>

        {/* paid-cancelled ≠ refunded: refund is a separate admin operation */}
        {paidCancelled && (
          <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-xl mb-4 text-sm text-yellow-800">
            ออเดอร์นี้ชำระเงินแล้วและถูกยกเลิก — <b>รอดำเนินการคืนเงินโดยร้าน</b> (ยังไม่ได้คืนเงิน)
          </div>
        )}
        {order.payment_status === 'refund' && (
          <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl mb-4 text-sm text-blue-800">คืนเงินสำเร็จแล้ว</div>
        )}

        {canCancel && (
          <button onClick={handleCancel} disabled={cancelling} data-testid="track-cancel" className="btn btn-outline w-full text-red-600 mb-2 disabled:opacity-50">
            {cancelling ? 'กำลังยกเลิก…' : 'ยกเลิกออเดอร์นี้'}
          </button>
        )}
      </div>

      {/* Order details — canonical fields from the DB */}
      <div className="card">
        <h3 className="font-bold text-brand-accent mb-4">รายละเอียดออเดอร์</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-brand-muted">วันที่สั่ง</span>
            <span>{new Date(order.created_at).toLocaleDateString('th-TH')}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-brand-muted">วันที่จัดส่ง</span>
            <span>{order.scheduled_date || new Date(order.created_at).toLocaleDateString('th-TH')}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-brand-muted">รอบจัดส่ง</span>
            <span>{String(order.delivery_round_id)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-brand-muted">วิธีจัดส่ง</span>
            <span>{order.delivery_method || 'self_delivery'}</span>
          </div>
          {(order.items || []).map((item, i) => (
            <div key={item.product_id + '-' + i} className="flex justify-between">
              <span className="text-brand-muted">{item.product_name} × {item.quantity}</span>
              <span>{((item.unit_price || 0) * item.quantity).toFixed(2)} ฿</span>
            </div>
          ))}
          <div className="flex justify-between font-bold border-t border-brand-border pt-2">
            <span>รวม (จากระบบ)</span>
            <span className="text-brand-primary">{Number(order.total_amount).toFixed(2)} บาท</span>
          </div>
          {intent?.receipt_url ? (
            <div className="text-center pt-2">
              <a href={String(intent.receipt_url)} target="_blank" rel="noopener" className="text-brand-primary hover:underline">ดูใบเสร็จ</a>
            </div>
          ) : null}
        </div>
      </div>

      {/* Rating prompt — only when the SERVER says delivered */}
      {status === 'delivered' && (
        <div className="card mt-6 bg-gradient-to-r from-yellow-50 to-orange-50 text-center">
          <MascotBadge pose="bye" size="lg" alt="Bite the mascot waving goodbye - thank you" className="mx-auto mb-2" loading="eager" />
          <h3 className="font-bold text-brand-accent mb-2">รีวิวประสบการณ์ของคุณ</h3>
          <Link to="/reviews" className="btn btn-primary">ไปเขียนรีวิว</Link>
        </div>
      )}
    </div>
  )
}
