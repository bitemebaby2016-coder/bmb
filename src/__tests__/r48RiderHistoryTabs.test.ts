// ============================================
// Bite Me Baby — R48 (Owner 2026-11-17): Rider history tabs — source contracts
// ============================================
// Owner: "งานของไรเดอร์ให้แสดงเฉพาะวันปัจจุบัน วันที่ผ่านไปแล้วสร้างแท็บเก็บไว้เป็นเดือนไว้ดูย้อนหลัง"
//       "มอบหมายงานล่วงหน้าได้ จอย delivery_rounds.scheduled_date ใน RPC ด้วย ต้องการทำได้ทั้งคู่"
import { describe, it, expect } from 'vitest'
import mig181Src from '../../supabase/migrations/181_rider_history_dates.sql?raw'
import riderPwaSrc from '../pages/RiderPwaPage.tsx?raw'
import driverServiceSrc from '../lib/driverService.ts?raw'
import riderHistorySrc from '../lib/riderHistory.ts?raw'

describe('R48 — migration 181: my_deliveries v3 scheduled_date + filters', () => {
  it('เพิ่ม scheduled_date ใน assignments + offers (JOIN delivery_rounds)', () => {
    expect(mig181Src).toContain('dr.scheduled_date')
    expect(mig181Src).toContain('LEFT JOIN public.delivery_rounds dr ON dr.id = o.round_id')
  })

  it('เพิ่ม filter params: assigned/scheduled from/to', () => {
    expect(mig181Src).toContain('p_assigned_from timestamptz DEFAULT NULL')
    expect(mig181Src).toContain('p_assigned_to timestamptz DEFAULT NULL')
    expect(mig181Src).toContain('p_scheduled_from date DEFAULT NULL')
    expect(mig181Src).toContain('p_scheduled_to date DEFAULT NULL')
  })

  it('WHERE clause กรอง assigned_at และ scheduled_date', () => {
    expect(mig181Src).toContain('p_assigned_from IS NULL OR da.assigned_at >= p_assigned_from')
    expect(mig181Src).toContain('p_scheduled_from IS NULL OR dr.scheduled_date >= p_scheduled_from')
  })

  it('VERIFICATION block ตัดเกม (scheduled_date + filters + JOIN)', () => {
    expect(mig181Src).toContain('ERR_VERIFY: scheduled_date missing')
    expect(mig181Src).toContain('ERR_VERIFY: p_assigned_from missing')
    expect(mig181Src).toContain('ERR_VERIFY: p_scheduled_from missing')
    expect(mig181Src).toContain("delivery_rounds dr ON dr.id = o.round_id")
  })
})

describe('R48 — TypeScript types + driverService', () => {
  it('MyDeliveryAssignment มี scheduled_date', () => {
    expect(driverServiceSrc).toContain('scheduled_date: string | null')
    expect(driverServiceSrc).toContain('R48: วันส่งจริง')
  })

  it('myDeliveriesResult รับ filter params 4 ตัว (ISO timestamp/date)', () => {
    expect(driverServiceSrc).toContain('assignedFrom?: string')
    expect(driverServiceSrc).toContain('assignedTo?: string')
    expect(driverServiceSrc).toContain('scheduledFrom?: string')
    expect(driverServiceSrc).toContain('scheduledTo?: string')
    expect(driverServiceSrc).toContain('p_assigned_from: params')
    expect(driverServiceSrc).toContain('p_scheduled_from: params')
  })
})

describe('R48 — riderHistory lib (timezone-safe UTC)', () => {
  it('filterAssignments: mode today/month + anchor assigned/scheduled', () => {
    expect(riderHistorySrc).toContain("mode: HistoryMode")
    expect(riderHistorySrc).toContain("anchor: DateAnchor")
    expect(riderHistorySrc).toContain("'assigned' | 'scheduled'")
  })

  it('timezone-safe: ใช้ Date.UTC สร้าง today กันบั๊ก timezone', () => {
    expect(riderHistorySrc).toContain('Date.UTC')
    expect(riderHistorySrc).toContain('bangkokNow.getUTCFullYear()')
  })

  it('getAvailableMonths: เดือนที่มีข้อมูล เรียงใหม่→เก่า', () => {
    expect(riderHistorySrc).toContain('getAvailableMonths')
    expect(riderHistorySrc).toContain('b.localeCompare(a)')
  })

  it('formatMonthLabel: Thai + พ.ศ. (2026-11 → พฤศจิกายน 2569)', () => {
    expect(riderHistorySrc).toContain('พฤศจิกายน 2569')
    expect(riderHistorySrc).toContain('thaiMonths')
  })

  it('buildHistoryData: รวม assignments + months + currentMonthKey', () => {
    expect(riderHistorySrc).toContain('buildHistoryData')
    expect(riderHistorySrc).toContain('currentMonthKey')
  })
})

describe('R48 — RiderPwaPage: Tab UI (today/month + anchor selector)', () => {
  it('Tab bar: วันนี้ + เดือนจากข้อมูลจริง + anchor selector', () => {
    expect(riderPwaSrc).toContain('data-testid="rider-history-tabs"')
    expect(riderPwaSrc).toContain('data-testid="rider-tab-today"')
    expect(riderPwaSrc).toContain('data-testid="rider-anchor-select"')
    expect(riderPwaSrc).toContain('📅 วันนี้')
    expect(riderPwaSrc).toContain('📅 วันส่ง (scheduled)')
    expect(riderPwaSrc).toContain('📝 วันมอบหมาย (assigned)')
  })

  it('Tab เดือนสร้างจาก getAvailableMonths + formatMonthLabel', () => {
    expect(riderPwaSrc).toContain('getAvailableMonths(assignments, historyAnchor)')
    expect(riderPwaSrc).toContain('formatMonthLabel(m)')
  })

  it('Filter assignments ด้วย filterAssignments ตาม mode/anchor/monthKey', () => {
    expect(riderPwaSrc).toContain('filterAssignments(assignments, historyMode, historyAnchor, historyMonthKey)')
  })

  it('คงการทำงานเดิม: delivered 3 ล่าสุด + overflow album', () => {
    expect(riderPwaSrc).toContain('deliveredAll.length > 3')
    expect(riderPwaSrc).toContain('data-testid="rider-history-toggle"')
  })
})