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
