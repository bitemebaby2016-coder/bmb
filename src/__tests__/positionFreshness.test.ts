// ============================================
// Bite Me Baby — R46 (Owner 2026-11-17): positionFreshness — ตำแหน่งเก่าต้องถูกระบุ
// ============================================
// บั๊กจริง: พิกัดไรเดอร์ค้างใน DB (heartbeat เขียนเฉพาะตอนหน้า /rider เปิดค้าง)
// โชว์บนแผนที่ราวกับ live ทั้งที่เก่า — ทุกจุดต้องบอกอายุของตัวเอง
import { describe, it, expect } from 'vitest'
import { positionAgeInfo, POSITION_STALE_MIN } from '../lib/positionFreshness'

const NOW = new Date('2026-11-17T16:00:00+07:00')

describe('R46 — positionFreshness (ตำแหน่งเก่าต้องถูกระบุ ไม่อวด live)', () => {
  it('เกณฑ์ stale = POSITION_STALE_MIN นาที (10)', () => {
    expect(POSITION_STALE_MIN).toBe(10)
  })

  it('updated_at 1 นาทีที่ผ่านมา = สด (stale=false) + label "ล่าสุด HH:MM"', () => {
    const t = new Date(NOW.getTime() - 60_000).toISOString()
    const info = positionAgeInfo(t, NOW)
    expect(info.stale).toBe(false)
    expect(info.known).toBe(true)
    expect(info.ageMin).toBe(1)
    expect(info.label).toMatch(/^ล่าสุด \d{2}:\d{2}$/)
  })

  it('updated_at 15 นาทีที่ผ่านมา = เก่า (stale=true) + label บอก "ตำแหน่งเก่า"', () => {
    const t = new Date(NOW.getTime() - 15 * 60_000).toISOString()
    const info = positionAgeInfo(t, NOW)
    expect(info.stale).toBe(true)
    expect(info.ageMin).toBe(15)
    expect(info.label).toMatch(/^ตำแหน่งเก่า \(ล่าสุด \d{2}:\d{2}\)$/)
  })

  it('ขอบเขต 10 นาทีพอดี = เก่า (>= เกณฑ์)', () => {
    const t = new Date(NOW.getTime() - POSITION_STALE_MIN * 60_000).toISOString()
    expect(positionAgeInfo(t, NOW).stale).toBe(true)
    const t9 = new Date(NOW.getTime() - 9 * 60_000).toISOString()
    expect(positionAgeInfo(t9, NOW).stale).toBe(false)
  })

  it('ไม่มี updated_at / เวลาเสีย = ถือว่าเก่า (ห้ามอวดว่า live) + known=false', () => {
    expect(positionAgeInfo(null, NOW).stale).toBe(true)
    expect(positionAgeInfo(null, NOW).known).toBe(false)
    expect(positionAgeInfo(undefined, NOW).stale).toBe(true)
    expect(positionAgeInfo('not-a-date', NOW).stale).toBe(true)
    expect(positionAgeInfo('not-a-date', NOW).known).toBe(false)
  })

  it('timestamp อนาคต (นาฬิกาเครื่องเพี้ยน) = ageMin หนีบเป็น 0 ไม่ติดลบ', () => {
    const t = new Date(NOW.getTime() + 5 * 60_000).toISOString()
    expect(positionAgeInfo(t, NOW).ageMin).toBe(0)
  })
})
