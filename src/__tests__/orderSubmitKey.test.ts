// ============================================
// WAVE 5A (migration 124) — client submit key unit contracts
// (R2 key policy · payload fingerprint · retry-safe key ring)
// ============================================
import { describe, it, expect } from 'vitest'
import {
  newSubmitKey,
  isValidSubmitKey,
  payloadFingerprint,
  SubmitKeyRing,
  extractIdempotencyErrorCode,
  isIdempotencyErrorCode,
  describeIdempotencyError,
  type SubmitKeyStore,
} from '@/lib/orderSubmitKey'

function memoryStore(): SubmitKeyStore & { dump: Map<string, string> } {
  const m = new Map<string, string>()
  return {
    dump: m,
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  }
}

describe('newSubmitKey — R2 shape', () => {
  it('is "CK-" + uuid, valid, unique per call', () => {
    const a = newSubmitKey()
    const b = newSubmitKey()
    expect(a.startsWith('CK-')).toBe(true)
    expect(a).not.toBe(b)
    expect(isValidSubmitKey(a)).toBe(true)
    expect(a.length).toBeLessThanOrEqual(128)
  })
})

describe('isValidSubmitKey — 124 R2 verdicts (btrim + ≤128 + no control chars)', () => {
  it('accepts realistic keys including padded ones', () => {
    expect(isValidSubmitKey('CK-abc')).toBe(true)
    expect(isValidSubmitKey('  CK-abc  ')).toBe(true) // btrim
    expect(isValidSubmitKey('x'.repeat(128))).toBe(true) // cap is inclusive
  })
  it('rejects empty/whitespace/over-cap/control chars', () => {
    expect(isValidSubmitKey('')).toBe(false)
    expect(isValidSubmitKey('   ')).toBe(false)
    expect(isValidSubmitKey('x'.repeat(129))).toBe(false)
    expect(isValidSubmitKey('CK-a\u0007b')).toBe(false)
    expect(isValidSubmitKey('CK-a\nb')).toBe(false)
  })
})

describe('payloadFingerprint — same payload ⇒ same key candidate', () => {
  it('is deterministic and key-order independent', () => {
    expect(payloadFingerprint({ a: 1, b: { c: 2, d: 3 } })).toBe(payloadFingerprint({ b: { d: 3, c: 2 }, a: 1 }))
  })
  it('treats equal JS numbers as one payload (R1 trim_scale mirror)', () => {
    expect(payloadFingerprint({ dist: 13.7563 })).toBe(payloadFingerprint({ dist: 13.75630 }))
    expect(payloadFingerprint({ dist: 1 })).toBe(payloadFingerprint({ dist: 1.0 }))
  })
  it('changes when business data changes (qty/round/extra field)', () => {
    const base = { items: [{ id: 'p1', qty: 1 }], round: 'r1' }
    expect(payloadFingerprint(base)).not.toBe(payloadFingerprint({ ...base, round: 'r2' }))
    expect(payloadFingerprint(base)).not.toBe(payloadFingerprint({ items: [{ id: 'p1', qty: 2 }], round: 'r1' }))
    expect(payloadFingerprint(base)).not.toBe(payloadFingerprint({ items: [{ id: 'p1', qty: 1 }], round: 'r1', extra: null }))
  })
  it('preserves array order (business data — R1)', () => {
    expect(payloadFingerprint({ items: [1, 2] })).not.toBe(payloadFingerprint({ items: [2, 1] }))
  })
})

describe('SubmitKeyRing — retry-safe key reuse', () => {
  it('same payload ⇒ same key; edited payload ⇒ fresh key', () => {
    const ring = new SubmitKeyRing(null) // memory-only
    expect(ring.keyFor('fp-a')).toBe(ring.keyFor('fp-a'))
    expect(ring.keyFor('fp-a')).not.toBe(ring.keyFor('fp-b'))
  })
  it('release ⇒ next submit of the same payload is a NEW submission (new key)', () => {
    const ring = new SubmitKeyRing(null)
    const k1 = ring.keyFor('fp-a')
    ring.release('fp-a')
    expect(ring.keyFor('fp-a')).not.toBe(k1)
  })
  it('survives "reload" via shared storage (reload + resubmit cannot duplicate)', () => {
    const store = memoryStore()
    const before = new SubmitKeyRing(store)
    const key = before.keyFor('fp-reload')
    const after = new SubmitKeyRing(store) // fresh page instance
    expect(after.keyFor('fp-reload')).toBe(key)
  })
  it('clear() drops every pending payload key', () => {
    const ring = new SubmitKeyRing(null)
    const k = ring.keyFor('fp-x')
    ring.clear()
    expect(ring.keyFor('fp-x')).not.toBe(k)
  })
})

describe('idempotency error helpers — 124 codes to UI', () => {
  it('extracts the code from PostgREST-style or mock-style errors', () => {
    expect(extractIdempotencyErrorCode({ message: 'ERR_IDEMPOTENCY_CONFLICT', code: 'P0001' })).toBe('ERR_IDEMPOTENCY_CONFLICT')
    expect(extractIdempotencyErrorCode({ code: 'ERR_IDEMPOTENCY_KEY_INVALID', message: 'x' })).toBe('ERR_IDEMPOTENCY_KEY_INVALID')
    expect(extractIdempotencyErrorCode({ message: 'ERR_CUTOFF_PASSED', code: 'P0001' })).toBeNull()
    expect(extractIdempotencyErrorCode(null)).toBeNull()
  })
  it('knows the three codes and maps them to Thai UI copy', () => {
    expect(isIdempotencyErrorCode('ERR_IDEMPOTENCY_BAD_RESULT')).toBe(true)
    expect(isIdempotencyErrorCode('ERR_CUTOFF_PASSED')).toBe(false)
    expect(describeIdempotencyError('ERR_IDEMPOTENCY_CONFLICT')).toContain('ไม่มีการสร้างออเดอร์เพิ่ม')
    expect(describeIdempotencyError('ERR_IDEMPOTENCY_KEY_INVALID')).toContain('คีย์')
    expect(describeIdempotencyError('ERR_IDEMPOTENCY_BAD_RESULT')).toContain('ผิดรูปแบบ')
    expect(describeIdempotencyError('ERR_XYZ')).toContain('ERR_XYZ')
  })
})