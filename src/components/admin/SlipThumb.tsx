// ============================================
// Bite Me Baby — SlipThumb (mig 133): transfer-slip evidence for admins
// ============================================
// PRESENTATIONAL (M5 · 2026-10-22): receives the order's payment_intents rows
// from its parent (single read path = paymentGateway.getPaymentIntents) — no
// self-fetching of intents anymore. Only the storage signed-URL (the image
// itself) is resolved locally.
// READ-ONLY: NEVER mutates payment state — the confirm action stays canonical
// via confirm_offline_payment RPC (one place: the AdminOrders slip panel).
// A7(ก.) · A2 (2026-10-22): NO silent "—" anymore. Every state is explicit:
//   ✓ ตรวจแล้ว          (paid / refund states — verified before)
//   ไม่ต้องตรวจสลิป    (COD / credit card — no slip verification in this flow)
//   ⏳ รอตรวจ           (slip/ref present, admin confirmation pending)
//   ⏳ รอสลิปจากลูกค้า   (promptpay pending, nothing uploaded yet)
//   ⚠ ไม่พบ payment intent (order has NO payment_intents row — A7(ก.) gap!)
//   ⚠ โหลดสลิปไม่ได้     (slip exists but the signed URL failed — RLS/storage)

import { useEffect, useState } from 'react'
import { getPaymentSlipSignedUrl } from '@/lib/paymentGateway'
import type { PaymentIntentLite } from '@/lib/paymentExceptions'

export interface SlipThumbProps {
  orderNumber: string
  /** orders.payment_status (canonical: pending|paid|refund|partially_refunded) */
  paymentStatus: string
  /** orders.payment_method */
  paymentMethod: string
  /** payment_intents rows of THIS order — fetched once by the parent (M5) */
  intents: PaymentIntentLite[]
}

const VERIFIED_STATUSES = new Set(['paid', 'refund', 'partially_refunded'])
const NO_SLIP_CHECK_METHODS = new Set(['cash_on_delivery', 'credit_card'])

function readReference(intents: PaymentIntentLite[]): string {
  const withSlip = intents.find((i) => i.slip_path)
  const raw = (intents[0]?.metadata as Record<string, unknown> | undefined)?.reference
    ?? (withSlip?.metadata as Record<string, unknown> | undefined)?.reference
  const ref = raw == null ? '' : String(raw)
  return ref === 'undefined' ? '' : ref
}

export function SlipThumb({ orderNumber, paymentStatus, paymentMethod, intents }: SlipThumbProps) {
  const withSlip = intents.find((i) => i.slip_path) ?? null
  const reference = readReference(intents)
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setSignedUrl(null)
    setLoadError(false)
    const path = withSlip?.slip_path
    if (!path) return
    void (async () => {
      try {
        const url = await getPaymentSlipSignedUrl(path)
        if (cancelled) return
        if (url) setSignedUrl(url)
        else setLoadError(true) // explicit — never a silent "—"
      } catch {
        if (!cancelled) setLoadError(true)
      }
    })()
    return () => { cancelled = true }
  }, [withSlip?.slip_path])

  const verified = VERIFIED_STATUSES.has(paymentStatus)
  const noCheck = NO_SLIP_CHECK_METHODS.has((paymentMethod || '').trim())
  const slipImage = signedUrl
    ? (
      <a href={signedUrl} target="_blank" rel="noopener" title="ดูสลิปเต็ม">
        <img
          src={signedUrl}
          alt={`สลิปการโอน ${orderNumber}`}
          data-testid="slip-thumb-img"
          className="w-12 h-12 object-cover rounded-lg border-2 border-brand-border"
          loading="lazy"
        />
      </a>
    )
    : null

  // ⚠ ทุกออเดอร์ต้องมี payment_intents (A7(ก.)) — ถ้าไม่มีต้องโชว์ให้เห็น ไม่ใช่หายเงียบ
  if (intents.length === 0) {
    return (
      <span
        className="inline-flex items-center gap-2 text-xs text-red-600"
        data-testid={`slip-thumb-${orderNumber}`}
        title="ออเดอร์นี้ยังไม่มี payment_intents row — ฝั่ง checkout ต้องสร้าง intent ทุกออเดอร์ (A7 ก.)"
      >
        <span data-testid="slip-missing-intent">⚠ ไม่พบ payment intent</span>
      </span>
    )
  }

  // ✓ ตรวจแล้ว — เคยยืนยันการชำระเงินแล้ว (paid หรือเคย paid ก่อนคืนเงิน)
  if (verified) {
    return (
      <span className="inline-flex items-center gap-2" data-testid={`slip-thumb-${orderNumber}`}>
        {slipImage}
        <span className="text-xs text-green-600 font-medium" data-testid="slip-verified">
          {paymentStatus === 'paid' ? '✓ ตรวจแล้ว' : paymentStatus === 'refund' ? '✓ เคยตรวจแล้ว · คืนเงินแล้ว' : '✓ เคยตรวจแล้ว · คืนเงินบางส่วน'}
        </span>
        {reference && <span className="text-xs text-brand-muted">ref: {reference}</span>}
      </span>
    )
  }

  // ไม่ต้องตรวจสลิป — COD เก็บเงินปลายทาง / บัตร ระบบ provider ยืนยันเอง
  if (noCheck) {
    return (
      <span className="inline-flex items-center gap-2 text-xs text-brand-muted" data-testid={`slip-thumb-${orderNumber}`}>
        <span data-testid="slip-no-check">
          {paymentMethod === 'cash_on_delivery' ? 'ไม่ต้องตรวจสลิป (เก็บเงินปลายทาง)' : 'ไม่ต้องตรวจสลิป (บัตร — ระบบยืนยันเอง)'}
        </span>
      </span>
    )
  }

  // promptpay ที่ยัง pending: มีหลักฐาน → รอตรวจ / ไม่มี → รอสลิป / signed URL พัง → error ชัด
  return (
    <span className="inline-flex items-center gap-2" data-testid={`slip-thumb-${orderNumber}`}>
      {slipImage}
      {loadError && !signedUrl && (
        <span className="text-xs text-red-600" data-testid="slip-error" title="พบสลิปใน payment_intents แต่สร้าง signed URL ไม่ได้ — ตรวจสิทธิ์ storage (payment-slips) / ไฟล์ถูกลบ">
          ⚠ โหลดสลิปไม่ได้
        </span>
      )}
      {reference && <span className="text-xs text-brand-muted">ref: {reference}</span>}
      {!loadError && (
        <span className="text-xs text-amber-600 font-medium" data-testid={withSlip || reference ? 'slip-pending' : 'slip-awaiting-slip'}>
          {withSlip || reference ? '⏳ รอตรวจ' : '⏳ รอสลิปจากลูกค้า'}
        </span>
      )}
    </span>
  )
}