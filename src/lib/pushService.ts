// ============================================
// Bite Me Baby — Web Push client service (W3-D-7)
//
// Transport (Web Push) is deliberately separate from the notification CATEGORY
// contract in notificationService.ts (Transactional/Marketing/Bite/Operational).
// This module owns ONLY the push transport: permission, subscription, and the
// server-side registration of that subscription.
//
// Security / authority:
//   - The VAPID public key comes from business_settings.push_config (admin-managed,
//     never hardcoded). The private key never reaches the browser or the database.
//   - The client never sends a customer id: register_push_subscription resolves
//     auth.uid() -> customers.id server-side (migration 115).
//   - Everything degrades to a typed "unsupported" state instead of throwing, so
//     a browser without push support never breaks the Notification Center.
// ============================================

import { supabase } from './supabase'

export type PushPermissionState = 'granted' | 'denied' | 'default' | 'unsupported'

export interface PushConfig {
  enabled: boolean
  vapid_public_key: string
  vapid_subject: string
}

export interface PushSubscriptionSummary {
  id: string
  created_at: string
  last_success_at: string | null
  user_agent: string | null
}

export type PushResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; reason?: string }

/** Minimal structural type — avoids depending on lib.dom's PushSubscription shape in tests. */
export interface PushSubscriptionLike {
  endpoint: string
  keys?: { p256dh?: string; auth?: string }
  toJSON?: () => { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
  unsubscribe?: () => Promise<boolean>
}

function isPushCapable(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/** Current permission state, or 'unsupported' when the browser has no push API. */
export function getPushPermissionState(): PushPermissionState {
  if (!isPushCapable()) return 'unsupported'
  return Notification.permission as PushPermissionState
}

/** Read the admin-configured push settings (public fields only). */
export async function getPushConfig(): Promise<PushConfig> {
  const { data, error } = await supabase.rpc('get_push_config')
  if (error || !data) return { enabled: false, vapid_public_key: '', vapid_subject: '' }
  const c = data as Partial<PushConfig>
  return {
    enabled: c.enabled === true,
    vapid_public_key: c.vapid_public_key ?? '',
    vapid_subject: c.vapid_subject ?? '',
  }
}

/**
 * base64url (VAPID) -> Uint8Array, as PushManager.subscribe requires.
 *
 * Format facts learned from web-push's own validator (scripts/vapidWebpushCheck.cjs):
 *   - the stored server-side key is the BARE 87-char unpadded base64url body;
 *     a 65-byte uncompressed point encodes to exactly 87 significant chars, so
 *     the first character is real key data and must NOT be stripped;
 *   - there is no 'B' marker anywhere in the server-side value. The 'B' prefix
 *     seen in some examples belongs to a different convention and would corrupt
 *     the point if removed here.
 * The only transformation needed is base64url -> base64 + padding.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

/** The active SW registration, or null when the app is not controlled yet. */
async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null
  return navigator.serviceWorker.ready
}

/** The browser-side subscription (device endpoint), or null when not subscribed. */
export async function getCurrentPushSubscription(): Promise<PushSubscriptionLike | null> {
  if (!isPushCapable()) return null
  const reg = await getRegistration()
  if (!reg || !('pushManager' in reg)) return null
  try {
    const sub = (await reg.pushManager.getSubscription()) as unknown as PushSubscriptionLike | null
    return sub ?? null
  } catch {
    return null
  }
}

/** Ask the browser for permission. Never throws; returns the resulting state. */
export async function requestPushPermission(): Promise<PushPermissionState> {
  if (!isPushCapable()) return 'unsupported'
  try {
    const result = await Notification.requestPermission()
    return result as PushPermissionState
  } catch {
    return 'denied'
  }
}

/**
 * Subscribe + register the endpoint server-side.
 * Idempotent: calling it again when already subscribed re-registers the same
 * endpoint (the migration upserts by endpoint) and never creates a duplicate.
 */
export async function enablePush(): Promise<PushResult<{ id: string }>> {
  if (!isPushCapable()) return { ok: false, error: 'ERR_PUSH_UNSUPPORTED' }

  const config = await getPushConfig()
  if (!config.enabled) return { ok: false, error: 'ERR_PUSH_DISABLED' }
  if (!config.vapid_public_key) return { ok: false, error: 'ERR_NO_VAPID_KEY' }

  const permission = await requestPushPermission()
  if (permission !== 'granted') return { ok: false, error: 'ERR_PERMISSION_DENIED', reason: permission }

  const reg = await getRegistration()
  if (!reg) return { ok: false, error: 'ERR_NO_SERVICE_WORKER' }

  let sub: PushSubscriptionLike
  try {
    const existing = (await reg.pushManager.getSubscription()) as unknown as PushSubscriptionLike | null
    sub = existing ?? ((await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(config.vapid_public_key) as unknown as BufferSource,
    })) as unknown as PushSubscriptionLike)
  } catch (e) {
    return { ok: false, error: 'ERR_SUBSCRIBE_FAILED', reason: (e as Error)?.message }
  }

  const json = sub.toJSON?.() ?? { endpoint: sub.endpoint, keys: sub.keys }
  const p256dh = json.keys?.p256dh
  const auth = json.keys?.auth
  if (!json.endpoint || !p256dh || !auth) return { ok: false, error: 'ERR_SUBSCRIPTION_INCOMPLETE' }

  const { data, error } = await supabase.rpc('register_push_subscription', {
    p_endpoint: json.endpoint,
    p_p256dh: p256dh,
    p_auth_secret: auth,
    p_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
  })
  if (error) return { ok: false, error: error.message }

  return { ok: true, value: data as { id: string } }
}

/** Unsubscribe the device and drop the server-side row. */
export async function disablePush(): Promise<PushResult<{ removed: number }>> {
  const sub = await getCurrentPushSubscription()
  const endpoint = sub?.toJSON?.()?.endpoint ?? sub?.endpoint

  if (sub?.unsubscribe) {
    try {
      await sub.unsubscribe()
    } catch {
      // already gone on the device — the server row still needs removing
    }
  }

  const { data, error } = await supabase.rpc('unregister_push_subscription', {
    p_subscription_id: null,
    p_endpoint: endpoint ?? null,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true, value: (data ?? { removed: 0 }) as { removed: number } }
}

/** Server-side transport flag (distinct from the category prefs). */
export async function setPushTransportPref(enabled: boolean): Promise<PushResult<{ push_enabled: boolean }>> {
  const { data, error } = await supabase.rpc('set_push_transport_pref', { p_enabled: enabled })
  if (error) return { ok: false, error: error.message }
  const res = data as { ok?: boolean; push_enabled?: boolean; error?: string }
  if (res?.ok === false) return { ok: false, error: res.error ?? 'ERR_PREF_REJECTED' }
  return { ok: true, value: { push_enabled: res?.push_enabled === true } }
}

/** This device's registration state — used to render the toggle honestly. */
export async function getPushStatus(): Promise<{
  supported: boolean
  permission: PushPermissionState
  subscribed: boolean
  serverEnabled: boolean
}> {
  const config = await getPushConfig()
  const sub = await getCurrentPushSubscription()
  return {
    supported: isPushCapable(),
    permission: getPushPermissionState(),
    subscribed: !!sub,
    serverEnabled: config.enabled,
  }
}

/** Own devices registered against this account (no endpoint tokens exposed). */
export async function listMyPushSubscriptions(): Promise<PushSubscriptionSummary[]> {
  const { data, error } = await supabase.rpc('list_my_push_subscriptions')
  if (error || !data) return []
  const rows = (data as { subscriptions?: PushSubscriptionSummary[] }).subscriptions
  return Array.isArray(rows) ? rows : []
}

/**
 * Re-register a subscription handed back by the service worker after
 * pushsubscriptionchange. The SW cannot authenticate, so the page does it.
 */
export async function reregisterPushedSubscription(sub: PushSubscriptionLike | null): Promise<boolean> {
  if (!sub) return false
  const json = sub.toJSON?.() ?? { endpoint: sub.endpoint, keys: sub.keys }
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false
  const { error } = await supabase.rpc('register_push_subscription', {
    p_endpoint: json.endpoint,
    p_p256dh: json.keys.p256dh,
    p_auth_secret: json.keys.auth,
    p_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
  })
  return !error
}