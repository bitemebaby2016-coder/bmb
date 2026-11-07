import { describe, it, expect } from 'vitest'
import {
  dateScopeForToday,
  dateScopeForMonth,
  orderMonthKeys,
  monthChipLabel,
  localDateStr,
  localMonthKey,
} from '@/lib/orderDateScope'

// Owner 2026-11-07: "ทุกโหมดแสดงเฉพาะวันปัจจุบัน" + แท็บเดือน (อดีต) — PURE helpers
describe('orderDateScope — pure helpers (Owner 2026-11-07)', () => {
  it('dateScopeForToday: scheduled = วันนี้ทั้งสองขอบ · created = เที่ยงคืน→เที่ยงคืนถัดไป (exclusive)', () => {
    const now = new Date(2026, 10, 7, 10, 12) // 7 พ.ย. 2026 10:12 local
    const s = dateScopeForToday(now)
    expect(s.scheduledFrom).toBe('2026-11-07')
    expect(s.scheduledTo).toBe('2026-11-07')
    expect(new Date(s.createdFrom)).toEqual(new Date(2026, 10, 7, 0, 0, 0, 0))
    expect(new Date(s.createdTo)).toEqual(new Date(2026, 10, 8, 0, 0, 0, 0))
    expect(new Date(s.createdTo).getTime() - new Date(s.createdFrom).getTime()).toBe(24 * 60 * 60 * 1000)
  })

  it('dateScopeForMonth: 1 ถึงวันสุดท้ายของเดือน · created ถึงวันแรกเดือนถัดไป (รองรับปีอธิกสุรทิน)', () => {
    const s = dateScopeForMonth('2026-11')
    expect(s.scheduledFrom).toBe('2026-11-01')
    expect(s.scheduledTo).toBe('2026-11-30')
    expect(new Date(s.createdFrom)).toEqual(new Date(2026, 10, 1))
    expect(new Date(s.createdTo)).toEqual(new Date(2026, 11, 1))
    expect(dateScopeForMonth('2024-02').scheduledTo).toBe('2024-02-29')
    expect(dateScopeForMonth('2026-12').scheduledTo).toBe('2026-12-31')
  })

  it('orderMonthKeys: union เดือน scheduled_date + created_at · ใหม่→เก่า · ไม่ซ้ำ · null scheduled ใช้เดือน created', () => {
    const keys = orderMonthKeys([
      { scheduled_date: '2026-11-15', created_at: '2026-10-15T10:00:00Z' }, // อยู่ 2 เดือน
      { scheduled_date: null, created_at: '2026-10-15T10:00:00Z' },
      { scheduled_date: '2026-09-05', created_at: '2026-09-15T10:00:00Z' },
    ])
    expect(keys).toEqual(['2026-11', '2026-10', '2026-09'])
  })

  it('monthChipLabel: เดือนไทย + ปี ค.ศ. (2026-11 → พ.ย. 2026)', () => {
    expect(monthChipLabel('2026-11')).toBe('พ.ย. 2026')
    expect(monthChipLabel('2026-01')).toBe('ม.ค. 2026')
    expect(monthChipLabel('2026-12')).toBe('ธ.ค. 2026')
  })

  it('localDateStr/localMonthKey: format ตาม timezone เครื่อง (YYYY-MM-DD / YYYY-MM)', () => {
    const d = new Date(2026, 10, 7)
    expect(localDateStr(d)).toBe('2026-11-07')
    expect(localMonthKey(d)).toBe('2026-11')
    expect(localDateStr(new Date(2026, 0, 3))).toBe('2026-01-03')
  })
})