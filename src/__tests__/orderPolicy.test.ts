// ============================================
// orderPolicy — typed admin-editable policy + round pattern (Owner 2026-10-24)
// ============================================
// WHY: ค่า policy ต้องตั้งจากฝั่งแอดมินได้โดยไม่พัง — เคสจริง production:
// pre_order_lead_days = "มี7" (พิมพ์ใน JSON ดิบ) -> server cast 22P02 ทุกพรีออเดอร์

import { describe, it, expect } from 'vitest'
import {
  ORDER_POLICY_DEFAULTS,
  normalizeOrderPolicy,
  validateOrderPolicy,
  normalizeRoundPattern,
  validateRoundPatternRow,
  ROUND_PATTERN_DEFAULTS,
} from '@/lib/orderPolicy'

describe('normalizeOrderPolicy', () => {
  it('ค่าพัง "มี7" (เคส production จริง) -> ใช้ default ไม่ crash', () => {
    const p = normalizeOrderPolicy({ pre_order_lead_days: 'มี7', cutoff_hours: 2 })
    expect(p.pre_order_lead_days).toBe(ORDER_POLICY_DEFAULTS.pre_order_lead_days)
    expect(p.cutoff_hours).toBe(2)
  })

  it('ค่าตัวเลขปกติคงไว้ + ค่าขาดหายใช้ default', () => {
    const p = normalizeOrderPolicy({ cutoff_hours: 0.5, daily_quota: 250 })
    expect(p.cutoff_hours).toBe(0.5)
    expect(p.daily_quota).toBe(250)
    expect(p.max_items_per_order).toBe(ORDER_POLICY_DEFAULTS.max_items_per_order)
  })

  it('ค่าเกินช่วง (cutoff_hours = 999) -> default', () => {
    const p = normalizeOrderPolicy({ cutoff_hours: 999 })
    expect(p.cutoff_hours).toBe(ORDER_POLICY_DEFAULTS.cutoff_hours)
  })
})

describe('validateOrderPolicy', () => {
  it('ค่าปกติ = null (ผ่าน)', () => {
    expect(validateOrderPolicy(normalizeOrderPolicy({}))).toBeNull()
  })
  it('NaN = error (กันพิมพ์ผิด)', () => {
    expect(validateOrderPolicy({ ...ORDER_POLICY_DEFAULTS, cutoff_hours: NaN })).toBeTruthy()
  })
})

describe('normalizeRoundPattern', () => {
  it('ขาดคีย์ -> เติม default ครบ 3 รอบ (morning/midday/evening)', () => {
    const rows = normalizeRoundPattern([{ round_key: 'midday', display_name: 'X', cutoff_time: '09:00', delivery_start: '12:00', delivery_end: '15:00', max_capacity: 5 }])
    expect(rows).toHaveLength(3)
    expect(rows[1].display_name).toBe('X')
    expect(rows[0].max_capacity).toBe(ROUND_PATTERN_DEFAULTS[0].max_capacity)
    expect(rows[2].round_key).toBe('evening')
  })

  it('raw พัง (ไม่ใช่ array) -> default ทั้งชุด', () => {
    const rows = normalizeRoundPattern('garbage')
    expect(rows).toHaveLength(3)
    expect(rows[0].delivery_start).toBe(ROUND_PATTERN_DEFAULTS[0].delivery_start)
  })
})

describe('validateRoundPatternRow', () => {
  it('แถวปกติ = null (ผ่าน)', () => {
    expect(validateRoundPatternRow(ROUND_PATTERN_DEFAULTS[0])).toBeNull()
  })
  it('เวลาพัง/ความจุ 0 = error', () => {
    expect(validateRoundPatternRow({ ...ROUND_PATTERN_DEFAULTS[0], cutoff_time: 'xx' })).toBeTruthy()
    expect(validateRoundPatternRow({ ...ROUND_PATTERN_DEFAULTS[0], delivery_start: '' })).toBeTruthy()
    expect(validateRoundPatternRow({ ...ROUND_PATTERN_DEFAULTS[0], max_capacity: 0 })).toBeTruthy()
    expect(validateRoundPatternRow({ ...ROUND_PATTERN_DEFAULTS[0], display_name: '  ' })).toBeTruthy()
  })
})