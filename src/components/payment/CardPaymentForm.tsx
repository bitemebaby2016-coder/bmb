// ============================================
// Bite Me Baby — Card payment form (P0-5 card flow · Omise cutover)
// ============================================
// Two providers, ONE authority boundary:
//   - OMISE (active when a real published key is configured — handoff §5.2):
//     card fields → Omise.js token (browser straight to Omise, PCI stays with
//     Omise) → omise-checkout EF (amount re-derived SERVER-SIDE) → charge
//     returns `pending` + authorize_uri (3-D Secure) → redirect there →
//     omise-webhook EF records the result via record_payment_result. The
//     browser never marks an order paid.
//   - STRIPE (legacy fallback while the cutover is unverified): card data via
//     Stripe.js Elements, client_secret + confirmCardPayment, stripe-webhook EF
//     records the result — behavior unchanged.
//   - client_secret / charge ids are never persisted, never logged, never sent
//     anywhere but the provider.
// ============================================

import { useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { writeAuditLog } from '@/lib/auditLog'
import { showToast } from '@/components/ui/ToastContainer'
import { isOmiseConfigured, omiseCreateCardToken } from '@/lib/omise'
import { createCheckout } from '@/lib/paymentGateway'

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

// ============================================
// OMISE branch — card fields → Omise.js token → omise-checkout EF
// ============================================
function OmiseCardForm({ orderNumber, amount }: { orderNumber: string; amount: number }) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fields, setFields] = useState({ name: '', number: '', month: '', year: '', cvc: '', postal: '' })

  const upd = (key: keyof typeof fields) => (e: ChangeEvent<HTMLInputElement>) =>
    setFields((f) => ({ ...f, [key]: e.target.value }))

  async function handlePay() {
    setBusy(true)
    setError('')
    try {
      const number = fields.number.replace(/[\s-]+/g, '')
      const year = fields.year.length === 2 ? `20${fields.year}` : fields.year
      if (!fields.name.trim() || number.length < 12 || !fields.month || !year || fields.cvc.length < 3) {
        setError('กรุณากรอกข้อมูลบัตรให้ครบ')
        return
      }

      // 1) Tokenize DIRECTLY with Omise (card data never touches our servers).
      const tokenRes = await omiseCreateCardToken({
        name: fields.name.trim(),
        number,
        expiration_month: String(Number(fields.month)),
        expiration_year: year,
        security_code: fields.cvc,
        postal_code: fields.postal.trim() || undefined,
      })
      if (!tokenRes.ok || !tokenRes.token) {
        setError(tokenRes.error || 'ไม่สามารถอ่านข้อมูลบัตรได้ — ลองใหม่อีกครั้ง')
        showToast('ข้อมูลบัตรไม่ถูกต้อง — ตรวจสอบแล้วลองใหม่', 'error')
        return
      }

      // 2) Charge SERVER-SIDE (amount re-derived from the DB in the EF).
      const res = await createCheckout(orderNumber, { cardToken: tokenRes.token })
      if (!res.ok) {
        setError(res.error || 'ERR_CHECKOUT_FAILED')
        showToast('การชำระเงินไม่สำเร็จ: ' + String(res.error || '').slice(0, 80), 'error')
        return
      }

      // 3) 3-D Secure: redirect ไปหน้ายืนยันตัวตนของ Omise → กลับมาที่
      //    /payment/:orderNumber (return_uri) — webhook บันทึกผลเอง, client ไม่ mark paid.
      if (res.authorize_uri && res.charge_status === 'pending') {
        writeAuditLog({
          action: 'payment_processed',
          entity_type: 'order',
          entity_id: orderNumber,
          description: 'Omise 3DS redirect #' + orderNumber,
          metadata: { chargeId: res.charge_id, amount },
        })
        showToast('กำลังเปิดหน้ายืนยันตัวตน 3-D Secure…', 'success')
        window.location.assign(res.authorize_uri)
        return
      }

      // 4) Charge settled immediately (test cards without 3DS) — the webhook
      //    still records the authoritative result; this is navigation only.
      if (res.charge_status === 'successful') {
        writeAuditLog({
          action: 'payment_processed',
          entity_type: 'order',
          entity_id: orderNumber,
          description: 'Omise card charge #' + orderNumber,
          metadata: { chargeId: res.charge_id, amount },
        })
        showToast('ชำระเงินสำเร็จ — ระบบบันทึกผลอัตโนมัติ', 'success')
        setTimeout(() => navigate('/track/' + orderNumber), 1500)
        return
      }

      setError('สถานะการชำระไม่สมบูรณ์ — ลองใหม่อีกครั้ง')
    } catch (e: unknown) {
      setError(String((e as Error)?.message || e).slice(0, 120))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card mb-6 bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-200">
      <h3 className="font-bold text-brand-accent mb-4">บัตรเครดิต/เดบิต (Omise)</h3>
      <p className="text-xs text-brand-muted mb-3">ยอดชำระ ฿{amount.toFixed(2)} — ข้อมูลบัตรถูกส่งตรงถึง Omise (PCI)</p>
      <div className="space-y-2 mb-3" data-testid="omise-card-form">
        <input type="text" data-testid="omise-card-name" autoComplete="cc-name" placeholder="ชื่อบนบัตร" value={fields.name} onChange={upd('name')} className="input" disabled={busy} />
        <input type="text" data-testid="omise-card-number" autoComplete="cc-number" inputMode="numeric" placeholder="เลขบัตร" value={fields.number} onChange={upd('number')} className="input" disabled={busy} />
        <div className="flex gap-2">
          <input type="text" data-testid="omise-card-exp" autoComplete="cc-exp-month" inputMode="numeric" placeholder="MM" maxLength={2} value={fields.month} onChange={upd('month')} className="input flex-1" disabled={busy} />
          <input type="text" data-testid="omise-card-year" autoComplete="cc-exp-year" inputMode="numeric" placeholder="YYYY" maxLength={4} value={fields.year} onChange={upd('year')} className="input flex-1" disabled={busy} />
          <input type="text" data-testid="omise-card-cvc" autoComplete="cc-csc" inputMode="numeric" placeholder="CVC" maxLength={4} value={fields.cvc} onChange={upd('cvc')} className="input flex-1" disabled={busy} />
        </div>
        <input type="text" data-testid="omise-card-postal" autoComplete="postal-code" placeholder="รหัสไปรษณีย์ (ถ้ามี)" value={fields.postal} onChange={upd('postal')} className="input" disabled={busy} />
      </div>
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      <button onClick={() => void handlePay()} disabled={busy} data-testid="pay-card" className="btn btn-success w-full text-lg py-3 disabled:opacity-50">
        {busy ? 'กำลังตัดบัตร…' : 'ยืนยันชำระเงิน'}
      </button>
    </div>
  )
}

/** Card branch wrapper — falls back to a clear "not configured" state. */
export function CardPaymentSection({ clientSecret, orderNumber, amount }: { clientSecret?: string | null; orderNumber: string; amount: number }) {
  // Omise cutover (handoff §5.2 step 3): with a real published key the card
  // form runs through Omise.js; without it the Stripe branch below keeps the
  // flow working (env-driven fallback, never a hard break).
  if (isOmiseConfigured()) {
    return <OmiseCardForm orderNumber={orderNumber} amount={amount} />
  }
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