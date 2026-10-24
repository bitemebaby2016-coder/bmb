// ============================================
// Bite Me Baby — 2026-10-24 (handoff task 4): delivery-schedule consolidation
// Owner approval: "1 รอบ = ความจุก้อนเดียว แยก 2 คอลัมน์คัทออฟ" + ป้าย
// "ปรับของเซมเดย์ / ปรับของพรีออเดอร์"
// Covers: client mirror (roundCutoffMs/Label/Bookability), pattern
// normalize+validate, admin UI labels, API write columns.
// Server side = e2e/contracts_145.sql (shared slot + override + >=2 rule).
// ============================================

import { describe, expect, it } from 'vitest'
import { roundBookability, roundCutoffLabel, roundCutoffMs } from '@/lib/deliveryRoundStatus'
import { normalizeRoundPattern, validateRoundPatternRow, ROUND_PATTERN_DEFAULTS } from '@/lib/orderPolicy'
import adminRoundsSrc from '@/pages/admin/AdminRounds.tsx?raw'
import roundsApiSrc from '@/lib/bmbAdminApi_rounds.ts?raw'

const H = 3_600_000

describe('roundCutoffMs — 145 two independent cutoffs (client mirror)', () => {
  it('SAME_DAY prefers same_day_cutoff, falls back to cutoff_time', () => {
    expect(roundCutoffMs({ cutoff_time: '10:30', same_day_cutoff: '12:00' }, 'SAME_DAY')).toBe(12 * H)
    expect(roundCutoffMs({ cutoff_time: '10:30', same_day_cutoff: null }, 'SAME_DAY')).toBe(10.5 * H)
    expect(roundCutoffMs({ cutoff_time: '10:30' }, 'SAME_DAY')).toBe(10.5 * H)
  })

  it('PRE_ORDER prefers pre_order_cutoff over the delivery_start − hours rule', () => {
    expect(roundCutoffMs({ pre_order_cutoff: '23:59', delivery_start: '11:00' }, 'PRE_ORDER', 2)).toBe(23 * H + 59 * 60_000)
    expect(roundCutoffMs({ delivery_start: '11:00' }, 'PRE_ORDER', 2)).toBe(9 * H)
    expect(roundCutoffMs({ delivery_start: '01:00' }, 'PRE_ORDER', 2)).toBe(-H)
    expect(roundCutoffMs({ pre_order_cutoff: '', delivery_start: '11:00' }, 'PRE_ORDER', 2)).toBe(9 * H)
  })

  it('roundCutoffLabel renders the override time verbatim', () => {
    expect(roundCutoffLabel({ pre_order_cutoff: '09:30', delivery_start: '11:00' }, 'PRE_ORDER', 2)).toBe('09:30')
    expect(roundCutoffLabel({ same_day_cutoff: '20:15', cutoff_time: '10:30' }, 'SAME_DAY')).toBe('20:15')
    expect(roundCutoffLabel({ delivery_start: '11:00' }, 'PRE_ORDER', 2)).toBe('09:00')
  })
})

describe('roundBookability — override flips the gate (mirror of server 145)', () => {
  it('PRE_ORDER open when pre_order_cutoff is later even though the rule already passed', () => {
    const status = roundBookability(
      { delivery_start: '11:00', pre_order_cutoff: '23:59', max_capacity: 10, current_count: 0 },
      { isToday: true, nowUtcMs: 12 * H, mode: 'PRE_ORDER', preOrderCutoffHours: 2 },
    )
    // rule would be 09:00 (passed at 12:00) — override 23:59 keeps it open
    expect(status).toBe('open')
  })

  it('SAME_DAY closes when same_day_cutoff passed even though cutoff_time is later', () => {
    const status = roundBookability(
      { cutoff_time: '23:59', same_day_cutoff: '00:00', max_capacity: 10, current_count: 0 },
      { isToday: true, nowUtcMs: 12 * H, mode: 'SAME_DAY' },
    )
    expect(status).toBe('cutoff_passed')
  })

  it('same-day keeps the legacy cutoff_time when no override column is set', () => {
    const open = roundBookability(
      { cutoff_time: '23:59', max_capacity: 10, current_count: 0 },
      { isToday: true, nowUtcMs: 12 * H, mode: 'SAME_DAY' },
    )
    expect(open).toBe('open')
  })
})

describe('order_pattern normalize/validate — new cutoff keys', () => {
  it('legacy rows (no new keys) backfill same_day_cutoff from cutoff_time + empty pre_order', () => {
    const rows = normalizeRoundPattern([{ round_key: 'midday', display_name: 'เที่ยง', cutoff_time: '10:30', delivery_start: '11:00', delivery_end: '14:00', max_capacity: 80 }])
    expect(rows[1].same_day_cutoff).toBe('10:30')
    expect(rows[1].pre_order_cutoff).toBe('')
  })

  it('missing rows fall back to defaults that keep same_day = cutoff_time', () => {
    const rows = normalizeRoundPattern([])
    for (const r of rows) {
      expect(r.same_day_cutoff).toBe(r.cutoff_time)
      expect(r.pre_order_cutoff).toBe('')
      expect(validateRoundPatternRow(r)).toBeNull()
    }
    expect(rows).toHaveLength(ROUND_PATTERN_DEFAULTS.length)
  })

  it('custom keys survive normalize; invalid times are rejected by validation', () => {
    const rows = normalizeRoundPattern([
      { round_key: 'evening', display_name: 'เย็น', cutoff_time: '16:00', same_day_cutoff: '18:00', pre_order_cutoff: '14:00', delivery_start: '17:00', delivery_end: '20:00', max_capacity: 100 },
    ])
    const evening = rows.find((r) => r.round_key === 'evening')!
    expect(evening.same_day_cutoff).toBe('18:00')
    expect(evening.pre_order_cutoff).toBe('14:00')
    expect(validateRoundPatternRow(evening)).toBeNull()
    // format guard ตาม convention เดิม (TIME_RE = 2-digit hour) — ไม่ใช่ range check
    expect(validateRoundPatternRow({ ...evening, pre_order_cutoff: '9:00' })).toBe('คัทออฟพรีออเดอร์ไม่ถูกต้อง')
    expect(validateRoundPatternRow({ ...evening, same_day_cutoff: '9x:00' })).toBe('คัทออฟเซมเดย์ไม่ถูกต้อง')
  })
})

describe('AdminRounds + rounds API source contract (Owner-labelled controls)', () => {
  it('pattern editor exposes exactly the two Owner labels', () => {
    expect(adminRoundsSrc).toContain('ปรับของเซมเดย์')
    expect(adminRoundsSrc).toContain('ปรับของพรีออเดอร์')
    expect(adminRoundsSrc).toContain('pattern-sameday-cutoff-')
    expect(adminRoundsSrc).toContain('pattern-preorder-cutoff-')
    expect(adminRoundsSrc).toContain('ปิดรับ เซมเดย์')
  })

  it('applyPatternToDay writes both cutoff columns (pre_order empty → NULL = ใช้กฎ)', () => {
    expect(roundsApiSrc).toContain('same_day_cutoff: `${p.same_day_cutoff || p.cutoff_time}:00`')
    expect(roundsApiSrc).toContain('pre_order_cutoff: p.pre_order_cutoff ? `${p.pre_order_cutoff}:00` : null')
  })
})