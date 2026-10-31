import { ReactNode, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Header } from './Header'
import { BottomNav } from './BottomNav'
import { Footer } from './Footer'
import { ToastContainer } from '../ui/ToastContainer'
import { OrderBuilderModal } from '../order/OrderBuilderModal'
import { BiteMascot } from '../ai/BiteMascot'
import { BackgroundLayer } from './BackgroundLayer'
import { AmbientMusicToggle } from '../audio/AmbientMusicToggle'
import { useCartStore } from '@/store/cartStore'
import { referralCodeFromSearch } from '@/lib/referralClient'
import { affiliateCodeFromSearch, saveAffiliateClaimCode } from '@/lib/engagementClient'
import { readCartParam } from '@/lib/cartDeepLink'
import { showToast } from '../ui/ToastContainer'

interface LayoutProps {
  children?: ReactNode
  hideBottomNav?: boolean
  /** Set to 'pre-order' on pre-order-heavy views to arm the Stage 3 micro-hook. */
  activeSection?: string
}

export function Layout({ children, hideBottomNav = false, activeSection = 'home' }: LayoutProps) {
  const [headerHidden, setHeaderHidden] = useState(false)
  const [lastScrollY, setLastScrollY] = useState(0)
  const mainRef = useRef<HTMLElement>(null)
  const location = useLocation()
  // Single-nav discipline: admin area uses the AdminNav sidebar/drawer only —
  // the customer BottomNav must never render there (structural gate, not CSS).
  const isAdminArea = location.pathname.startsWith('/admin')
  const showBottomNav = !hideBottomNav && !isAdminArea

  // [G&R 154] Deep-link แชร์: `/?ref=CODE` → เก็บโค้ดแนะนำเพื่อนเข้าตะกร้า (ครั้งเดียว
  // ตอนเข้าหน้า) แล้ว strip พารามิเตอร์ออกจาก address bar — ใช้ได้ทุก path
  useEffect(() => {
    if (typeof window === 'undefined') return
    const code = referralCodeFromSearch(window.location.search)
    if (!code) return
    if (!useCartStore.getState().referralCode) {
      useCartStore.getState().setReferralCode(code)
      showToast('บันทึกโค้ดแนะนำเพื่อนแล้ว — ใช้ตอนสั่งซื้อเพื่อรับรางวัลคู่กัน', 'success')
    }
    try {
      const url = new URL(window.location.href)
      url.searchParams.delete('ref')
      window.history.replaceState(null, '', url.pathname + url.search + url.hash)
    } catch { /* URL แปลก ๆ = ปล่อยตามเดิม */ }
  }, [])

  // [G&R 156] Deep-link ครีเอเตอร์: `/?aff=CODE` → เก็บลง sessionStorage รอ Checkout
  // ผูกกับออเดอร์ (affiliate_claim) — แล้ว strip พารามิเตอร์ออกจาก address bar
  useEffect(() => {
    if (typeof window === 'undefined') return
    const aff = affiliateCodeFromSearch(window.location.search)
    if (!aff) return
    saveAffiliateClaimCode(aff)
    try {
      const url = new URL(window.location.href)
      url.searchParams.delete('aff')
      window.history.replaceState(null, '', url.pathname + url.search + url.hash)
    } catch { /* URL แปลก ๆ = ปล่อยตามเดิม */ }
  }, [])

  // [R27 · Owner 2026-10-30] Deep-link ตะกร้าจากโซเชียล: /shop?cart=<b64url>
  // → รอ persistence hydration ให้เสร็จ (กัน restore ทับ) → เติมรายการลงตะกร้า
  // → เปิดแผงตะกร้าให้เช็คเอาท์ต่อหรือเพิ่มเมนูเอง · strip พารามิเตอร์ทันที (กัน reload ซ้ำ)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const raw = new URLSearchParams(window.location.search).get('cart')
    if (!raw) return
    try {
      const url = new URL(window.location.href)
      url.searchParams.delete('cart')
      window.history.replaceState(null, '', url.pathname + url.search + url.hash)
    } catch { /* URL แปลก ๆ = ปล่อยตามเดิม */ }
    const items = readCartParam(raw)
    if (!items || items.length === 0) {
      // R43 B6 (Owner 2026-10-31): decode-fail เคย return เงียบ → ลูกค้าเห็นตะกร้าว่าง
      // ไม่ทราบสาเหตุ (ภาพ 7-8) → ห้ามเงียบ ต้องบอกสาเหตุ + ทางออกเสมอ
      showToast('ลิงก์รายการในแชทไม่สมบูรณ์หรือเสียหาย — เปิดรายการให้ไม่ได้ เลือกเมนูใหม่ที่หน้าร้านได้เลย', 'warning')
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const t0 = Date.now()
        while (!useCartStore.getState().isHydrated && Date.now() - t0 < 4000) {
          await new Promise((r) => setTimeout(r, 100))
        }
        const { getProducts } = await import('@/lib/bmbAdminApi_products')
        const catalog = await getProducts()
        const byId = new Map(catalog.map((p) => [p.id, p]))
        let added = 0
        let missing = 0
        for (const it of items) {
          const p = byId.get(it.id)
          if (!p || (p as { is_available?: boolean }).is_available === false) { missing++; continue }
          const res = useCartStore.getState().addItem(p, it.q, {}, 'SAME_DAY')
          if (res === 'added') added++
        }
        if (cancelled) return
        if (added > 0) {
          showToast('เปิดรายการที่สรุปไว้ให้แล้ว 🛒 ' + added + ' รายการ — เช็คเอาท์หรือเพิ่มเมนูต่อได้เลย', 'success')
          useCartStore.getState().setCheckoutOpen(true)
        } else if (missing > 0) {
          showToast('รายการจากลิงก์หาไม่เจอในเมนูปัจจุบัน — เลือกเมนูใหม่ได้ที่หน้าร้าน', 'warning')
        }
      } catch {
        if (!cancelled) showToast('เปิดรายการจากลิงก์ไม่สำเร็จ — สั่งใหม่ได้ที่หน้าร้าน', 'warning')
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Header hide-on-scroll — listen on the ACTUAL scroll container (`main` has
  // overflow-y-auto, so window.scrollY never moves on long pages) → this makes
  // the behavior work again without changing any page's scroll architecture.
  useEffect(() => {
    const el = mainRef.current
    if (!el) return
    let ticking = false

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = el.scrollTop
          const threshold = 100

          // Hide header when scrolling down
          if (currentScrollY > lastScrollY && currentScrollY > threshold) {
            setHeaderHidden(true)
          } else {
            setHeaderHidden(false)
          }

          setLastScrollY(currentScrollY)
          ticking = false
        })
        ticking = true
      }
    }

    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [lastScrollY])

  // R12 (Owner 2026-10-27): ทุกหน้าขึ้นจากด้านบนเส เว้นแต่ติดเงื่อนไข deep-link —
  // `#hash` ที่มี element จริงบนหน้า = ลิ้งไป section นั้น (ความลึกใช้ได้จริง) ·
  // ไม่มี/หาไม่เจอ = ขึ้นบน (<main> + window fallback) · fire ทุกครั้งเมื่อ
  // pathname/search/hash เปลี่ยน (จิ้มลิงก์ URL เดิมเป๊ะ = Header/BottomNav/Footer scroll เอง)
  // (jsdom ไม่ implement Element.scrollTo/scrollIntoView — guard + fallback ให้ test render ได้)
  useEffect(() => {
    const hashId = location.hash && location.hash.length > 1 ? location.hash.slice(1) : ''
    const target = hashId && typeof document !== 'undefined' ? document.getElementById(hashId) : null
    if (target && typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    const el = mainRef.current
    if (el) {
      if (typeof el.scrollTo === 'function') el.scrollTo({ top: 0 })
      else el.scrollTop = 0
    }
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') window.scrollTo({ top: 0 })
  }, [location.pathname, location.search, location.hash])

  return (
    <div className="flex flex-col min-h-screen">
      {/* Site background layer — Stage C: z-0 fixed, pointer-events none,
          content/overlays below stay above it via the relative z-10 wrapper */}
      <BackgroundLayer />
      <div className={`relative z-10 flex flex-col flex-1 min-h-0${showBottomNav ? '' : ' nav-visible'}`}>
        {/* Header - hidden when scrolling down */}
        <div className={`transition-transform duration-300 ${headerHidden ? '-translate-y-full' : 'translate-y-0'} relative z-50`}>
          <Header />
        </div>

        {/* Main content - scroll window, not main.
            D02: bottom clearance = measured BottomNav + StickyCartBar heights
            (set as --bmb-bottom-nav-h / --bmb-sticky-h), so content can always
            scroll fully above both fixed bars on any viewport/safe-area. */}
        <main ref={mainRef} className="flex-1 min-h-0 overflow-y-auto main-scroll">
          {children}
        </main>

        {/* Footer - always visible at bottom */}
        <Footer />

        {showBottomNav && <BottomNav />}
        <ToastContainer />
        {/* Ambient music player — session-persistent singleton state */}
        <AmbientMusicToggle />
        <OrderBuilderModal />
        {/* Decorative + floating AI mascot (pointer-events guarded) */}
        <BiteMascot activeSection={activeSection} />
      </div>
    </div>
  )
}
