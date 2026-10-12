// P3 — Facebook Login: ทดสอบ redirect safety + ข้อความ error
// โดยเฉพาะ open-redirect และการไม่ leak raw error code ให้ลูกค้า
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  socialRedirectTo,
  readSocialNext,
  describeSocialError,
  consumeSocialCallbackError,
} from '@/lib/socialLogin'

vi.mock('@/lib/supabase', () => ({ supabase: { auth: { signInWithOAuth: vi.fn() } } }))

describe('P3 social login — open-redirect protection', () => {
  beforeEach(() => { window.history.replaceState({}, '', '/') })
  afterEach(() => { window.history.replaceState({}, '', '/') })

  it('keeps same-origin paths as-is', () => {
    expect(socialRedirectTo('/checkout')).toContain('next=%2Fcheckout')
  })

  it('rejects protocol-relative `//evil.com` and falls back to /', () => {
    const url = socialRedirectTo('//evil.example.com')
    expect(url).toContain('next=%2F')
    expect(url).not.toContain('evil.example.com')
  })

  it('rejects absolute http(s) URLs and falls back to /', () => {
    expect(socialRedirectTo('https://evil.example.com')).toContain('next=%2F')
    expect(socialRedirectTo('https://evil.example.com')).not.toContain('evil.example.com')
  })

  it('readSocialNext returns the saved path', () => {
    window.history.replaceState({}, '', '/login?next=%2Fcart')
    expect(readSocialNext()).toBe('/cart')
  })

  it('readSocialNext refuses to return a protocol-relative target', () => {
    window.history.replaceState({}, '', '/login?next=%2F%2Fevil.example.com')
    expect(readSocialNext()).toBe('/')
  })
})

describe('P3 social login — callback error handling', () => {
  beforeEach(() => { window.history.replaceState({}, '', '/') })
  afterEach(() => { window.history.replaceState({}, '/', '/') })

  it('reads error from hash (Supabase implicit flow)', () => {
    window.history.replaceState({}, '', '/login#error=access_denied&error_description=user_cancel')
    expect(consumeSocialCallbackError()).toBe('access_denied')
  })

  it('reads error from query', () => {
    window.history.replaceState({}, '', '/login?error=validation_failed')
    expect(consumeSocialCallbackError()).toBe('validation_failed')
  })

  it('clears the error param so a refresh does not replay it, but keeps ?next=', () => {
    window.history.replaceState({}, '', '/login?error=access_denied&next=%2Fcheckout')
    consumeSocialCallbackError()
    expect(window.location.href).toContain('next=%2Fcheckout')
    expect(window.location.href).not.toContain('error=access_denied')
  })

  it('returns undefined when there is no error', () => {
    window.history.replaceState({}, '', '/login?next=%2Fcart')
    expect(consumeSocialCallbackError()).toBeUndefined()
  })
})

describe('P3 social login — Thai error messages', () => {
  it('maps every known code to a distinct Thai message', () => {
    const codes = [
      'access_denied', 'provider_email_needs_verification', 'both_email_and_id_must_be_present',
      'user_already_exists', 'validation_failed', 'ERR_SOCIAL_START_FAILED', 'ERR_NETWORK',
    ]
    const seen = new Set(codes.map(describeSocialError))
    expect(seen.size).toBe(codes.length)
  })

  it('never leaks the raw error code to the customer', () => {
    for (const c of ['access_denied', 'user_already_exists', undefined]) {
      expect(describeSocialError(c)).not.toContain('ERR_')
      expect(describeSocialError(c)).not.toContain('access_denied')
    }
  })

  it('keeps the identity boundary — never claims payment or account merging', () => {
    for (const c of ['access_denied', 'user_already_exists', undefined]) {
      const msg = describeSocialError(c)
      expect(msg).not.toMatch(/ชำระเงิน|จ่ายเงิน|payment/i)
      expect(msg).not.toMatch(/รวมบัญชี|merge/i)
    }
  })
})
