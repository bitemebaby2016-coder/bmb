import { create } from 'zustand'
import type { Notification } from '@/types'

interface SimpleNotification {
  title: string
  body: string
  type: string
}

interface NotificationStore {
  notifications: Notification[]
  unreadCount: number

  addNotification: (notification: SimpleNotification) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  removeNotification: (id: string) => void
  getUnreadCount: () => number
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
      notifications: state.notifications.map(n =>
        n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
      ),
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
      unreadCount: state.notifications.find(n => n.id === id && !n.is_read) 
        ? state.unreadCount - 1 
        : state.unreadCount
    }))
  },

  getUnreadCount: () => get().notifications.filter(n => !n.is_read).length,
}))