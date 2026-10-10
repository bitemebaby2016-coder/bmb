import { ReactNode, useEffect, useRef, useState } from 'react'
import { Header } from './Header'
import { BottomNav } from './BottomNav'
import { Footer } from './Footer'
import { ToastContainer } from '../ui/ToastContainer'
import { OrderBuilderModal } from '../order/OrderBuilderModal'
import { BiteMascot } from '../ai/BiteMascot'
import { CartIsolationModal } from '../cart/CartIsolationModal'
import { BackgroundLayer } from './BackgroundLayer'

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

  return (
    <div className="flex flex-col min-h-screen">
      {/* Site background layer — Stage C: z-0 fixed, pointer-events none,
          content/overlays below stay above it via the relative z-10 wrapper */}
      <BackgroundLayer />
      <div className={`relative z-10 flex flex-col flex-1 min-h-0${hideBottomNav ? '' : ' nav-visible'}`}>
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

        {!hideBottomNav && <BottomNav />}
        <ToastContainer />
        <OrderBuilderModal />
        {/* Decorative + floating AI mascot (pointer-events guarded) */}
        <BiteMascot activeSection={activeSection} />
        {/* Global cart-isolation confirmation modal */}
        <CartIsolationModal />
      </div>
    </div>
  )
}
