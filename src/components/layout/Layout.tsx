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

  // HANDOFF 2026-10-24 task 3: scroll-to-top on route change. The scroll window
  // is `main` (not window), so navigating from a deep position (e.g. admin
  // sidebar item clicked while scrolled down) used to land the new page at the
  // OLD offset — action clicks must always open the task at the top.
  // (jsdom ไม่ implement Element.scrollTo — guard + fallback ให้ test render ได้)
  useEffect(() => {
    const el = mainRef.current
    if (!el) return
    if (typeof el.scrollTo === 'function') el.scrollTo({ top: 0 })
    else el.scrollTop = 0
  }, [location.pathname])

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
