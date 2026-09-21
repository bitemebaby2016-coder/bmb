// ============================================
// Bite Me Baby — Notification service (NOT-01, migration 021)
// Channels: Transactional / Marketing / Bite / Operational — each toggleable.
// ============================================

import { supabase } from './supabase'

export const NOTIFICATION_CHANNELS = ['Transactional', 'Marketing', 'Bite', 'Operational'] as const
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number]

export interface NotificationRow {
  id: string
  title: string
  message: string
  category: NotificationChannel
  is_read: boolean
  created_at: string
}

export interface NotificationPrefs {
  channels: Record<NotificationChannel, boolean>
}

export const DEFAULT_CHANNEL_STATE: Record<NotificationChannel, boolean> = {
  Transactional: true,
  Marketing: true,
  Bite: true,
  Operational: true,
}

/** Publish a notification (server resolves the actor's customer row + channel pref). */
export async function createNotification(params: {
  title: string
  message: string
  category: NotificationChannel
  customerId?: string
}): Promise<{ id: string | null; suppressed: boolean } | null> {
  const { data, error } = await supabase.rpc('create_notification', {
    p_title: params.title,
    p_message: params.message,
    p_category: params.category,
    p_customer_id: params.customerId ?? null,
  })
  if (error) {
    console.warn('[Notification] create failed:', error.message)
    return null
  }
  return data as unknown as { id: string | null; suppressed: boolean }
}

/** Toggle a channel on/off. */
export async function setNotificationPref(channel: NotificationChannel, enabled: boolean): Promise<Record<NotificationChannel, boolean> | null> {
  const { data, error } = await supabase.rpc('set_notification_pref', { p_channel: channel, p_enabled: enabled })
  if (error) return null
  return (data as unknown as { channels: Record<NotificationChannel, boolean> }).channels ?? null
}

/** Read own notifications (RLS own/admin), grouped by channel. */
export async function getMyNotifications(): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id,title,message,category,is_read,created_at')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) return []
  return (data ?? []) as NotificationRow[]
}