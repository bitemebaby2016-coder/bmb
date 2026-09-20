import { ReactNode, useEffect, useState } from 'react'
import { Header } from './Header'
import { BottomNav } from './BottomNav'
import { Footer } from './Footer'
import { ToastContainer } from '../ui/ToastContainer'
import { OrderBuilderModal } from '../order/OrderBuilderModal'

interface LayoutProps {
  children?: ReactNode
  hideBottomNav?: boolean
}

export function Layout({ children, hideBottomNav = false }: LayoutProps) {
  const [headerHidden, setHeaderHidden] = useState(false)
  const [lastScrollY, setLastScrollY] = useState(0)

  useEffect(() => {
    let ticking = false

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY
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

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [lastScrollY])

  return (
    <div className="flex flex-col min-h-screen bg-brand-bg">
      {/* Header - hidden when scrolling down */}
      <div className={`transition-transform duration-300 ${headerHidden ? '-translate-y-full' : 'translate-y-0'} relative z-50`}>
        <Header />
      </div>
      
      {/* Main content - scroll window, not main */}
      <main className="flex-1 min-h-0 overflow-y-auto pb-24">
        {children}
      </main>
      
      {/* Footer - always visible at bottom */}
      <Footer />
      
      {!hideBottomNav && <BottomNav />}
      <ToastContainer />
      <OrderBuilderModal />
    </div>
  )
}