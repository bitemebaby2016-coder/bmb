// ============================================
// Bite Me Baby — InAppBrowserNotice (R46 → R57 · Owner 2026-11-02)
// Owner: "กดตามลิ้งจากเฟซบุ๊คไปให้ใช้บราวเซอร์ภายนอก ห้ามใช้บราวเซอร์ของเฟซ"
// เดิม R46 = แจ้ง + ให้ผู้ใช้ยืนยันเอง (ปุ่ม "อยู่ที่นี่ต่อ") → R57 = "ห้ามใช้" :
//   Android (FB in-app) = redirect อัตโนมัติด้วย intent:// → เปิด Chrome ภายนอกทันที
//     (กัน loop ด้วย sessionStorage 1 ครั้ง/แท็บ · intent ล้ม = browser_fallback_url กลับมาแล้วโชว์แถบ)
//   iOS (FB in-app) = เบราว์เซอร์ในแอป iOS บังคับข้ามแอปด้วย JS ไม่ได้ → แถบบังคับวิธีเปิด
//     Safari + ปุ่มเปิดด้านนอก (ไม่มีปุ่ม "อยู่ที่นี่ต่อ" แล้ว — Owner ห้ามใช้เบราว์เซอร์เฟซ)
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
 */
export function externalBrowserIntentUrl(href: string): string | null {
  let u: URL
  try { u = new URL(href) } catch { return null }
  if (u.protocol !== 'https:') return null
  const target = `${u.host}${u.pathname}${u.search}${u.hash}`
  return `intent://${target}#Intent;scheme=https;package=com.android.chrome;s.browser_fallback_url=${encodeURIComponent(href)};end`
}

/** sessionStorage กัน redirect loop (1 ครั้ง/แท็บ — ล้มเหลวแล้วต้องไม่ยิงซ้ำรัว ๆ ) */
const EXT_REDIRECT_KEY = 'bmb:inapp-ext-redirected'

export function InAppBrowserNotice() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (typeof navigator === 'undefined') return
    if (!isInAppBrowser(navigator.userAgent)) return
    if (/Android/i.test(navigator.userAgent)) {
      let attempted = false
      try { attempted = sessionStorage.getItem(EXT_REDIRECT_KEY) === '1' } catch { attempted = true } // บล็อก = ไม่เสี่ยง loop
      if (!attempted) {
        try { sessionStorage.setItem(EXT_REDIRECT_KEY, '1') } catch { /* */ }
        const intent = externalBrowserIntentUrl(window.location.href)
        if (intent) {
          window.location.replace(intent) // บังคับออกนอก FB → Chrome (Owner: ห้ามใช้เบราว์เซอร์ของเฟซ)
          return // ถ้า intent ล้ม (ไม่มี Chrome) = fallback กลับมาในแท็บเดิม → โชว์แถบด้านล่าง
        }
      }
    }
    // iOS / redirect ไม่สำเร็จ = แถบบังคับวิธีเปิดภายนอก (ไม่มีปุ่ม "อยู่ที่นี่ต่อ" แล้ว)
    setShow(true)
  }, [])

  if (!show) return null

  const openExternal = () => {
    // Android = intent เปิด Chrome ตรง ๆ · iOS = window.open best-effort (ถ้าแอปบล็อก = ใช้เมนูตามคำแนะนำ)
    const intent = externalBrowserIntentUrl(window.location.href)
    if (intent && /Android/i.test(navigator.userAgent)) {
      window.location.replace(intent)
      return
    }
    try {
      window.open(window.location.href, '_blank', 'noopener,noreferrer')
    } catch { /* popup block = ผู้ใช้ใช้เมนู ⋮/แชร์ ตามคำแนะนำ */ }
  }

  return (
    <div
      className="fixed inset-x-3 bottom-24 sm:bottom-4 z-[70] rounded-xl border-2 border-brand-primary bg-brand-surface shadow-lg p-3"
      role="alert"
      data-testid="inapp-browser-notice"
    >
      <p className="text-xs font-semibold text-brand-accent mb-1">
        🔗 คุณเปิดลิงก์จาก Facebook — ใช้เบราว์เซอร์ภายนอก (biteme-baby.com)
      </p>
      <p className="text-[11px] text-brand-muted leading-snug mb-2">
        เว็บนี้<b>ห้ามเปิดในเบราว์เซอร์ของ Facebook</b> (แคชเก่า/บล็อกแผนที่·GPS) — ระบบจะเปิดภายนอกให้อัตโนมัติ ถ้าไม่เด้ง กดปุ่มด้านล่าง หรือ <b>⋮/แชร์ (มุมขวาบน) → เปิดในเบราว์เซอร์ (Safari)</b>
      </p>
      <div className="flex items-center gap-2">
        <button type="button" className="btn btn-primary btn-xs" onClick={openExternal} data-testid="inapp-open-external">
          🌐 เปิดในเบราว์เซอร์ภายนอก
        </button>
      </div>
    </div>
  )
}