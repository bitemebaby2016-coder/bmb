// ============================================
// W-4 / L-6 — แถบสถานะต้องพูดตามเวลา-รอบจริง (Owner 2026-10-26 N-4 ข้อ 6)
//   เดิม ~11:00 ยังโชว์ "เปิดรับออเดอร์ เช้า" ทั้งที่รอบเช้าหมดหน้าต่างส่งแล้ว
//   เกณฑ์ใหม่: เซมเดย์ยังสั่งได้ (ไม่มีปิดรอบ 148) + รอบถัดไปส่งกี่โมง
//               + พรีออเดอร์ = รอบถัดไป (วันถัดไป) เมื่อวันนี้แอดมินปิดรอบแล้ว
// ============================================

import { describe, it, expect } from 'vitest'
import { getStoreStatusFromRounds } from '@/lib/homeProviders'

// 2026-10-26 = วันทดสอบ · รอบวันนี้: เช้า 06–09 · เที่ยง 11–14 · เย็น 17–20 (active)
const TODAY = '2026-10-26'
const TOMORROW = '2026-10-27'
const atIctl = (hhmm: string) => new Date(Date.parse(`2026-10-26T${hhmm}:00+07:00`))

const todayRounds = [
  { id: 'round-1', status: 'active', display_name: 'เช้า', delivery_start: '06:00', delivery_end: '09:00', cutoff_time: '08:00', max_capacity: 60, current_count: 0, scheduled_date: TODAY },
  { id: 'round-2', status: 'active', display_name: 'เที่ยง', delivery_start: '11:00', delivery_end: '14:00', cutoff_time: '10:30', max_capacity: 80, current_count: 0, scheduled_date: TODAY },
  { id: 'round-3', status: 'active', display_name: 'เย็น', delivery_start: '17:00', delivery_end: '20:00', cutoff_time: '16:00', max_capacity: 100, current_count: 0, scheduled_date: TODAY },
]

const tomorrowRound = {
  id: 'round-20261027-midday', status: 'active', display_name: 'รอบวันที่ 27',
  delivery_start: '11:00', delivery_end: '14:00', cutoff_time: '10:30',
  max_capacity: 80, current_count: 0, scheduled_date: TOMORROW,
}

describe('L-6 — แถบสถานะตามเวลา/รอบจริง', () => {
  it('~10:00 (ช่วงว่างหลังรอบเช้าหมด window) ห้ามโชว์ "เช้า" → บอกเซมเดย์ยังสั่งได้ (ไม่โชว์เวลาส่ง — R10 2026-10-27)', () => {
    const s = getStoreStatusFromRounds(todayRounds, atIctl('10:00'))
    expect(s.isOpen).toBe(true)
    expect(s.state).toBe('open')
    expect(s.message).not.toContain('เช้า')
    expect(s.message).toContain('เซมเดย์')
    // R10 (Owner 2026-10-27 "ส่ง 11:00–15:00 ไม่ต้องแสดง"): ห้ามผูกเซมเดย์กับเวลาส่งของรอบ
    expect(s.message).not.toContain('11:00')
    // ไม่มีรอบ nàoอยู่ในหน้าต่าง → ห้ามโชว์ชื่อรอบ/ตัวเลขความจุของรอบอื่น
    expect(s.currentRoundLabel).toBeUndefined()
    expect(s.capacityPct).toBeUndefined()
  })

  it('11:00 พอดี = อยู่ในหน้าต่างรอบเที่ยง → currentRoundLabel = เที่ยง (ข้อความยังคงสไตล์เซมเดย์)', () => {
    const s = getStoreStatusFromRounds(todayRounds, atIctl('11:00'))
    expect(s.isOpen).toBe(true)
    expect(s.message).toContain('เปิดรับออเดอร์')
    expect(s.message).toContain('เซมเดย์')
    expect(s.message).not.toContain('เช้า')
    expect(s.currentRoundLabel).toBe('เที่ยง')
    expect(typeof s.capacityPct).toBe('number')
  })

  it('รอบวันนี้ถูกปิดหมด (แอดมินกดปิด) → แถบเปิดจองล่วงหน้า + พรีออเดอร์ชี้รอบถัดไป (วันที่ 27)', () => {
    const closedToday = todayRounds.map((r) => ({ ...r, status: 'closed' }))
    const s = getStoreStatusFromRounds([...closedToday, tomorrowRound], atIctl('11:00'))
    expect(s.isOpen).toBe(true)
    expect(s.state).toBe('preorder_only')
    expect(s.message).toContain('จองล่วงหน้า')
    expect(s.preOrderLine).toContain('รอบวันที่ 27')
    expect(s.preOrderLine).not.toContain('ปิดรับแล้ว')
    // R13 (Owner 2026-10-28): บอก "รอบไหนของวันไหน" — วันที่ DD/MM/YYYY + ปิดรอบ
    expect(s.preOrderLine).toContain('27/10/2026')
    expect(s.preOrderLine).toMatch(/รอบส่งถัดไป/)
    expect(s.preOrderLine).toMatch(/\(ปิดรอบ \d{2}:\d{2}\)/)
  })

  it('ทุกรอบวันนี้ผ่านหน้าต่างส่งแล้ว (21:00) → ยังบอกว่าเซมเดย์สั่งได้ ไม่ใช่ปิดร้าน', () => {
    const s = getStoreStatusFromRounds(todayRounds, atIctl('21:00'))
    expect(s.isOpen).toBe(true)
    expect(s.message).toContain('เซมเดย์')
    expect(s.message).not.toContain('ยังไม่เปิดรับออเดอร์')
  })
})