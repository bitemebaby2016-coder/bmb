// ============================================
// deliveryRoundStatus — client DISPLAY mirror of the server round gates
// (Owner 2026-10-17 "รอบส่งมั่ว": rounds past cutoff/window must not look
// selectable on checkout; the server stays the authority at order time.)
// ============================================

import { describe, it, expect } from 'vitest'
import { roundBookability, roundStatusLabel } from '@/lib/deliveryRoundStatus'

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

describe('roundBookability', () => {
  it('ก่อน cutoff ของวันนี้ = open', () => {
    expect(roundBookability(base, { isToday: true, nowUtcMs: MORNING })).toBe('open')
  })

  it('พ้น cutoff วันนี้ = cutoff_passed (มิเรอร์ ERR_CUTOFF_PASSED)', () => {
    expect(roundBookability(base, { isToday: true, nowUtcMs: NIGHT })).toBe('cutoff_passed')
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
