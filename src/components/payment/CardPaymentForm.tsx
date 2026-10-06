// ============================================
// Bite Me Baby — Stripe card payment form (P0-5 completion: card flow)
// ============================================
// Authority boundary (same as every other payment path):
//   - the amount was derived SERVER-SIDE in create-checkout; this form only
//     submits the card data via Stripe.js (PCI stays with Stripe Elements).
//   - the payment RESULT is recorded by the stripe-webhook EF through an
//     idempotent service-role RPC — a successful confirmCardPayment here is
//     shown as "awaiting confirmation" until the webhook lands, never marked
//     paid by the client.
//   - client_secret arrives through navigation state from CheckoutPage; it is
//     never persisted, never logged, never sent anywhere but Stripe.
// ============================================

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { writeAuditLog } from '@/lib/auditLog'
import { showToast } from '@/components/ui/ToastContainer'

const PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY_LIVE as string | undefined

export function isCardFlowConfigured(): boolean {
  return typeof PUBLISHABLE_KEY === 'string' && PUBLISHABLE_KEY.startsWith('pk_live_')
}

/** Lazily-kept Stripe.js promise — Stripe.js must be a singleton per page. */
let stripePromise: Promise<any> | null = null
export function getStripePromise(): Promise<any> | null {
  if (!isCardFlowConfigured()) return null
  if (!stripePromise) stripePromise = loadStripe(PUBLISHABLE_KEY as string)
  return stripePromise
}

function CardForm({ clientSecret, orderNumber, amount }: { clientSecret: string; orderNumber: string; amount: number }) {
  const stripe = useStripe()
  const elements = useElements()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handlePay() {
    if (!stripe || !elements) return
    setBusy(true)
    setError('')
    try {
      const card = elements.getElement(CardElement)
      if (!card) {
        setError('กรุณากรอกข้อมูลบัตร')
        return
      }
      const res = await stripe.confirmCardPayment(clientSecret, { payment_method: { card } })

      if (res.error) {
        // Real failure (declined / 3DS failed / network). The webhook will have
        // recorded it as failed — surface, never fabricate a success.
        setError(res.error.message || 'การชำระเงินไม่สำเร็จ')
        showToast('การชำระเงินไม่สำเร็จ: ' + String(res.error.message || '').slice(0, 80), 'error')
        return
      }

      const intent = res.paymentIntent
      if (intent && (intent.status === 'succeeded' || intent.status === 'processing')) {
        writeAuditLog({
          action: 'payment_processed',
          entity_type: 'order',
          entity_id: orderNumber,
          description: 'Stripe card confirm #' + orderNumber,
          metadata: { intentStatus: intent.status, intentId: intent.id, amount },
        })
        showToast('ชำระเงินสำเร็จ — ระบบบันทึกผลอัตโนมัติ', 'success')
        setTimeout(() => navigate('/track/' + orderNumber), 1500)
      } else {
        setError('สถานะการชำระไม่สมบูรณ์ — ลองใหม่อีกครั้ง')
      }
    } catch (e: any) {
      setError(String(e?.message || e).slice(0, 120))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card mb-6 bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-200">
      <h3 className="font-bold text-brand-accent mb-4">บัตรเครดิต/เดบิต (Stripe)</h3>
      <p className="text-xs text-brand-muted mb-3">ยอดชำระ ฿{amount.toFixed(2)} — ข้อมูลบัตรถูกส่งตรงถึง Stripe (PCI)</p>
      <div className="p-3 rounded-lg border border-brand-border bg-white mb-3" data-testid="card-element">
        <CardElement options={{ disabled: busy }} />
      </div>
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      <button onClick={() => void handlePay()} disabled={busy || !stripe} data-testid="pay-card" className="btn btn-success w-full text-lg py-3 disabled:opacity-50">
        {busy ? 'กำลังตัดบัตร…' : 'ยืนยันชำระเงิน'}
      </button>
    </div>
  )
}

/** Card branch wrapper — falls back to a clear "not configured" state. */
export function CardPaymentSection({ clientSecret, orderNumber, amount }: { clientSecret?: string | null; orderNumber: string; amount: number }) {
  const promise = getStripePromise()
  if (!promise || !clientSecret) {
    return (
      <div className="card mb-6 bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200">
        <h3 className="font-bold text-brand-accent mb-2">บัตรเครดิต/เดบิต</h3>
        <p className="text-sm text-brand-muted">ระบบบัตรยังไม่พร้อมในขณะนี้ — ใช้ช่องทางอื่นหรือลองใหม่ภายหลัง</p>
      </div>
    )
  }
  return (
    <Elements stripe={promise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
      <CardForm clientSecret={clientSecret} orderNumber={orderNumber} amount={amount} />
    </Elements>
  )
}