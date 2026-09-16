import { create } from 'zustand'
import type { Notification, NotificationEventType } from '@/types'

interface SimpleNotification {
  title: string
  body: string
  type: string
}

const NOTIFICATION_TEMPLATES = {
  order_placed: { title: 'Order Placed', bodyFn: (d) => `Order ${d.orderNumber} created!` },
  order_confirmed: { title: 'Order Confirmed', bodyFn: (d) => `Order ${d.orderNumber} confirmed.` },
  order_preparing: { title: 'Preparing Food', bodyFn: (d) => `Order ${d.orderNumber} being prepared.` },
  order_ready_for_dispatch: { title: 'Ready to Ship', bodyFn: (d) => `Order ${d.orderNumber} ready.` },
  order_dispatched: { title: 'Out for Delivery', bodyFn: (d) => `Order ${d.orderNumber} on its way!` },
  order_delivered: { title: 'Delivered!', bodyFn: (d) => `Order ${d.orderNumber} delivered. Thank you!` },
  payment_confirmed: { title: 'Payment Confirmed', bodyFn: (d) => `Payment for ${d.orderNumber} confirmed.` },
  payment_pending: { title: 'Payment Pending', bodyFn: (d) => `Order ${d.orderNumber} awaiting payment.` },
  low_stock_alert: { title: 'Low Stock Alert', bodyFn: (d) => `${d.itemName} running low.` },
  promotion_expired: { title: 'Promotion Expired', bodyFn: (d) => `Promo "${d.promotionName}" expired.` },
  referral_awarded: { title: 'Referral Bonus', bodyFn: (d) => `You earned ${d.points} points!` },
  loyalty_points_earned: { title: 'Loyalty Points', bodyFn: (d) => `Earned ${d.points} points from #${d.orderNumber}` },
  system_announcement: { title: 'System Announcement', bodyFn: (d) => d.message || 'Announcement' },
}

interface NotificationStore {
  notifications: Notification[]
  unreadCount: number
  addNotification: (notification: SimpleNotification) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
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
