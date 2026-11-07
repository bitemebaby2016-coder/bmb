// ============================================
// Bite Me Baby — InAppBrowserNotice (R46 → R57 → R76 → R77 · Owner 2026-11-02 / 2026-11-07)
// Owner: "กดตามลิ้งจากเฟซบุ๊คไปให้ใช้บราวเซอร์ภายนอก ห้ามใช้บราวเซอร์ของเฟซ"
// เดิม R46 = แจ้ง + ให้ผู้ใช้ยืนยันเอง (ปุ่ม "อยู่ที่นี่ต่อ") → R57 = "ห้ามใช้" :
//   Android (FB in-app) = พยายามเปิด Chrome ภายนอกอัตโนมัติ (1 ครั้ง/แท็บ)
//   iOS (FB in-app) = แถบบังคับวิธีเปิด (JS ข้ามแอปไม่ได้)
// R76 (Owner: "อาการเดิมเลย" — ลิงก์แตะแล้วขึ้นหน้าเว็บไม่พร้อมใช้งาน):
//   FB WebView บางเครื่องไม่รู้จัก intent:// → ถ้านำทาง "หน้าปัจจุบัน" ไป intent://
//   (window.location.replace) = net::ERR_UNKNOWN_URL_SCHEME กลืนทั้งหน้า = ลิงก์ใช้ไม่ได้ทุกลิงก์
//   → R76 = ห้ามนำทางหน้าปัจจุบันไป intent:// เด็ดขาด
// R77 (Owner: "ใส่ปุ่มปิดป้อบอัพเพิ่ม... ลิ้งต่อที่กดจากเปิดบราวเซอร์ภายนอกเออเร่อใช้ไม่ได้"):
//   - ปุ่มเดิมเรียก window.open กับค่า intent:// = ขึ้นหน้า error/ไม่เด้งอะไรเลย → เปลี่ยนเป็น
//     <a href={intent}> นำทาง "เฟรมเดียว" ด้วย gesture จริง (WebView ที่รู้จัก intent://
//     = เด้ง Chrome ทันที · ไม่รู้จัก = หน้า error แต่กด ← ย้อนกลับได้ ไม่หายถาวร)
//   - ห้ามยิง intent อัตโนมัติตอนโหลดหน้า (กันหน้า error เด้งเอง) + ห้าม window.open กับค่า intent
//   - เพิ่มปุ่มปิดป๊อปอัพ (X) ตามคำสั่ง Owner — จำการปิดต่อแท็บ (sessionStorage)
//   + แถบบอกวิธีเปิดภายนอกด้วยเมนู ⋮ (ทางที่ใช้ได้ทุกเครื่อง) เสมอ
// ตรวจด้วย UA (FBAN/FBAV/FB_IAB/FBIANV/IG/LINE)
// ============================================
import { useEffect, useState } from 'react'

/** Pure — ตรวจว่าเป็นเบราว์เซอร์ในแอป Facebook/Instagram/Line (export ให้ test เรียกตรง)
 *  UA จริงขึ้นรูปแบบ [FBAN/…] [FB_IAB] (FB_IAB ไม่มี / ตามหลัง — ห้ามผูก slash) */
export function isInAppBrowser(ua: string): boolean {
  return /FBAN|FBAV|FB_IAB|FBIANV|Instagram\/|Line\//i.test(ua)
}

/**
 * Pure — สร้าง URL .Scheme intent:// ให้ WebView เปิดลิงก์ใน Chrome (เบราว์เซอร์ภายนอก)
 *  Android intent URL: intent://<host+path>?<query>#Intent;scheme=https;package=com.android.chrome;
 *  s.browser_fallback_url=<เดิม>;end — ถ้าไม่มี Chrome จะเด้งกลับมาที่ URL เดิม (แล้วโชว์แถบ)
 *  คืน null เมื่อ href ไม่ใช่ https (http/relative = ห้ามยิง intent)
 *  R76/R77: ใช้กับ <a href> เท่านั้น — ห้าม window.location / window.open กับค่านี้เด็ดขาด
 */
export function externalBrowserIntentUrl(href: string): string | null {
  let u: URL
  try { u = new URL(href) } catch { return null }
  if (u.protocol !== 'https:') return null
  const target = `${u.host}${u.pathname}${u.search}${u.hash}`
  return `intent://${target}#Intent;scheme=https;package=com.android.chrome;s.browser_fallback_url=${encodeURIComponent(href)};end`
}

/** R77: ผู้ใช้กดปิดป๊อปอัพ = ซ่อนต่อแท็บ (ไม่เด้งกวนระหว่างใช้งานในแท็บเดิม) */
export const NOTICE_DISMISS_KEY = 'bmb:inapp-notice-dismissed'

export function InAppBrowserNotice() {
  const [show, setShow] = useState(false)
  const [intentUrl, setIntentUrl] = useState<string | null>(null)
  useEffect(() => {
    if (typeof navigator === 'undefined') return
    if (!isInAppBrowser(navigator.userAgent)) return
    let dismissed = false
    try { dismissed = sessionStorage.getItem(NOTICE_DISMISS_KEY) === '1' } catch { /* */ }
    if (dismissed) return
    // Android = ปุ่มเปิดภายนอกด้วย intent:// ผ่าน <a href> เฟรมเดียว · iOS = ปุ่ม best-effort
    if (/Android/i.test(navigator.userAgent)) {
      setIntentUrl(externalBrowserIntentUrl(window.location.href))
    }
    setShow(true)
  }, [])

  const closeNotice = () => {
    try { sessionStorage.setItem(NOTICE_DISMISS_KEY, '1') } catch { /* */ }
    setShow(false)
  }

  const openExternalIos = () => {
    // iOS = ข้ามแอปด้วย JS ไม่ได้ — เปิดแท็บใหม่ best-effort แล้วให้ใช้เมนู ⋮ ตามคำแนะนำ
    try {
      window.open(window.location.href, '_blank', 'noopener,noreferrer')
    } catch { /* popup block = ผู้ใช้ใช้เมนู ⋮/แชร์ ตามคำแนะนำ */ }
  }

  if (!show) return null

  return (
    <div
      className="fixed inset-x-3 bottom-24 sm:bottom-4 z-[70] rounded-xl border-2 border-brand-primary bg-brand-surface shadow-lg p-3"
      role="alert"
      data-testid="inapp-browser-notice"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-brand-accent mb-1">
          🔗 คุณเปิดลิงก์จาก Facebook — ใช้เบราว์เซอร์ภายนอก (biteme-baby.com)
        </p>
        <button
          type="button"
          onClick={closeNotice}
          aria-label="ปิดแจ้งเตือนนี้"
          data-testid="inapp-close"
          className="shrink-0 w-7 h-7 rounded-full border border-brand-primary text-brand-accent text-sm leading-none hover:bg-orange-50"
        >
          ✕
        </button>
      </div>
      <p className="text-[11px] text-brand-muted leading-snug mb-2">
        เว็บนี้<b>ห้ามเปิดในเบราว์เซอร์ของ Facebook</b> (แคชเก่า/บล็อกแผนที่·GPS) — กดปุ่มด้านล่างเพื่อเปิดภายนอก ถ้าไม่เด้ง ให้แตะ <b>⋮/แชร์ (มุมขวาบน) → เปิดในเบราว์เซอร์</b> แล้วเลือก Chrome/Safari (ถ้ากดปุ่มแล้วขึ้นหน้า error = กดปุ่ม ← ย้อนกลับ แล้วใช้เมนู ⋮ แทน)
      </p>
      <div className="flex items-center gap-2">
        {intentUrl ? (
          // R77: <a href> เฟรมเดียว = ทางเดียวที่ WebView ซึ่งรู้จัก intent:// จะเด้ง Chrome ได้จริง
          // (ไม่ใช้ window.open — ได้หน้า error/ไม่เด้งตามที่ Owner รายงาน) · ไม่มี target=_blank
          <a href={intentUrl} className="btn btn-primary btn-xs" data-testid="inapp-open-external">
            🌐 เปิดในเบราว์เซอร์ภายนอก
          </a>
        ) : (
          <button type="button" className="btn btn-primary btn-xs" onClick={openExternalIos} data-testid="inapp-open-external">
            🌐 เปิดในเบราว์เซอร์ภายนอก
          </button>
        )}
      </div>
    </div>
  )
}