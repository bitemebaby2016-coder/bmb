// ============================================
// Bite Me Baby — R48 (Owner 2026-11-17): riderHistory — ตัวกรอง + แท็บรายเดือน
// ============================================
// ฟังก์ชัน pure สำหรับกรองงานไรเดอร์ + สร้างแท็บรายเดือน
// ทดสอบ timezone Asia/Bangkok (UTC+7) + anchor assigned/scheduled
import { describe, it, expect } from 'vitest'
import {
  filterAssignments,
  getAvailableMonths,
  formatMonthLabel,
  buildHistoryData,
} from '../lib/riderHistory'
import type { MyDeliveryAssignment } from '../lib/driverService'

const makeAssignment = (overrides: Partial<MyDeliveryAssignment> = {}): MyDeliveryAssignment => ({
  order_number: 'TEST-001',
  assignment_status: 'delivered',
  assigned_at: '2026-11-17T08:00:00+07:00',
  accepted_at: null,
  scheduled_date: '2026-11-17',
  dropoff_detail: 'Test',
  dropoff_latitude: 12.6,
  dropoff_longitude: 102.1,
  order_status: 'delivered',
  total_amount: 100,
  payment_status: 'paid',
  payment_method: 'cash',
  items: [],
  ...overrides,
})

const TODAY_BANGKOK = new Date('2026-11-17T12:00:00+07:00')

describe('R48 — riderHistory (filter + months + label)', () => {
  describe('filterAssignments', () => {
    it('mode=today + anchor=scheduled: งาน scheduled_date = วันนี้ (Asia/Bangkok)', () => {
      const a = makeAssignment({ scheduled_date: '2026-11-17', assigned_at: '2026-11-16T08:00:00+07:00' })
      const res = filterAssignments([a], 'today', 'scheduled', undefined, TODAY_BANGKOK)
      expect(res).toHaveLength(1)
    })

    it('mode=today + anchor=scheduled: งาน scheduled_date = เมื่อวาน → ถูกกรองออก', () => {
      const a = makeAssignment({ scheduled_date: '2026-11-16', assigned_at: '2026-11-16T08:00:00+07:00' })
      const res = filterAssignments([a], 'today', 'scheduled', undefined, TODAY_BANGKOK)
      expect(res).toHaveLength(0)
    })

    it('mode=today + anchor=assigned: ใช้ assigned_at แทน scheduled_date', () => {
      const a = makeAssignment({ scheduled_date: '2026-11-16', assigned_at: '2026-11-17T08:00:00+07:00' })
      const res = filterAssignments([a], 'today', 'assigned', undefined, TODAY_BANGKOK)
      expect(res).toHaveLength(1) // assigned_at = วันนี้
    })

    it('mode=month + monthKey=2026-11: งานในเดือนพฤศจิกายน 2026', () => {
      const a1 = makeAssignment({ scheduled_date: '2026-11-01' })
      const a2 = makeAssignment({ scheduled_date: '2026-11-15' })
      const a3 = makeAssignment({ scheduled_date: '2026-10-31' })
      const res = filterAssignments([a1, a2, a3], 'month', 'scheduled', '2026-11', TODAY_BANGKOK)
      expect(res).toHaveLength(2)
    })

    it('anchor=scheduled ใช้ scheduled_date; anchor=assigned ใช้ assigned_at', () => {
      const a = makeAssignment({
        scheduled_date: '2026-11-17',
        assigned_at: '2026-11-16T08:00:00+07:00',
      })
      expect(filterAssignments([a], 'today', 'scheduled', undefined, TODAY_BANGKOK)).toHaveLength(1)
      expect(filterAssignments([a], 'today', 'assigned', undefined, TODAY_BANGKOK)).toHaveLength(0)
    })

    it('scheduled_date null + anchor=scheduled = fallback ไป assigned_at (history jobs)', () => {
      // History jobs with NULL scheduled_date fallback to assigned_at
      const a = makeAssignment({ scheduled_date: null, assigned_at: '2026-11-17T08:00:00+07:00' })
      const res = filterAssignments([a], 'today', 'scheduled', undefined, TODAY_BANGKOK)
      expect(res).toHaveLength(1) // falls back to assigned_at = today
    })

    it('scheduled_date null + anchor=scheduled + active job = เห็นเสมอใน today (ไม่ขึ้นกับ date)', () => {
      // Active jobs always visible in today view regardless of scheduled_date
      const a = makeAssignment({ 
        assignment_status: 'assigned', 
        scheduled_date: null, 
        assigned_at: '2026-11-16T08:00:00+07:00' // yesterday
      })
      const res = filterAssignments([a], 'today', 'scheduled', undefined, TODAY_BANGKOK)
      expect(res).toHaveLength(1) // active jobs always visible
    })
  })

  describe('getAvailableMonths', () => {
    it('คืนเดือนที่มีข้อมูล เรียงใหม่ → เก่า (YYYY-MM)', () => {
      const a1 = makeAssignment({ scheduled_date: '2026-11-01' })
      const a2 = makeAssignment({ scheduled_date: '2026-10-15' })
      const a3 = makeAssignment({ scheduled_date: '2026-11-20' })
      const months = getAvailableMonths([a1, a2, a3], 'scheduled')
      expect(months).toEqual(['2026-11', '2026-10'])
    })

    it('scheduled_date null ใช้ assigned_at fallback สร้างเดือน', () => {
      const a = makeAssignment({ scheduled_date: null, assigned_at: '2026-11-17T08:00:00+07:00' })
      // anchor=scheduled: fallback ไป assigned_at → สร้างเดือน
      expect(getAvailableMonths([a], 'scheduled')).toEqual(['2026-11'])
      // anchor=assigned: ใช้ assigned_at โดยตรง
      expect(getAvailableMonths([a], 'assigned')).toEqual(['2026-11'])
    })
  })

  describe('formatMonthLabel', () => {
    it('2026-11 → พฤศจิกายน 2569', () => {
      expect(formatMonthLabel('2026-11')).toBe('พฤศจิกายน 2569')
    })
    it('2026-01 → มกราคม 2569', () => {
      expect(formatMonthLabel('2026-01')).toBe('มกราคม 2569')
    })
  })

  describe('buildHistoryData', () => {
    it('รวม assignments + months + currentMonthKey', () => {
      const a1 = makeAssignment({ scheduled_date: '2026-11-17' })
      const a2 = makeAssignment({ scheduled_date: '2026-10-15' })
      const data = buildHistoryData([a1, a2], 'today', 'scheduled', undefined, TODAY_BANGKOK)
      expect(data.assignments).toHaveLength(1) // today filter
      expect(data.availableMonths).toEqual(['2026-11', '2026-10'])
      expect(data.currentMonthKey).toBe('2026-11')
    })
  })
})