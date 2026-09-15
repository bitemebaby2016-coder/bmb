import { Link } from 'react-router-dom'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import { NotificationDropdown } from '@/components/notification/NotificationDropdown'

export function Header() {
  const cartCount = useCartStore((s) => s.getCartCount())
  const customer = useAuthStore((s) => s.customer)
  const logout = useAuthStore((s) => s.logout)

  function handleLogout() {
    logout()
    window.location.href = '/'
  }

  return (
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
              {customer.email === 'admin@bmb.co.th' && (
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
        </div>
      </div>
    </header>
  )
}