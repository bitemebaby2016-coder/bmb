import { useState, useEffect } from 'react'
import { useNotificationStore } from '@/store/notificationStore'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { getMyNotifications } from '@/lib/notificationService'

const icons: Record<string, string> = {
  order_update: '📦',
  promotion: '🎟️',
  system: '⚙️',
  loyalty: '💰',
  referral: '👥',
}

export function NotificationDropdown() {
  const notifications = useNotificationStore((s) => s.notifications)
  const unreadCount = useNotificationStore((s) => s.unreadCount)
  const markAllAsRead = useNotificationStore((s) => s.markAllAsRead)
  const hydrateServerNotifications = useNotificationStore((s) => s.hydrateServerNotifications)
  const markServerAsRead = useNotificationStore((s) => s.markServerAsRead)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [open, setOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    // ✅ GAP CLOSURE: Request browser notification permission on mount
    useNotificationStore.getState().requestBrowserPermission()

    // W3-D: hydrate durable server notifications once (RLS own rows only).
    if (isAuthenticated && !hydrated) {
      setHydrated(true)
      getMyNotifications().then((rows) => hydrateServerNotifications(rows))
    }
  }, [isAuthenticated, hydrated, hydrateServerNotifications])

  if (unreadCount === 0 && !open) return null

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative w-10 h-10 rounded-full bg-brand-bg hover:bg-orange-100 transition-colors flex items-center justify-center"
      >
        <span className="text-xl">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center z-50">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-12 w-80 max-h-96 overflow-y-auto bg-white rounded-xl shadow-2xl border z-50">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between rounded-t-xl">
              <h3 className="font-bold text-brand-accent">การแจ้งเตือน ({unreadCount} อันอ่าน)</h3>
              <button onClick={markAllAsRead} className="text-xs text-brand-primary hover:underline">
                อ่านทั้งหมดแล้ว ✓
              </button>
            </div>

            {/* Notifications List */}
            <div className="divide-y">
              {notifications.slice(0, 10).map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    if (n.is_read) return
                    // Server-durable rows (evt-*/auto-*) persist "read" via RLS; local-only rows stay local.
                    if (n.id.startsWith('evt-') || n.id.startsWith('auto-')) markServerAsRead(n.id)
                    else useNotificationStore.getState().markAsRead(n.id)
                  }}
                  className={`w-full text-left p-3 transition-colors ${
                    n.is_read ? 'bg-white hover:bg-gray-50' : 'bg-orange-50 hover:bg-orange-100'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl">{icons[n.type] || '🔔'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-brand-accent line-clamp-1">{n.title}</p>
                      <p className="text-xs text-brand-muted line-clamp-2">{n.body || ''}</p>
                      <p className="text-xs text-brand-muted mt-1">{new Date(n.created_at).toLocaleString('th-TH')}</p>
                    </div>
                    {!n.is_read && <span className="w-2 h-2 rounded-full bg-brand-primary flex-shrink-0" />}
                  </div>
                </button>
              ))}
              
              {notifications.length === 0 && (
                <div className="p-6 text-center text-brand-muted">
                  <p className="text-4xl mb-2">🔔</p>
                  <p>ไม่มีการแจ้งเตือน</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <Link to="/profile" onClick={() => setOpen(false)} className="block p-3 text-center text-sm text-brand-primary border-t hover:bg-brand-bg">
              ดูโปรไฟล์ →
            </Link>
          </div>
        </>
      )}
    </div>
  )
}