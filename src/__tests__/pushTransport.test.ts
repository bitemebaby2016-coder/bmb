// ============================================
// W3-D-7 — Web Push transport tests (migration 115 contract)
//
// Proves the CLIENT contract of the push transport:
//   - no hardcoded VAPID key: config always comes from the get_push_config RPC
//   - the client never supplies a customer id (server resolves auth.uid())
//   - unsupported / disabled / no-key / denied paths degrade to typed errors
//   - disablePush always removes the server row, even if the device is gone
//   - the service worker message path re-registers a rotated subscription
// NOTE: RLS + service_role grants are enforced server-side and verified against
// production via the migration probes, not here.
// ============================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const rpcMock = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
  default: null,
}))

import {
  enablePush,
  disablePush,
  getPushConfig,
  getCurrentPushSubscription,
  getPushPermissionState,
  getPushStatus,
  listMyPushSubscriptions,
  reregisterPushedSubscription,
  requestPushPermission,
  setPushTransportPref,
} from '@/lib/pushService'

const VAPID = 'BNbVuo1k3dWUYqvXk1s3xk4xKv_z1oXkP0Yq9ExamplePublicKeyValue12345'

const SUB_JSON = {
  endpoint: 'https://push.example.test/endpoint/abc',
  keys: { p256dh: 'p256dh-key', auth: 'auth-secret' },
}

/** Install a fake PushManager/SW pair and return handles for assertions. */
function installPushEnvironment(opts: {
  permission?: NotificationPermission
  existing?: unknown
  subscribeImpl?: () => unknown
} = {}) {
  const calls = { subscribe: 0, unsubscribe: 0 }
  const subscription = {
    endpoint: SUB_JSON.endpoint,
    toJSON: () => SUB_JSON,
    unsubscribe: async () => {
      calls.unsubscribe++
      return true
    },
  }

  const pushManager = {
    getSubscription: async () => opts.existing ?? null,
    subscribe: async () => {
      calls.subscribe++
      return opts.subscribeImpl ? opts.subscribeImpl() : subscription
    },
  }

  const registration = { pushManager, scope: '/' }

  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { ready: Promise.resolve(registration), addEventListener: vi.fn(), removeEventListener: vi.fn() },
  })

  const permission = opts.permission ?? 'granted'
  Object.defineProperty(window, 'PushManager', { configurable: true, value: function PushManager() {} })
  Object.defineProperty(window, 'Notification', {
    configurable: true,
    value: Object.assign(
      function Notification() {},
      { permission, requestPermission: async () => permission },
    ),
  })

  return { calls, registration, subscription }
}

function removePushEnvironment() {
  Reflect.deleteProperty(navigator, 'serviceWorker')
  Reflect.deleteProperty(window as unknown as Record<string, unknown>, 'PushManager')
  Reflect.deleteProperty(window as unknown as Record<string, unknown>, 'Notification')
}

/** configRpc answers get_push_config; other RPCs fall through to `fallback`. */
function route(fallback: unknown = { data: null, error: null }, enabled = true, key = VAPID) {
  rpcMock.mockImplementation((fn: string) =>
    Promise.resolve(fn === 'get_push_config'
      ? { data: { enabled, vapid_public_key: key, vapid_subject: '' }, error: null }
      : fallback),
  )
}

describe('W3-D-7 Web Push transport', () => {
  beforeEach(() => {
    rpcMock.mockReset()
    removePushEnvironment()
  })

  afterEach(() => {
    removePushEnvironment()
  })

  describe('admin-configurable config (no hardcode)', () => {
    it('reads enabled + vapid_public_key from get_push_config', async () => {
      rpcMock.mockResolvedValue({ data: { enabled: true, vapid_public_key: VAPID, vapid_subject: 'mailto:a@b.c' }, error: null })
      const cfg = await getPushConfig()
      expect(cfg.enabled).toBe(true)
      expect(cfg.vapid_public_key).toBe(VAPID)
      expect(rpcMock).toHaveBeenCalledWith('get_push_config')
    })

    it('an RPC error degrades to disabled/empty (never a fabricated key)', async () => {
      rpcMock.mockResolvedValue({ data: null, error: { message: 'boom' } })
      expect(await getPushConfig()).toEqual({ enabled: false, vapid_public_key: '', vapid_subject: '' })
    })
  })

  describe('unsupported environments', () => {
    it('reports unsupported without touching the network', async () => {
      expect(getPushPermissionState()).toBe('unsupported')
      expect(await requestPushPermission()).toBe('unsupported')
      expect(await getCurrentPushSubscription()).toBeNull()
      expect(await enablePush()).toEqual({ ok: false, error: 'ERR_PUSH_UNSUPPORTED' })
      expect(rpcMock).not.toHaveBeenCalled()
    })
  })

  describe('enablePush', () => {
    it('refuses when the admin has disabled the transport', async () => {
      installPushEnvironment()
      route({ data: null, error: null }, false)
      expect(await enablePush()).toEqual({ ok: false, error: 'ERR_PUSH_DISABLED' })
    })

    it('refuses when no VAPID public key is configured yet', async () => {
      installPushEnvironment()
      route({ data: null, error: null }, true, '')
      expect(await enablePush()).toEqual({ ok: false, error: 'ERR_NO_VAPID_KEY' })
    })

    it('refuses when permission is denied, and never subscribes', async () => {
      const { calls } = installPushEnvironment({ permission: 'denied' })
      route()
      const r = await enablePush()
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error).toBe('ERR_PERMISSION_DENIED')
      expect(calls.subscribe).toBe(0)
    })

    it('subscribes and registers WITHOUT sending any customer id', async () => {
      const { calls } = installPushEnvironment()
      route({ data: { id: 'push-1' }, error: null })

      expect(await enablePush()).toEqual({ ok: true, value: { id: 'push-1' } })
      expect(calls.subscribe).toBe(1)

      const registerCall = rpcMock.mock.calls.find((c) => c[0] === 'register_push_subscription')
      expect(registerCall).toBeDefined()
      const args = registerCall![1] as Record<string, unknown>
      expect(args.p_endpoint).toBe(SUB_JSON.endpoint)
      expect(args.p_p256dh).toBe(SUB_JSON.keys.p256dh)
      expect(args.p_auth_secret).toBe(SUB_JSON.keys.auth)
      // authority boundary: the client must not name the recipient
      expect(JSON.stringify(args)).not.toMatch(/customer/i)
    })

    it('reuses an existing subscription instead of creating a duplicate', async () => {
      const { calls } = installPushEnvironment()
      const existing = { endpoint: SUB_JSON.endpoint, toJSON: () => SUB_JSON }
      Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: {
          ready: Promise.resolve({
            pushManager: {
              getSubscription: async () => existing,
              subscribe: async () => { calls.subscribe++; return existing },
            },
          }),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        },
      })
      route({ data: { id: 'push-1' }, error: null })

      expect((await enablePush()).ok).toBe(true)
      expect(calls.subscribe).toBe(0)
    })

    it('rejects a subscription missing its keys instead of registering garbage', async () => {
      installPushEnvironment({
        subscribeImpl: () => ({
          endpoint: SUB_JSON.endpoint,
          toJSON: () => ({ endpoint: SUB_JSON.endpoint }),
        }),
      })
      route()

      expect(await enablePush()).toEqual({ ok: false, error: 'ERR_SUBSCRIPTION_INCOMPLETE' })
      expect(rpcMock.mock.calls.some((c) => c[0] === 'register_push_subscription')).toBe(false)
    })
  })

  describe('disablePush', () => {
    it('unsubscribes the device AND removes the server row', async () => {
      let callsUnsubscribe = 0
      const deviceSub = { endpoint: SUB_JSON.endpoint, toJSON: () => SUB_JSON, unsubscribe: async () => { callsUnsubscribe++; return true } }
      const { calls } = installPushEnvironment()
      ;(navigator.serviceWorker as any).ready = Promise.resolve({
        pushManager: { getSubscription: async () => deviceSub, subscribe: async () => deviceSub },
      })
      rpcMock.mockResolvedValue({ data: { ok: true, removed: 1 }, error: null })

      const r = await disablePush()
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.value.removed).toBe(1)
      expect(callsUnsubscribe).toBe(1)

      const unreg = rpcMock.mock.calls.find((c) => c[0] === 'unregister_push_subscription')
      expect((unreg![1] as Record<string, unknown>).p_endpoint).toBe(SUB_JSON.endpoint)
      expect(calls.subscribe).toBe(0)
    })

    it('still removes the server row when the device subscription is already gone', async () => {
      installPushEnvironment()
      rpcMock.mockResolvedValue({ data: { ok: true, removed: 1 }, error: null })
      expect((await disablePush()).ok).toBe(true)
      const unreg = rpcMock.mock.calls.find((c) => c[0] === 'unregister_push_subscription')
      expect((unreg![1] as Record<string, unknown>).p_endpoint).toBeNull()
    })
  })

  describe('transport preference + status', () => {
    it('surfaces ERR_NO_SUBSCRIPTION when enabling without a device', async () => {
      rpcMock.mockResolvedValue({ data: { ok: false, error: 'ERR_NO_SUBSCRIPTION', push_enabled: false }, error: null })
      expect(await setPushTransportPref(true)).toEqual({ ok: false, error: 'ERR_NO_SUBSCRIPTION' })
    })

    it('getPushStatus reflects browser capability honestly', async () => {
      installPushEnvironment()
      route()
      const st = await getPushStatus()
      expect(st.supported).toBe(true)
      expect(st.serverEnabled).toBe(true)
      expect(st.subscribed).toBe(false)
    })
  })

  describe('service worker re-registration path', () => {
    it('re-registers a rotated subscription handed back by the SW', async () => {
      rpcMock.mockResolvedValue({ data: { ok: true, id: 'push-2' }, error: null })
      const ok = await reregisterPushedSubscription({
        endpoint: 'https://push.example.test/endpoint/new',
        toJSON: () => ({ endpoint: 'https://push.example.test/endpoint/new', keys: { p256dh: 'k2', auth: 'a2' } }),
      })
      expect(ok).toBe(true)
      const call = rpcMock.mock.calls.find((c) => c[0] === 'register_push_subscription')!
      expect((call[1] as Record<string, unknown>).p_endpoint).toBe('https://push.example.test/endpoint/new')
    })

    it('is a no-op for a null or incomplete subscription', async () => {
      expect(await reregisterPushedSubscription(null)).toBe(false)
      expect(await reregisterPushedSubscription({ endpoint: 'https://x.test/e', toJSON: () => ({ endpoint: 'https://x.test/e' }) })).toBe(false)
      expect(rpcMock).not.toHaveBeenCalled()
    })
  })

  describe('own-device listing', () => {
    it('returns the array or an empty list on error', async () => {
      rpcMock.mockResolvedValue({ data: { subscriptions: [{ id: 'push-1', created_at: 'x', last_success_at: null, user_agent: null }] }, error: null })
      expect(await listMyPushSubscriptions()).toHaveLength(1)

      rpcMock.mockResolvedValue({ data: null, error: { message: 'nope' } })
      expect(await listMyPushSubscriptions()).toEqual([])
    })
  })
})