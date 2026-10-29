// ============================================
// Bite Me Baby — hostname resolver tests (Task 2)
// ============================================
import { describe, it, expect } from 'vitest'
import { normalizeHostname, canonicalHostTenant, DEFAULT_TENANT_ID } from '@/lib/hostnameTenant'

describe('normalizeHostname', () => {
  it('lower + ตัด port + ตัด www.', () => {
    expect(normalizeHostname('WWW.Biteme-Baby.com:443')).toBe('biteme-baby.com')
    expect(normalizeHostname(' order.bakerybrand.com ')).toBe('order.bakerybrand.com')
    expect(normalizeHostname(null)).toBe('')
    expect(normalizeHostname(undefined)).toBe('')
  })
})

describe('canonicalHostTenant — pure รู้ทันทีไม่ต้อง query', () => {
  it('โดเมนหลัก BMB = default tenant (ไม่ต้องพึ่ง m175)', () => {
    expect(canonicalHostTenant('biteme-baby.com')).toBe(DEFAULT_TENANT_ID)
    expect(canonicalHostTenant('https://www.biteme-baby.com:443')).toBe(DEFAULT_TENANT_ID)
    expect(canonicalHostTenant('localhost:3000')).toBe(DEFAULT_TENANT_ID)
  })

  it('โดเมนอื่น/ว่าง = null (ให้ไป lookup DB — ห้ามเดา)', () => {
    expect(canonicalHostTenant('order.bakerybrand.com')).toBeNull()
    expect(canonicalHostTenant('')).toBeNull()
    expect(canonicalHostTenant(null)).toBeNull()
  })
})