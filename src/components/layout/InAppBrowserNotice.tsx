// ============================================
// Bite Me Baby — InAppBrowserNotice (R46 → R57 → R76 → R77 → R79 → R81 · Owner 2026-11-08)
// Owner: "กดตามลิ้งจากเฟซบุ๊คไปให้ใช้บราวเซอร์ภายนอก ห้ามใช้บราวเซอร์ของเฟซ"
// R76: ห้ามนำทางหน้าปัจจุบันไป intent:// (ERR_UNKNOWN_URL_SCHEME กินทั้งหน้า)
// R81-B2 — Smart Escape ออกแบบใหม่ตามหลักฐาน 6 รอบ (เปลี่ยนเป้าหมายให้ถูก: FB WebView
//   ไม่มีทาง force-escape ด้วย JS — สู้ platform ไม่ได้ = แก้ไม่หายสักที):
//   ① ปุ่มเดียว = คัดลอกลิงก์ + แผง guide 3 ขั้น — **ห้าม auto-share**
//      (R79 รัน navigator.share อัตโนมัติ = "กดเปิดภายนอกกลายเป็นแชร์" ที่ Owner เจอ)
//   ② **ลบปุ่ม intent "ลองเปิดเลย" ทิ้งทั้งหมด** (หลักฐาน R79: เครื่อง Owner กด = error
//      แต่ปุ่มยังอยู่ → Owner กดซ้ำ = error ซ้ำ)
//   ③ share = ปุ่มที่สองชื่อชัด — เรียกเฉพาะผู้ใช้กดเอง · ④ guide ต่างกันตาม platform
//   ⑤ Android มีปุ่ม "เปิดในแท็บใหม่" (target=_blank — ไม่มีทางพาหน้าปัจจุบันไป error)
// R81-B1 — debug capture (เปิดด้วย ?r81debug=1 หนเดียว): เก็บ UA + ผลกดปุ่มลง localStorage
//   + console = หลักฐานให้ทีมแก้ตามข้อเท็จจริง (บทเรียน 6 รอบที่แก้ blind)
// กติกาคงเดิม: ห้าม nav หน้าปัจจุบันไป intent/unknown scheme · ห้าม auto intent · ห้าม auto share
// ตรวจด้วย UA (FBAN/FBAV/FB_IAB/FBIANV/IG/LINE)
// ============================================
import { useEffect, useState } from 'react'
import { r81Capture, r81Platform } from '@/lib/r81DebugCapture'

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
 *  R81: คงไว้เป็น pure helper ที่มี test คุม (r57) — **ไม่ได้ผูกกับปุ่มใด ๆ อีกแล้ว**
 *  (R79 ใส่ปุ่ม intent บน UI = error บนเครื่อง Owner → ถูกลบออกตามคำสั่ง R81-B2)
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
  const [guideOpen, setGuideOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  // R81-B3/B4: ข้อความ guide ต่างกันตาม platform จริงของเครื่อง · pageUrl = ปุ่มเปิดแท็บใหม่
  const [platform, setPlatform] = useState<'ios' | 'android' | 'other'>('other')
  const [pageUrl, setPageUrl] = useState('')
  useEffect(() => {
    if (typeof navigator === 'undefined') return
    if (!isInAppBrowser(navigator.userAgent)) return
    let dismissed = false
    try { dismissed = sessionStorage.getItem(NOTICE_DISMISS_KEY) === '1' } catch { /* */ }
    if (dismissed) return
    setPlatform(r81Platform(navigator.userAgent))
    setPageUrl(window.location.href)
    r81Capture('notice_shown', navigator.userAgent)
    setShow(true)
  }, [])

  const closeNotice = () => {
    try { sessionStorage.setItem(NOTICE_DISMISS_KEY, '1') } catch { /* */ }
    r81Capture('notice_closed')
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
   * R81-B2 — ปุ่มหลัก: คัดลอกลิงก์ + เปิดแผง guide เท่านั้น
   *  ห้าม auto-share (บทเรียน R79) · ห้ามนำทางหน้าปัจจุบันไป intent (บทเรียน R76)
   *  ไม่มีปุ่ม intent บน UI อีกแล้ว (บทเรียน R79: error บนเครื่อง Owner)
   */
  const handleOpenExternal = async () => {
    const ok = await copyUrl()
    setCopied(ok)
    setGuideOpen(true)
    r81Capture('copy_and_guide', ok ? 'copied' : 'copy_failed')
  }

  /** R81-B2: share = ปุ่มที่สองชื่อชัด — เรียกเฉพาะผู้ใช้กดเองเท่านั้น (ห้าม auto-share) */
  const handleShare = async () => {
    const nav = navigator as Navigator & { share?: (data?: ShareData) => Promise<void> }
    if (!nav.share) { r81Capture('share', 'unsupported'); return }
    try {
      await nav.share({ title: 'Bite Me Baby', url: window.location.href })
      r81Capture('share', 'shared')
    } catch { r81Capture('share', 'user_cancel_or_error') }
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
        เว็บนี้<b>ห้ามเปิดในเบราว์เซอร์ของ Facebook</b> (แคชเก่า/บล็อกแผนที่·GPS) — กดปุ่มด้านล่าง เราจะ<b>คัดลอกลิงก์ให้เลย</b> พร้อมวิธีเปิดภายนอกที่ใช้ได้จริงบนเครื่องคุณ (กด ✕ เมื่อไหร่ก็ได้)
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleOpenExternal}
          className="btn btn-primary btn-xs"
          data-testid="inapp-open-external"
        >
          🌐 เปิดในเบราว์เซอร์ภายนอก (คัดลอกลิงก์ให้แล้ว)
        </button>
      </div>
      {guideOpen && (
        <div className="mt-2 rounded-lg border border-brand-primary/50 bg-white/80 p-2" data-testid="inapp-guide">
          <p className="text-[11px] font-semibold text-brand-accent" data-testid="inapp-guide-status">
            {copied
              ? '📋 คัดลอกลิงก์แล้ว — ทำตาม 3 ขั้นด้านล่าง = ออกจากแอปเฟซได้จริง'
              : '📋 คัดลอกไม่สำเร็จ — กดปุ่ม "คัดลอกลิงก์" ด้านล่างอีกครั้ง'}
          </p>
          <ol className="mt-1 list-decimal pl-4 text-[11px] text-brand-muted leading-snug">
            {platform === 'ios' ? (
              <>
                <li>กดปุ่ม <b>📋 คัดลอกลิงก์</b> แล้วออกจากแอปเฟซ</li>
                <li>เปิดแอป <b>Safari</b> → วางในช่องค้นหา = เข้าเว็บภายนอกทันที</li>
                <li>ทางเลือก: กด <b>⋯ (จุดสามจุด มุมบนขวา)</b> → เลือก <b>เปิดผ่าน Chrome หรือ Safari เพื่อการใช้งานที่สมบูรณ์ที่สุด</b></li>
              </>
            ) : (
              <>
                <li>ออกจากแอปเฟซ → เปิดแอป <b>Chrome</b></li>
                <li>วางลิงก์ในช่องค้นหา = เข้าเว็บภายนอกทันที (ใช้งานต่อได้ทุกหน้า)</li>
                <li>ทางเลือก: กด <b>⋯ (จุดสามจุด มุมบนขวา)</b> → เลือก <b>เปิดผ่าน Chrome หรือ Safari เพื่อการใช้งานที่สมบูรณ์ที่สุด</b></li>
              </>
            )}
          </ol>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => { void copyUrl().then(setCopied); r81Capture('copy_button', window.location.href) }}
              className="btn btn-outline btn-xs"
              data-testid="inapp-copy"
            >
              📋 คัดลอกลิงก์
            </button>
            <button
              type="button"
              onClick={() => { void handleShare() }}
              className="btn btn-outline btn-xs"
              data-testid="inapp-share"
            >
              📤 แชร์/ส่งต่อ
            </button>
            {platform === 'android' && pageUrl && externalBrowserIntentUrl(pageUrl) && (
              // D4 NEW WAY (Owner 2026-11-09 action plan): intent ผ่าน "คลิกของผู้ใช้" เท่านั้น —
              //   ต่างจาก JS auto-redirect (location.replace) ที่ R76/R81 พิสูจน์ว่าถูกบล็อก/พังหน้า
              //   · <a href> _native click_ = WebView ส่งต่อให้ system resolver → Chrome
              //   · s.browser_fallback_url = ไม่มี Chrome → กลับ URL เดิม ไม่มีทางพาหน้าไป error
              <a
                href={externalBrowserIntentUrl(pageUrl) as string}
                className="btn btn-primary btn-xs"
                data-testid="inapp-open-chrome"
                onClick={() => r81Capture('open_chrome_intent', pageUrl)}
              >
                🌐 เปิดใน Chrome โดยตรง
              </a>
            )}
            {platform === 'android' && pageUrl && (
              // R81-B3: target=_blank = เปิดแท็บใหม่เท่านั้น — ไม่มีทางพาหน้าปัจจุบันไป error
              <a
                href={pageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary btn-xs"
                data-testid="inapp-open-tab"
                onClick={() => r81Capture('open_tab', pageUrl)}
              >
                ↗ เปิดในแท็บใหม่
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
