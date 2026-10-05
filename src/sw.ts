/// <reference lib="webworker" />
/// <reference types="vite-plugin-pwa/client" />
// ============================================
// Bite Me Baby — Service Worker (injectManifest, W3-D-7 Web Push)
// Replaces the previous generateSW output. Offline precache behaviour is
// unchanged (same globPatterns as the old config); what is NEW:
//   - `push` handler           → shows a real notification on the device
//   - `notificationclick`      → focuses an existing tab / opens the deep link
//   - `pushsubscriptionchange` → re-registers after the browser rotates keys
// The payload shape is owned by supabase/functions/push-send:
//   { title, body, url?, tag?, notificationId? }
// ============================================

import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare const self: ServiceWorkerGlobalScope

// --- offline precache (same behaviour as the previous generateSW worker) ---
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// SPA navigations: serve index.html from the precache so deep links work offline.
const fileExtensionRegexp = /\/[^/?]+\.[^/]+$/
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), {
    denylist: [/^\/api\//, fileExtensionRegexp],
  }),
)

interface PushPayload {
  title?: string
  body?: string
  url?: string
  tag?: string
  notificationId?: string
}

/** Coerce an unknown push payload into a displayable shape (never trust the wire). */
function readPayload(event: PushEvent): PushPayload {
  if (!event.data) return {}
  try {
    const parsed = JSON.parse(event.data.text())
    if (parsed && typeof parsed === 'object') {
      const p = parsed as Record<string, unknown>
      return {
        title: typeof p.title === 'string' ? p.title : undefined,
        body: typeof p.body === 'string' ? p.body : undefined,
        url: typeof p.url === 'string' ? p.url : undefined,
        tag: typeof p.tag === 'string' ? p.tag : undefined,
        notificationId: typeof p.notificationId === 'string' ? p.notificationId : undefined,
      }
    }
  } catch {
    // Non-JSON payload: fall back to the raw text below.
  }
  return { body: event.data.text() }
}

self.addEventListener('push', (event: PushEvent) => {
  const payload = readPayload(event)
  const title = payload.title || 'Bite Me Baby'
  // `renotify` is part of the Push/Notification spec but is not in lib.dom's
  // NotificationOptions yet — cast so the browser still honours it.
  const options: NotificationOptions & { renotify?: boolean } = {
    body: payload.body || '',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: payload.tag || 'bmb-notification',
    // An order number changes as the order progresses — each state is its own
    // notification instead of overwriting the previous one.
    renotify: true,
    data: { url: payload.url || '/notifications', notificationId: payload.notificationId },
    lang: 'th',
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  const target = (event.notification.data as { url?: string } | undefined)?.url || '/notifications'

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of clientList) {
        if ('focus' in client) {
          // Reuse an open tab rather than piling up duplicates.
          if ('navigate' in client && client.url !== target) {
            try {
              await client.navigate(target)
            } catch {
              /* cross-origin or already-closed — fall through to openWindow */
            }
          }
          return client.focus()
        }
      }
      return self.clients.openWindow(target)
    })(),
  )
})

// The browser may rotate the push keys or silently drop the subscription.
// The service worker has no Supabase session (it must not hold credentials), so
// it hands the new subscription back to the page; the client re-registers it
// through the authenticated RPC (see src/lib/pushService.ts).
self.addEventListener('pushsubscriptionchange', (event: ExtendableEvent) => {
  event.waitUntil(
    (async () => {
      try {
        const sub = await self.registration.pushManager.getSubscription()
        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        for (const client of clients) {
          client.postMessage({ type: 'bmb:pushsubscriptionchange', subscription: sub?.toJSON() ?? null })
        }
      } catch {
        // pushManager unavailable (e.g. permission revoked) — nothing to do here.
      }
    })(),
  )
})