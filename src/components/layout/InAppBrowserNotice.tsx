// ============================================
// Bite Me Baby — InAppBrowserNotice (R46 → R57 → R76 · Owner 2026-11-02 / 2026-11-07)
// Owner: "กดตามลิ้งจากเฟซบุ๊คไปให้ใช้บราวเซอร์ภายนอก ห้ามใช้บราวเซอร์ของเฟซ"
// เดิม R46 = แจ้ง + ให้ผู้ใช้ยืนยันเอง (ปุ่ม "อยู่ที่นี่ต่อ") → R57 = "ห้ามใช้" :
//   Android (FB in-app) = พยายามเปิด Chrome ภายนอกอัตโนมัติ (1 ครั้ง/แท็บ)
//   iOS (FB in-app) = แถบบังคับวิธีเปิด (JS ข้ามแอปไม่ได้)
// R76 (Owner: "อาการเดิมเลย" — ลิงก์แตะแล้วขึ้นหน้าเว็บไม่พร้อมใช้งาน):
//   FB WebView บางเครื่องไม่รู้จัก intent:// → ถ้านำทาง "หน้าปัจจุบัน" ไป intent://
//   (window.location.replace) = net::ERR_UNKNOWN_URL_SCHEME กลืนทั้งหน้า = ลิงก์ใช้ไม่ได้ทุกลิงก์
//   → R76 = ห้ามนำทางหน้าปัจจุบันไป intent:// เด็ดขาด · ใช้ window.open(intent, '_blank')
//   (ไม่ทำลายหน้า — สำเร็จ = เด้ง Chrome · ไม่รองรับ = เงียบ/หน้าเดิมยังใช้ต่อ)
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
 *  R76: ห้ามนำค่าที่ได้ไปใส่ window.location เด็ดขาด (ดู header) — เรียกผ่าน openIntentSafely เท่านั้น
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

/** R76 — เปิด intent:// แบบไม่ทำลายหน้าปัจจุบัน:
 *  window.open = ถ้า WebView รู้จัก intent:// → เด้ง Chrome · ไม่รู้จัก → เงียบ/หน้าต่างใหม่พัง
 *  แต่หน้าปัจจุบันต้อง "ไม่พัง" เสมอ (ต่างจาก location.replace ที่กลืนทั้งหน้า) */
function openIntentSafely(intent: string): void {
  try { window.open(intent, '_blank', 'noopener') } catch { /* popup block = ใช้เมนู ⋮ ตามคำแนะนำ */ }
}

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
          // R64 (Owner: "ลิ้งที่กดต่อไปไม่ได้เปิดบราวเซอร์นอก"): โชว์แถบก่อนพยายามเปิดเสมอ —
          // R76: ห้าม location.replace(intent) (FB WebView บางเครื่อง = ERR_UNKNOWN_URL_SCHEME กลืนหน้า)
          // → เปิดผ่าน window.open แบบไม่ทำลายหน้า + แถบพร้อมวิธีเปิดด้วยเมนู ⋮
          setShow(true)
          openIntentSafely(intent)
          return
        }
      }
    }
    // iOS / ความพยายามแล้ว = แถบวิธีเปิดภายนอก (ไม่มีปุ่ม "อยู่ที่นี่ต่อ" แล้ว)
    setShow(true)
  }, [])

  if (!show) return null

  const openExternal = () => {
    // Android = intent เปิด Chrome ผ่าน window.open (ไม่ทำลายหน้า) · iOS = window.open best-effort
    const intent = externalBrowserIntentUrl(window.location.href)
    if (intent && /Android/i.test(navigator.userAgent)) {
      openIntentSafely(intent)
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
        เว็บนี้<b>ห้ามเปิดในเบราว์เซอร์ของ Facebook</b> (แคชเก่า/บล็อกแผนที่·GPS) — กดปุ่มด้านล่างเพื่อเปิดภายนอก ถ้าไม่เด้ง ให้แตะ <b>⋮/แชร์ (มุมขวาบน) → เปิดในเบราว์เซอร์</b> แล้วเลือก Chrome/Safari
      </p>
      <div className="flex items-center gap-2">
        <button type="button" className="btn btn-primary btn-xs" onClick={openExternal} data-testid="inapp-open-external">
          🌐 เปิดในเบราว์เซอร์ภายนอก
        </button>
      </div>
    </div>
  )
}