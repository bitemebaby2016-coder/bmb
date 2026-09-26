import { Link, useLocation } from 'react-router-dom'
import { useState, useEffect, Fragment } from 'react'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import { shouldShowAdminLink } from '@/lib/adminUi'
import { NotificationDropdown } from '@/components/notification/NotificationDropdown'

const MOBILE_NAV_LINKS = [
  { path: '/menu', label: 'เมนู' },
  { path: '/promotions', label: 'โปรโมชั่น' },
  { path: '/vote', label: 'โหวตเมนู' },
  { path: '/random-menu', label: 'สุ่มเมนู' },
]

export function Header() {
  const cartCount = useCartStore((s) => s.getCartCount())
  const customer = useAuthStore((s) => s.customer)
  const role = useAuthStore((s) => s.role)
  const logout = useAuthStore((s) => s.logout)
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  function handleLogout() {
    logout()
    window.location.href = '/'
  }

  function closeMobileMenu() {
    setMobileMenuOpen(false)
  }

  return (
    <Fragment>
      <header className="relative z-50 bg-brand-surface border-b border-brand-border">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <img src="/Head Logo.webp" alt="Bite Me Baby" width={40} height={40} className="rounded-lg object-cover" />
          <span className="font-display font-bold text-brand-accent text-xl">Bite Me Baby</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          <Link to="/menu" className="text-brand-accent hover:text-brand-primary transition-colors font-medium">เมนู</Link>
          <Link to="/promotions" className="text-brand-accent hover:text-brand-primary transition-colors font-medium">โปรโมชั่น</Link>
          <Link to="/vote" className="text-brand-accent hover:text-brand-primary transition-colors font-medium">โหวตเมนู</Link>
          <Link to="/random-menu" className="text-brand-accent hover:text-brand-primary transition-colors font-medium">สุ่มเมนู</Link>
        </nav>

        <div className="flex items-center gap-3">
          {customer ? (
            <div className="flex items-center gap-3">
              <NotificationDropdown />
              {shouldShowAdminLink(role, customer.email) && (
                <Link to="/admin" className="text-brand-primary font-medium hover:underline">Admin</Link>
              )}
              <div className="w-9 h-9 bg-brand-secondary rounded-full flex items-center justify-center text-brand-accent font-bold">
                {customer.name?.charAt(0) || 'U'}
              </div>
              <button onClick={handleLogout} className="text-brand-muted hover:text-brand-primary text-sm">ออก</button>
            </div>
          ) : (
            <Link to="/login" className="text-brand-primary font-medium hover:underline">เข้าสู่ระบบ</Link>
          )}

          <Link to="/cart" className="relative p-2">
            <svg className="w-6 h-6 text-brand-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-brand-primary text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                {cartCount}
              </span>
            )}
          </Link>

          {/* Mobile Hamburger Button */}
          <button
            type="button"
            className="md:hidden p-2 rounded-lg text-brand-accent hover:bg-brand-bg transition-colors"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="เปิดเมนู"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu-drawer"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>
    </header>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="mobile-menu-title" id="mobile-menu-drawer">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 transition-opacity"
            onClick={closeMobileMenu}
            aria-hidden="true"
          />
          {/* Drawer Panel */}
          <div className="fixed top-0 right-0 bottom-0 w-full max-w-sm bg-brand-surface shadow-xl flex flex-col animate-slide-in-right">
            <div className="flex items-center justify-between px-4 py-3 border-b border-brand-border">
              <h2 id="mobile-menu-title" className="font-display font-bold text-brand-accent text-lg">เมนูหลัก</h2>
              <button
                type="button"
                className="p-2 rounded-lg text-brand-muted hover:bg-brand-bg transition-colors"
                onClick={closeMobileMenu}
                aria-label="ปิดเมนู"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <nav className="flex-1 py-4 px-4 overflow-y-auto">
              <ul className="space-y-2" role="list">
                {MOBILE_NAV_LINKS.map((link) => (
                  <li key={link.path}>
                    <Link
                      to={link.path}
                      onClick={closeMobileMenu}
                      className={`flex items-center px-3 py-3 rounded-xl font-medium transition-colors ${
                        location.pathname === link.path
                          ? 'bg-brand-primary text-white'
                          : 'text-brand-accent hover:bg-brand-bg'
                      }`}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>

              {/* User Actions in Mobile Menu */}
              <div className="mt-6 pt-4 border-t border-brand-border space-y-2">
                {customer ? (
                  <>
                    {shouldShowAdminLink(role, customer.email) && (
                      <Link
                        to="/admin"
                        onClick={closeMobileMenu}
                        className="flex items-center px-3 py-3 rounded-xl font-medium text-brand-primary hover:bg-brand-bg transition-colors"
                      >
                        🛠️ Admin Dashboard
                      </Link>
                    )}
                    <Link
                      to="/orders"
                      onClick={closeMobileMenu}
                      className="flex items-center px-3 py-3 rounded-xl font-medium text-brand-accent hover:bg-brand-bg transition-colors"
                    >
                      📦 ออเดอร์ของฉัน
                    </Link>
                    <Link
                      to="/profile"
                      onClick={closeMobileMenu}
                      className="flex items-center px-3 py-3 rounded-xl font-medium text-brand-accent hover:bg-brand-bg transition-colors"
                    >
                      👤 บัญชีผู้ใช้
                    </Link>
                    <button
                      onClick={() => { handleLogout(); closeMobileMenu(); }}
                      className="flex items-center w-full px-3 py-3 rounded-xl font-medium text-brand-danger hover:bg-brand-danger-light transition-colors text-left"
                    >
                      🚪 ออกจากระบบ
                    </button>
                  </>
                ) : (
                  <Link
                    to="/login"
                    onClick={closeMobileMenu}
                    className="flex items-center px-3 py-3 rounded-xl font-medium text-brand-primary hover:bg-brand-bg transition-colors"
                  >
                    🔑 เข้าสู่ระบบ / สมัครสมาชิก
                  </Link>
                )}
              </div>
            </nav>

            {/* Cart Shortcut in Mobile Menu */}
            <Link
              to="/cart"
              onClick={closeMobileMenu}
              className="mx-4 mb-4 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-brand-primary text-white font-bold hover:bg-brand-primary-dark transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span>ตะกร้าสินค้า</span>
              {cartCount > 0 && (
                <span className="bg-white/20 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                  {cartCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      )}
      </Fragment>
  )
}