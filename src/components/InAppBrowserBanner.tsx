// ============================================
// Bite Me Baby — In-App Browser Banner
// ============================================
// แสดง banner แจ้งเตือนเมื่อเปิดใน FB WebView + ปุ่มคัดลอกลิงก์ + dismiss + ปุ่มติดตั้งแอป
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
// • R101 / Phase 1: ปุ่มคัดลอกพา **ตะกร้าสด ณ เวลากด** (encodeLiveCartParam v2) + fallback chain
//   live cart → mount snapshot → bmb:cart-resume (TTL 30 นาที)
// ============================================

import { useCallback, useRef, useState } from 'react'
import { useInAppBrowser } from '@/hooks/useInAppBrowser'
import { useCartStore } from '@/store/cartStore'
import { normalizeCartParam, encodeLiveCartParam } from '@/lib/cartDeepLink'

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
const CART_RESUME_TTL = 30 * 60 * 1000 // 30 นาที

interface CartHandoff {
  raw: string
  count: number
  at?: number
}

/** อ่านสแนปชอตตะกร้าจาก localStorage (จากครั้งก่อนในแอป/เครื่องเดียวกัน) —
 *  R96-R100d (Owner 2026-11-14 "copy ไป Chrome แล้วไม่มีสินค้า"): เมื่อจุดจับ ?cart=
 *  ณ mount แรกพลาด (URL ไม่มี param/decode fail) ต้องมีแหล่งถอดลิงก์คัดลอกสำรองเสมอ — ไม่เงียบ
 *  R101e/Phase 1: เพิ่ม TTL 30 นาที + เคลียร์เมื่อหมดอายุ (กันสแนปชอตเก่า) */
function readCartResume(): CartHandoff | null {
  try {
    const j = JSON.parse(localStorage.getItem(CART_RESUME_KEY) || 'null') as { raw?: string; items?: number; at?: number } | null
    if (j && typeof j.raw === 'string' && j.raw.length > 0 && Number(j.items) > 0) {
      const at = Number(j.at || 0)
      if (at > 0 && Date.now() - at > CART_RESUME_TTL) {
        // หมดอายุ = เคลียร์ทิ้ง
        try { localStorage.removeItem(CART_RESUME_KEY) } catch {}
        return null
      }
      return { raw: j.raw, count: Number(j.items), at }
    }
  } catch { /* localStorage ถูกบล็อก/ข้อมูลพัง = ไม่มีสำรอง */ }
  return null
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
  // R63b (live test 2026-11-23 "คัดลอกลิงก์ → เปิดเบราว์เซอร์ภายนอก ได้ตะกร้าเก่า"): ต้องเป็น
  // subscription hook — `.getState()` ใน render body อ่านครั้งเดียวตอน mount (ไม่ re-render
  // เมื่อลูกค้าเพิ่มเมนูต่อใน WebView) → ปุ่มคัดลอกใช้ตะกร้า mount เก่าเสมอ ทั้งที่ตะกร้าสดเพิ่มแล้ว
  const liveCart = useCartStore((state) => state.items)

  // hooks ทั้งหมดต้องอยู่ก่อน early return (R90-hotfix — ห้ามย้ายลงไปข้างล่าง)
  // lazy initializer: รันครั้งเดียวตอน mount ซึ่ง URL ยังไม่ถูก strip โดย Layout
  const [cartHandoff] = useState<CartHandoff | null>(() => {
    try {
      // R101-fix (A-4): normalizeCartParam = ถอด % มั่วจาก copy/paste ได้ด้วย
      // (ค่าปกติ b64url ไม่มี % = เหมือน decodeCartParam ตรง ๆ)
      const cap = normalizeCartParam(new URLSearchParams(window.location.search).get('cart'))
      if (!cap) return readCartResume() // จุดจับ ณ mount พลาด = ใช้สแนปชอตสำรอง
      try {
        localStorage.setItem(CART_RESUME_KEY, JSON.stringify({ raw: cap.raw, items: cap.items.length, at: Date.now() }))
      } catch { /* localStorage ถูกบล็อก = มี state ในหน้าพอแล้ว */ }
      return { raw: cap.raw, count: cap.items.length, at: Date.now() }
    } catch {
      return readCartResume()
    }
  })

  // R92 (Owner 2026-11-11 ภาพ 3: error page ERR_UNKNOWN_URL_SCHEME จากลิงก์ intent ที่เฟสค้างไว้):
  // FB Android WebView ไม่ dispatch รูปแบบนี้ = บทเรียน R76/R79/R81-B2 ห้ามกลับมาใส่อีกเด็ดขาด
  // → ปุ่มหลักเดียว = คัดลอกลิงก์ (มี ?cart= เสมอ) + guide ต่อ platform — ทางเดียวที่พิสูจน์ว่าใช้ได้จริง
  // URL ส่งต่อ: ถ้า Layout strip ?cart= ไปแล้ว ให้ใส่ค่า raw ที่เก็บไว้กลับเข้ามาก่อน
  // Phase 1: strip fbclid (tracking param) ความสะอาด
  // R63b: handoffUrl เดิม (ประกอบจาก mount snapshot ตอน render) = dead code ตัดทิ้ง —
  // ปุ่มคัดลอก/กล่องลิงก์ทุกทางผ่าน buildLiveHandoffUrl ณ เวลากด (fallback chain เดียว)

  // สร้าง URL พาตะกร้าสด ณ เวลากด — fallback chain: live cart → mount snapshot → bmb:cart-resume (TTL 30 นาที)
  // R102 (2026-11-24): strip fbclid ก่อน fallback chain + บังคับ live cart เสมอเมื่อมีของ
  const buildLiveHandoffUrl = useCallback(() => {
    // R102: strip fbclid ทันที (ก่อน encode) กัน tracking param ปน payload
    let finalUrl = window.location.href
    try {
      const u = new URL(finalUrl)
      u.searchParams.delete('fbclid')
      finalUrl = u.toString()
    } catch { /* fall through */ }

    let enc = ''
    let droppedMods = false
    let truncated = false
    let usedLiveCart = false
    let liveCount = 0

    // 1) ตะกร้าสดจาก cartStore (ถ้ามีของ) — บังคับใช้ live cart เสมอ ไม่ fallback
    if (liveCart.length > 0) {
      const res = encodeLiveCartParam(
        liveCart.map((it) => ({
          id: it.product.id,
          quantity: it.quantity,
          customizations: it.customizations,
          line_mode: it.line_mode,
        })),
      )
      enc = res.encoded
      droppedMods = res.droppedMods
      truncated = res.truncated
      usedLiveCart = true
      liveCount = liveCart.reduce((s, it) => s + it.quantity, 0)
    }

    // 2) fallback: mount snapshot (cartHandoff) — ใช้ได้ก็ต่อเมื่อ live cart ว่าง
    if (!enc && cartHandoff?.raw) {
      enc = cartHandoff.raw
    }

    // 3) fallback: bmb:cart-resume (มี TTL 30 นาที) — ใช้ได้ก็ต่อเมื่อ live cart ว่าง
    if (!enc) {
      const resume = readCartResume()
      if (resume?.raw) enc = resume.raw
    }

    // สร้าง URL พร้อม ?cart= (ถ้ามี) + ?s= (บริบทแชท) จาก URL ปัจจุบันถ้ามี
    try {
      const u = new URL(finalUrl)
      if (enc) u.searchParams.set('cart', enc)
      // เก็บ ?s= ไว้ถ้ามี (บริบทแชทต่อเนื่อง)
      finalUrl = u.toString()
    } catch { /* fall through */ }

    return { url: finalUrl, usedLiveCart, liveCount, droppedMods, truncated }
  }, [liveCart, cartHandoff])

  // R91 (Owner 2026-11-11 "ในข้อความ ออกไม่ได้"): Messenger in-app บล็อกลิงก์ intent — เส้นทางเดียว
  // ที่ใช้ได้จริงคือ คัดลอกลิงก์ + เปิดเบราว์เซอร์เอง (หรือเมนู ⋯ ของแอป) → ให้ปุ่มสำรองเสมอ
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [guideOpen, setGuideOpen] = useState(false)
  // R101-fix (Owner 2026-11-15 A-4 FAIL "คัดลอก → Chrome ไม่มีตะกร้า · แต่ใน WebView เฟซมีสินค้า"):
  // WebView decode/restore ผ่านแล้วทั้งคู่ = ปัญหาแคบอยู่ที่ clipboard ข้าม WebView→Chrome
  // → copy 3 ชั้น (clipboard API → execCommand → prompt modal) + กล่องลิงก์เต็มที่ user
  //   เลือก/คัดลอกเองได้ (ทำงานทุก WebView ทุกเครื่อง — สะพานเดียวที่พิสูจน์ว่าใช้ได้จริง)
  const linkBoxRef = useRef<HTMLTextAreaElement>(null)
  const ua = navigator.userAgent
  const isMessengerUA = /MESSENGER/i.test(ua)
  const isIOS = /iPhone|iPad/i.test(ua)

  const copyHandoff = useCallback(async () => {
    const { url, usedLiveCart, liveCount, droppedMods, truncated } = buildLiveHandoffUrl()
    let done = false
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
        done = true
      }
    } catch { /* fall through → textarea */ }
    if (!done) {
      try {
        const ta = document.createElement('textarea')
        ta.value = url
        ta.setAttribute('readonly', '')
        ta.style.cssText = 'position:fixed;opacity:0'
        document.body.appendChild(ta)
        ta.select()
        done = document.execCommand('copy')
        document.body.removeChild(ta)
      } catch { /* fall through → prompt */ }
    }
    if (!done) {
      // R101-fix: WebView บางรุ่นบล็อกทั้ง clipboard API และ execCommand →
      // prompt modal = ทางเดียวที่ user คัดลอกเองได้แน่นอน (ทุก platform)
      try {
        window.prompt('คัดลอกลิงก์นี้เองครับ (กดค้าง/Ctrl+C):', url)
        done = true // user เห็น/คัดลอกเองแล้ว — ไม่รู้ผลจริง แต่ guide ต่อไปช่วยได้
      } catch { /* prompt ถูกบล็อก (หายาด) = ปุ่มกล่องลิงก์ด้านล่างรับช่วงต่อ */ }
    }
    setCopyState(done ? 'copied' : 'failed')
    setGuideOpen(true)
  }, [buildLiveHandoffUrl])

  // R101-fix: เลือกทั้งหมดในกล่องลิงก์ (user กดค้าง → คัดลอกเองได้ทุก WebView)
  const selectLinkBox = useCallback(() => {
    const el = linkBoxRef.current
    if (!el) return
    el.focus()
    el.select()
    try { el.setSelectionRange(0, el.value.length) } catch { /* iOS รุ่นเก่า */ }
  }, [])

  // สร้าง URL สำหรับกล่องลิงก์ (ใช้ live cart ถ้ามี)
  const { url: linkBoxUrl } = buildLiveHandoffUrl()

  // จำนวนรายการสำหรับแสดงใน banner — ใช้ตะกร้าสดเมื่อมีของ มิฉะนั้นใช้ mount snapshot
  const displayCount = liveCart.length > 0
    ? liveCart.reduce((s, it) => s + it.quantity, 0)
    : (cartHandoff?.count ?? 0)
  const displayLineCount = liveCart.length > 0 ? liveCart.length : (cartHandoff?.count ?? 0)

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
              {(displayCount > 0 || displayLineCount > 0) ? (
                <p className="text-xs opacity-90" data-testid="inapp-live-cart-count">
                  พบรายการ {displayLineCount} รายการ ({displayCount} ชิ้น)
                  {liveCart.length > 0 ? ' — ลิงก์นี้พาตะกร้าเต็มของคุณ' : ' — กดคัดลอกลิงก์ข้างล่าง แล้ววางใน Chrome/Safari หรือติดตั้งแอปเลยก็ได้ครับ'}
                </p>
              ) : (
                // R96-R100d (Owner): ห้ามเงียบ — บอกตรงว่าลิงก์นี้ไม่มีรายการ กัน "คัดลอกลิงก์เปล่าไป Chrome แล้วไม่มีตะกร้า"
                <p className="text-xs opacity-90">ลิงก์ที่เปิดอยู่ไม่พบรายการตะกร้า — ให้ใช้ลิงก์จากคอมเมนต์/ข้อความที่ระบบตอบไว้ (ที่มีข้อความ "สรุปรายการของคุณ") หรือเลือกเมนูที่หน้าร้านได้เลย</p>
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
            {/* R101-fix (A-4): กล่องลิงก์เต็ม — WebView บางรุ่นคัดลอกโปรแกรมไม่ได้จริง →
                user เลือกทั้งหมด + กดค้าง/Ctrl+C คัดลอกเองได้ทุกเครื่อง (สะพานที่พิสูจน์ว่าใช้ได้จริง) */}
            {(cartHandoff || liveCart.length > 0) && (
              <div className="mt-2">
                <textarea
                  ref={linkBoxRef}
                  readOnly
                  value={linkBoxUrl}
                  rows={2}
                  data-testid="inapp-link-box"
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-full rounded bg-white text-amber-900 text-[11px] px-2 py-1 break-all"
                />
                <button
                  type="button"
                  onClick={selectLinkBox}
                  data-testid="inapp-select-link"
                  className="mt-1 text-white underline text-xs"
                >
                  🔗 เลือกทั้งหมด แล้วกดค้าง/Ctrl+C คัดลอกเอง
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="h-20 lg:h-24" aria-hidden="true" />

      {children}
    </>
  )
}
