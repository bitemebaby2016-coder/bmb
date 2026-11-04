// ============================================
// Bite Me Baby — MASTER เปิด/ปิดร้าน (Owner R66-B · migration 185)
// business_settings.store_master_open = { open: boolean }
// "อยู่เหนือกฎทั้งหมด": getStoreStatusFromRounds ตรวจค่านี้ก่อนรอบ/เวลาใด ๆ
// ZERO-FAKE: ไม่มีค่า/parse ไม่ได้ = เปิดร้าน (ห้ามเดาปิด — mirror shopHoursLogic)
// Server: trg_orders_master_gate บล็อก INSERT ใหม่ทุก channel (ERR_STORE_CLOSED)
// ============================================

import type { StoreStatus } from '@/types'

export const STORE_MASTER_KEY = 'store_master_open'

/** ค่าดิบจาก business_settings -> true=เปิด (default/ค่าเพี้ยน = เปิด) */
export function parseStoreMasterOpen(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    try {
      return parseStoreMasterOpen(JSON.parse(value))
    } catch {
      return true
    }
  }
  if (typeof value === 'object') {
    const open = (value as { open?: unknown }).open
    if (typeof open === 'boolean') return open
    return true
  }
  return true
}

/** ค่าที่ส่งเข้า getStoreStatusFromRounds (undefined/null = ยังไม่ได้โหลด → ไม่บัง — ZERO-FAKE) */
export function masterOpenFromConfig(value: unknown): boolean | null {
  if (value === null || value === undefined) return null
  if (value === 'hours' || value === 'operating_hours') return null
  return parseStoreMasterOpen(value)
}

/** สถานะ "ปิดเพราะ Master" — มาก่อนผลลัพธ์อื่นทุกกรณี */
export function masterClosedStatus(): StoreStatus {
  return {
    isOpen: false,
    state: 'closed',
    sameDayOpen: false,
    preOrderOpen: false,
    sameDayLine: 'ปิดรับแล้ว',
    message: 'ร้านปิดชั่วคราว (ปิดจากสวิตช์ Master ของแอดมิน)',
  }
}