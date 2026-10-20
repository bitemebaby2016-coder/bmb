import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { getOrder } from '@/lib/bmbAdminApi_orders'
import { submitOfflinePaymentReference, getPaymentIntents, createPaymentIntent, uploadPaymentSlip, submitPaymentSlip } from '@/lib/paymentGateway'
import { CardPaymentSection } from '@/components/payment/CardPaymentForm'
import { isOmiseConfigured } from '@/lib/omise'
import { writeAuditLog } from '@/lib/auditLog'
import { showToast } from '@/components/ui/ToastContainer'
import { MascotBadge } from '@/components/MascotBadge'

export function PaymentConfirmationPage() {
  const { orderNumber } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState<any>(null)
  const [paymentIntent, setPaymentIntent] = useState<any>(null)
  const [transactionId, setTransactionId] = useState('')
  const [isConfirming, setIsConfirming] = useState(false)
  const [retrying, setRetrying] = useState(false)
  // mig 133: หลักฐานการโอน (รูปสลิป) — เก็บ object path ใน payment_intents.slip_path
  const [slipPath, setSlipPath] = useState<string | null>(null)
  const [slipPreview, setSlipPreview] = useState<string | null>(null)
  const [slipUploading, setSlipUploading] = useState(false)
  const ensuredIntent = useRef(false)

  // ✅ Phase 3B §10: server state is polled; intent selection prefers the
  // ACTIVE attempt (pending/processing) — never blindly intents[0] — and a
  // failed attempt is surfaced with a Retry that re-uses the SAME order.
  const load = useCallback(async () => {
    if (!orderNumber) return
    const o = await getOrder(orderNumber)
    if (o) setOrder(o)
    const intents = await getPaymentIntents({ orderNumber })
    const active = intents.find((i) => i.status === 'pending' || i.status === 'processing')
    setPaymentIntent(active ?? intents[0] ?? null)
    // mig 133: MISSING_INTENT กันหลุด — สร้าง intent ให้เองตอนเปิดหน้าจ่ายเงิน
    // (create_payment_intent_record เช็คยอด + เจ้าของออเดอร์ฝั่ง server อยู่แล้ว)
    if (!ensuredIntent.current && intents.length === 0 && o && o.payment_status === 'pending'
      && (o.payment_method === 'promptpay_qr' || o.payment_method === 'cash_on_delivery')) {
      ensuredIntent.current = true
      await createPaymentIntent(orderNumber, o.total_amount ?? 0, o.payment_method)
      const retry = await getPaymentIntents({ orderNumber })
      setPaymentIntent(retry.find((i) => i.status === 'pending' || i.status === 'processing') ?? retry[0] ?? null)
    }
  }, [orderNumber])

  useEffect(() => {
    void load()
    const t = setInterval(() => void load(), 15000) // READ-ONLY polling
    return () => clearInterval(t)
  }, [load])

  async function handleRetryPayment() {
    if (!orderNumber || retrying) return
    setRetrying(true)
    // Same order, new attempt — NO second order, NO cart mutation.
    const res = await createPaymentIntent(orderNumber, order?.total_amount ?? 0, order?.payment_method ?? 'promptpay_qr')
    if (res.success) showToast('สร้างรายการชำระใหม่สำเร็จ — ลองชำระอีกครั้งได้เลย', 'success')
    else showToast(res.error || 'สร้างรายการชำระใหม่ไม่สำเร็จ', 'error')
    await load()
    setRetrying(false)
  }

  async function handleSlipFile(file: File | undefined) {
    if (!file || !orderNumber) return
    if (!file.type.startsWith('image/')) { showToast('กรุณาเลือกไฟล์รูปภาพ', 'error'); return }
    if (file.size > 8 * 1024 * 1024) { showToast('ไฟล์ใหญ่เกิน 8MB', 'error'); return }
    setSlipUploading(true)
    const res = await uploadPaymentSlip(orderNumber, file)
    if (res.success && res.path) {
      setSlipPath(res.path)
      setSlipPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return URL.createObjectURL(file)
      })
      showToast('อัปโหลดสลิปแล้ว ✓', 'success')
    } else {
      showToast(res.error || 'อัปโหลดสลิปไม่สำเร็จ', 'error')
    }
    setSlipUploading(false)
  }

  async function handlePromptPaySubmit() {
    if (!orderNumber) return
    setIsConfirming(true)
    // P0-5: customer only SUBMITS evidence (TXN ref + slip image).
    // The kitchen verifies and confirms the payment — the client cannot mark paid.
    // Order matters: TXN first (pending → processing via 008 B.4), then the slip
    // (mig 133 accepts pending|processing) so BOTH pieces of evidence land.
    let ok = true
    let errMsg = ''
    if (transactionId) {
      const result = await submitOfflinePaymentReference(orderNumber, transactionId)
      if (result.success) {
        writeAuditLog({ action: 'payment_processed', entity_type: 'order', entity_id: orderNumber, description: 'PromptPay TXN submitted #' + orderNumber, metadata: { transactionId } })
      } else {
        ok = false
        errMsg = result.error || 'Failed'
      }
    }
    if (ok && slipPath) {
      const slipRes = await submitPaymentSlip(orderNumber, slipPath)
      if (slipRes.success) {
        writeAuditLog({ action: 'payment_processed', entity_type: 'order', entity_id: orderNumber, description: 'PromptPay slip attached #' + orderNumber, metadata: { slipPath } })
      } else {
        ok = false
        errMsg = slipRes.error || 'Failed'
      }
    }
    if (ok) {
      showToast('ส่งข้อมูลการชำระเงินแล้ว — รอแอดมินตรวจสอบ', 'success')
      setTimeout(() => navigate('/track/' + orderNumber), 1500)
    } else {
      showToast(errMsg || 'Failed', 'error')
    }
    setIsConfirming(false)
  }

  if (!order) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <div className="text-6xl mb-4">🔍</div>
        <h1 className="text-2xl font-bold text-brand-accent mb-4">Not Found</h1>
        <p className="text-brand-muted mb-6">Invalid order number</p>
        <Link to="/" className="btn btn-primary">Back</Link>
      </div>
    )
  }

  const isPaid = order.payment_status === 'paid'
  const isPending = order.payment_status === 'pending'
  // Card flow (P0-5): the client_secret is handed through navigation state by
  // CheckoutPage. A page refresh loses it — the customer then sees the honest
  // "not ready" card and can retry from the failed-payment path instead.
  const locationState = (typeof window !== 'undefined' && (window.history?.state as { usr?: { clientSecret?: string } })?.usr) || null
  const cardClientSecret = (locationState as { clientSecret?: string } | null)?.clientSecret ?? paymentIntent?.client_secret ?? null

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-brand-accent">Payment Confirmation</h1>
        <Link to={'/track/' + orderNumber} className="btn btn-outline">Track Order</Link>
      </div>
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm text-brand-muted">Order Number</div>
            <div className="text-xl font-bold text-brand-accent">{order.order_number}</div>
            {/* Owner 2026-10-20: หน้าชำระเงินต้องบอกชัดว่าเป็นออเดอร์ประเภทไหน */}
            <div className="mt-1 flex items-center gap-2">
              <span className={'badge ' + (order.order_mode === 'PRE_ORDER' ? 'badge-info' : 'badge-warning')}>
                {order.order_mode === 'PRE_ORDER' ? '📅 พรีออเดอร์ (สั่งล่วงหน้า)' : '⚡ สั่งวันนี้ (Same-day)'}
              </span>
              {order.order_mode === 'PRE_ORDER' && order.scheduled_date ? (
                <span className="text-xs text-brand-muted">จัดส่งวันที่ {order.scheduled_date}</span>
              ) : null}
            </div>
          </div>
          <span className={'badge ' + (isPaid ? 'badge-success' : isPending ? 'badge-warning' : 'badge-primary')}>{order.payment_status}</span>
        </div>
        <div className="border-t border-brand-border pt-4 space-y-2">
          <div className="flex justify-between"><span>Customer</span><span>{order.customer_name}</span></div>
          <div className="flex justify-between"><span>Phone</span><span>{order.customer_phone}</span></div>
          <div className="flex justify-between"><span>Payment</span><span>{order.payment_method === 'promptpay_qr' ? 'PromptPay (โอนผ่าน QR ของร้าน — ยืนยันโดยแอดมิน)' : order.payment_method === 'credit_card' ? `บัตรเครดิต/เดบิต (${isOmiseConfigured() ? 'Omise' : 'Stripe'})` : 'เงินสดตอนรับของ'}</span></div>
          {order.delivery_method === 'pickup' && (
            <div className="rounded-lg border-2 border-brand-primary bg-orange-50 p-3 mt-2 text-center" data-testid="pickup-code-block">
              <div className="text-sm text-slate-700">รหัสรับอาหาร (แสดงที่หน้าร้าน)</div>
              <div className="text-3xl font-bold tracking-[0.3em] text-slate-900">{order.pickup_code || '------'}</div>
              <div className="text-xs text-slate-600 mt-1">รับที่ร้าน · ค่าจัดส่งฟรี</div>
            </div>
          )}
          {/* Owner fix 2026-10-19: โชว์การคำนวณทั้งหมด — เดิมมีแค่ Total ทำให้ยอดดู
              "เหมือนมีส่วนลดลอย ๆ" (ส่วนลด/ค่าส่งถูกหักจริงโดย server แต่ไม่แสดง) */}
          <div className="flex justify-between"><span>สินค้า</span><span>฿{Number(order.subtotal ?? 0).toFixed(2)}</span></div>
          {Number(order.discount_amount ?? 0) > 0 && (
            <div className="flex justify-between text-green-600"><span>ส่วนลด</span><span>-฿{Number(order.discount_amount).toFixed(2)}</span></div>
          )}
          <div className="flex justify-between"><span>ค่าจัดส่ง</span><span>฿{Number(order.delivery_fee ?? 0).toFixed(2)}</span></div>
          <div className="flex justify-between text-xl font-bold pt-2 border-t border-brand-border"><span>Total</span><span className="text-brand-primary">฿{order.total_amount.toFixed(2)}</span></div>
          <p className="text-xs text-brand-muted">ยอดนี้ = สินค้า − ส่วนลด + ค่าจัดส่ง (ระบบคำนวณจากเซิร์ฟเวอร์ตอนสร้างออเดอร์)</p>
        </div>
      </div>
      {isPending && order.payment_method === 'promptpay_qr' && (
        <div className="card mb-6 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200">
          <h3 className="font-bold text-brand-accent mb-2">PromptPay — ชำระเงินด้วยตนเอง</h3>
          {/* CR-2 P3: static shop QR (Owner-verified asset). No dynamic amount. */}
          <div className="text-center mb-3">
            <img
              src="/assets/Qr%20Code/BMB_Promptpay_Qr.webp"
              alt="QR PromptPay ของร้าน Bite Me Baby"
              width={220}
              height={220}
              className="mx-auto rounded-lg border border-green-300 bg-white p-2"
              data-testid="promptpay-qr"
            />
            <p className="text-xs text-brand-muted mt-1">สแกนด้วยแอปธนาคาร/ PromptPay แล้วโอนตามยอดออเดอร์ด้านบน</p>
          </div>
          <ol className="text-sm mb-4 list-decimal list-inside space-y-1">
            <li>สแกน QR ด้านบนและโอน <strong>฿{order.total_amount.toFixed(2)}</strong></li>
            <li>คัดลอก <strong>เลขธุรกรรม (Transaction ID / Ref.)</strong> จากสลิป</li>
            <li>นำมาใส่ด้านล่าง หรือแนบรูปสลิป (แนะนำ) แล้วกด “ส่งข้อมูลการชำระเงิน”</li>
          </ol>
          <div className="mb-4">
            <label className="block text-sm font-medium text-brand-accent mb-2">📸 แนบสลิปการโอน (แนะนำ — แอดมินใช้ตรวจ)</label>
            {slipPreview ? (
              <div className="flex items-start gap-3" data-testid="slip-box">
                <img src={slipPreview} alt="สลิปการโอน" data-testid="slip-preview" className="w-28 h-28 object-cover rounded-lg border-2 border-brand-border" />
                <div>
                  <p className="text-xs text-green-700 font-medium mb-1">✓ เลือกรูปสลิปแล้ว</p>
                  <label className="btn btn-outline btn-sm cursor-pointer">
                    เปลี่ยนรูป
                    <input data-testid="slip-input" type="file" accept="image/*" className="hidden" onChange={(e) => { void handleSlipFile(e.target.files?.[0]); e.target.value = '' }} />
                  </label>
                </div>
              </div>
            ) : (
              <label className="btn btn-outline w-full cursor-pointer">
                📎 เลือกรูปสลิปการโอน
                <input data-testid="slip-input" type="file" accept="image/*" className="hidden" onChange={(e) => { void handleSlipFile(e.target.files?.[0]); e.target.value = '' }} />
              </label>
            )}
            {slipUploading && <p className="text-xs text-brand-muted mt-1">⏳ กำลังอัปโหลดสลิป…</p>}
            {slipPath && !slipUploading && <p className="text-xs text-green-700 mt-1">✅ แนบสลิปแล้ว — รอแอดมินตรวจสอบ</p>}
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-brand-accent mb-2">Transaction ID</label>
            <input data-testid="txn-input" type="text" placeholder="Enter Transaction ID" value={transactionId} onChange={(e) => setTransactionId(e.target.value)} className="input mb-3" />
          </div>
          <p className="text-xs mb-3" style={{ color: '#b45309' }}>
            ⚠️ การส่งเลขธุรกรรม <strong>ยังไม่เท่ากับการชำระเงินได้รับการยืนยัน</strong> — แอดมินตรวจสอบสลิปก่อน แล้วระบบจะเปลี่ยนสถานะเป็น “ชำระเงินแล้ว” ให้
          </p>
          <button data-testid="confirm-payment" onClick={handlePromptPaySubmit} disabled={isConfirming || slipUploading || (!transactionId && !slipPath)} className="btn btn-success w-full text-lg py-3 disabled:opacity-50">
            {isConfirming ? 'กำลังส่ง...' : 'ส่งข้อมูลการชำระเงิน'}
          </button>
        </div>
      )}
      {isPending && order.payment_method === 'credit_card' && (
        <CardPaymentSection clientSecret={cardClientSecret} orderNumber={order.order_number} amount={order.total_amount} />
      )}
      {isPending && order.payment_method === 'cash_on_delivery' && (
        <div className="card mb-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200">
          <h3 className="font-bold text-brand-accent mb-4">เงินสดตอนรับของ</h3>
          <p className="text-brand-muted mb-4">เงินจะถูกเก็บตอนส่งของ — ไม่ต้องชำระตอนนี้</p>
          <span className="badge badge-info">⏳ รอเก็บเงินตอนรับของ (delivered)</span>
        </div>
      )}
      {/* ✅ Phase 3B §10: failed payment → retry on the SAME order */}
      {order.payment_status === 'failed' && (
        <div className="card mb-6 bg-gradient-to-br from-red-50 to-rose-50 border-2 border-red-200 text-center py-6">
          <h3 className="text-xl font-bold text-red-700 mb-2">การชำระเงินไม่สำเร็จ</h3>
          <p className="text-brand-muted mb-4">ลองชำระใหม่อีกครั้ง — ออเดอร์เดิมของคุณยังอยู่ (ไม่มีการสร้างออเดอร์ใหม่)</p>
          <button onClick={handleRetryPayment} disabled={retrying} data-testid="retry-payment" className="btn btn-primary disabled:opacity-50">
            {retrying ? 'กำลังสร้างรายการใหม่…' : 'ลองชำระเงินอีกครั้ง'}
          </button>
        </div>
      )}
      {isPaid && (
        <div className="card mb-6 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 text-center py-6">
          {/* Mascot pose=`bye` — payment success / thank-you (Pose Map §18.2) */}
          <MascotBadge pose="bye" size="lg" alt="Bite the mascot waving goodbye - payment successful" className="mx-auto mb-3" loading="eager" />
          <h3 className="text-xl font-bold text-green-700 mb-2">Payment Successful</h3>
          <p className="text-brand-muted">This order has been paid. Processing...</p>
          <Link to={'/track/' + orderNumber} className="btn btn-primary mt-4">Track Order</Link>
        </div>
      )}
      {paymentIntent && paymentIntent.receipt_url && (
        <div className="card text-center">
          <a href={paymentIntent.receipt_url} target="_blank" rel="noopener" className="text-brand-primary hover:underline">View Receipt</a>
        </div>
      )}
    </div>
  )
}
