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
import {
  enablePush,
  disablePush,
  getPushStatus,
  requestPushPermission,
  reregisterPushedSubscription,
  type PushSubscriptionLike,
} from '@/lib/pushService'
import { MascotBadge } from '@/components/MascotBadge'

const CHANNEL_ICON: Record<NotificationChannel, string> = {
  Transactional: '🧾',
  Marketing: '📣',
  Bite: '🤖',
  Operational: '⚙️',
}

/** ช่อง Bite ใช้มาสคอตน้อง Bite แทนอีโมจิหุ่นยนต์ */
function ChannelIcon({ channel }: { channel: NotificationChannel }) {
  if (channel === 'Bite') {
    return <MascotBadge pose="recommend" size="sm" alt="น้อง Bite" className="inline-block align-middle" />
  }
  return <span aria-hidden="true">{CHANNEL_ICON[channel]}</span>
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

  // --- Web Push transport (separate from the category toggles above) ---
  const [pushBusy, setPushBusy] = useState(false)
  const [pushSubscribed, setPushSubscribed] = useState(false)
  const [pushSupported, setPushSupported] = useState(true)
  const [pushServerEnabled, setPushServerEnabled] = useState(false)
  const [pushPermission, setPushPermission] = useState<string>('default')
  const [pushMessage, setPushMessage] = useState('')

  useEffect(() => {
    let active = true
    void (async () => {
      const st = await getPushStatus()
      if (!active) return
      setPushSupported(st.supported)
      setPushSubscribed(st.subscribed)
      setPushServerEnabled(st.serverEnabled)
      setPushPermission(st.permission)
    })()
    // The SW hands back a rotated subscription here; re-register it (it cannot
    // authenticate on its own — the page session does).
    const onMessage = (event: MessageEvent) => {
      const d = event.data as { type?: string; subscription?: PushSubscriptionLike | null } | null
      if (d?.type === 'bmb:pushsubscriptionchange') {
        void reregisterPushedSubscription(d.subscription ?? null)
      }
    }
    navigator.serviceWorker?.addEventListener('message', onMessage)
    return () => {
      active = false
      navigator.serviceWorker?.removeEventListener('message', onMessage)
    }
  }, [])

  async function togglePush(enabled: boolean) {
    setPushBusy(true)
    setPushMessage('')
    try {
      if (enabled) {
        const r = await enablePush()
        if (!r.ok) {
          setPushMessage(
            r.error === 'ERR_PUSH_DISABLED' || r.error === 'ERR_NO_VAPID_KEY'
              ? 'ยังไม่ได้เปิดใช้ Push โดยผู้ดูแลระบบ'
              : r.error === 'ERR_PERMISSION_DENIED'
                ? 'เบราว์เซอร์ไม่อนุญาตการแจ้งเตือน'
                : 'เปิด Push ไม่สำเร็จ',
          )
          return
        }
        setPushSubscribed(true)
      } else {
        const r = await disablePush()
        if (!r.ok) {
          setPushMessage('ปิด Push ไม่สำเร็จ')
          return
        }
        setPushSubscribed(false)
      }
    } finally {
      setPushBusy(false)
    }
  }

  async function askPermissionOnly() {
    setPushBusy(true)
    try {
      const p = await requestPushPermission()
      setPushPermission(p)
      if (p === 'granted') setPushMessage('อนุญาตแล้ว — กดสวิตช์เพื่อเปิดใช้งาน')
    } finally {
      setPushBusy(false)
    }
  }

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
            <span className="text-sm font-semibold text-slate-700"><ChannelIcon channel={c} /> {c}</span>
            <input
              type="checkbox"
              checked={prefs[c] ?? true}
              onChange={(e) => void toggle(c, e.target.checked)}
              data-testid={`notif-toggle-${c}`}
            />
          </label>
        ))}
      </div>

      {/* Web Push transport — how the notification REACHES the device. */}
      <section className="bg-white rounded-xl p-3 shadow-sm border border-slate-100" data-testid="push-transport">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">📲 แจ้งเตือนผ่าน Web Push</span>
          <input
            type="checkbox"
            disabled={pushBusy || !pushSupported || !pushServerEnabled}
            checked={pushSubscribed}
            onChange={(e) => void togglePush(e.target.checked)}
            data-testid="push-toggle"
          />
        </div>
        <p className="text-xs text-slate-400 mt-1">
          {!pushSupported
            ? 'เบราว์เซอร์นี้ไม่รองรับ Push'
            : !pushServerEnabled
              ? 'ยังไม่ได้เปิดใช้งาน Push โดยผู้ดูแลระบบ'
              : pushPermission === 'denied'
                ? 'เบราว์เซอร์บล็อกการแจ้งเตือน — ต้องไปตั้งค่าในเบราว์เซอร์'
                : pushSubscribed
                  ? 'เปิดอยู่บนเครื่องนี้'
                  : 'ปิดอยู่'}
        </p>
        {pushPermission === 'default' && pushSupported && pushServerEnabled && (
          <button
            onClick={() => void askPermissionOnly()}
            disabled={pushBusy}
            className="mt-2 text-xs px-3 py-1 rounded-lg border border-brand-border disabled:opacity-40"
            data-testid="push-ask-permission"
          >
            อนุญาตการแจ้งเตือน
          </button>
        )}
        {pushMessage && <p className="text-xs text-amber-600 mt-1">{pushMessage}</p>}
      </section>

      {loading && <p className="text-sm text-slate-400">กำลังโหลด…</p>}

      {NOTIFICATION_CHANNELS.map((c) => (
        <section key={c} data-testid={`notif-section-${c}`}>
          <h2 className="font-bold text-slate-700 mb-2 mt-4"><ChannelIcon channel={c} /> {c}</h2>
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