// ============================================
// Bite Me Baby — SlipReviewPanel (A2 · 2026-10-22 · R1.2/D-04 2026-10-23)
// ============================================
// "แผงตรวจสลิปเดียว" — the ONE place where offline-payment verification happens.
// Lists EVERY order awaiting payment check (payment_status='pending') — NOT tied
// to the page/status/mode/branch filters of AdminOrders (D-04: ออเดอร์ที่ถูก
// ตัวกรอง/branch บัง ต้องไม่หายจากแผงตรวจเงิน) — shows the evidence via
// SlipThumb (M5: intents passed in from the parent's single read path) and hosts
// the SINGLE canonical action — confirm_offline_payment — delegated to
// AdminOrders.handleConfirmPayment. The order rows carry NO duplicate confirm
// button anymore (same action = one place).
// R1.2 (D-04): ปุ่มยืนยันปิด + บอกเหตุผลชัดเมื่อ server จะปฏิเสธอยู่แล้ว
// (paymentConfirmability = pure mirror ของเงื่อนไข 008 B.5) — ไม่มีการกดแล้ว
// error ลอย ๆ อีกต่อไป
// READ-ONLY + delegation: no payment/money logic lives here.

import { useState } from 'react'
import type { OrderForm } from '@/lib/bmbAdminApi_orders'
import { paymentConfirmability, type PaymentIntentLite } from '@/lib/paymentExceptions'
import { SlipThumb } from './SlipThumb'

export function SlipReviewPanel({ orders, intentsByOrder, onConfirmPayment }: {
  orders: OrderForm[]
  intentsByOrder: Record<string, PaymentIntentLite[]>
  onConfirmPayment: (orderNumber: string) => void
}) {
  const [open, setOpen] = useState(false)
  const pending = orders.filter((o) => o.payment_status === 'pending')

  if (pending.length === 0) return null

  return (
    <div className="card mb-4" data-testid="slip-review-panel">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 font-bold text-brand-accent"
        data-testid="slip-review-toggle"
      >
        <span>🧾 ตรวจการชำระเงิน/สลิป ({pending.length})</span>
        <span className="text-xs text-brand-muted">{open ? 'ซ่อน ▲' : 'เปิดตรวจ ▼'}</span>
      </button>

      {open && (
        <ul className="mt-3 space-y-3" data-testid="slip-review-list">
          {pending.map((o) => {
            const evidence = intentsByOrder[o.order_number] || []
            const check = paymentConfirmability(o, evidence)
            return (
              <li key={o.order_number} className="rounded-lg border border-brand-border p-3" data-testid="slip-review-item">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-brand-accent">{o.order_number}</div>
                    <div className="text-xs text-brand-muted">
                      {o.customer_name} • {o.customer_phone} • {o.payment_method || '—'} • ฿{Number(o.total_amount || 0).toFixed(2)}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <SlipThumb
                      orderNumber={o.order_number}
                      paymentStatus={o.payment_status || 'pending'}
                      paymentMethod={o.payment_method || ''}
                      intents={evidence}
                    />
                    <button
                      type="button"
                      onClick={() => onConfirmPayment(o.order_number)}
                      disabled={!check.confirmable}
                      className="btn btn-success text-sm disabled:opacity-50"
                      data-testid={`slip-confirm-${o.order_number}`}
                    >
                      ✅ ยืนยันการชำระเงิน
                    </button>
                  </div>
                </div>
                {!check.confirmable && (
                  <p className="mt-2 text-xs text-amber-700" data-testid={`slip-reason-${o.order_number}`}>
                    ⚠ {check.reason}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}