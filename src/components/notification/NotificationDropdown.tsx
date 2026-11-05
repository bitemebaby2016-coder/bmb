import { useState, useEffect, useRef } from 'react'
import { useNotificationStore } from '@/store/notificationStore'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { getMyNotifications } from '@/lib/notificationService'
import { resolveNotificationRoute } from '@/lib/notificationLinks'
// R70: เสียงเตือนกลาง (เดิม define ในไฟล์นี้ — ย้ายไป lib/notifBeep เพื่อใช้ร่วมกับแชต)
import { playNotifBeep } from '@/lib/notifBeep'

const icons: Record<string, string> = {
  order_update: '📦',
  promotion: '🎟️',
  system: '⚙️',
  loyalty: '💰',
  referral: '👥',
  // R71: แถวข้อความแชต (m187 notification_type=ORDER_MESSAGE · title มี 💬 นำอยู่แล้ว)
  order_message: '💬',
  ORDER_MESSAGE: '💬',
}

const SOUND_KEY = 'bmb:notif-sound'

export function NotificationDropdown() {
  const notifications = useNotificationStore((s) => s.notifications)
  const unreadCount = useNotificationStore((s) => s.unreadCount)
  const markAllAsReadServer = useNotificationStore((s) => s.markAllAsReadServer)
  const hydrateServerNotifications = useNotificationStore((s) => s.hydrateServerNotifications)
  const markServerAsRead = useNotificationStore((s) => s.markServerAsRead)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const role = useAuthStore((s) => s.role)
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  // R10 (Owner 2026-10-27): เสียงแจ้งเตือน + ปุ่มเปิด/ปิด (จำค่าไว้ให้แอดมิน)
  const [soundOn, setSoundOn] = useState(() => {
    try { return localStorage.getItem(SOUND_KEY) !== 'off' } catch { return true }
  })
  const soundRef = useRef(soundOn)
  soundRef.current = soundOn
  const seenRef = useRef<Set<string> | null>(null)

  function toggleSound() {
    setSoundOn((v) => {
      const next = !v
      try { localStorage.setItem(SOUND_KEY, next ? 'on' : 'off') } catch { /* private mode */ }
      return next
    })
  }

  useEffect(() => {
    // R70 (Owner "ระบบ pwa และแจ้งเตือนให้เปิดแจ้งเตือน ไม่เห็นมาเคยมีใช้งานได้"):
    // เดิม mount นี้ไปเรียก requestPermission() เอง = native dialog
    // เด้งสุ่มหน้า → ถ้าผู้ใช้กด Block/เคยตอบไปแล้ว PushPermissionPrompt (ซึ่งโชว์เฉพาะ
    // permission 'default') จะไม่มีวันโผล่ และ "อนุญาต" โดยไม่มี subscription =
    // push ใช้งานไม่ได้จริง — ปล่อยให้ PushPermissionPrompt/ปุ่มตั้งค่าจัดการทั้งหมด
    // W3-D: hydrate durable server notifications once (RLS own rows only).
    if (isAuthenticated && !hydrated) {
      setHydrated(true)
      getMyNotifications().then((rows) => {
        seenRef.current = new Set(rows.map((r) => r.id))
        hydrateServerNotifications(rows)
      })
    }
  }, [isAuthenticated, hydrated, hydrateServerNotifications])

  // R10 (Owner "ออเดอร์เข้าไม่มีในแจ้งเตือน ต้องมีแจ้งเตือนและมีเสียง"): poll ฟีดจริงทุก 20 วิ
  // — ออเดอร์ใหม่/สถานะเปลี่ยน (จาก trigger 161) เข้ากระดิ่งทั้งฝั่งลูกค้าและแอดมิน
  // (แอดมินเห็นทุกแถวผ่าน RLS is_admin) + มีเสียงเมื่อมีรายการใหม่ (ปิดได้จากปุ่มในกล่องนี้)
  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false
    const tick = async () => {
      const rows = await getMyNotifications()
      if (cancelled) return
      const seen = seenRef.current ?? (seenRef.current = new Set())
      const fresh = rows.filter((r) => !r.is_read && !seen.has(r.id))
      rows.forEach((r) => seen.add(r.id))
      if (fresh.length > 0 && soundRef.current) {
        playNotifBeep()
        // R71 (Owner "กระดิ่งเตือนจริง"): เด้ง notification บนเดสก์ท็อปด้วยเมื่อหน้าไม่ได้โฟกัส
        // (granted เท่านั้น — ไม่เด้งขอสิทธิ์เอง)
        try {
          if (
            typeof document !== 'undefined' && document.hidden &&
            typeof window !== 'undefined' && 'Notification' in window &&
            Notification.permission === 'granted'
          ) {
            const last = fresh[fresh.length - 1]
            new Notification(last.title, { body: last.message, icon: '/favicon.svg', tag: 'bmb-bell' })
          }
        } catch { /* private mode / policy — เงียบไว้ */ }
      }
      hydrateServerNotifications(rows)
    }
    void tick()
    const t = setInterval(() => void tick(), 20_000)
    return () => { cancelled = true; clearInterval(t) }
  }, [isAuthenticated, hydrateServerNotifications])

  // Bell stays visible even at 0 unread (2026-10-24 acceptance): the badge may
  // clear, but notification HISTORY must remain reachable from the header.
  // Header mounts this only for a signed-in customer.
  async function handleMarkAllRead() {
    // Server-authoritative: the badge clears (and the popup auto-dismisses)
    // only after the rows actually persisted as read on the server.
    const ok = await markAllAsReadServer()
    if (ok) setOpen(false)
  }

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
            <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between gap-2 rounded-t-xl">
              <h3 className="font-bold text-brand-accent">การแจ้งเตือน ({unreadCount} อันอ่าน)</h3>
              <div className="flex items-center gap-2">
                {/* R10 (Owner 2026-10-27): ปุ่มเปิด/ปิดเสียงแจ้งเตือน (จำค่าให้แอดมิน) */}
                <button
                  onClick={toggleSound}
                  title={soundOn ? 'ปิดเสียงแจ้งเตือน' : 'เปิดเสียงแจ้งเตือน'}
                  aria-pressed={soundOn}
                  data-testid="notif-sound-toggle"
                  className={`text-xs px-2 py-1 rounded-full border transition-colors ${soundOn ? 'border-brand-primary text-brand-primary bg-brand-primary/10' : 'border-gray-300 text-brand-muted'}`}
                >
                  {soundOn ? '🔊 เสียง' : '🔇 เงียบ'}
                </button>
                <button onClick={() => void handleMarkAllRead()} className="text-xs text-brand-primary hover:underline">
                  อ่านทั้งหมดแล้ว ✓
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="divide-y">
              {notifications.slice(0, 10).map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    // R11 (Owner 2026-10-27): กดอ่าน = เด้งไปหน้าทำงานที่เกี่ยวข้องอัตโนมัติ
                    const target = resolveNotificationRoute(
                      { type: n.type, title: n.title, body: n.body, data: n.data },
                      role,
                    )
                    setOpen(false)
                    if (target) navigate(target)
                    if (n.is_read) return
                    // R71 (Owner "กระดิ่งเตือนจริง"): เดิม persist "อ่านแล้ว" เฉพาะ evt-*/auto-* =
                    // แถว msgn-*/notif-* (ข้อความ/ออเดอร์) ถูกมาร์กเฉพาะในเครื่อง → ป้ายแดงกลับมาทุก reload —
                    // markServerAsRead ปลอดภัยกับทุกแถว (แถว local-only = server update 0 แถว + มาร์กในเครื่องตามเดิม)
                    void markServerAsRead(n.id)
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

            {/* Footer — history lives in the Notification Center (/notifications) */}
            <Link to="/notifications" onClick={() => setOpen(false)} className="block p-3 text-center text-sm text-brand-primary border-t hover:bg-brand-bg">
              ดูการแจ้งเตือนทั้งหมด →
            </Link>
          </div>
        </>
      )}
    </div>
  )
}