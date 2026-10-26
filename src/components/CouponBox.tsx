// ============================================
// Bite Me Baby — CouponBox (M2 · canonical coupon UI + ONE apply path · A1)
// ============================================
// ONE coupon component used by BOTH CartPage and CheckoutPage (M2: the input +
// apply + remove UI used to exist twice with drifting copy/behavior). Every
// coupon → cart-store write goes through the helpers exported here so there is
// exactly ONE apply path:
//   applyCouponCode()           — PromotionsPage "ใช้เลย" + /menu?code=X deep
//                                 link + this box (A1: the code lands in the
//                                 cart store IMMEDIATELY — clipboard copy is
//                                 only a silent bonus, never a fake "คัดลอกแล้ว")
//   removeCouponCode()          — shared remove
//   revalidateCouponForSubmit() — submit-time gate (moved out of CheckoutPage
//                                 per M2 — validation logic lives in ONE place;
//                                 migration 114 silently IGNORES a non-
//                                 qualifying code, so the client must refuse to
//                                 submit instead of charging full price while
//                                 the customer believes a discount applied)
// The rule engine stays `lib/promotionClient.ts` (server-mirror of migration
// 114). The server re-derives the authoritative amount at order creation.
// ============================================

import { useEffect, useState } from 'react'
import { useCartStore } from '@/store/cartStore'
import { showToast } from '@/components/ui/ToastContainer'
import {
  fetchCouponEvaluation,
  evaluateCoupon,
  describeCouponResult,
  normalizePromoCode,
  type CouponEvaluation,
  type CouponLine,
} from '@/lib/promotionClient'

/** บรรทัดตะกร้าปัจจุบันสำหรับคำนวณฐานสินค้าเข้า scope (G&R 153) */
function currentCouponLines(): CouponLine[] {
  return useCartStore.getState().items.map((i) => ({
    productId: i.product.id,
    subtotal: i.subtotal,
  }))
}

/**
 * Apply a code to the shared cart store — the ONE write path for every surface.
 * - rule ok        → code + applied promotion land in the cart immediately
 * - below_min      → code kept as PENDING (re-checks as the cart grows) but no
 *                    discount is pretended
 * - anything else  → stale code cleared so the UI never shows a phantom coupon
 */
export async function applyCouponCode(code: string): Promise<CouponEvaluation> {
  const before = useCartStore.getState()
  const result = await fetchCouponEvaluation(code, before.subtotal, {
    lines: currentCouponLines(),
  })
  const s = useCartStore.getState()
  if (result.ok) {
    s.setCouponCode(normalizePromoCode(result.promo.code))
    s.setAppliedPromotion(result.promo)
    return result
  }
  if (result.reason === 'below_min') {
    s.setCouponCode(normalizePromoCode(code))
    s.setAppliedPromotion(null)
    return result
  }
  s.setCouponCode('')
  s.setAppliedPromotion(null)
  return result
}

/** Remove any applied/pending code from the cart store. */
export function removeCouponCode(notify = true) {
  const s = useCartStore.getState()
  s.setCouponCode('')
  s.setAppliedPromotion(null)
  if (notify) showToast('เอาโค้ดส่วนลดออกแล้ว', 'info')
}

/**
 * Submit-time revalidation (moved from CheckoutPage by M2). Returns the discount
 * the customer should EXPECT, or an honest refusal message — never submits with
 * a code that fails the rules.
 */
export async function revalidateCouponForSubmit(
  subtotal: number,
): Promise<{ ok: true; discountAmount: number } | { ok: false; message: string }> {
  const code = useCartStore.getState().couponCode.trim()
  if (!code) return { ok: true, discountAmount: 0 }
  const check = await fetchCouponEvaluation(code, subtotal, { lines: currentCouponLines() })
  if (!check.ok) return { ok: false, message: describeCouponResult(check) }
  const s = useCartStore.getState()
  s.setAppliedPromotion(check.promo)
  return { ok: true, discountAmount: check.discountAmount }
}

export function CouponBox() {
  const { subtotal, couponCode, appliedPromotion } = useCartStore()
  const [codeInput, setCodeInput] = useState('')
  const [busy, setBusy] = useState(false)

  // Coupon rehydration (moved from CheckoutPage by M2): cartPersistence stores
  // the code only (D01 minimal persistence) — rebuild the applied promotion
  // from REAL rows so a reload never leaves a phantom discount or a dead code.
  // R3 (D-04): deps = [couponCode] — เดิม [] ทำให้แข่งกับ cart hydration ที่เป็น
  // async (initCartPersistence โหลด catalog ก่อน restore) → ถ้า mount เสร็จก่อน
  // restore โค้ดจะถูก set แล้วไม่มีใคร re-validate อีกเลย (คูปองหาย/ค้าง pending)
  useEffect(() => {
    // re-evaluate เมื่อ subtotal เปลี่ยนด้วย ( deps เดิมมีแค่ [couponCode] ): ครอบคลุมจังหวะ
    // hydrate ที่subtotal ยัง 0 → below_min ค้าง pending ถาวร = บั๊ก "ต้องกดลองอีกครั้ง"
    // ของ Owner 2026-10-26 — apply แล้ว (มี appliedPromotion) = ออกก่อนไม่ยิงซ้ำ
    let cancelled = false
    const code = useCartStore.getState().couponCode
    if (!code.trim() || useCartStore.getState().appliedPromotion) return
    void fetchCouponEvaluation(code, useCartStore.getState().subtotal).then((result) => {
      if (cancelled) return
      const s = useCartStore.getState()
      if (result.ok) {
        s.setAppliedPromotion(result.promo)
      } else if (result.reason !== 'below_min') {
        s.setCouponCode('')
        showToast(describeCouponResult(result), 'info')
      }
    })
    return () => { cancelled = true }
  }, [couponCode, subtotal])

  async function handleApply(raw: string) {
    const code = raw.trim()
    if (!code) {
      showToast('กรุณาใส่รหัสโปรโมชั่นก่อนกดใช้โค้ด', 'warning')
      return
    }
    if (busy) return
    setBusy(true)
    const result = await applyCouponCode(code)
    showToast(
      describeCouponResult(result),
      result.ok ? 'success' : result.reason === 'below_min' ? 'info' : 'error',
    )
    if (result.ok || result.reason === 'below_min') setCodeInput('')
    setBusy(false)
  }

  const pendingCode = couponCode.trim() && !appliedPromotion ? couponCode.trim() : ''

  return (
    <div className="card mb-6">
      <h3 className="font-bold text-brand-accent mb-3">🎟️ คูปอง/โปรโมชั่น</h3>
      {appliedPromotion ? (() => {
        const status = evaluateCoupon([appliedPromotion], couponCode, subtotal)
        return (
          <div className={`rounded-xl border p-3 ${status.ok ? 'border-green-300 bg-green-50' : 'border-amber-300 bg-amber-50'}`} data-testid="applied-coupon">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-bold text-brand-accent">{appliedPromotion.name}</div>
                <div className="font-mono text-sm">{couponCode}</div>
                {status.ok ? (
                  <div className="text-sm text-green-700">คาดการณ์ส่วนลด {status.discountAmount.toFixed(2)} บาท — ระบบยืนยันยอดจริงตอนสร้างออเดอร์</div>
                ) : (
                  <div className="text-sm text-amber-700">{describeCouponResult(status)}</div>
                )}
              </div>
              <button type="button" onClick={() => removeCouponCode()} className="text-sm text-brand-danger hover:underline shrink-0" data-testid="coupon-remove">เอาออก</button>
            </div>
          </div>
        )
      })() : pendingCode ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3" data-testid="pending-coupon">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-mono text-sm">{pendingCode}</div>
              <div className="text-sm text-amber-700">โค้ดนี้ยังไม่เข้าเงื่อนไขตอนนี้ — ระบบจะตรวจอีกครั้งก่อนสั่งซื้อ (ยังไม่ได้หักส่วนลด)</div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <button type="button" onClick={() => void handleApply(pendingCode)} className="text-sm text-brand-primary hover:underline" data-testid="coupon-retry">ลองอีกครั้ง</button>
              <button type="button" onClick={() => removeCouponCode()} className="text-sm text-brand-danger hover:underline" data-testid="coupon-remove">เอาออก</button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <input
              type="text"
              data-testid="coupon-input"
              placeholder="ใส่รหัสคูปอง"
              aria-label="รหัสคูปอง"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              className="input flex-1"
            />
            <button type="button" onClick={() => void handleApply(codeInput)} className="btn btn-outline" data-testid="coupon-apply">ใช้โค้ด</button>
          </div>
          <p className="text-xs text-brand-muted mt-2">ระบบตรวจรหัสจากโปรโมชั่นจริงของร้านตามเงื่อนไข (วันที่/ยอดขั้นต่ำ) — ส่วนลดยืนยันอีกครั้งบนเซิร์ฟเวอร์ตอนสร้างออเดอร์</p>
        </>
      )}
    </div>
  )
}