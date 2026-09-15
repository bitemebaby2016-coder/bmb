import { Link, useLocation } from 'react-router-dom'

const navItems = [
  { path: '/', label: 'หน้าแรก', icon: '🏠' },
  { path: '/menu', label: 'เมนู', icon: '🍽️' },
  { path: '/cart', label: 'ตะกร้า', icon: '🛒' },
  { path: '/ai-chat', label: 'ไบต์', icon: '/icon_chat.webp' },
  { path: '/profile', label: 'โปรไฟล์', icon: '👤' },
]

export function BottomNav() {
  const location = useLocation()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-brand-surface border-t border-brand-border z-50 no-print">
      <div className="max-w-7xl mx-auto px-4 py-2 flex justify-around">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || 
            (item.path === '/cart' && location.pathname.startsWith('/cart')) ||
            (item.path === '/ai-chat' && location.pathname.startsWith('/ai-chat'))
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