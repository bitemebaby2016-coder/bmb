import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { getOrder } from '@/lib/bmbAdminApi_orders'
import { submitOfflinePaymentReference, getPaymentIntents } from '@/lib/paymentGateway'
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

  useEffect(() => {
    async function load() {
      if (orderNumber) {
        const o = await getOrder(orderNumber)
        if (o) setOrder(o)
        const intents = await getPaymentIntents({ orderNumber })
        if (intents.length > 0) setPaymentIntent(intents[0])
      }
    }
    load()
  }, [orderNumber])

  async function handlePromptPaySubmit() {
    if (!orderNumber) return
    setIsConfirming(true)
    // P0-5: customer only SUBMITS the TXN reference (pending -> processing).
    // The kitchen verifies and confirms the payment — the client cannot mark paid.
    const result = await submitOfflinePaymentReference(orderNumber, transactionId)
    if (result.success) {
      writeAuditLog({ action: 'payment_processed', entity_type: 'order', entity_id: orderNumber, description: 'PromptPay TXN submitted #' + orderNumber, metadata: { transactionId } })
      showToast('ข้อมูลการชำระเงินถูกส่ง — รоยืนยานจาก kitchen', 'success')
      setTimeout(() => navigate('/track/' + orderNumber), 1500)
    } else { showToast(result.error || 'Failed', 'error') }
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
          </div>
          <span className={'badge ' + (isPaid ? 'badge-success' : isPending ? 'badge-warning' : 'badge-primary')}>{order.payment_status}</span>
        </div>
        <div className="border-t border-brand-border pt-4 space-y-2">
          <div className="flex justify-between"><span>Customer</span><span>{order.customer_name}</span></div>
          <div className="flex justify-between"><span>Phone</span><span>{order.customer_phone}</span></div>
          <div className="flex justify-between"><span>Payment</span><span>{order.payment_method === 'promptpay_qr' ? 'PromptPay QR' : 'COD'}</span></div>
          <div className="flex justify-between text-xl font-bold pt-2 border-t border-brand-border"><span>Total</span><span className="text-brand-primary">฿{order.total_amount.toFixed(2)}</span></div>
        </div>
      </div>
      {isPending && order.payment_method === 'promptpay_qr' && (
        <div className="card mb-6 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200">
          <h3 className="font-bold text-brand-accent mb-4">PromptPay Confirmation</h3>
          <div className="mb-4">
            <label className="block text-sm font-medium text-brand-accent mb-2">Transaction ID</label>
            <input data-testid="txn-input" type="text" placeholder="Enter Transaction ID" value={transactionId} onChange={(e) => setTransactionId(e.target.value)} className="input mb-3" />
          </div>
          <button data-testid="confirm-payment" onClick={handlePromptPaySubmit} disabled={isConfirming || !transactionId} className="btn btn-success w-full text-lg py-3 disabled:opacity-50">
            {isConfirming ? 'กำลังส่ง...' : 'ส่งข้อมูลการชำระเงิน'}
          </button>
        </div>
      )}
      {isPending && order.payment_method === 'cash_on_delivery' && (
        <div className="card mb-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200">
          <h3 className="font-bold text-brand-accent mb-4">เงินสดตอนรับของ</h3>
          <p className="text-brand-muted mb-4">เงินจะถูกเก็บตอนส่งของ — ไม่ต้องชำระตอนนี้</p>
          <span className="badge badge-info">⏳ รอเก็บเงินตอนรับของ (delivered)</span>
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
