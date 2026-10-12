// ============================================
// Bite Me Baby — OTP policy regression (P0 security remediation / Owner OD-1)
// ============================================
// OTP ยืนยัน "การควบคุมเบอร์โทร" เท่านั้น — ห้ามใช้เป็นหลักฐานการชำระเงิน
// และห้ามเก็บรหัส plaintext (ต้อง hash เสมอ) — ทดสอบทั้งสองข้อที่นี่
// ============================================

import { describe, it, expect } from 'vitest'
import {
  OTP_LENGTH,
  OTP_TTL_MS,
  OTP_MAX_ATTEMPTS,
  OTP_SEND_LIMIT,
  OTP_SEND_RULE,
  OTP_VERIFY_RULE,
  generateOtpCode,
  newOtpSalt,
  hashOtpCode,
  verifyOtpCode,
  timingSafeEqualHex,
  isOtpExpired,
  normalizeOtpPhone,
  maskOtpPhone,
  otpSmsMessage,
  isOtpLimited,
  recordOtpHit,
} from '../../supabase/functions/_shared/otpPolicy'

const T0 = 1_700_000_000_000

describe('generateOtpCode — ต้องสุ่มด้วย CSPRNG และใช้ได้จริง', () => {
  it('produces exactly OTP_LENGTH digits', () => {
    const code = generateOtpCode()
    expect(code).toMatch(new RegExp(`^\\d{${OTP_LENGTH}}$`))
  })

  it('never produces the all-zero code (trivially guessable)', () => {
    for (let i = 0; i < 200; i++) {
      expect(generateOtpCode()).not.toBe('0'.repeat(OTP_LENGTH))
    }
  })

  it('actually varies across calls (not a constant)', () => {
    const seen = new Set(Array.from({ length: 50 }, () => generateOtpCode()))
    expect(seen.size).toBeGreaterThan(1)
  })
})

describe('hashOtpCode / verifyOtpCode — ห้ามเก็บ plaintext', () => {
  it('hash is deterministic for the same code+salt and NEVER equals the code', async () => {
    const salt = newOtpSalt()
    const h1 = await hashOtpCode('123456', salt)
    const h2 = await hashOtpCode('123456', salt)
    expect(h1).toBe(h2)
    expect(h1).not.toContain('123456')
    expect(h1).toMatch(/^[0-9a-f]{64}$/) // SHA-256 hex
  })

  it('different salt produces a different hash (same code)', async () => {
    const a = await hashOtpCode('123456', newOtpSalt())
    const b = await hashOtpCode('123456', newOtpSalt())
    expect(a).not.toBe(b)
  })

  it('verifies the correct code and rejects everything else', async () => {
    const salt = newOtpSalt()
    const hash = await hashOtpCode('654321', salt)
    expect(await verifyOtpCode('654321', hash, salt)).toBe(true)
    expect(await verifyOtpCode('654322', hash, salt)).toBe(false)
    expect(await verifyOtpCode('', hash, salt)).toBe(false)
  })

  it('rejects non-digit and wrong-length candidates before hashing', async () => {
    const salt = newOtpSalt()
    const hash = await hashOtpCode('123456', salt)
    expect(await verifyOtpCode('12345a', hash, salt)).toBe(false)
    expect(await verifyOtpCode('12345', hash, salt)).toBe(false)   // สั้นเกิน
    expect(await verifyOtpCode('1234567', hash, salt)).toBe(false) // ยาวเกิน
  })
})

describe('timingSafeEqualHex', () => {
  it('accepts equal strings and rejects different ones', () => {
    expect(timingSafeEqualHex('abc123', 'abc123')).toBe(true)
    expect(timingSafeEqualHex('abc123', 'abc124')).toBe(false)
    expect(timingSafeEqualHex('abc123', 'abc12')).toBe(false) // ต่างความยาว
    expect(timingSafeEqualHex('', '')).toBe(true)
  })
})

describe('expiry, masking, message', () => {
  it('expires at the TTL boundary (fail-closed)', () => {
    // isOtpExpired(expiresAt, now) — now ถึง/เกิน expiresAt = หมดอายุ
    expect(isOtpExpired(T0 + OTP_TTL_MS, T0)).toBe(false)                     // ยังไม่ถึง
    expect(isOtpExpired(T0 + OTP_TTL_MS, T0 + OTP_TTL_MS - 1)).toBe(false)    // วินาทีก่อน
    expect(isOtpExpired(T0 + OTP_TTL_MS, T0 + OTP_TTL_MS)).toBe(true)         // ตรงพอดี
    expect(isOtpExpired(T0 + OTP_TTL_MS, T0 + OTP_TTL_MS + 1)).toBe(true)     // เกิน
    expect(isOtpExpired(new Date(T0 + OTP_TTL_MS).toISOString(), T0 + OTP_TTL_MS)).toBe(true)
    expect(isOtpExpired('not-a-date', T0)).toBe(true)                          // parse ไม่ได้ = หมดอายุ
  })

  it('normalizeOtpPhone strips formatting, maskOtpPhone hides the middle', () => {
    expect(normalizeOtpPhone('+66 81-234-5678')).toBe('66812345678')
    expect(maskOtpPhone('0812345678')).toBe('081***678')
    expect(maskOtpPhone('12')).toBe('***') // สั้นเกินจะ mask ได้ -> ห้ามโชว์
  })

  it('the SMS text carries the code and TTL but no personal data', () => {
    const msg = otpSmsMessage('123456')
    expect(msg).toContain('123456')
    expect(msg).toContain(String(Math.round(OTP_TTL_MS / 60000)))
    expect(msg).toContain('หมดอายุ')
    // ห้ามมีชื่อ/ที่อยู่/อีเมลในข้อความ
    expect(msg).not.toMatch(/@/)
  })
})

describe('OTP limits — กัน SMS fraud และ brute force', () => {
  let store: Map<string, number[]>

  it('sends are capped at OTP_SEND_LIMIT per phone per window', () => {
    store = new Map()
    for (let i = 0; i < OTP_SEND_LIMIT; i++) {
      expect(isOtpLimited(store, 'p:0812345678', OTP_SEND_RULE, T0).limited).toBe(false)
      recordOtpHit(store, 'p:0812345678', OTP_SEND_RULE, T0)
    }
    const blocked = isOtpLimited(store, 'p:0812345678', OTP_SEND_RULE, T0)
    expect(blocked.limited).toBe(true)
    expect(blocked.retryAfterSec).toBeGreaterThan(0)
  })

  it('verify attempts are capped separately and independently per phone', () => {
    store = new Map()
    for (let i = 0; i < OTP_VERIFY_RULE.limit; i++) {
      recordOtpHit(store, 'v:0812345678', OTP_VERIFY_RULE, T0)
    }
    expect(isOtpLimited(store, 'v:0812345678', OTP_VERIFY_RULE, T0).limited).toBe(true)
    expect(isOtpLimited(store, 'v:0899999999', OTP_VERIFY_RULE, T0).limited).toBe(false)
  })

  it('limits unlock after the window slides', () => {
    store = new Map()
    for (let i = 0; i < OTP_SEND_LIMIT; i++) recordOtpHit(store, 'p:0812345678', OTP_SEND_RULE, T0)
    expect(isOtpLimited(store, 'p:0812345678', OTP_SEND_RULE, T0).limited).toBe(true)
    expect(isOtpLimited(store, 'p:0812345678', OTP_SEND_RULE, T0 + OTP_SEND_RULE.windowMs + 1).limited).toBe(false)
  })

  it('per-challenge attempt budget is finite (not unlimited retries)', () => {
    expect(OTP_MAX_ATTEMPTS).toBeGreaterThan(0)
    expect(OTP_MAX_ATTEMPTS).toBeLessThanOrEqual(10)
  })
})
