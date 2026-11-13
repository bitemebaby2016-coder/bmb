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
//   → ปุ่มคัดลอกต้องพา ?cart= กลับเสมอ (ถ้า URL ปัจจุบันถูก strip ไปแล้ว จะใส่ค่า raw
//     ที่เก็บไว้ตอนเข้าหน้ากลับเข้าไปก่อนคัดลอก)
// • R92 (Owner 2026-11-11): ลบปุ่มเปิดแบบ intent ทั้งหมด — ภาพ 3 พิสูจน์ FB Android WebView
//   ไม่ dispatch รูปแบบนี้ = ERR_UNKNOWN_URL_SCHEME หน้าพัง (R76/R79/R81-B2) ห้ามใส่อีก
// ============================================

import { useCallback, useState } from 'react'
import { useInAppBrowser } from '@/hooks/useInAppBrowser'
import { decodeCartParam } from '@/lib/cartDeepLink'

// ============================================
// Global beforeinstallprompt capture — shared across all banner instances
// One listener total; all PWA buttons share _promptRef
// ============================================
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  prompt(): Promise<void>
}
const _promptRef = { value: null as BeforeInstallPromptEvent | null }

if (typeof window !== 'undefined' && !(window as unknown as Record<string, unknown>)['bmb-pwa-listener-added']) {
  ;(window as unknown as Record<string, unknown>)['bmb-pwa-listener-added'] = true
  const _handler = (e: Event) => {
    e.preventDefault()
    _promptRef.value = e as unknown as BeforeInstallPromptEvent
  }
  window.addEventListener('beforeinstallprompt', _handler)
}

async function _triggerInstall(): Promise<void> {
  const p = _promptRef.value
  if (!p || typeof p.prompt !== 'function') return
  try {
    await p.prompt()
    _promptRef.value = null
  } catch { /* fall through */ }
}

const CART_RESUME_KEY = 'bmb:cart-resume'

interface CartHandoff {
  raw: string
  count: number
}

// ============================================
// PWA Install Button — always visible, shows prompt or manual guide
// ============================================
function PwaInstallButton({ canInstall }: { canInstall: boolean }) {
  const [showGuide, setShowGuide] = useState(false)
  const ua = navigator.userAgent
  const isIOS = /iPhone|iPad/i.test(ua)

  return (
    <>
      <button
        type="button"
        className="bg-green-600 text-white font-bold px-4 py-2 rounded-lg shadow hover:bg-green-700 transition-colors"
        onClick={() => {
          if (canInstall) {
            void _triggerInstall()
          } else {
            setShowGuide(true)
          }
        }}
        data-testid="inapp-install-app"
      >
        📥 ติดตั้งแอป
      </button>
      {showGuide && (
        <div className="absolute bottom-0 left-0 right-0 bg-white border border-gray-200 rounded-t-xl p-3 shadow-xl z-50">
          <p className="font-semibold text-sm mb-2">ติดตั้ง Bite Me Baby เป็นแอป (PWA)</p>
          <ol className="list-decimal pl-5 text-xs space-y-1">
            {isIOS ? (
              <>
                <li>แตะปุ่ม <b>แชร์ (ช่องสี่เหลี่ยมมีลูกศรขึ้น)</b></li>
                <li>เลื่อนลง → เลือก <b>"เพิ่มบนหน้าจอโฮม"</b></li>
                <li>แตะ <b>"เพิ่ม"</b></li>
              </>
            ) : (
              <>
                <li>แตะ <b>⋯ (สามจุดมุมบนขวา)</b></li>
                <li>เลือก <b>"ติดตั้งแอปนี้"</b> หรือ <b>"เพิ่มในหน้าหลัก"</b></li>
              </>
            )}
          </ol>
          <button
            type="button"
            className="text-xs text-blue-600 underline mt-2"
            onClick={() => setShowGuide(false)}
          >
            ปิด
          </button>
        </div>
      )}
    </>
  )
}

export function InAppBrowserBanner({ children }: { children: React.ReactNode }) {
  const { isFB, dismissed, dismiss, installApp, canInstall } = useInAppBrowser()

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

  // R92 (Owner 2026-11-11 ภาพ 3: error page ERR_UNKNOWN_URL_SCHEME จากลิงก์ intent ที่เฟสค้างไว้):
  // FB Android WebView ไม่ dispatch รูปแบบนี้ = บทเรียน R76/R79/R81-B2 ห้ามกลับมาใส่อีกเด็ดขาด
  // → ปุ่มหลักเดียว = คัดลอกลิงก์ (มี ?cart= เสมอ) + guide ต่อ platform — ทางเดียวที่พิสูจน์ว่าใช้ได้จริง
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

  // R91 (Owner 2026-11-11 "ในข้อความ ออกไม่ได้"): Messenger in-app บล็อกลิงก์ intent — เส้นทางเดียว
  // ที่ใช้ได้จริงคือ คัดลอกลิงก์ + เปิดเบราว์เซอร์เอง (หรือเมนู ⋯ ของแอป) → ให้ปุ่มสำรองเสมอ
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [guideOpen, setGuideOpen] = useState(false)
  const ua = navigator.userAgent
  const isMessengerUA = /MESSENGER/i.test(ua)
  const isIOS = /iPhone|iPad/i.test(ua)

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
            <span className="text-lg" aria-hidden="true">⚠️</span>
            <div>
              <p className="font-semibold">Facebook ไม่รองรับการเปิดลิงก์ตะกร้าอัตโนมัติ</p>
              {cartHandoff ? (
                <p className="text-xs opacity-90">พบรายการ {cartHandoff.count} รายการ — กดคัดลอกลิงก์ข้างล่าง แล้ววางใน Chrome/Safari หรือติดตั้งแอปเลยก็ได้ครับ</p>
              ) : (
                <p className="text-xs opacity-90">กรุณากดคัดลอกลิงก์เพื่อเปิดใน Chrome/Safari หรือติดตั้งแอปจากปุ่มด้านล่าง</p>
              )}
            </div>
          </div>
          <div className="flex gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              className={`font-bold px-4 py-2 rounded-lg shadow ${copyState === 'copied' ? 'bg-green-500 text-white' : 'bg-white text-amber-700'}`}
              onClick={() => void copyHandoff()}
              data-testid="inapp-copy-link"
            >
              {copyState === 'copied' ? '✓ คัดลอกแล้ว — วางใน Chrome / Safari' : '📋 คัดลอกลิงก์ · เปิดใน Chrome / Safari'}
            </button>
            <PwaInstallButton canInstall={canInstall} />
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
                  <li>ถ้าไม่มีเมนูนั้น: เปิด Chrome/Safari → วางลิงก์ที่คัดลอกไว้</li>
                </>
              ) : isIOS ? (
                <>
                  <li>แตะปุ่ม <b>แชร์ (ช่องสี่เหลี่ยมมีลูกศรขึ้น)</b> ที่แถบล่างของแอปเฟซ</li>
                  <li>เลือก <b>Safari</b> จากรายการแอป</li>
                  <li>ถ้าไม่มีเมนูนั้น: เปิด Safari เอง → วางลิงก์ที่คัดลอกไว้</li>
                </>
              ) : (
                <>
                  <li>แตะ <b>⋯ (สามจุดมุมบนขวา)</b> ของแอปเฟซ</li>
                  <li>เลือก <b>“เปิดในเบราว์เซอร์”</b> — เปิดใน Chrome</li>
                  <li>ถ้าไม่มีเมนูนั้น: เปิด Chrome เอง → วางลิงก์ที่คัดลอกไว้</li>
                </>
              )}
            </ol>
            <p className="mt-1 opacity-90">สำรองทุกเครื่อง: คัดลอกลิงก์แล้ว <b>วางใน Chrome / Safari</b> = เข้าเว็บจริงเสมอ</p>
          </div>
        )}
      </div>

      <div className="h-20 lg:h-24" aria-hidden="true" />

      {children}
    </>
  )
}
