// ============================================
// deliveryRoundStatus — client DISPLAY mirror of the server round gates
// (Owner 2026-10-17 "รอบส่งมั่ว": rounds past cutoff/window must not look
// selectable on checkout; the server stays the authority at order time.)
// 148 (Owner 2026-10-24): SAME_DAY = ไม่มีคัทออฟ → เงื่อนไข cutoff ใช้กับ PRE_ORDER เท่านั้น
// ============================================

import { describe, it, expect } from 'vitest'
import { roundBookability, roundStatusLabel, roundCutoffLabel } from '@/lib/deliveryRoundStatus'

// Fixed instants (Bangkok = UTC+7):
// 2026-10-17 21:32 ICT = 2026-10-17T14:32Z · 2026-10-17 09:00 ICT = 2026-10-17T02:00Z
const NIGHT = Date.parse('2026-10-17T14:32:00Z')
const MORNING = Date.parse('2026-10-17T02:00:00Z')

const base = {
  cutoff_time: '10:30',
  delivery_start: '11:00',
  delivery_end: '14:00',
  current_count: 0,
  max_capacity: 80,
}

describe('roundCutoffLabel', () => {
  it('SAME_DAY = ไม่มีคัทออฟ (148 — Owner สั่งถอด)', () => {
    expect(roundCutoffLabel(base, 'SAME_DAY', 2)).toBe('ไม่มีคัทออฟ')
    expect(roundCutoffLabel({ cutoff_time: '23:59', delivery_start: '11:00' }, 'SAME_DAY')).toBe('ไม่มีคัทออฟ')
  })
  it('PRE_ORDER = delivery_start − cutoff_hours (11:00 − 2 = 09:00)', () => {
    expect(roundCutoffLabel(base, 'PRE_ORDER', 2)).toBe('09:00')
    expect(roundCutoffLabel(base, 'PRE_ORDER', 1)).toBe('10:00')
  })
})

// ---- 143 (Owner Q1 2026-10-24): คัทออฟพรีออเดอร์ = cutoff_hours ชม. ก่อนส่ง ----
describe('roundBookability — PRE_ORDER (คัทออฟก่อนส่ง 2 ชม.)', () => {
  it('วันนี้ 09:00 น. = ยังเปิด (ตรงคัทออฟ 09:00 พอดี — strict `>`)', () => {
    expect(roundBookability(base, { isToday: true, mode: 'PRE_ORDER', preOrderCutoffHours: 2, nowUtcMs: MORNING })).toBe('open')
  })

  it('วันนี้ 09:30 น. = cutoff_passed (เลยคัทออฟ 2 ชม. ก่อนรอบเที่ยงแล้ว — เคส Owner)', () => {
    const NINE_THIRTY = Date.parse('2026-10-17T02:30:00Z')
    expect(roundBookability(base, { isToday: true, mode: 'PRE_ORDER', preOrderCutoffHours: 2, nowUtcMs: NINE_THIRTY })).toBe('cutoff_passed')
  })

  it('SAME_DAY ตอน 09:30 น. = ยัง open (เลย cutoff_time 10:30 หรือไม่ก็ตาม — 148 ไม่มีคัทออฟเซมเดย์)', () => {
    const NINE_THIRTY = Date.parse('2026-10-17T02:30:00Z')
    expect(roundBookability(base, { isToday: true, mode: 'SAME_DAY', nowUtcMs: NINE_THIRTY })).toBe('open')
  })

  it('cutoff_hours ตั้งได้: 1 ชม. = คัทออฟ 10:00 (09:30 ยังเปิด)', () => {
    const NINE_THIRTY = Date.parse('2026-10-17T02:30:00Z')
    expect(roundBookability(base, { isToday: true, mode: 'PRE_ORDER', preOrderCutoffHours: 1, nowUtcMs: NINE_THIRTY })).toBe('open')
    expect(roundBookability(base, { isToday: true, mode: 'PRE_ORDER', preOrderCutoffHours: 1, nowUtcMs: NIGHT })).toBe('cutoff_passed')
  })

  it('วันถัดไป (isToday=false) = open เสมอ (คัทออฟอยู่บนวันส่ง)', () => {
    expect(roundBookability(base, { isToday: false, mode: 'PRE_ORDER', preOrderCutoffHours: 2, nowUtcMs: NIGHT })).toBe('open')
  })
})

describe('roundBookability', () => {
  it('ก่อน cutoff ของวันนี้ = open', () => {
    expect(roundBookability(base, { isToday: true, nowUtcMs: MORNING })).toBe('open')
  })

  it('พ้น cutoff เดิมของวันนี้ = ยัง open (148: SAME_DAY ไม่มีคัทออฟ — mirror ของ server)', () => {
    const AFTER_OLD_CUTOFF = Date.parse('2026-10-17T05:00:00Z') // 12:00 ICT — เลย cutoff_time 10:30 แล้ว แต่หน้าต่างส่ง (14:00) ยังไม่จบ
    expect(roundBookability(base, { isToday: true, nowUtcMs: AFTER_OLD_CUTOFF })).toBe('open')
    // เลยหน้าต่างส่งแล้ว = window_passed (ป้ายบอกเหตุจริง — ไม่ใช่ cutoff)
    expect(roundBookability(base, { isToday: true, nowUtcMs: NIGHT })).toBe('window_passed')
  })

  it('PRE_ORDER พ้น cutoff วันนี้ = cutoff_passed (ยังบังคับเหมือนเดิม)', () => {
    expect(roundBookability(base, { isToday: true, mode: 'PRE_ORDER', preOrderCutoffHours: 2, nowUtcMs: NIGHT })).toBe('cutoff_passed')
  })

  it('รอบถัดไป (isToday=false) = open เสมอ แม้เวลาในวันจะพ้นแล้ว', () => {
    expect(roundBookability(base, { isToday: false, nowUtcMs: NIGHT })).toBe('open')
  })

  it('เคสรอบทั้งวัน "ส่ง 08:00-20:00 · สั่งได้ถึง 23:59" ตอน 21:32 = window_passed', () => {
    const allDay = { cutoff_time: '23:59', delivery_start: '08:00', delivery_end: '20:00', current_count: 3, max_capacity: 100 }
    expect(roundBookability(allDay, { isToday: true, nowUtcMs: NIGHT })).toBe('window_passed')
  })

  it('เต็มความจุ = full (มาก่อนเรื่องเวลา)', () => {
    const full = { ...base, current_count: 80, max_capacity: 80 }
    expect(roundBookability(full, { isToday: true, nowUtcMs: MORNING })).toBe('full')
    expect(roundBookability(full, { isToday: false, nowUtcMs: MORNING })).toBe('full')
  })

  it('เวลาหาย/ผิดรูปแบบ = ไม่บล็อกเอง (server ตัดสินตอนสั่ง)', () => {
    expect(roundBookability({}, { isToday: true, nowUtcMs: NIGHT })).toBe('open')
    expect(roundBookability({ cutoff_time: '99:99', delivery_end: 'xx' }, { isToday: true, nowUtcMs: NIGHT })).toBe('open')
    // เคส regression: แถว mock/เดิมที่ไม่มี delivery_start/end เลย ต้องไม่โดนตีเป็น window_passed
    expect(roundBookability({ cutoff_time: '23:59', current_count: 0, max_capacity: 99 }, { isToday: true, nowUtcMs: NIGHT })).toBe('open')
  })

  it('current_count/max_capacity ไม่ใช่ตัวเลข = ไม่บล็อก', () => {
    expect(roundBookability({ ...base, current_count: null, max_capacity: undefined }, { isToday: true, nowUtcMs: MORNING })).toBe('open')
  })

  it('เวลาตรง cutoff เป๊ะ = ยัง open (กฎ strict > เหมือน server)', () => {
    const atCutoff = Date.parse('2026-10-17T03:30:00Z') // 10:30 ICT
    expect(roundBookability(base, { isToday: true, nowUtcMs: atCutoff })).toBe('open')
  })
})

describe('roundStatusLabel', () => {
  it('มีป้ายไทยครบทุกสถานะ', () => {
    expect(roundStatusLabel('open')).toBe('เปิดรับ')
    expect(roundStatusLabel('cutoff_passed')).toBe('ปิดรับแล้ว')
    expect(roundStatusLabel('window_passed')).toBe('หมดเวลาจัดส่งแล้ว')
    expect(roundStatusLabel('full')).toBe('เต็มแล้ว')
  })
})
