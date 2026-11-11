// ============================================
// Bite Me Baby — In-App Browser Banner
// ============================================
// แสดง banner แจ้งเตือนเมื่อเปิดใน FB WebView + ปุ่มเปิดนอก + dismiss + ปุ่มติดตั้งแอป
// R90-hotfix (Owner 2026-11-11): เวอร์ชันก่อนพังทั้งเว็บ (Minified React error #310 =
// "Rendered more hooks than during the previous render") เพราะ useState/useEffect
// ถูกวางไว้หลัง early return → render แรก (isFB=false) ข้าม hooks, render ถัดไป
// (isFB=true) เรียก hooks เพิ่ม = จำนวน hooks ไม่เท่ากัน = crash ทันทีที่ลูกค้ากดลิงก์
//   กติกาถาวร: **hooks ทุกตัวต้องอยู่ก่อน return ทุก branch** ของ component นี้
// • อ่าน ?cart= ตอน render แรก (lazy useState — ก่อน Layout.tsx strip พารามิเตอร์)
//   ด้วย decodeCartParam เดียวกับ Layout (ของเดิม atob raw ไม่มี padding = decode พัง)
// • FB WebView กับ Chrome ไม่แชร์ localStorage กัน — "สะพาน" เดียวคือตัวลิงก์
//   → intent URL / openExternally ต้องถูกสร้างใหม่พร้อม ?cart= เสมอ (ถ้า URL ปัจจุบัน
//     ถูก strip ไปแล้ว จะใส่ค่า raw ที่เก็บไว้ตอนเข้าหน้ากลับเข้าไปก่อนเปิดออก)
// ============================================

import { useCallback, useState } from 'react'
import { useInAppBrowser } from '@/hooks/useInAppBrowser'
import { decodeCartParam } from '@/lib/cartDeepLink'

const CART_RESUME_KEY = 'bmb:cart-resume'

interface CartHandoff {
  raw: string
  count: number
}

export function InAppBrowserBanner({ children }: { children: React.ReactNode }) {
  const { isFB, dismissed, dismiss, openExternally, installApp, canInstall } = useInAppBrowser()

  // hooks ทั้งหมดต้องอยู่ก่อน early return (R90-hotfix — ห้ามย้ายลงไปข้างล่าง)
  // lazy initializer:รันครั้งเดียวตอน mount ซึ่ง URL ยังไม่ถูก strip โดย Layout
  const [cartHandoff] = useState<CartHandoff | null>(() => {
    try {
      const raw = new URLSearchParams(window.location.search).get('cart')
      if (!raw) return null
      const items = decodeCartParam(raw)
      if (!items || items.length === 0) {
        console.warn('[InAppBanner] ?cart= มีแต่ถอดไม่สำเร็จ —', raw.slice(0, 24))
        return null
      }
      try {
        localStorage.setItem(CART_RESUME_KEY, JSON.stringify({ raw, items: items.length, at: Date.now() }))
      } catch { /* localStorage ถูกบล็อก = มี state ในหน้าพอแล้ว */ }
      return { raw, count: items.length }
    } catch {
      return null
    }
  })

  const ua = navigator.userAgent
  const isAndroid = /Android/i.test(ua)

  // URL ส่งต่อ: ถ้า Layout strip ?cart= ไปแล้ว ให้ใส่ค่า raw ที่เก็บไว้กลับเข้ามาก่อน
  const handoffUrl = (() => {
    const current = window.location.href
    try {
      const u = new URL(current)
      if (cartHandoff && !u.searchParams.has('cart')) u.searchParams.set('cart', cartHandoff.raw)
      return u.toString()
    } catch {
      return current
    }
  })()

  const intentUrl = isAndroid && /^https:\/\//.test(handoffUrl)
    ? `intent://${handoffUrl.replace(/^https:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;action=android.intent.action.VIEW;s.browser_fallback_url=${encodeURIComponent(handoffUrl)};end`
    : null

  const handleOpenExternal = useCallback(() => openExternally(handoffUrl), [handoffUrl, openExternally])

  // R91 (Owner 2026-11-11 "ในข้อความ ออกไม่ได้"): Messenger in-app บล็อก intent:// — เส้นทางเดียว
  // ที่ใช้ได้จริงคือ คัดลอกลิงก์ + เปิดเบราว์เซอร์เอง (หรือเมนู ⋯ ของแอป) → ให้ปุ่มสำรองเสมอ
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [guideOpen, setGuideOpen] = useState(false)
  const isMessengerUA = /MESSENGER/i.test(ua)

  const copyHandoff = useCallback(async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(handoffUrl)
        setCopyState('copied')
        setGuideOpen(true)
        return
      }
    } catch { /* fall through → textarea */ }
    try {
      const ta = document.createElement('textarea')
      ta.value = handoffUrl
      ta.setAttribute('readonly', '')
      ta.style.cssText = 'position:fixed;opacity:0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      setCopyState(ok ? 'copied' : 'failed')
      setGuideOpen(true)
    } catch {
      setCopyState('failed')
    }
  }, [handoffUrl])

  if (!isFB || dismissed) return <>{children}</>

  return (
    <>
      <div
        className="fixed top-0 left-0 right-0 z-50 bg-amber-600 text-white px-4 py-3 animate-slide-down"
        role="banner"
        aria-live="polite"
        data-testid="inapp-banner"
      >
        <div className="max-w-xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-lg" aria-hidden="true">📱</span>
            <div>
              <p className="font-semibold">กำลังเปิดใน Facebook</p>
              {cartHandoff ? (
                <p className="text-xs opacity-90">พบรายการ {cartHandoff.count} รายการในตะกร้า — กดปุ่มด้านขวาแล้วรายการจะตามไปเปิดในเบราว์เซอร์จริงด้วยครับ</p>
              ) : (
                <>
                  <p className="text-xs opacity-90">บางฟีเจอร์ทำงานไม่เต็ม (Push, Bluetooth, ติดตั้งแอป)</p>
                  <p className="text-xs opacity-90 mt-1">ลิงก์ที่มี ?cart= จากแชท AI จะเติมตะกร้าอัตโนมัติเมื่อเปิดเบราว์เซอร์ภายนอก</p>
                </>
              )}
            </div>
          </div>
          <div className="flex gap-2 shrink-0 flex-wrap">
            {intentUrl && (
              <a
                href={intentUrl}
                className="bg-white text-amber-700 font-bold px-4 py-2 rounded-lg shadow"
                data-testid="inapp-open-external"
              >
                เปิดใน Chrome / Safari
              </a>
            )}
            {!intentUrl && (
              <button
                type="button"
                className="bg-white text-amber-700 font-bold px-4 py-2 rounded-lg shadow"
                onClick={handleOpenExternal}
                data-testid="inapp-open-external"
              >
                เปิดในเบราว์เซอร์ภายนอก
              </button>
            )}
            <button
              type="button"
              className={`font-bold px-4 py-2 rounded-lg shadow ${copyState === 'copied' ? 'bg-green-500 text-white' : 'bg-white/20 text-white'}`}
              onClick={() => void copyHandoff()}
              data-testid="inapp-copy-link"
            >
              {copyState === 'copied' ? '✓ คัดลอกแล้ว' : '📋 คัดลอกลิงก์'}
            </button>
            {canInstall && (
              <button
                type="button"
                className="bg-green-600 text-white font-bold px-4 py-2 rounded-lg shadow"
                onClick={installApp}
                data-testid="inapp-install-app"
              >
                📥 ติดตั้งแอป
              </button>
            )}
            <button
              type="button"
              className="text-white opacity-80 hover:opacity-100 text-sm underline"
              onClick={dismiss}
              data-testid="inapp-dismiss"
            >
              เข้าใจแล้ว
            </button>
          </div>
        </div>
        {guideOpen && (
          <div className="max-w-xl mx-auto mt-2 rounded-lg bg-white/15 p-2 text-xs leading-snug" data-testid="inapp-guide">
            {copyState === 'copied' ? (
              <p className="font-semibold mb-1">📋 คัดลอกลิงก์แล้ว — {isMessengerUA ? 'ใน Messenger แตะปุ่ม ⋯ มุมบนขวาแล้วเลือก "เปิดในเบราว์เซอร์" หรือ:' : 'เปิดเบราว์เซอร์จริงแล้ววางลิงก์:'}</p>
            ) : copyState === 'failed' ? (
              <p className="font-semibold mb-1">คัดลอกไม่สำเร็จ — กดปุ่ม "📋 คัดลอกลิงก์" อีกครั้ง หรือใช้เมนู ⋯ ของแอป</p>
            ) : (
              <p className="font-semibold mb-1">เปิดเว็บภายนอกตามขั้นนี้ครับ:</p>
            )}
            <ol className="list-decimal pl-5">
              {isMessengerUA ? (
                <>
                  <li>แตะ <b>⋯ (สามจุดมุมบนขวา)</b> ในหน้าจอ Messenger นี้</li>
                  <li>เลือก <b>“เปิดในเบราว์เซอร์”</b> (Android) หรือ <b>แชร์ → Safari</b> (iPhone)</li>
                  <li>ถ้าไม่มีเมนูนั้น: แตะ <b>📋 คัดลอกลิงก์</b> → เปิด Chrome/Safari → วางในช่องค้นหา</li>
                </>
              ) : (
                <>
                  <li>เปิดแอป <b>Chrome</b> หรือ <b>Safari</b> เอง</li>
                  <li>วางลิงก์ในช่องค้นหา = เข้าเว็บจริง (ตะกร้าที่สรุปไว้จะเติมอัตโนมัติ)</li>
                  <li>ทางลัด: กด <b>📋 คัดลอกลิงก์</b> ด้านบนก่อน แล้วค่อยวาง</li>
                </>
              )}
            </ol>
          </div>
        )}
      </div>

      <div className="h-20 lg:h-24" aria-hidden="true" />

      {children}
    </>
  )
}
