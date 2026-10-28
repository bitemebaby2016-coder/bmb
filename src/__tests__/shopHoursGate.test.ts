// Owner 2026-10-26: "จะห้าทุ่มยังสั่งเซมเดย์ได้ ทั้งที่ร้านตั้งปิดไว้สองทุ่ม
// = ไม่ได้ซิงค์ค่าที่แอดมินตั้ง" — เกณฑ์: hours/operating_hours ต้องบังคับจริง
// ทุกจุด (status bar + round picker + submit gate + server trigger 160)
import { describe, it, expect } from 'vitest'
import { roundBookability, roundStatusLabel } from '@/lib/deliveryRoundStatus'
import { withinShopHours, parseHHMM, hoursToMs } from '@/lib/shopHoursLogic'
import { getStoreStatusFromRounds } from '@/lib/homeProviders'

const H8_20 = { openMs: 8 * 3_600_000, closeMs: 20 * 3_600_000 }
/** ms-of-day Bangkok ของ ISO ที่ระบุ +07:00 */
const bkkMs = (iso: string): number => Date.parse(iso) - Date.parse(iso.slice(0, 10) + 'T00:00:00+07:00')
const NIGHT = bkkMs('2026-10-26T22:55:00+07:00') // 22:55 — เคสจริงของ Owner
const NOON = bkkMs('2026-10-26T12:00:00+07:00')
const base = { delivery_start: '07:00', delivery_end: '09:00', max_capacity: 10, current_count: 0, round_key: 'morning' }

describe('shopHoursLogic (pure)', () => {
  it("parseHHMM: '8:00' และ '20:00:00' → ms-of-day · ค่าว่าง/เพี้ยน = null", () => {
    expect(parseHHMM('8:00')).toBe(8 * 3_600_000)
    expect(parseHHMM('20:00:00')).toBe(20 * 3_600_000)
    expect(parseHHMM('')).toBeNull()
    expect(parseHHMM('xx:99')).toBeNull()
  })
  it('within 8:00–20:00: 22:55 = ปิด · 12:00 = เปิด · 20:00 เต็ม = ปิด (bound ปิดไม่รวม)', () => {
    expect(withinShopHours(NIGHT, H8_20)).toBe(false)
    expect(withinShopHours(NOON, H8_20)).toBe(true)
    expect(withinShopHours(20 * 3_600_000, H8_20)).toBe(false)
    expect(withinShopHours(8 * 3_600_000, H8_20)).toBe(true)
    expect(withinShopHours(7 * 3_600_000 + 59 * 60_000, H8_20)).toBe(false)
  })
  it('ไม่มีข้อมูลเวลา = ห้ามเดาปิด (ZERO-FAKE)', () => {
    expect(withinShopHours(NIGHT, null)).toBe(true)
    expect(withinShopHours(null, H8_20)).toBe(true)
  })
  it('ข้ามเที่ยงคืน (เปิด 22:00 ปิด 02:00)', () => {
    const hm = { openMs: 22 * 3_600_000, closeMs: 2 * 3_600_000 }
    expect(withinShopHours(23 * 3_600_000, hm)).toBe(true)
    expect(withinShopHours(1 * 3_600_000, hm)).toBe(true)
    expect(withinShopHours(12 * 3_600_000, hm)).toBe(false)
  })
  it('hoursToMs ค่าไม่ครบ = null', () => {
    expect(hoursToMs({ open: '', close: '20:00' })).toBeNull()
    expect(hoursToMs(null)).toBeNull()
  })
})

describe('roundBookability — sync กับค่าแอดมิน', () => {
  it('เซมเดย์ 22:55 (ปิด 20:00) → shop_closed (เคสจริงของ Owner)', () => {
    expect(roundBookability(base, { isToday: true, mode: 'SAME_DAY', nowUtcMs: NIGHT, shopHoursMs: H8_20 })).toBe('shop_closed')
  })
  it('ในเวลาเปิดร้าน → open (148: SAME_DAY ไม่มีปิดรอบ)', () => {
    expect(roundBookability(base, { isToday: true, mode: 'SAME_DAY', nowUtcMs: NOON, shopHoursMs: H8_20 })).toBe('open')
  })
  it('ไม่ส่ง hours = ไม่เปลี่ยนพฤติกรรมเดิม (zero-fake)', () => {
    expect(roundBookability(base, { isToday: true, mode: 'SAME_DAY', nowUtcMs: NIGHT })).toBe('open')
  })
  it('operating_hours.same_day_open=false → shop_closed', () => {
    expect(roundBookability(base, { isToday: true, mode: 'SAME_DAY', nowUtcMs: NOON, operatingHours: { same_day_open: false } })).toBe('shop_closed')
  })
  it('round_key toggle ปิดเฉพาะรอบ (morning_open=false) — รอบอื่นไม่โดน', () => {
    expect(roundBookability(base, { isToday: true, mode: 'SAME_DAY', nowUtcMs: NOON, operatingHours: { morning_open: false } })).toBe('shop_closed')
    expect(roundBookability({ ...base, round_key: 'midday' }, { isToday: true, mode: 'SAME_DAY', nowUtcMs: NOON, operatingHours: { morning_open: false } })).toBe('open')
  })
  it('pre_order_open=false บล็อกเฉพาะ PRE_ORDER', () => {
    expect(roundBookability(base, { isToday: false, mode: 'PRE_ORDER', nowUtcMs: NIGHT, operatingHours: { pre_order_open: false } })).toBe('shop_closed')
    expect(roundBookability(base, { isToday: true, mode: 'SAME_DAY', nowUtcMs: NOON, operatingHours: { pre_order_open: false } })).toBe('open')
  })
  it('พรีออเดอร์วันถัดไปไม่ถูกเวลาเปิดร้านของวันนี้บล็อก', () => {
    expect(roundBookability({ ...base, pre_order_cutoff: '05:00' }, { isToday: false, mode: 'PRE_ORDER', nowUtcMs: NIGHT, shopHoursMs: H8_20 })).toBe('open')
  })
  it('ป้ายสถานะใหม่', () => {
    expect(roundStatusLabel('shop_closed')).toBe('ปิดในการตั้งค่าร้าน')
  })
})
// __PART2__
describe('getStoreStatusFromRounds — แถบสถานะซิงค์ hours', () => {
  const todayRound = [{
    status: 'active', display_name: 'เช้า', delivery_start: '07:00:00', delivery_end: '09:00:00',
    scheduled_date: '2026-10-26', round_key: 'morning', max_capacity: 10, current_count: 0,
  }]
  it('22:55 + ปิด 20:00 → ห้ามโชว์เซมเดย์ "ยังสั่งได้"', () => {
    const s = getStoreStatusFromRounds(todayRound, new Date('2026-10-26T22:55:00+07:00'), {
      shopHoursMs: H8_20, hoursClose: '20:00',
    })
    expect(s.message).not.toContain('ยังสั่งได้')
    expect(s.isOpen).toBe(false) // ไม่มีรอบอนาคตใน fixture → closed
  })
  it('มีรอบพรุ่งนี้ → preorder_only (รอบวันนี้ปิดจริงตามเวลา) ไม่ใช่สายเซมเดย์', () => {
    const rows = [...todayRound, {
      status: 'active', display_name: 'เช้า', delivery_start: '07:00:00', delivery_end: '09:00:00',
      scheduled_date: '2026-10-27', round_key: 'morning', max_capacity: 10, current_count: 0,
    }]
    const s = getStoreStatusFromRounds(rows, new Date('2026-10-26T22:55:00+07:00'), {
      shopHoursMs: H8_20, hoursClose: '20:00',
    })
    expect(s.state).toBe('preorder_only')
    expect(s.message).not.toContain('ยังสั่งได้')
    expect(s.message).toContain('จองล่วงหน้า')
  })
  it('ในเวลาเปิด + hoursClose → โชว์เวลาปิดจริง + ตัด :ss ของหน้าต่างส่ง', () => {
    const s = getStoreStatusFromRounds(todayRound, new Date('2026-10-26T08:00:00+07:00'), {
      shopHoursMs: H8_20, hoursClose: '20:00',
    })
    expect(s.isOpen).toBe(true)
    expect(s.hoursClose).toBe('20:00')
    // R10 (Owner 2026-10-27 "ส่ง 11:00–15:00 ไม่ต้องแสดง"): หน้าต่างส่ง (ที่เคยตัด :ss) ถูกถอดออกแล้ว
    expect(s.deliveryWindowLabel).toBeUndefined()
  })
  it('ไม่ส่ง opts = พฤติกรรมเดิม (test อื่นที่ไม่เกี่ยวเวลาคงเขียว)', () => {
    const s = getStoreStatusFromRounds(todayRound, new Date('2026-10-26T22:55:00+07:00'))
    expect(s.isOpen).toBe(true)
  })
})
