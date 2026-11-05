// ============================================
// Bite Me Baby — R71: RiderBell (กระดิ่งแจ้งเตือนฝั่งไรเดอร์ · /rider ไม่มี Header/bell เดิม)
// ============================================
// Owner (2026-11-05): "ฝั่งไดร์เวอร์ไม่มีแจ้งเตือน … กระดิ่งเตือนจริง"
//   - แถว notifications ของไรเดอร์ = user_id = ตัวเอง (m187 '-r' · RLS own)
//   - poll ทุก 20 วิ (แบบ NotificationDropdown) — มีเสียง + ป้ายแดง + browser
//     notification เมื่อหน้าไม่ได้โฟกัส + อ่านทั้งหมดแล้ว (server-authoritative)
// ============================================
import { useEffect, useRef, useState } from 'react'
import { getMyNotifications, markAllNotificationsRead, type NotificationRow } from '@/lib/notificationService'
import { playNotifBeep } from '@/lib/notifBeep'

export function RiderBell() {
  const [rows, setRows] = useState<NotificationRow[]>([])
  const [open, setOpen] = useState(false)
  const seenRef = useRef<Set<string> | null>(null)

  useEffect(() => {
    let cancelled = false
    const tick = async () => {
      const list = await getMyNotifications()
      if (cancelled) return
      const seen = seenRef.current ?? (seenRef.current = new Set())
      const fresh = list.filter((r) => !r.is_read && !seen.has(r.id))
      list.forEach((r) => seen.add(r.id))
      if (fresh.length > 0) {
        playNotifBeep()
        // แจ้งเตือนบนเดสก์ท็อปเมื่อหน้าไม่ได้โฟกัส (granted เท่านั้น — ไม่เด้งขอสิทธิ์เอง)
        try {
          if (
            typeof document !== 'undefined' && document.hidden &&
            typeof window !== 'undefined' && 'Notification' in window &&
            Notification.permission === 'granted'
          ) {
            const last = fresh[fresh.length - 1]
            new Notification(last.title, { body: last.message, icon: '/favicon.svg', tag: 'bmb-rider-bell' })
          }
        } catch { /* private mode / policy — เงียบไว้ */ }
      }
      setRows(list)
    }
    void tick()
    const t = window.setInterval(() => void tick(), 20_000)
    return () => { cancelled = true; window.clearInterval(t) }
  }, [])

  const unread = rows.filter((r) => !r.is_read).length

  async function handleMarkAll() {
    const ok = await markAllNotificationsRead()
    if (ok) {
      setRows((rs) => rs.map((r) => ({ ...r, is_read: true })))
      setOpen(false)
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn btn-outline text-xs relative"
        data-testid="rider-bell"
        aria-label={`การแจ้งเตือน${unread > 0 ? ` ${unread} รายการใหม่` : ''}`}
      >
        🔔 แจ้งเตือน
        {unread > 0 && (
          <span
            className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center"
            data-testid="rider-bell-badge"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-50 w-72 max-h-80 overflow-y-auto bg-white rounded-xl shadow-2xl border" data-testid="rider-bell-list">
            <div className="sticky top-0 bg-white border-b p-2.5 flex items-center justify-between gap-2 rounded-t-xl">
              <span className="text-xs font-bold text-brand-accent">การแจ้งเตือน ({unread} ใหม่)</span>
              <button type="button" onClick={() => void handleMarkAll()} className="text-xs text-brand-primary hover:underline" data-testid="rider-bell-markall">
                อ่านทั้งหมดแล้ว ✓
              </button>
            </div>
            {rows.length === 0 && (
              <p className="p-4 text-center text-xs text-brand-muted">ยังไม่มีการแจ้งเตือน</p>
            )}
            {rows.slice(0, 15).map((r) => (
              <div
                key={r.id}
                className={`p-2.5 border-b text-left ${r.is_read ? 'bg-white' : 'bg-orange-50'}`}
                data-testid="rider-bell-item"
              >
                <p className="text-xs font-semibold text-brand-accent line-clamp-1">{r.title}</p>
                <p className="text-[11px] text-brand-muted line-clamp-2">{r.message}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{new Date(r.created_at).toLocaleString('th-TH')}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
