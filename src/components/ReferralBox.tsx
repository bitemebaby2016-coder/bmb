// ============================================
// Bite Me Baby — ReferralBox (G&R STAGE 2 · 154)
// --------------------------------------------
// ช่องกรอก "โค้ดแนะนำเพื่อน" ตอน checkout (ที่เดียว — ไม่ต้องมีในหน้า cart:
// การผูกสิทธิ์เกิดตอนสร้างออเดอร์จริงเท่านั้น)
//   applyReferralCode()           — format + own-code check (mirror) → preview server
//                                   → ลง cartStore (กติกาเดียวกับ coupon gate:
//                                   โค้ดไม่ผ่านจริง = ไม่เก็บ ไม่แสร้งว่าใช้ได้)
//   removeReferralCode()          — ลบออก
//   revalidateReferralForSubmit() — submit gate: ตรวจซ้ำก่อนสั่ง (server ยังตัดสิน
//                                   อีกทีตอน referral_claim ทันทีหลัง order สร้าง)
// โค้ดเป็น "ทางเลือก" — ไม่กรอก = ข้ามได้ ไม่บังคับสมัครสมาชิกอะไรเพิ่ม
// ============================================

import { useEffect, useState } from 'react'
import { useCartStore } from '@/store/cartStore'
import { showToast } from '@/components/ui/ToastContainer'
import {
  fetchReferralPreview,
  fetchMyReferralStatus,
  validateReferralCode,
  describeReferralIssue,
  describeReferralPreview,
  normalizeReferralCode,
} from '@/lib/referralClient'

/** โค้ดของตัวเอง (cache ระหว่าง component) — ใช้กันกรอกโค้ดตัวเอง (self-referral). */
let ownReferralCode: string | null = null

/**
 * Apply path เดียวทุกหน้า — mirror ของ applyCouponCode:
 * ผ่าน format + ไม่ใช่โค้ดตัวเอง + server preview → ลง store ทันที
 */
export async function applyReferralCode(
  raw: string,
): Promise<{ ok: boolean; message: string }> {
  const v = validateReferralCode(raw, ownReferralCode)
  if (!v.ok) return { ok: false, message: describeReferralIssue(v.issue) }
  const preview = await fetchReferralPreview(v.code)
  if (!preview.ok) return { ok: false, message: describeReferralPreview(preview) }
  useCartStore.getState().setReferralCode(v.code)
  return { ok: true, message: describeReferralPreview(preview) }
}

/** Remove path เดียว. */
export function removeReferralCode(notify = true): void {
  useCartStore.getState().setReferralCode('')
  if (notify) showToast('เอาโค้ดแนะนำเพื่อนออกแล้ว', 'info')
}

/**
 * Submit gate (mirror revalidateCouponForSubmit): โค้ดที่ค้างอยู่ต้องยังผ่านกฎ
 * ตอนสั่งจริง — ไม่ผ่าน = ถูกเอาออก + แจ้งเหตุ (ไม่ปล่อยให้ลูกค้าคิดว่าได้สิทธิ์
 * ทั้งที่ระบบจะไม่บันทึก). ไม่มีโค้ด = ok (ทางเลือก).
 */
export async function revalidateReferralForSubmit(): Promise<
  { ok: true; code: string | null } | { ok: false; message: string }
> {
  const code = normalizeReferralCode(useCartStore.getState().referralCode)
  if (!code) return { ok: true, code: null }
  const v = validateReferralCode(code, ownReferralCode)
  if (!v.ok) {
    useCartStore.getState().setReferralCode('')
    return { ok: false, message: describeReferralIssue(v.issue) }
  }
  const preview = await fetchReferralPreview(v.code)
  if (!preview.ok) {
    if (preview.reason === 'load_failed') return { ok: false, message: describeReferralPreview(preview) }
    useCartStore.getState().setReferralCode('')
    return { ok: false, message: describeReferralPreview(preview) }
  }
  return { ok: true, code: v.code }
}

export function ReferralBox() {
  const referralCode = useCartStore((s) => s.referralCode)
  const [codeInput, setCodeInput] = useState('')
  const [busy, setBusy] = useState(false)

  // ดึงโค้ดของตัวเอง (ล็อกอินแล้ว) เพื่อกันกรอกโค้ดตัวเอง — เงียบถ้าไม่ได้ล็อกอิน
  useEffect(() => {
    let cancelled = false
    void fetchMyReferralStatus().then((st) => {
      if (!cancelled && st?.code) ownReferralCode = st.code
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleApply(raw: string) {
    if (!raw.trim()) {
      showToast('กรุณากรอกรหัสแนะนำเพื่อนก่อนกดใช้โค้ด', 'warning')
      return
    }
    if (busy) return
    setBusy(true)
    const result = await applyReferralCode(raw)
    showToast(result.message, result.ok ? 'success' : 'error')
    if (result.ok) setCodeInput('')
    setBusy(false)
  }

  return (
    <div className="card mb-6">
      <h3 className="font-bold text-brand-accent mb-3">🤝 โค้ดแนะนำเพื่อน</h3>
      {referralCode ? (
        <div
          className="rounded-xl border border-green-300 bg-green-50 p-3 flex items-start justify-between gap-2"
          data-testid="applied-referral"
        >
          <div>
            <div className="font-mono text-sm font-bold">{referralCode}</div>
            <div className="text-sm text-green-700">
              บันทึกโค้ดแล้ว — ทั้งคุณและเพื่อนจะได้รับคูปองเมื่อออเดอร์ของเพื่อนใหม่ผ่านสถานะที่กำหนด
              (ระบบยืนยันสิทธิ์อีกครั้งตอนสร้างออเดอร์)
            </div>
          </div>
          <button
            type="button"
            onClick={() => removeReferralCode()}
            className="text-sm text-brand-danger hover:underline shrink-0"
            data-testid="referral-remove"
          >
            เอาออก
          </button>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <input
              type="text"
              data-testid="referral-input"
              placeholder="ใส่โค้ดแนะนำเพื่อน (BMB-...)"
              aria-label="โค้ดแนะนำเพื่อน"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              className="input flex-1"
            />
            <button
              type="button"
              onClick={() => void handleApply(codeInput)}
              className="btn btn-outline"
              data-testid="referral-apply"
              disabled={busy}
            >
              {busy ? '⏳…' : 'ใช้โค้ด'}
            </button>
          </div>
          <p className="text-xs text-brand-muted mt-2">
            มีโค้ดจากเพื่อน? ใส่ได้เลย — ไม่มีโค้ดก็สั่งได้ตามปกติ ระบบตรวจโค้ดจากเซิร์ฟเวอร์จริงตอนสั่งซื้อ
          </p>
        </>
      )}
    </div>
  )
}