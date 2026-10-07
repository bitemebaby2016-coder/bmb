import { describe, it, expect, vi, afterEach } from 'vitest'
import { omisePublishedKey, omiseConfig, isOmiseConfigured, omiseIsTestMode, OMISE_CHECKOUT_FUNCTION } from '@/lib/omise'

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