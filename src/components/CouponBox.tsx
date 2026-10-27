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
  listAvailableCoupons,
  type CouponEvaluation,
  type CouponLine,
} from '@/lib/promotionClient'
import type { PromotionRow } from '@/lib/bmbAdminApi_promotions'

/** บรรทัดตะกร้าปัจจุบันสำหรับคำนวณฐานสินค้าเข้า scope (G&R 153) */
function currentCouponLines(): CouponLine[] {
  return useCartStore.getState().items.map((i) => ({
    productId: i.product.id,
    subtotal: i.subtotal,
  }))
}

/**
 * ยิงตรวจคูปอง + retry อัตโนมัติ 1 ครั้งเมื่อโหลดข้อมูลไม่สำเร็จ (เครือข่ายชั่วคราว) —
 * Owner 2026-10-27 "คูปองหน้าเช็คเอาท์ยังเออเร่อ ต้องโหลดซ้ำ/กดลองอีกครั้งถึงจะใช้ได้":
 * ครั้งแรกที่พลาดจาก network ให้ระบบลองซ้ำเอง ไม่ต้องให้ลูกค้ากด/รีเฟรชเอง
 */
async function fetchEvaluationResilient(
  code: string | null | undefined,
  subtotal: number,
  opts?: { lines?: CouponLine[] },
): Promise<CouponEvaluation> {
  let result = await fetchCouponEvaluation(code, subtotal, opts)
  if (!result.ok && result.reason === 'load_failed') {
    await new Promise((resolve) => setTimeout(resolve, 500))
    result = await fetchCouponEvaluation(code, subtotal, opts)
  }
  return result
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
  const result = await fetchEvaluationResilient(code, before.subtotal, {
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
  const check = await fetchEvaluationResilient(code, subtotal, { lines: currentCouponLines() })
  if (!check.ok) {
    // Owner 2026-10-27: เครือข่ายขัดข้อง ≠ โค้ดใช้ไม่ได้ — บอกให้กด "ใช้โค้ด" อีกครั้ง
    // (เดิมปนเป็น "ใช้โค้ดส่วนลดไม่ได้" ทุกเคสจนดูเหมือนคูปองพัง)
    if (check.reason === 'load_failed') {
      return { ok: false, message: 'ยังตรวจโค้ดส่วนลดไม่ได้ (เครือข่ายขัดข้อง) — กรุณากด "ใช้โค้ด" อีกครั้ง' }
    }
    return { ok: false, message: describeCouponResult(check) }
  }
  const s = useCartStore.getState()
  s.setAppliedPromotion(check.promo)
  return { ok: true, discountAmount: check.discountAmount }
}

export function CouponBox() {
  const { subtotal, couponCode, appliedPromotion } = useCartStore()
  const [codeInput, setCodeInput] = useState('')
  const [busy, setBusy] = useState(false)
  // R10 (Owner 2026-10-27): popup เลือกโค้ด — จิ้มกล่องคูปองแล้วโชว์โค้ดที่ใช้ได้ตอนนี้
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerLoading, setPickerLoading] = useState(false)
  const [available, setAvailable] = useState<PromotionRow[]>([])

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
    void fetchEvaluationResilient(code, useCartStore.getState().subtotal).then((result) => {
      if (cancelled) return
      const s = useCartStore.getState()
      if (result.ok) {
        s.setAppliedPromotion(result.promo)
      } else if (result.reason === 'load_failed') {
        // Owner 2026-10-27: โหลดไม่สำเร็จ (เครือข่าย) = เก็บโค้ดไว้ ไม่ล้าง/ไม่เด้ง error —
        // retry ไปแล้ว 1 ครั้ง รอบหน้า subtotal เปลี่ยน/กดใช้โค้ดอีกครั้งจะตรวจใหม่เอง
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

  // R10 (Owner 2026-10-27): คูปองใช้ที่หน้าเช็คเอาท์อย่างเดียว — จิ้มกล่องนี้แล้วเปิด
  // popup โชว์ "โค้ดที่มีปัจจุบัน" ให้ลูกค้าเลือก เติม+ใช้ให้อัตโนมัติ (ไม่ต้องพิมพ์เอง)
  async function openPicker() {
    setPickerOpen(true)
    setPickerLoading(true)
    setAvailable(await listAvailableCoupons())
    setPickerLoading(false)
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
          <button
            type="button"
            onClick={() => void openPicker()}
            className="w-full rounded-xl border-2 border-dashed border-brand-primary/40 py-3 font-semibold text-sm text-brand-primary hover:bg-brand-primary/10 transition-all"
            data-testid="coupon-open"
          >
            🎟️ แตะเพื่อเลือกคูปองจากรายการ
          </button>
          <p className="text-xs text-brand-muted mt-2">โค้ดที่ใช้ได้ตอนนี้จะแสดงเป็นป๊อปอัพให้เลือก — จิ้มแล้วเติมให้อัตโนมัติ</p>
        </>
      )}

      {/* Popup เลือกโค้ด (R10) — จิ้มโค้ด = เติม+ใช้ทันที */}
      {pickerOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setPickerOpen(false)} />
          <div className="fixed inset-x-4 top-24 z-50 max-w-md mx-auto bg-white rounded-2xl shadow-2xl border p-4" data-testid="coupon-picker">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-brand-accent">เลือกคูปอง</h4>
              <button type="button" onClick={() => setPickerOpen(false)} className="text-sm text-brand-muted hover:underline" data-testid="coupon-picker-close">ปิด</button>
            </div>
            {pickerLoading ? (
              <p className="text-sm text-brand-muted p-3">กำลังโหลดโค้ด…</p>
            ) : available.length === 0 ? (
              <p className="text-sm text-brand-muted p-3">ยังไม่มีโค้ดที่ใช้ได้ในขณะนี้</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {available.map((p) => {
                  const benefit = p.discount_type === 'percentage'
                    ? `ลด ${Number(p.discount_value) || 0}%${p.max_discount_amount ? ` (สูงสุด ${Number(p.max_discount_amount)} บาท)` : ''}`
                    : `ลด ${Number(p.discount_value) || 0} บาท`
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        void handleApply(String(p.code)).then(() => setPickerOpen(false))
                      }}
                      data-testid={`coupon-pick-${String(p.code)}`}
                      className="w-full text-left rounded-xl border border-brand-primary/30 p-3 hover:bg-brand-primary/10 transition-all"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-mono font-bold text-brand-accent">{String(p.code)}</div>
                          <div className="text-xs text-brand-muted truncate">{p.name} · {benefit}</div>
                          {Number(p.min_order_amount) > 0 && (
                            <div className="text-xs text-amber-700">ยอดขั้นต่ำ {Number(p.min_order_amount)} บาท</div>
                          )}
                        </div>
                        <span className="text-brand-primary font-semibold text-sm shrink-0">ใช้โค้ดนี้</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
            {/* เผื่อโค้ดที่ไม่ได้อยู่ในรายการ (ป้าย/แชท) — พิมพ์เองได้ */}
            <div className="flex gap-2 mt-3 pt-3 border-t">
              <input
                type="text"
                data-testid="coupon-input"
                placeholder="พิมพ์รหัสเอง"
                aria-label="รหัสคูปอง"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                className="input flex-1"
              />
              <button type="button" onClick={() => void handleApply(codeInput).then(() => setPickerOpen(false))} className="btn btn-outline" data-testid="coupon-apply">ใช้โค้ด</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}