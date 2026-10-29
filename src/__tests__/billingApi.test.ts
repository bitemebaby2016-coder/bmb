// ============================================
// Bite Me Baby — Billing tests (Task 2 · pure parts)
// ============================================
import { describe, it, expect } from 'vitest'
import { daysUntilDue, billingStatusBadge } from '@/lib/billingApi'

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.parse('2026-11-01T00:00:00Z')

describe('daysUntilDue — วันคงเหลือถึงงวดบริการ', () => {
  it('นับวันถึงงวด (ปัดลง)', () => {
    expect(daysUntilDue('2026-11-06T00:00:00Z', NOW)).toBe(5)
  })

  it('เกินงวดแล้ว = ติดลบ (ไม่ปิดบัง)', () => {
    expect(daysUntilDue('2026-10-30T00:00:00Z', NOW)).toBe(-2)
  })

  it('วันที่เพี้ยน/ว่าง = null (ไม่เดา)', () => {
    expect(daysUntilDue(null, NOW)).toBeNull()
    expect(daysUntilDue('', NOW)).toBeNull()
    expect(daysUntilDue('not-a-date', NOW)).toBeNull()
  })
})

describe('billingStatusBadge — ป้ายสถานะไทย', () => {
  it('ครบทุก status ที่ schema อนุญาต', () => {
    expect(billingStatusBadge('active').label).toBe('ใช้งานอยู่')
    expect(billingStatusBadge('past_due').cls).toBe('badge-danger')
    expect(billingStatusBadge('canceled').label).toBe('ยกเลิกแล้ว')
  })
})