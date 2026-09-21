import { Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { shouldShowAdminLink } from '@/lib/adminUi'

const navItems = [
  { path: '/', label: 'หน้าแรก', icon: '🏠' },
  { path: '/menu', label: 'เมนู', icon: '🍽️' },
  { path: '/ai-chat', label: 'ไบต์', icon: '/icon_chat.webp' },
  { path: '/orders', label: 'ออเดอร์', icon: '📦' },
  { path: '/profile', label: 'บัญชี', icon: '👤' },
]

export function BottomNav() {
  const location = useLocation()
const role = useAuthStore((s) => s.role)
  const customer = useAuthStore((s) => s.customer)

  // PHASE 6 UI/admin: admins get a Dashboard entry instead of the customer
  // account tab, so they can always jump back to /admin without browser Back.
  const items = shouldShowAdminLink(role, customer?.email)
    ? navItems.map((item) => item.path === '/profile' ? { path: '/admin', label: 'Dashboard', icon: '🛠️' } : item)
    : navItems

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-brand-surface border-t border-brand-border z-50 no-print">
      <div className="max-w-7xl mx-auto px-4 py-2 flex justify-around">
        {items.map((item) => {
          const isActive = location.pathname === item.path ||
            (item.path === '/ai-chat' && location.pathname.startsWith('/ai-chat')) ||
            (item.path === '/orders' && location.pathname.startsWith('/orders')) ||
            (item.path === '/admin' && location.pathname.startsWith('/admin'))
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-1 py-2 px-4 rounded-lg transition-all ${
                isActive ? 'text-brand-primary bg-brand-bg' : 'text-brand-muted hover:text-brand-primary'
              }`}
            >
              {item.icon.startsWith('/') ? (
                <img src={item.icon} alt={item.label} className="w-6 h-6 object-contain" />
              ) : (
                <span className="text-xl">{item.icon}</span>
              )}
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}