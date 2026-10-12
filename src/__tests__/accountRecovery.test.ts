// ============================================
// Bite Me Baby — P0 interim + P1 (SF-01 / SF-04) regression tests
// ============================================
// SF-04 — account recovery: ต้องกู้รหัสผ่านได้ และ "ห้าม" รั่วข้อมูลว่าอีเมลไหนมีบัญชี
// SF-01 — phone-auto-login rate limit: pure module ที่ EF ใช้จริง ต้องกัน brute force
//         โดยไม่ทำให้ผู้ใช้ปกติถูกบล็อก (ค่า limit เผื่อพิมพ์ผิดได้หลายครั้ง)
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---- mock เฉพาะไฟล์นี้ (ไม่แตะ shared helper เพื่อกันผลกระทบข้าม test) ----
// ต้องใช้ vi.hoisted เพราะ vi.mock ถูกยกไว้เหนือ declaration ตอน compile
// + ระบุชนิดของ args/result ให้ชัด เพื่อให้ tsc (npm run build) ตรวจผ่าน
const authMock = vi.hoisted(() => ({
  resetPasswordForEmail: vi.fn(
    async (
      _email: string,
      _opts?: { redirectTo?: string },
    ): Promise<{ error: { message: string } | null }> => ({ error: null }),
  ),
  updateUser: vi.fn(
    async (_u: { password: string }): Promise<{ error: { message: string } | null }> => ({ error: null }),
  ),
  getSession: vi.fn(
    async (): Promise<{ data: { session: { user: { id: string } } | null } }> => ({
      data: { session: { user: { id: 'u1' } } },
    }),
  ),
}))

vi.mock('@/lib/supabase', () => ({ supabase: { auth: authMock }, supabaseAdmin: null }))

import {
  sendPasswordReset,
  updatePassword,
  canUpdatePassword,
  MIN_PASSWORD_LENGTH,
} from '@/lib/authRecovery'
import { describeGuestOtpError } from '@/lib/guestCheckout'
import {
  checkRateLimit,
  recordAttempt,
  pruneHits,
  normalizePhoneKey,
  clientIpOf,
  sweep,
  QUICK_LOGIN_PHONE_RULE,
  QUICK_LOGIN_IP_RULE,
} from '../../supabase/functions/phone-auto-login/rateLimit'

beforeEach(() => {
  authMock.resetPasswordForEmail.mockReset().mockResolvedValue({ error: null })
  authMock.updateUser.mockReset().mockResolvedValue({ error: null })
  authMock.getSession
    .mockReset()
    .mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
})

describe('sendPasswordReset — SF-04 (ไม่มีในระบบมาก่อน 2026-10-12)', () => {
  it('rejects an empty or malformed email before calling Supabase', async () => {
    expect((await sendPasswordReset('')).error).toBe('ERR_MISSING_EMAIL')
    expect((await sendPasswordReset('   ')).error).toBe('ERR_MISSING_EMAIL')
    expect((await sendPasswordReset('not-an-email')).error).toBe('ERR_INVALID_EMAIL')
    expect(authMock.resetPasswordForEmail).not.toHaveBeenCalled()
  })

  it('lowercases + trims the email and passes an absolute redirectTo', async () => {
    const res = await sendPasswordReset('  MyName@Example.COM ')
    expect(res.ok).toBe(true)
    expect(authMock.resetPasswordForEmail).toHaveBeenCalledTimes(1)
    const [emailArg, opts] = authMock.resetPasswordForEmail.mock.calls[0]
    expect(emailArg).toBe('myname@example.com')
    expect(String(opts?.redirectTo)).toMatch(/^https?:\/\/.+\/reset-password$/)
  })

  it('HIDES account existence — "User not found" ต้องดูเหมือนสำเร็จ (no enumeration)', async () => {
    authMock.resetPasswordForEmail.mockResolvedValue({ error: { message: 'User not found' } })
    const res = await sendPasswordReset('nobody@example.com')
    expect(res.ok).toBe(true)
    expect(res.error).toBeUndefined()
  })

  it('still surfaces genuine transport failures', async () => {
    authMock.resetPasswordForEmail.mockResolvedValue({ error: { message: 'Failed to fetch' } })
    const res = await sendPasswordReset('someone@example.com')
    expect(res.ok).toBe(false)
    expect(res.error).toBe('Failed to fetch')
  })
})

describe('updatePassword / canUpdatePassword — SF-04', () => {
  it(`refuses a password shorter than ${MIN_PASSWORD_LENGTH} characters`, async () => {
    const res = await updatePassword('short')
    expect(res.error).toBe('ERR_PASSWORD_TOO_SHORT')
    expect(authMock.updateUser).not.toHaveBeenCalled()
  })

  it('delegates to supabase.auth.updateUser for a valid password', async () => {
    const res = await updatePassword('a-strong-password')
    expect(res.ok).toBe(true)
    expect(authMock.updateUser).toHaveBeenCalledWith({ password: 'a-strong-password' })
  })

  it('surfaces the updateUser failure', async () => {
    authMock.updateUser.mockResolvedValue({
      error: { message: 'Password should be at least 6 characters' },
    })
    const res = await updatePassword('a-strong-password')
    expect(res.ok).toBe(false)
  })

  it('canUpdatePassword reflects whether a session exists', async () => {
    expect(await canUpdatePassword()).toBe(true)
    authMock.getSession.mockResolvedValue({ data: { session: null } })
    expect(await canUpdatePassword()).toBe(false)
  })
})


describe('phone-auto-login rate limit — SF-01 interim hardening', () => {
  const T0 = 1_000_000
  let store: Map<string, number[]>

  beforeEach(() => { store = new Map() })

  it('normalizePhoneKey strips formatting and keeps the last 14 digits', () => {
    expect(normalizePhoneKey('+66 81-234-5678')).toBe('66812345678')
    expect(normalizePhoneKey('0812345678')).toBe('0812345678')
    expect(normalizePhoneKey('')).toBe('')
  })

  it('pruneHits drops attempts older than the window', () => {
    const hits = [T0 - 100, T0 - 50, T0]
    // cutoff = now - window = T0 - 60 -> ตัดเฉพาะ T0-100 (เก่ากว่า cutoff)
    expect(pruneHits(hits, T0, 60)).toEqual([T0 - 50, T0])
    expect(pruneHits(hits, T0, 40)).toEqual([T0])
    expect(pruneHits(hits, T0, 1_000_000)).toEqual(hits)
  })

  it('allows the first attempts and blocks exactly at the limit', () => {
    for (let i = 0; i < QUICK_LOGIN_PHONE_RULE.limit; i++) {
      const r = checkRateLimit(store, 'p:0812345678', QUICK_LOGIN_PHONE_RULE, T0)
      expect(r.limited).toBe(false)
      expect(r.remaining).toBe(QUICK_LOGIN_PHONE_RULE.limit - i)
      recordAttempt(store, 'p:0812345678', QUICK_LOGIN_PHONE_RULE, T0)
    }
    const blocked = checkRateLimit(store, 'p:0812345678', QUICK_LOGIN_PHONE_RULE, T0)
    expect(blocked.limited).toBe(true)
    expect(blocked.remaining).toBe(0)
    expect(blocked.retryAfterSec).toBeGreaterThan(0)
  })

  it('unblocks after the window slides past', () => {
    for (let i = 0; i < QUICK_LOGIN_PHONE_RULE.limit; i++) {
      recordAttempt(store, 'p:0812345678', QUICK_LOGIN_PHONE_RULE, T0)
    }
    expect(checkRateLimit(store, 'p:0812345678', QUICK_LOGIN_PHONE_RULE, T0).limited).toBe(true)
    const later = T0 + QUICK_LOGIN_PHONE_RULE.windowMs + 1
    expect(checkRateLimit(store, 'p:0812345678', QUICK_LOGIN_PHONE_RULE, later).limited).toBe(false)
  })

  it('different phones are counted independently', () => {
    for (let i = 0; i < QUICK_LOGIN_PHONE_RULE.limit; i++) {
      recordAttempt(store, 'p:0811111111', QUICK_LOGIN_PHONE_RULE, T0)
    }
    expect(checkRateLimit(store, 'p:0811111111', QUICK_LOGIN_PHONE_RULE, T0).limited).toBe(true)
    expect(checkRateLimit(store, 'p:0822222222', QUICK_LOGIN_PHONE_RULE, T0).limited).toBe(false)
  })

  it('IP limit is HIGHER than phone limit — shared carrier NAT must not lock out real customers', () => {
    expect(QUICK_LOGIN_IP_RULE.limit).toBeGreaterThan(QUICK_LOGIN_PHONE_RULE.limit)
    for (let i = 0; i < QUICK_LOGIN_PHONE_RULE.limit; i++) {
      recordAttempt(store, 'i:203.0.113.9', QUICK_LOGIN_IP_RULE, T0)
    }
    // เบอร์ถูกบล็อกได้แต่ IP ยังไม่ (ผู้ใช้ NAT คนอื่นยังใช้ได้)
    expect(checkRateLimit(store, 'i:203.0.113.9', QUICK_LOGIN_IP_RULE, T0).limited).toBe(false)
  })

  it('clientIpOf prefers x-forwarded-for first hop, then cf-connecting-ip', () => {
    expect(clientIpOf(new Headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }))).toBe('203.0.113.7')
    expect(clientIpOf(new Headers({ 'cf-connecting-ip': '198.51.100.4' }))).toBe('198.51.100.4')
    expect(clientIpOf(new Headers())).toBe('unknown')
  })

  it('sweep removes expired keys so memory cannot grow without bound', () => {
    recordAttempt(store, 'p:0812345678', QUICK_LOGIN_PHONE_RULE, T0)
    recordAttempt(store, 'i:203.0.113.9', QUICK_LOGIN_IP_RULE, T0)
    expect(store.size).toBe(2)
    sweep(store, T0 + QUICK_LOGIN_IP_RULE.windowMs + 1, QUICK_LOGIN_IP_RULE.windowMs)
    expect(store.size).toBe(0)
  })
})

// ---- P2 (Owner OD-2 option A) — guest checkout error mapping ----
describe('describeGuestOtpError — ข้อความภาษาไทยครบทุก reason', () => {
  it('maps every OTP failure reason to a distinct Thai message', () => {
    const seen = new Set<string>()
    for (const code of [
      'ERR_OTP_REQUIRED', 'ERR_OTP_INVALID', 'ERR_OTP_EXPIRED', 'ERR_OTP_ALREADY_USED',
      'ERR_OTP_TOO_MANY_TRIES', 'ERR_OTP_NOT_FOUND', 'ERR_RATE_LIMITED', 'ERR_TIMEOUT',
    ]) {
      const msg = describeGuestOtpError(code)
      expect(msg.length).toBeGreaterThan(0)
      seen.add(msg)
    }
    // ข้อความต้องไม่ซ้ำกันทุกกรณี (ผู้ใช้ต้องแยกแยะได้ว่าปัญหาคืออะไร)
    expect(seen.size).toBe(8)
  })

  it('never leaks the raw error code to the customer', () => {
    expect(describeGuestOtpError('ERR_OTP_INVALID')).not.toContain('ERR_')
    expect(describeGuestOtpError(undefined)).not.toContain('ERR_')
  })

  it('keeps the OTP boundary — messages never claim payment', () => {
    for (const code of ['ERR_OTP_INVALID', 'ERR_OTP_EXPIRED', 'ERR_RATE_LIMITED']) {
      expect(describeGuestOtpError(code)).not.toMatch(/ชำระเงิน|จ่ายเงิน|payment/i)
    }
  })
})
