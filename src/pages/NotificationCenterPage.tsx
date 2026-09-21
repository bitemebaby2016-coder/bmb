// ============================================
// Bite Me Baby — Notification Center (NOT-01)
// Groups notifications by channel with per-channel on/off toggles.
// ============================================

import { useEffect, useMemo, useState } from 'react'
import { GlassCard } from '@/components/ui/GlassCard'
import {
  getMyNotifications,
  setNotificationPref,
  NOTIFICATION_CHANNELS,
  DEFAULT_CHANNEL_STATE,
  type NotificationRow,
  type NotificationChannel,
} from '@/lib/notificationService'

const CHANNEL_ICON: Record<NotificationChannel, string> = {
  Transactional: '🧾',
  Marketing: '📣',
  Bite: '🤖',
  Operational: '⚙️',
}

export function NotificationCenterPage() {
  const [rows, setRows] = useState<NotificationRow[]>([])
  const [prefs, setPrefs] = useState<Record<NotificationChannel, boolean>>(DEFAULT_CHANNEL_STATE)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    void (async () => {
      const list = await getMyNotifications()
      if (!active) return
      setRows(list)
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [])

  const grouped = useMemo(() => {
    const map = new Map<NotificationChannel, NotificationRow[]>()
    for (const c of NOTIFICATION_CHANNELS) map.set(c, [])
    for (const r of rows) map.get(r.category)?.push(r)
    return map
  }, [rows])

  async function toggle(channel: NotificationChannel, enabled: boolean) {
    const next = await setNotificationPref(channel, enabled)
    if (next) setPrefs((prev) => ({ ...prev, ...next }))
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <h1 className="text-2xl font-bold text-brand-accent">🔔 Notification Center</h1>
      <p className="text-sm text-slate-500">แยกช่อง Transactional / Marketing / Bite / Operational — ปิดได้ต่อช่อง</p>

      <div className="grid grid-cols-2 gap-3">
        {NOTIFICATION_CHANNELS.map((c) => (
          <label key={c} className="flex items-center justify-between bg-white rounded-xl p-3 shadow-sm border border-slate-100">
            <span className="text-sm font-semibold text-slate-700">{CHANNEL_ICON[c]} {c}</span>
            <input
              type="checkbox"
              checked={prefs[c] ?? true}
              onChange={(e) => void toggle(c, e.target.checked)}
              data-testid={`notif-toggle-${c}`}
            />
          </label>
        ))}
      </div>

      {loading && <p className="text-sm text-slate-400">กำลังโหลด…</p>}

      {NOTIFICATION_CHANNELS.map((c) => (
        <section key={c} data-testid={`notif-section-${c}`}>
          <h2 className="font-bold text-slate-700 mb-2 mt-4">{CHANNEL_ICON[c]} {c}</h2>
          {grouped.get(c)!.length === 0 ? (
            <p className="text-xs text-slate-400 ml-1">ไม่มีข้อความในช่องนี้</p>
          ) : (
            <div className="space-y-2">
              {grouped.get(c)!.map((n) => (
                <GlassCard key={n.id} className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">{n.title}</p>
                      <p className="text-xs text-slate-500">{n.message}</p>
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0">{new Date(n.created_at).toLocaleString('th-TH')}</span>
                  </div>
                </GlassCard>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  )
}