import { create } from 'zustand'
import type { Notification, NotificationEventType } from '@/types'

// ============================================
// Order-state sequence (handoff 2026-10-24 §6 fix 3)
// Production probe of order 841 (read-only, 2026-10-24): the server rows are
// timestamped OUT of order — preparing (11:29:07) is NEWER than delivered
// (11:29:05) — so raw created_at sorting shows the stale "preparing" row as
// latest. notification_type is canonical → rank by state, cluster rows of the
// same order together, keep created_at only as the tiebreaker / group recency.
// ============================================

const ORDER_STATE_RANK: Record<string, number> = {
  order_created: 10,
  order_placed: 10,
  payment_pending: 15,
  order_confirmed: 20,
  payment_confirmed: 25,
  order_preparing: 30,
  order_ready: 40,
  order_ready_for_dispatch: 40,
  order_out_for_delivery: 50,
  order_dispatched: 50,
  order_delivered: 60,
}

/** Fallback rank by text when notification_type is missing (Thai titles verified on 841). */
const ORDER_STATE_KEYWORDS: Array<[RegExp, number]> = [
  [/(จัดส่งสำเร็จ|\bdelivered\b)/i, 60],
  [/(ออกจัดส่ง|ออกส่งแล้ว|out for delivery|dispatched)/i, 50],
  [/(อาหารพร้อมแล้ว|พร้อมส่ง|\bready\b)/i, 40],
  [/(กำลังเตรียม|preparing)/i, 30],
  [/(ได้รับการยืนยัน|ยืนยันแล้ว|confirmed)/i, 20],
  [/(รับออเดอร์แล้ว|ได้รับเรียบร้อย|order placed|order created)/i, 10],
]

/** Rank of a single notification on the order-state ladder (0 = unknown/local). */
export function orderStateRank(n: { type?: string; title?: string; body?: string; data?: Record<string, unknown> }): number {
  const byType = ORDER_STATE_RANK[String(n.type || '').toLowerCase()]
  if (byType !== undefined) return byType
  const text = `${n.title || ''} ${n.body || ''}`
  for (const [re, rank] of ORDER_STATE_KEYWORDS) if (re.test(text)) return rank
  return 0
}

/** Order number for clustering (deterministic ids: evt-ord-BMB-YYYYMMDD-N-<state>). */
export function orderKeyOf(n: { id?: string; title?: string; body?: string; data?: Record<string, unknown> }): string {
  const fromData = n.data && typeof n.data.orderNumber === 'string' ? n.data.orderNumber : ''
  const m = `${n.id || ''} ${n.title || ''} ${n.body || ''} ${fromData}`.match(/BMB-\d{6,}-\d+/i)
  return m ? m[0].toUpperCase() : ''
}

/**
 * Bell ordering: rows of the SAME order are clustered and sorted by state rank
 * (delivered always above preparing regardless of clock), groups themselves are
 * newest-first by their latest created_at; singletons keep pure recency.
 */
export function sortNotificationsForBell(list: Notification[]): Notification[] {
  const groups = new Map<string, Notification[]>()
  for (const n of list) {
    const key = orderKeyOf(n as Notification) || `~single:${n.id}`
    const g = groups.get(key)
    if (g) g.push(n)
    else groups.set(key, [n])
  }
  const arranged = [...groups.values()].map((g) => ({
    g: [...g].sort(
      (a, b) =>
        orderStateRank(b as Notification) - orderStateRank(a as Notification) ||
        String(b.created_at || '').localeCompare(String(a.created_at || '')),
    ),
    t: g.reduce((mx, n) => (String(n.created_at || '') > mx ? String(n.created_at || '') : mx), ''),
  }))
  arranged.sort((a, b) => b.t.localeCompare(a.t))
  return arranged.flatMap((x) => x.g)
}

interface SimpleNotification {
  title: string
  body: string
  type: string
}

const NOTIFICATION_TEMPLATES = {
  order_placed: { title: 'Order Placed', bodyFn: (d: Record<string, any>) => `Order ${d.orderNumber} created!` },
  order_confirmed: { title: 'Order Confirmed', bodyFn: (d: Record<string, any>) => `Order ${d.orderNumber} confirmed.` },
  order_preparing: { title: 'Preparing Food', bodyFn: (d: Record<string, any>) => `Order ${d.orderNumber} being prepared.` },
  order_ready_for_dispatch: { title: 'Ready to Ship', bodyFn: (d: Record<string, any>) => `Order ${d.orderNumber} ready.` },
  order_dispatched: { title: 'Out for Delivery', bodyFn: (d: Record<string, any>) => `Order ${d.orderNumber} on its way!` },
  order_delivered: { title: 'Delivered!', bodyFn: (d: Record<string, any>) => `Order ${d.orderNumber} delivered. Thank you!` },
  payment_confirmed: { title: 'Payment Confirmed', bodyFn: (d: Record<string, any>) => `Payment for ${d.orderNumber} confirmed.` },
  payment_pending: { title: 'Payment Pending', bodyFn: (d: Record<string, any>) => `Order ${d.orderNumber} awaiting payment.` },
  low_stock_alert: { title: 'Low Stock Alert', bodyFn: (d: Record<string, any>) => `${d.itemName} running low.` },
  promotion_expired: { title: 'Promotion Expired', bodyFn: (d: Record<string, any>) => `Promo "${d.promotionName}" expired.` },
  referral_awarded: { title: 'Referral Bonus', bodyFn: (d: Record<string, any>) => `You earned ${d.points} points!` },
  loyalty_points_earned: { title: 'Loyalty Points', bodyFn: (d: Record<string, any>) => `Earned ${d.points} points from #${d.orderNumber}` },
  system_announcement: { title: 'System Announcement', bodyFn: (d: Record<string, any>) => d.message || 'Announcement' },
}

interface NotificationStore {
  notifications: Notification[]
  unreadCount: number
  hydrateServerNotifications: (rows: Array<{ id: string; title: string; message: string; is_read: boolean; created_at: string; notification_type?: string | null }>) => void
  markServerAsRead: (id: string) => Promise<void>
  addNotification: (notification: SimpleNotification) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  markAllAsReadServer: () => Promise<boolean>
  removeNotification: (id: string) => void
  getUnreadCount: () => number
  triggerEvent: (eventType: NotificationEventType, eventData?: Record<string, any>) => void
  sendToUser: (userId: string, eventType: NotificationEventType, eventData?: Record<string, any>) => void
  requestBrowserPermission: () => Promise<boolean>
  sendBrowserNotification: (title: string, body: string, options?: NotificationOptions) => boolean
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  /**
   * W3-D — hydrate server-side (durable) notifications into the local cache.
   * Server rows are canonical; deterministic server ids (`evt-*`/`auto-*`)
   * keep the merge idempotent — re-hydration never duplicates entries.
   */
  hydrateServerNotifications: (rows) => {
    if (!rows || rows.length === 0) return
    set((state) => {
      const serverIds = new Set(rows.map((r) => r.id))
      const mapped = rows.map((r) => ({
        id: r.id,
        user_id: '',
        title: r.title,
        body: r.message,
        type: (r.notification_type || 'order_update') as unknown as Notification['type'],
        data: {},
        channel: 'in_app' as const,
        is_read: r.is_read,
        sent_at: r.created_at,
        created_at: r.created_at,
        read_at: r.is_read ? r.created_at : undefined,
      })) as unknown as Notification[]
      // Server rows are canonical (2026-10-24 reconciliation): an existing
      // local copy is REPLACED, not skipped — otherwise a stale local
      // is_read=false survives re-hydration and the badge never clears
      // across reload/sessions (defect on order 841).
      const localOnly = state.notifications.filter((n) => !serverIds.has(n.id))
      // Order-state ordering (defect on 841): prepared/delivered timestamps are
      // inverted on the server, so rank by state per order cluster — a stale
      // local "preparing" can never sit above the server's "delivered".
      const merged = sortNotificationsForBell([...mapped, ...localOnly]).slice(0, 50)
      const unread = merged.filter((n) => !n.is_read).length
      return { notifications: merged, unreadCount: unread }
    })
  },
  /** Persist "read" server-side first; local cache follows the server result. */
  markServerAsRead: async (id) => {
    const { markNotificationRead } = await import('@/lib/notificationService')
    const ok = await markNotificationRead(id)
    if (ok) get().markAsRead(id)
  },
  addNotification: (notification) => {
    const now = new Date().toISOString()
    const newNotification: Notification = {
      ...notification,
      id: `notif-${Date.now()}`,
      created_at: now,
      is_read: false,
      user_id: '',
      data: {},
      channel: 'in_app',
      sent_at: now,
      read_at: undefined,
    } as unknown as Notification
    set((state) => ({
      notifications: [newNotification, ...state.notifications].slice(0, 50),
      unreadCount: state.unreadCount + 1
    }))
  },
  markAsRead: (id) => {
    set((state) => ({
      notifications: state.notifications.map(n => n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n),
      unreadCount: Math.max(0, state.unreadCount - 1)
    }))
  },
  markAllAsRead: () => {
    set((state) => ({
      notifications: state.notifications.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() })),
      unreadCount: 0
    }))
  },
  /**
   * Persist "read" for ALL own unread rows server-side first (RLS own rows);
   * the local badge follows ONLY the server result — a failed write must not
   * fake a cleared badge (defect on order 841: markAllAsRead never reached
   * the server, so the red badge returned after every reload).
   */
  markAllAsReadServer: async () => {
    const { markAllNotificationsRead } = await import('@/lib/notificationService')
    const ok = await markAllNotificationsRead()
    if (ok) get().markAllAsRead()
    return ok
  },
  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter(n => n.id !== id),
      unreadCount: state.notifications.find(n => n.id === id && !n.is_read) ? state.unreadCount - 1 : state.unreadCount
    }))
  },
  getUnreadCount: () => get().notifications.filter(n => !n.is_read).length,
  triggerEvent: (eventType, eventData = {}) => {
    const template = NOTIFICATION_TEMPLATES[eventType]
    if (!template) return
    const now = new Date().toISOString()
    const notification: Notification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      user_id: eventData.userId || '',
      title: template.title,
      body: template.bodyFn(eventData),
      type: 'order_status' as any,
      data: eventData,
      channel: 'in_app',
      is_read: false,
      sent_at: now,
      created_at: now,
      read_at: undefined,
    } as unknown as Notification
    set((state) => ({
      notifications: [notification, ...state.notifications].slice(0, 50),
      unreadCount: state.unreadCount + 1
    }))
    const { sendBrowserNotification } = get()
    sendBrowserNotification(notification.title, notification.body)
  },
  sendToUser: (userId, eventType, eventData = {}) => {
    get().triggerEvent(eventType, { ...eventData, userId })
  },
  requestBrowserPermission: async (): Promise<boolean> => {
    if (!('Notification' in window)) return false
    try {
      const permission = await Notification.requestPermission()
      return permission === 'granted'
    } catch { return false }
  },
  sendBrowserNotification: (title, body, options) => {
    if (!('Notification' in window)) return false
    if (Notification.permission === 'granted') {
      try {
        new Notification(title, { body, icon: '/favicon.svg', badge: '/favicon.svg', tag: `bmb-${Date.now()}`, ...options })
        return true
      } catch { return false }
    }
    return false
  },
}))
