import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  omisePublishedKey,
  omiseConfig,
  isOmiseConfigured,
  omiseIsTestMode,
  OMISE_CHECKOUT_FUNCTION,
  OMISE_WEBHOOK_FUNCTION,
  OMISE_REFUND_FUNCTION,
  OMISE_JS_CDN,
  omiseCreateCardToken,
  loadOmiseJs,
} from '@/lib/omise'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('omise config — Stripe→Omise switch, TEST MODE foundation', () => {
  it('returns an empty published key when unset', () => {
    vi.stubEnv('OMISE_PUBLISHED_API_KEY_TEST_MODE', '')
    expect(omisePublishedKey()).toBe('')
    expect(isOmiseConfigured()).toBe(false)
  })

  it('detects test mode from a pkey_test_ key', () => {
    vi.stubEnv('OMISE_PUBLISHED_API_KEY_TEST_MODE', 'pkey_test_abc123')
    expect(omiseIsTestMode()).toBe(true)
    expect(isOmiseConfigured()).toBe(true)
    expect(omiseConfig()).toEqual({
      publishedKey: 'pkey_test_abc123',
      testMode: true,
      configured: true,
    })
  })

  it('treats a placeholder value as unconfigured', () => {
    vi.stubEnv('OMISE_PUBLISHED_API_KEY_TEST_MODE', 'pkey_test_REPLACE_WITH_OWNER_TEST_KEY')
    expect(isOmiseConfigured()).toBe(false)
    expect(omiseConfig().configured).toBe(false)
  })

  it('whitelists the Omise checkout edge function name for the cutover seam', () => {
    expect(OMISE_CHECKOUT_FUNCTION).toBe('omise-checkout')
  })
})

describe('omise cutover seams — webhook/refund EFs + Omise.js loader', () => {
  it('wires the webhook and refund EF names', () => {
    expect(OMISE_WEBHOOK_FUNCTION).toBe('omise-webhook')
    expect(OMISE_REFUND_FUNCTION).toBe('omise-refund')
  })

  it('points Omise.js at the official CDN', () => {
    expect(OMISE_JS_CDN).toBe('https://cdn.omise.co/omise.js')
  })

  it('omiseCreateCardToken refuses without a configured key (never loads the CDN)', async () => {
    vi.stubEnv('OMISE_PUBLISHED_API_KEY_TEST_MODE', 'pkey_test_REPLACE_WITH_OWNER_TEST_KEY')
    const r = await omiseCreateCardToken({
      name: 'Test Card',
      number: '4242424242424242',
      expiration_month: '12',
      expiration_year: '2030',
      security_code: '123',
    })
    expect(r).toEqual({ ok: false, error: 'ERR_OMISE_NOT_CONFIGURED' })
  })

  it('loadOmiseJs resolves null when unconfigured', async () => {
    vi.stubEnv('OMISE_PUBLISHED_API_KEY_TEST_MODE', '')
    expect(await loadOmiseJs()).toBeNull()
  })
})