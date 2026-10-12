// P4 — Passkey: ทดสอบการแปล error เป็นภาษาไทย + ตรวจ supported
import { describe, it, expect, vi } from 'vitest'
import {
  describePasskeyError,
  isPasskeySupported,
} from '@/lib/passkeyLogin'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPasskey: vi.fn(),
      registerPasskey: vi.fn(),
      passkey: { list: vi.fn(), delete: vi.fn(), update: vi.fn() },
    },
  },
}))

describe('P4 passkey — support detection', () => {
  it('returns false when PublicKeyCredential is absent', () => {
    const w = window as unknown as Record<string, unknown>
    const original = w.PublicKeyCredential
    try {
      delete w.PublicKeyCredential
      expect(isPasskeySupported()).toBe(false)
    } finally {
      if (original !== undefined) w.PublicKeyCredential = original
    }
  })

  it('returns true when PublicKeyCredential and navigator.credentials exist', () => {
    const w = window as unknown as Record<string, unknown>
    const n = navigator as unknown as Record<string, unknown>
    const hadCred = 'credentials' in n
    const originalCred = n.credentials
    try {
      w.PublicKeyCredential = class {}
      n.credentials = {}
      expect(isPasskeySupported()).toBe(true)
    } finally {
      delete w.PublicKeyCredential
      if (hadCred) n.credentials = originalCred
      else delete n.credentials
    }
  })
})

describe('P4 passkey — Thai error messages', () => {
  it('never leaks the raw error code to the customer', () => {
    for (const c of ['webauthn_challenge_expired', 'ERROR_CEREMONY_ABORTED', 'ERR_PASSKEY_FAILED', undefined]) {
      const msg = describePasskeyError(c)
      expect(msg.length).toBeGreaterThan(0)
      expect(msg).not.toContain('webauthn_')
      expect(msg).not.toContain('ERROR_')
      expect(msg).not.toContain('ERR_')
    }
  })

  it('distinguishes user-cancelled from challenge-expired (ผู้ใช้ต้องรู้ว่าเกิดอะไร)', () => {
    expect(describePasskeyError('ERROR_CEREMONY_ABORTED')).not.toBe(
      describePasskeyError('webauthn_challenge_expired'),
    )
  })

  it('tells a user with no passkey exactly what to do next', () => {
    const msg = describePasskeyError('not_registered')
    expect(msg).toContain('โปรไฟล์')
    expect(msg).toContain('วิธีเข้าสู่ระบบอื่น')
  })

  it('keeps the identity boundary — never claims payment or account merging', () => {
    for (const c of ['not_registered', 'webauthn_challenge_expired', undefined]) {
      expect(describePasskeyError(c)).not.toMatch(/ชำระเงิน|จ่ายเงิน|payment/i)
      expect(describePasskeyError(c)).not.toMatch(/รวมบัญชี|merge/i)
    }
  })
})
