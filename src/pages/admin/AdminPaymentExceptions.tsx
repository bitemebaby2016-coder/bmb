// ============================================
// Bite Me Baby — Admin Payment Exceptions (STEP 3B-2E)
// ============================================
// READ-ONLY operational view. The backend/payment provider remains the SOLE
// authority: this page NEVER marks payments paid, NEVER mutates orders.status,
// and NEVER issues refunds. Canonical actions (confirm_offline_payment,
// stripe-refund EF, webhook record_payment_result) continue to live in their
// existing paths — the view points operators there instead of duplicating them.
// Reads only fields permitted by the existing admin RLS; no card/CVV/secret
// data is displayed (payment_intents has no sensitive credential columns).

import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { getPaymentExceptionOrders, getPaymentIntentsFor, classifyPaymentException, groupPaymentExceptions, PAYMENT_EXCEPTION_META, type PaymentExceptionKind, type PaymentIntentLite } from '@/lib/paymentExceptions'
import type { OrderForm } from '@/lib/bmbAdminApi_orders'
import { orderModeBadge } from '@/lib/adminOrderDisplay'
import { showToast } from '@/components/ui/ToastContainer'

const SECTION_ORDER: PaymentExceptionKind[] = [
  'WEBHOOK_MISMATCH', 'MISSING_INTENT', 'STALE_UNPAID', 'PENDING_UNPAID', 'PROCESSING',
  'INTENT_FAILED', 'PARTIAL_REFUND', 'REFUNDED', 'OK_COD_AWAITED', 'OK_PAID',
]
const SECTION_TITLE: Record<PaymentExceptionKind, string> = {
  WEBHOOK_MISMATCH: '⚠ Webhook mismatch (ต้องตรวจ)',
  MISSING_INTENT: '⚠ ไม่พบ payment intent',
  STALE_UNPAID: '⚠ ค้างชำระเกิน 24 ชม.',
  PENDING_UNPAID: '⏳ Pending (รอชำระ)',
  PROCESSING: '🔄 Processing',
  INTENT_FAILED: '❌ Payment failed',
  PARTIAL_REFUND: '↩️ Partial Refund',
  REFUNDED: '↩️ Refund',
  OK_COD_AWAITED: '💵 COD (รอเก็บตอนส่ง — ปกติ)',
  OK_PAID: '✅ Paid (อ้างอิง)',
}

export function AdminPaymentExceptions() {
  const [rows, setRows] = useState<Array<{ order: OrderForm; kind: PaymentExceptionKind; intent: PaymentIntentLite | null }>>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const orders = await getPaymentExceptionOrders()
      const intents = await getPaymentIntentsFor(orders.map((o) => o.order_number))
      const byOrder = new Map<string, PaymentIntentLite[]>()
      for (const i of intents) {
        const list = byOrder.get(i.order_number) || []
        list.push(i)
        byOrder.set(i.order_number, list)
      }
      setRows(orders.map((o) => {
        const oi = byOrder.get(o.order_number) || []
        const c = classifyPaymentException(o, oi)
        return { order: o, kind: c.kind, intent: oi[0] || null }
      }))
    } catch (e) {
      console.error('[AdminPaymentExceptions] load failed:', e)
      showToast('โหลดข้อมูลไม่สำเร็จ', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const groups = groupPaymentExceptions(rows)
  const attention = rows.filter((r) => PAYMENT_EXCEPTION_META[r.kind].attention).length

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h1 className="text-3xl font-bold text-brand-accent">💳 Payment Exceptions (read-only)</h1>
        <div className="flex gap-2">
          <button onClick={() => { void load() }} className="btn btn-outline text-sm" disabled={loading}>รีเฟรช</button>
          <Link to="/admin/orders" className="btn btn-outline text-sm">ไปที่ Orders (จัดการ)</Link>
        </div>
      </div>

      <p className="text-xs text-brand-muted mb-4">
        หน้านี้อ่านสถานะจาก canonical payment authority เท่านั้น (orders.payment_status + payment_intents) — ห้าม mark paid เอง,
        การยืนยันเงินสด/PromptPay ทำผ่าน Admin Orders (confirm_offline_payment), refund ผ่าน stripe-refund (EF, admin-only)
        · พบรายการต้องเฝ้าดู: <b>{attention}</b>
      </p>

      {loading ? (
        <div className="card text-center py-8"><p className="text-brand-muted">กำลังโหลด…</p></div>
      ) : rows.length === 0 ? (
        <div className="card text-center py-12"><div className="text-5xl mb-3">🎉</div><p className="text-brand-muted">ไม่มี payment ที่ต้องเฝ้าดู</p></div>
      ) : (
        <div className="space-y-5">
          {SECTION_ORDER.filter((k) => groups[k].length > 0).map((k) => (
            <div key={k} className="card">
              <h3 className="font-bold text-brand-accent mb-3">{SECTION_TITLE[k]} ({groups[k].length})</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-brand-bg"><tr>
                    <th className="p-2">ออเดอร์</th><th className="p-2">โหมด</th><th className="p-2">สถานะ order</th>
                    <th className="p-2">วิธีชำระ</th><th className="p-2">สถานะชำระ</th><th className="p-2">จำนวน</th>
                    <th className="p-2">อ้างอิง provider</th><th className="p-2">อัปเดต</th>
                  </tr></thead>
                  <tbody>
                    {groups[k].map((r) => {
                      const mode = orderModeBadge(r.order.order_mode, r.order.scheduled_date)
                      return (
                        <tr key={r.order.order_number} className="border-b border-brand-border">
                          <td className="p-2 font-mono">{r.order.order_number}</td>
                          <td className="p-2">{mode.label}</td>
                          <td className="p-2">{r.order.status}</td>
                          <td className="p-2">{r.order.payment_method || '—'}</td>
                          <td className="p-2"><span className={'badge ' + PAYMENT_EXCEPTION_META[r.kind].cls}>{PAYMENT_EXCEPTION_META[r.kind].label}</span></td>
                          <td className="p-2">{Number(r.order.total_amount || 0).toFixed(2)}</td>
                          <td className="p-2 text-xs text-brand-muted">
                            {r.intent?.payment_intent_id ? String(r.intent.payment_intent_id).slice(0, 18) : (r.intent?.status ?? '—')}
                            {r.intent?.failure_reason ? <div className="text-red-500">{String(r.intent.failure_reason).slice(0, 40)}</div> : null}
                          </td>
                          <td className="p-2 text-xs text-brand-muted">{new Date(r.order.updated_at || r.order.created_at).toLocaleString('th-TH')}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
