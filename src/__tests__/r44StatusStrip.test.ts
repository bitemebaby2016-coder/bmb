// ============================================
// Bite Me Baby — R44/N1 tests (Owner 2026-11-01 Strip copy รอบ 3): แถบสถานะหน้าแรก 3 บรรทัด
//   1) ไฟสถานะเปิด-ปิด แจ้งทั้ง Pre-Order และ Same-Day ในบรรทัดเดียว (ไอคอนหลังคำไทย)
//   2) 🛵 จองล่วงหน้า/📅Pre-Order : รอบส่ง <เวลาออกส่ง 7.00 AM> <ชื่อรอบ> <วัน> (ปิดรับ …) — label ใน strip · body ใน provider
//   3) 🛵 ส่งวันนี้/⚡Same-Day : จัดส่งทันทีหลังครัวปรุงเสร็จ (ไม่ผูกรอบส่งใด ๆ · ไม่มีวงเล็บ) · ปิดรับแล้ว
// ============================================

import { describe, it, expect } from 'vitest'
import { getStoreStatusFromRounds } from '@/lib/homeProviders'
import { DEFAULT_STORE_STATUS_COPY } from '@/lib/storeStatusCopy'
import stripSrc from '../components/home/StoreStatusStrip.tsx?raw'

const TODAY = '2026-11-01'
const TOMORROW = '2026-11-02'
const atIctl = (d: string, hhmm: string) => new Date(Date.parse(`${d}T${hhmm}:00+07:00`))

const todayRounds = [
  { id: 'r1', status: 'active', display_name: 'เช้า', delivery_start: '06:00', delivery_end: '09:00', cutoff_time: '08:00', max_capacity: 60, current_count: 0, scheduled_date: TODAY },
  { id: 'r2', status: 'active', display_name: 'เที่ยง', delivery_start: '11:00', delivery_end: '14:00', cutoff_time: '10:30', max_capacity: 80, current_count: 0, scheduled_date: TODAY },
  { id: 'r3', status: 'active', display_name: 'เย็น', delivery_start: '17:00', delivery_end: '20:00', cutoff_time: '16:00', max_capacity: 100, current_count: 0, scheduled_date: TODAY },
]
const tomorrowRound = {
  id: 'r4', status: 'active', display_name: 'เที่ยง', delivery_start: '11:00', delivery_end: '14:00',
  cutoff_time: '10:30', max_capacity: 80, current_count: 0, scheduled_date: TOMORROW,
}

describe('R44 — บรรทัด ③ สถานะขนส่ง Same-Day (N1: ไม่ผูกรอบส่งใด ๆ)', () => {
  it('อยู่ในหน้าต่างส่ง (12:00 ในรอบเที่ยง 11-14) → "จัดส่งทันทีหลังครัวปรุงเสร็จ"', () => {
    const s = getStoreStatusFromRounds(todayRounds as never, atIctl(TODAY, '12:00'))
    expect(s.sameDayOpen).toBe(true)
    expect(s.sameDayLine).toBe('จัดส่งทันทีหลังครัวปรุงเสร็จ')
  })
  it('ช่วงว่างระหว่างรอบ (10:00) → ยังคง "จัดส่งทันทีหลังครัวปรุงเสร็จ" (ห้ามผูกเวลาของรอบ/ไม่มีวงเล็บ)', () => {
    const s = getStoreStatusFromRounds(todayRounds as never, atIctl(TODAY, '10:00'))
    expect(s.sameDayOpen).toBe(true)
    expect(s.sameDayLine).toBe('จัดส่งทันทีหลังครัวปรุงเสร็จ')
    expect(s.sameDayLine).not.toContain('เริ่มส่ง') // branch ผูกเวลาของรอบถูกถอดออกจากสเปกแล้ว
    expect(s.sameDayLine).not.toContain('(')
    expect(s.sameDayLine).not.toContain('รอบ')
  })
  it('รอบวันนี้ปิดหมด + มีรอบพรุ่งนี้ → sameDayLine "ปิดรับแล้ว" (preorder_only)', () => {
    const closedToday = todayRounds.map((r) => ({ ...r, status: 'closed' }))
    const s = getStoreStatusFromRounds([...closedToday, tomorrowRound] as never, atIctl(TODAY, '10:00'))
    expect(s.state).toBe('preorder_only')
    expect(s.sameDayLine).toBe('ปิดรับแล้ว')
  })
  it('ไม่มีรอบเลย → sameDayLine "ปิดรับแล้ว"', () => {
    const s = getStoreStatusFromRounds([] as never, atIctl(TODAY, '10:00'))
    expect(s.sameDayLine).toBe('ปิดรับแล้ว')
  })
})

describe('R44 — บรรทัด ② รูปแบบพรีออเดอร์ใหม่ (N1)', () => {
  it('Pre-Order body: รอบส่ง <เวลา 7.00 AM จุดคั่น> <ชื่อรอบ> <วัน> (ปิดรับ HH:MM AM/PM) — หัวข้ออยู่ strip', () => {
    const closedToday = todayRounds.map((r) => ({ ...r, status: 'closed' }))
    const s = getStoreStatusFromRounds([...closedToday, tomorrowRound] as never, atIctl(TODAY, '10:00'))
    expect(s.preOrderLine).toMatch(/^รอบส่ง /)
    expect(s.preOrderLine).toContain('11.00 AM') // N1: delivery_start ไม่ pad ชั่วโมง + จุดคั่นนาที
    expect(s.preOrderLine).toContain('เที่ยง') // N1: ชื่อรอบจริง (display_name) ของรอบถัดไปโชว์ again
    expect(s.preOrderLine).toContain('02/11/2026') // dynamic จาก scheduled_date ห้าม hardcode
    expect(s.preOrderLine).toMatch(/\(ปิดรับ \d{2}:\d{2} (AM|PM)\)/) // cutoff ยังคง HH:MM AM/PM
    expect(s.preOrderLine).not.toContain('รอบส่งถัดไป') // label เก่าถูกแทนแล้ว
  })
  it('ปิดรับแล้ว = default ใหม่ขึ้นต้น 🛵 (คีย์ copy แก้ได้เหมือนเดิม)', () => {
    expect(DEFAULT_STORE_STATUS_COPY.preOrderClosed).toBe('ปิดรับแล้ว — ยังไม่เปิดรอบถัดไป')
  })
})

describe('R44 — StoreStatusStrip source (3 บรรทัด)', () => {
  it('บรรทัด ① ไฟรวมสองสายในบรรทัดเดียว (preOrderOpen/sameDayOpen แยกสีได้จริง · ไอคอนหลังคำไทย)', () => {
    expect(stripSrc).toContain('data-testid="strip-status-lights"')
    // N1 (Owner 2026-11-01): ไอคอนอยู่หลังคำไทย — จองล่วงหน้า/📅Pre-Order · ส่งวันนี้/⚡Same-Day
    expect(stripSrc).toContain('เปิดรับออเดอร์ จองล่วงหน้า/📅Pre-Order')
    expect(stripSrc).toContain('เปิดรับออเดอร์ ส่งวันนี้/⚡Same-Day')
    expect(stripSrc).not.toContain('จองล่วงหน้า/Pre-Order 📅') // label R50 ถูกแทนแล้ว
    expect(stripSrc).not.toContain('รอบวันนี้/Same-Day') // label เก่าถูกแทนทั้งบรรทัด
    expect(stripSrc).toContain("preOrderOpen ? '🟢' : '🔴'")
    expect(stripSrc).toContain("sameDayOpen ? '🟢' : '🔴'")
    expect(stripSrc).toContain('ปิดรับแล้ว')
  })
  it('บรรทัด ② ③ มี testid เดิมครบ + fallback ปิดรับเมื่อไม่มีรอบ + ไม่ truncate', () => {
    expect(stripSrc).toContain('data-testid="strip-preorder"')
    expect(stripSrc).toContain('data-testid="strip-sameday"')
    expect(stripSrc).toContain('DEFAULT_STORE_STATUS_COPY.preOrderClosed')
    // N1 copy: 2) หัวข้อ จองล่วงหน้า/📅Pre-Order · 3) หัวข้อ ส่งวันนี้/⚡Same-Day (กัน regression กลับข้อความเก่า)
    expect(stripSrc).toContain('🛵 จองล่วงหน้า/📅Pre-Order :')
    // หัวข้อ 3 = scooter U+1F6F5 นำหน้า (เขียนเป็น \u{1F6F5} กันอักขระจีนหลุดเข้า source · languageSanity)
    expect(stripSrc).toContain('\u{1F6F5} ส่งวันนี้/⚡Same-Day :')
    expect(stripSrc).not.toContain('📅 Pre-Order / จองล่วงหน้า :') // label R52 ถูกแทนแล้ว
    expect(stripSrc).not.toContain('⚡ Same-Day / ส่งวันนี้ :')
    expect(stripSrc).toContain('จัดส่งทันทีหลังครัวปรุงเสร็จ') // fallback ของ strip (ครัว = คำใหม่ N1)
    expect(stripSrc).not.toMatch(/opacity-80/)
    expect((stripSrc.match(/text-sm sm:text-base font-bold/g) || []).length).toBeGreaterThanOrEqual(3)
  })
})