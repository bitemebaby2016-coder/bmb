// ============================================
// ROUND-14 / P0-1 — SAME_DAY = เปิด–ปิดไม่มีคัทออฟ (Owner 2026-10-24)
// แทน roundsTwoCutoffs.test.ts (ถูกรื้อตามคำสั่ง: "คัทออฟมีเฉพาะ PRE_ORDER เท่านั้น")
//
// สิ่งที่ชุดนี้ป้องกันการย้อนกลับ:
//   1. client mirror ห้ามมีคัทออฟเซมเดย์ (roundCutoffMs = null เสมอ)
//   2. แบบฟอร์ม/การซ่อมรอบห้ามเขียน/อ่านคีย์ same_day_cutoff
//   3. PRE_ORDER ต้องยังมีทั้ง override + fallback (ของจริง ห้ามโดนถอดไปด้วย)
//   4. บรรทัด source ใน bmbAdminApi_rounds / AdminRounds ต้องไม่มีคำว่า same_day_cutoff
// ============================================

import { describe, it, expect } from 'vitest'
import { roundBookability, roundCutoffLabel, roundCutoffMs } from '@/lib/deliveryRoundStatus'
import { normalizeRoundPattern, validateRoundPatternRow, ROUND_PATTERN_DEFAULTS, type RoundPatternRow } from '@/lib/orderPolicy'
import roundsApiSrc from '../lib/bmbAdminApi_rounds.ts?raw'
import orderPolicySrc from '../lib/orderPolicy.ts?raw'
import adminRoundsSrc from '../pages/admin/AdminRounds.tsx?raw'

const H = 3_600_000
// 2026-10-17 21:32 ICT = 2026-10-17T14:32Z
const NIGHT = Date.parse('2026-10-17T14:32:00Z')

describe('roundCutoffMs — SAME_DAY ไม่มีคัทออฟ (148)', () => {
  it('SAME_DAY คืน null เสมอ ไม่ว่า cutoff_time จะเป็นอะไร', () => {
    expect(roundCutoffMs({ cutoff_time: '10:30' }, 'SAME_DAY')).toBeNull()
    expect(roundCutoffMs({ cutoff_time: '23:59', delivery_start: '11:00' }, 'SAME_DAY')).toBeNull()
    expect(roundCutoffMs({}, 'SAME_DAY')).toBeNull()
  })

  it('PRE_ORDER ยังคง override (pre_order_cutoff) + fallback (delivery_start − hours)', () => {
    expect(roundCutoffMs({ pre_order_cutoff: '23:59', delivery_start: '11:00' }, 'PRE_ORDER', 2)).toBe(23 * H + 59 * 60_000)
    expect(roundCutoffMs({ delivery_start: '11:00' }, 'PRE_ORDER', 2)).toBe(9 * H)
    expect(roundCutoffMs({ delivery_start: '01:00' }, 'PRE_ORDER', 2)).toBe(-H)
    expect(roundCutoffMs({ pre_order_cutoff: '', delivery_start: '11:00' }, 'PRE_ORDER', 2)).toBe(9 * H)
  })

  it('roundCutoffLabel: SAME_DAY = ข้อความ "ไม่มีคัทออฟ" · PRE_ORDER = เวลาจริง', () => {
    expect(roundCutoffLabel({ cutoff_time: '10:30' }, 'SAME_DAY')).toBe('ไม่มีคัทออฟ')
    expect(roundCutoffLabel({ pre_order_cutoff: '09:30', delivery_start: '11:00' }, 'PRE_ORDER', 2)).toBe('09:30')
    expect(roundCutoffLabel({ delivery_start: '11:00' }, 'PRE_ORDER', 2)).toBe('09:00')
  })
})

describe('roundBookability — mirror ของ server 148', () => {
  it('SAME_DAY เลย cutoff_time เดิมไปแล้ว = ยัง open (ไม่มี cutoff_passed — 148)', () => {
    const status = roundBookability(
      {
        cutoff_time: '23:59', delivery_start: '17:00', delivery_end: '23:59',
        max_capacity: 10, current_count: 0,
      },
      { isToday: true, nowUtcMs: NIGHT, mode: 'SAME_DAY' },
    )
    expect(status).toBe('open')
    expect(status).not.toBe('cutoff_passed')
  })

  it('SAME_DAY หน้าต่างส่งจบแล้ว = window_passed (ไม่ใช่ cutoff — ป้ายบอกเหตุจริง)', () => {
    expect(
      roundBookability(
        { cutoff_time: '23:59', delivery_start: '17:00', delivery_end: '20:00', max_capacity: 10, current_count: 0 },
        { isToday: true, nowUtcMs: NIGHT, mode: 'SAME_DAY' },
      ),
    ).toBe('window_passed')
  })

  it('PRE_ORDER ยังได้ cutoff_passed เมื่อเลยคัทออฟ (ของจริงห้ามอ่อน)', () => {
    const status = roundBookability(
      { delivery_start: '18:00', delivery_end: '20:00', max_capacity: 10, current_count: 0 },
      { isToday: true, nowUtcMs: NIGHT, mode: 'PRE_ORDER', preOrderCutoffHours: 2 },
    )
    expect(status).toBe('cutoff_passed')
  })

  it('ความจุเต็มยังมาก่อนเรื่องเวลาทั้งสองโหมด', () => {
    const full = { cutoff_time: '23:59', delivery_end: '20:00', max_capacity: 10, current_count: 10 }
    expect(roundBookability(full, { isToday: true, nowUtcMs: NIGHT, mode: 'SAME_DAY' })).toBe('full')
    expect(roundBookability(full, { isToday: true, nowUtcMs: NIGHT, mode: 'PRE_ORDER', preOrderCutoffHours: 2 })).toBe('full')
  })
})

describe('round pattern — คีย์ same_day_cutoff ถูกถอด (148d)', () => {
  it('normalizeRoundPattern ไม่เอาคีย์ same_day_cutoff เก่าจาก DB เข้ามา', () => {
    const rows = normalizeRoundPattern([
      { round_key: 'midday', display_name: 'เที่ยง', cutoff_time: '10:30', same_day_cutoff: '12:00', pre_order_cutoff: '09:00', delivery_start: '11:00', delivery_end: '14:00', max_capacity: 80 },
      { round_key: 'morning' },
    ])
    expect(rows).toHaveLength(3)
    for (const r of rows) expect(Object.keys(r)).not.toContain('same_day_cutoff')
    expect(rows[1].pre_order_cutoff).toBe('09:00')
    expect(rows[0].pre_order_cutoff).toBe('')
  })

  it('ค่า default ไม่มีฟิลด์ same_day_cutoff', () => {
    for (const r of ROUND_PATTERN_DEFAULTS) expect(Object.keys(r)).not.toContain('same_day_cutoff')
  })

  it('validateRoundPatternRow: ยังเช็ค cutoff_time/pre_order_cutoff แต่ไม่มีการเช็คเซมเดย์', () => {
    const good: RoundPatternRow = { round_key: 'evening', display_name: 'เย็น', cutoff_time: '16:00', pre_order_cutoff: '14:00', delivery_start: '17:00', delivery_end: '20:00', max_capacity: 100 }
    expect(validateRoundPatternRow(good)).toBeNull()
    expect(validateRoundPatternRow({ ...good, pre_order_cutoff: '9:00' })).toBe('คัทออฟพรีออเดอร์ไม่ถูกต้อง')
    expect(validateRoundPatternRow({ ...good, cutoff_time: '9x:00' })).toBe('เวลาปิดรับเดิม (cutoff_time) ไม่ถูกต้อง')
    // คีย์เอ็กซ์ตรา/เน่าจาก DB ไม่ทำให้ validation พัง
    expect(validateRoundPatternRow({ ...good, same_day_cutoff: '9x:00' } as RoundPatternRow)).toBeNull()
  })
})

describe('source guards — ห้ามมี same_day_cutoff ในสายแอดมิน/แบบฟอร์ม', () => {
  it('bmbAdminApi_rounds.ts ไม่มีคำว่า same_day_cutoff เหลือ', () => {
    expect(roundsApiSrc).not.toContain('same_day_cutoff')
    expect(roundsApiSrc).toContain("pre_order_cutoff: p.pre_order_cutoff ? `${p.pre_order_cutoff}:00` : null")
  })

  it('orderPolicy.ts ไม่มีคำว่า same_day_cutoff เหลือ', () => {
    expect(orderPolicySrc).not.toContain('same_day_cutoff')
  })

  it('AdminRounds.tsx ไม่มีช่อง input pattern-sameday-cutoff แล้ว', () => {
    expect(adminRoundsSrc).not.toContain('pattern-sameday-cutoff')
    expect(adminRoundsSrc).not.toContain('same_day_cutoff')
    expect(adminRoundsSrc).toContain('data-testid={`pattern-cutoff-${p.round_key}`}')
  })
})