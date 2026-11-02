// ============================================
// Bite Me Baby — R44/R52 tests (Owner 2026-11-01): แถบสถานะหน้าแรก 3 บรรทัด
//   1) ไฟสถานะเปิด-ปิด แจ้งทั้ง Pre-Order และ Same-Day ในบรรทัดเดียว
//   2) 📅 Pre-Order / จองล่วงหน้า : [สกู๊ตเตอร์] รอบส่งถัดไป <เวลาออกส่ง> <วัน> (ปิดรับ …) — label ใน strip · body ใน provider
//   3) ⚡ Same-Day / ส่งวันนี้ : จัดส่งทันทีหลังปรุงเสร็จ · เริ่มส่ง HH:MM AM · ปิดรับแล้ว
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

describe('R44 — บรรทัด ③ สถานะขนส่ง Same-Day', () => {
  it('อยู่ในหน้าต่างส่ง (12:00 ในรอบเที่ยง 11-14) → "จัดส่งทันทีหลังปรุงเสร็จ"', () => {
    const s = getStoreStatusFromRounds(todayRounds as never, atIctl(TODAY, '12:00'))
    expect(s.sameDayOpen).toBe(true)
    expect(s.sameDayLine).toBe('จัดส่งทันทีหลังปรุงเสร็จ')
  })
  it('ช่วงว่างระหว่างรอบ (10:00) → "เริ่มส่ง 11:00 AM" (รอบถัดไป + AM/PM)', () => {
    const s = getStoreStatusFromRounds(todayRounds as never, atIctl(TODAY, '10:00'))
    expect(s.sameDayOpen).toBe(true)
    expect(s.sameDayLine).toBe('เริ่มส่ง 11:00 AM')
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

describe('R44 — บรรทัด ② รูปแบบพรีออเดอร์ใหม่', () => {
  it('Pre-Order body: รอบส่งถัดไป <เวลาออกส่ง AM/PM> <วัน> (ปิดรับ HH:MM AM/PM) — R52 หัวข้ออยู่ strip', () => {
    const closedToday = todayRounds.map((r) => ({ ...r, status: 'closed' }))
    const s = getStoreStatusFromRounds([...closedToday, tomorrowRound] as never, atIctl(TODAY, '10:00'))
    expect(s.preOrderLine).toMatch(/^รอบส่งถัดไป /)
    expect(s.preOrderLine).toContain('11:00 AM') // R52: delivery_start ของรอบพรุ่งนี้ = เวลาออกส่งจริง
    expect(s.preOrderLine).not.toContain('เที่ยง') // R52: ชื่อรอบห้ามโชว์แล้ว
    expect(s.preOrderLine).toContain('02/11/2026')
    expect(s.preOrderLine).toMatch(/\(ปิดรับ \d{2}:\d{2} (AM|PM)\)/)
  })
  it('ปิดรับแล้ว = default ใหม่ขึ้นต้น 🛵 (คีย์ copy แก้ได้เหมือนเดิม)', () => {
    expect(DEFAULT_STORE_STATUS_COPY.preOrderClosed).toBe('ปิดรับแล้ว — ยังไม่เปิดรอบถัดไป')
  })
})

describe('R44 — StoreStatusStrip source (3 บรรทัด)', () => {
  it('บรรทัด ① ไฟรวมสองสายในบรรทัดเดียว (preOrderOpen/sameDayOpen แยกสีได้จริง)', () => {
    expect(stripSrc).toContain('data-testid="strip-status-lights"')
    // R50 (Owner 2026-11-01 Strip copy): ① มีช่องว่าง + ไอคอน 📅/⚡ ประจำสาย
    expect(stripSrc).toContain('เปิดรับออเดอร์ จองล่วงหน้า/Pre-Order 📅')
    expect(stripSrc).toContain('เปิดรับออเดอร์ รอบวันนี้/Same-Day ⚡')
    expect(stripSrc).toContain('รอบวันนี้/Same-Day')
    expect(stripSrc).toContain("preOrderOpen ? '🟢' : '🔴'")
    expect(stripSrc).toContain("sameDayOpen ? '🟢' : '🔴'")
    expect(stripSrc).toContain('ปิดรับแล้ว')
  })
  it('บรรทัด ② ③ มี testid เดิมครบ + fallback ปิดรับเมื่อไม่มีรอบ + ไม่ truncate', () => {
    expect(stripSrc).toContain('data-testid="strip-preorder"')
    expect(stripSrc).toContain('data-testid="strip-sameday"')
    expect(stripSrc).toContain('DEFAULT_STORE_STATUS_COPY.preOrderClosed')
    // R52 copy: 2) หัวข้อ Pre-Order/จองล่วงหน้า · 3) หัวข้อ Same-Day/ส่งวันนี้ (กัน regression กลับเป็นข้อความเก่า)
    expect(stripSrc).toContain('📅 Pre-Order / จองล่วงหน้า :')
    expect(stripSrc).toContain('⚡ Same-Day / ส่งวันนี้ :')
    expect(stripSrc).not.toContain('รอบวันนี้/Same-Day :') // label เก่าถูกแทนแล้ว (บรรทัด 1 คง 'รอบวันนี้/Same-Day ⚡' เดิม)
    expect(stripSrc).not.toMatch(/opacity-80/)
    expect((stripSrc.match(/text-sm sm:text-base font-bold/g) || []).length).toBeGreaterThanOrEqual(3)
  })
})