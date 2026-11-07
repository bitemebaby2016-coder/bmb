// ============================================
// Bite Me Baby — InAppBrowserNotice (R46 → R57 → R76 → R77 → R79 · Owner 2026-11-02 / 11-07)
// Owner: "กดตามลิ้งจากเฟซบุ๊คไปให้ใช้บราวเซอร์ภายนอก ห้ามใช้บราวเซอร์ของเฟซ"
// R76: ห้ามนำทางหน้าปัจจุบันไป intent:// (ERR_UNKNOWN_URL_SCHEME กินทั้งหน้า)
// R77: ปุ่มเปิด = <a href={intent}> เฟรมเดียว + ปุ่มปิด ✕ + แถบเมนู ⋮
// R79 (Owner: "สำคัญ — ทำให้ป๊อปอัพเปิดบราวเซอร์ภายนอกจากเม้นเอไอในแชต ต่อออกได้จริง"):
//   ผลทดสอบ 7 พ.ย. = ปุ่ม intent "เออเร่อ" + ⋮/แชร์ "เปิดต่อไปที่บราวเซอร์ภายนอกไม่ได้"
//   (FB WebView เครื่อง Owner บล็อกทุกช่อง) → Smart Escape กดครั้งเดียวได้ทุกช่อง:
//   ① คัดลอก URL อัตโนมัติ (ทางออกจริง: เปิด Chrome → วาง) ② navigator.share ถ้าเครื่องมี
//   ③ แผง guide 3 ขั้น + ปุ่มคัดลอกซ้ำ ④ ปุ่มรอง <a href={intent}> เฉพาะเครื่องที่รับ intent
//   ห้ามนำทางหน้าปัจจุบันไป intent · ห้าม window.open กับ intent · ห้ามยิง intent อัตโนมัติ
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
  const [guideOpen, setGuideOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (typeof navigator === 'undefined') return
    if (!isInAppBrowser(navigator.userAgent)) return
    let dismissed = false
    try { dismissed = sessionStorage.getItem(NOTICE_DISMISS_KEY) === '1' } catch { /* */ }
    if (dismissed) return
    // Android = เก็บ intent ไว้เป็นปุ่มรองใน guide (เครื่องที่ WebView รับ intent = เด้ง Chrome จริง)
    if (/Android/i.test(navigator.userAgent)) {
      setIntentUrl(externalBrowserIntentUrl(window.location.href))
    }
    setShow(true)
  }, [])

  const closeNotice = () => {
    try { sessionStorage.setItem(NOTICE_DISMISS_KEY, '1') } catch { /* */ }
    setShow(false)
    setGuideOpen(false)
  }

  /** R79: คัดลอก URL ปัจจุบัน — clipboard API ก่อน · fallback textarea+execCommand (Safari/FB WebView) */
  const copyUrl = async (): Promise<boolean> => {
    const url = window.location.href
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url)
        return true
      }
    } catch { /* หลุดไป fallback ด้านล่าง */ }
    try {
      const ta = document.createElement('textarea')
      ta.value = url
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch { return false }
  }

  /**
   * R79 — Smart Escape (คำสั่ง Owner "ทำให้ป๊อปอัพเปิดบราวเซอร์ภายนอก...ต่อออกได้จริง"):
   * เครื่อง Owner = intent error + ⋮ ก็ไม่ออก (FB WebView บล็อก) → กดครั้งเดียวได้ทุกช่องพร้อมกัน:
   * ① คัดลอกลิงก์เสมอ (ทางออกจริง: เปิด Chrome → วาง) ② navigator.share ถ้ามี (share sheet จริง)
   * ③ เปิดแผง guide วิธีใช้ Chrome — ห้ามนำทางหน้าปัจจุบันไป intent เด็ดขาด (R76 = กินทั้งหน้า)
   */
  const handleOpenExternal = async () => {
    const ok = await copyUrl()
    setCopied(ok)
    setGuideOpen(true)
    const nav = navigator as Navigator & { share?: (data?: ShareData) => Promise<void> }
    if (nav.share) {
      try { await nav.share({ title: 'Bite Me Baby', url: window.location.href }) } catch { /* user cancel = guide ยังค้างให้ใช้ต่อ */ }
    }
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
        เว็บนี้<b>ห้ามเปิดในเบราว์เซอร์ของ Facebook</b> (แคชเก่า/บล็อกแผนที่·GPS) — กดปุ่มด้านล่าง เราจะ<b>คัดลอกลิงก์ให้เลย</b> พร้อมวิธีเปิด Chrome ที่ใช้ได้จริง (กด ✕ เมื่อไหร่ก็ได้)
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleOpenExternal}
          className="btn btn-primary btn-xs"
          data-testid="inapp-open-external"
        >
          🌐 เปิดในเบราว์เซอร์ภายนอก
        </button>
      </div>
      {guideOpen && (
        <div className="mt-2 rounded-lg border border-brand-primary/50 bg-white/80 p-2" data-testid="inapp-guide">
          <p className="text-[11px] font-semibold text-brand-accent" data-testid="inapp-guide-status">
            {copied
              ? '📋 คัดลอกลิงก์แล้ว — เปิด Chrome แล้ววาง = ออกนอกแอปเฟซได้จริง'
              : '📋 คัดลอกไม่สำเร็จ — กดปุ่ม "คัดลอกลิงก์" ด้านล่างอีกครั้ง'}
          </p>
          <ol className="mt-1 list-decimal pl-4 text-[11px] text-brand-muted leading-snug">
            <li>ออกจากแอปเฟซ → เปิดแอป <b>Chrome</b></li>
            <li>วางลิงก์ในช่องค้นหา = เข้าเว็บภายนอกทันที (ใช้งานต่อได้ทุกหน้า)</li>
            <li>ทางเลือก: ⋮/แชร์ (มุมขวาบน) → เปิดในเบราว์เซอร์ ถ้าเมนูขึ้น</li>
          </ol>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => { void copyUrl().then(setCopied) }}
              className="btn btn-outline btn-xs"
              data-testid="inapp-copy"
            >
              📋 คัดลอกลิงก์
            </button>
            {intentUrl && (
              // ปุ่มรอง: เครื่องที่ WebView รับ intent:// = เด้ง Chrome จริง (เฟรมเดียว · ห้าม window.open)
              <a href={intentUrl} className="btn btn-primary btn-xs" data-testid="inapp-open-try">
                ⚡ ลองเปิดเลย (เครื่องที่รองรับ)
              </a>
            )}
            <button
              type="button"
              onClick={() => setGuideOpen(false)}
              className="btn btn-ghost btn-xs"
              data-testid="inapp-guide-close"
            >
              ปิดคำแนะนำ
            </button>
          </div>
        </div>
      )}
    </div>
  )
}