// ============================================
// Bite Me Baby — InAppBrowserNotice (R46 · Owner 2026-11-01)
// ลิงก์ที่เปิดจาก Facebook = เบราว์เซอร์ในแอป FB (แคชเก่า/บล็อกแผนที่·GPS/ตัด ?cart=)
// → แจ้งผู้ใช้ว่ากำลังเปิด "เว็บภายนอก Facebook" และให้ผู้ใช้ยืนยันเปิดเอง
// ตรวจด้วย UA (FBAN/FBAV/FB_IAB = FB iOS/Android/In-App Browser) · dismiss จำใน localStorage
// ============================================
import { useEffect, useState } from 'react'

/** Pure — ตรวจว่าเป็นเบราว์เซอร์ในแอป Facebook/Instagram/Line (export ให้ test เรียกตรง)
 *  UA จริงขึ้นรูปแบบ [FBAN/…] [FB_IAB] (FB_IAB ไม่มี / ตามหลัง — ห้ามผูก slash) */
export function isInAppBrowser(ua: string): boolean {
  return /FBAN|FBAV|FB_IAB|FBIANV|Instagram\/|Line\//i.test(ua)
}

const DISMISS_KEY = 'bmb:inapp-linkout-dismissed'

export function InAppBrowserNotice() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (typeof navigator === 'undefined') return
    if (!isInAppBrowser(navigator.userAgent)) return
    try {
      if (localStorage.getItem(DISMISS_KEY) === '1') return
    } catch { /* แอปบางตัวบล็อก localStorage = โชว์ทุกครั้ง (ปลอดภัย) */ }
    setShow(true)
  }, [])

  if (!show) return null

  const openExternal = () => {
    // ยืนยันโดยผู้ใช้ = จิ้มปุ่มนี้เอง · ถ้าเบราว์เซอร์ในแอปยังเปิดแท็บตัวเองอยู่
    // ให้ใช้เมนู ⋮ (มุมขวาบน) → "เปิดในเบราว์เซอร์" ตามข้อความด้านล่าง
    try {
      window.open(window.location.href, '_blank', 'noopener,noreferrer')
    } catch { /* popup block = ผู้ใช้ใช้เมนู ⋮ ตามคำแนะนำ */ }
    dismiss()
  }
  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, '1') } catch { /* */ }
    setShow(false)
  }

  return (
    <div
      className="fixed inset-x-3 bottom-24 sm:bottom-4 z-[70] rounded-xl border-2 border-brand-primary bg-brand-surface shadow-lg p-3"
      role="alert"
      data-testid="inapp-browser-notice"
    >
      <p className="text-xs font-semibold text-brand-accent mb-1">
        🔗 คุณเปิดลิงก์จาก Facebook — นี่คือเว็บภายนอก (biteme-baby.com)
      </p>
      <p className="text-[11px] text-brand-muted leading-snug mb-2">
        เบราว์เซอร์ในแอป Facebook จำกัดแผนที่/GPS/แคช → <b>ยืนยันเพื่อเปิดด้วยเบราว์เซอร์ของคุณเอง</b> ถ้าไม่เด้ง ให้กด <b>⋮ (มุมขวาบน) → เปิดในเบราว์เซอร์</b>
      </p>
      <div className="flex items-center gap-2">
        <button type="button" className="btn btn-primary btn-xs" onClick={openExternal} data-testid="inapp-open-external">
          🌐 เปิดในเบราว์เซอร์ภายนอก
        </button>
        <button type="button" className="btn btn-outline btn-xs" onClick={dismiss} data-testid="inapp-stay">
          อยู่ที่นี่ต่อ
        </button>
      </div>
    </div>
  )
}