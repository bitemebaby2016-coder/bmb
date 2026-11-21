// ============================================
// Bite Me Baby — riderHistory (R48 · 2026-11-17)
// ============================================
// ฟังก์ชันกรองงานไรเดอร์ + สร้างแท็บรายเดือน
// รองรับ 2 anchor: 'assigned' (วันมอบหมาย) / 'scheduled' (วันส่งจริง)
// ============================================

import type { MyDeliveryAssignment } from './driverService'

export type HistoryMode = 'today' | 'month'
export type DateAnchor = 'assigned' | 'scheduled'

export interface HistoryFilterResult {
  assignments: MyDeliveryAssignment[]
  availableMonths: string[] // ['2026-11', '2026-10', ...] เรียงใหม่ → เก่า
  currentMonthKey: string // '2026-11'
}

/** แปลง timestamp string → Date ใน timezone Asia/Bangkok */
function toBangkokDate(ts: string | null | undefined): Date | null {
  if (!ts) return null
  const d = new Date(ts)
  if (!Number.isFinite(d.getTime())) return null
  // Asia/Bangkok = UTC+7
  return new Date(d.getTime() + 7 * 60 * 60 * 1000)
}

/** สถานะงานที่ถือว่า "active" (กำลังดำเนินอยู่) — ควรเห็นในแท็บวันนี้เสมอ ไม่ว่าจะมี scheduled_date หรือไม่ */
const ACTIVE_STATUSES: MyDeliveryAssignment['assignment_status'][] = ['assigned', 'accepted', 'picked_up', 'in_transit', 'arrived']

/** สถานะงานที่ถือว่า "ประวัติ" (จบสิ้นสุดแล้ว) — กรองตามวันตาม anchor */
const HISTORY_STATUSES: MyDeliveryAssignment['assignment_status'][] = ['delivered', 'declined', 'cancelled']

/** ดึงวันที่ที่ใช้กรองตาม anchor — fallback assigned_at เมื่อ scheduled_date เป็น NULL */
function getFilterDate(a: MyDeliveryAssignment, anchor: DateAnchor): string | null {
  if (anchor === 'scheduled') {
    return a.scheduled_date ?? a.assigned_at ?? null
  }
  return a.assigned_at ?? null
}

/** เช็คว่า assignment อยู่ใน "วันนี้" ตาม anchor */
function isToday(a: MyDeliveryAssignment, anchor: DateAnchor, today: Date): boolean {
  const ts = getFilterDate(a, anchor)
  const d = toBangkokDate(ts)
  if (!d) return false
  return d.getUTCFullYear() === today.getUTCFullYear() &&
         d.getUTCMonth() === today.getUTCMonth() &&
         d.getUTCDate() === today.getUTCDate()
}

/** เช็คว่า assignment อยู่ในเดือนที่กำหนด (key = 'YYYY-MM') */
function isInMonth(a: MyDeliveryAssignment, anchor: DateAnchor, monthKey: string): boolean {
  const ts = getFilterDate(a, anchor)
  const d = toBangkokDate(ts)
  if (!d) return false
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${yyyy}-${mm}` === monthKey
}

/** ดึง key เดือน 'YYYY-MM' จาก assignment ตาม anchor — fallback assigned_at เมื่อ scheduled_date เป็น NULL */
function getMonthKey(a: MyDeliveryAssignment, anchor: DateAnchor): string | null {
  const ts = getFilterDate(a, anchor)
  const d = toBangkokDate(ts)
  if (!d) return null
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${yyyy}-${mm}`
}

/**
 * กรอง assignments ตาม mode + anchor
 * - today: งาน active (assigned/accepted/picked_up/in_transit/arrived) เห็นเสมอ
 *          งานประวัติ (delivered/declined/cancelled) กรองตามวัน
 * - month: งานที่อยู่ใน monthKey (YYYY-MM) ที่เลือก (ใช้ getFilterDate fallback)
 */
export function filterAssignments(
  assignments: MyDeliveryAssignment[],
  mode: HistoryMode,
  anchor: DateAnchor,
  monthKey?: string,
  now?: Date // optional for testing (UTC)
): MyDeliveryAssignment[] {
  const testNow = now ?? new Date()
  const bangkokNow = new Date(testNow.getTime() + 7 * 60 * 60 * 1000)
  // สร้าง today ใน UTC เพื่อให้ตรงกับการเปรียบเทียบ UTC components
  const today = new Date(Date.UTC(bangkokNow.getUTCFullYear(), bangkokNow.getUTCMonth(), bangkokNow.getUTCDate()))

  return assignments.filter((a) => {
    const isActive = ACTIVE_STATUSES.includes(a.assignment_status as MyDeliveryAssignment['assignment_status'])
    const isHistory = HISTORY_STATUSES.includes(a.assignment_status as MyDeliveryAssignment['assignment_status'])

    if (mode === 'today') {
      // งาน active เห็นในแท็บวันนี้เสมอ (ไม่ว่าจะมี scheduled_date หรือไม่)
      if (isActive) return true
      // งานประวัติกรองตามวัน
      if (isHistory) return isToday(a, anchor, today)
      // สถานะอื่น (ไม่ควรเกิด) - fallback ให้เห็น
      return true
    }
    if (mode === 'month' && monthKey) {
      // เดือน: ใช้ getFilterDate fallback สำหรับทุกสถานะ
      return isInMonth(a, anchor, monthKey)
    }
    return true // fallback: show all
  })
}

/** ดึงรายการเดือนที่มีข้อมูล (เรียงใหม่ → เก่า) */
export function getAvailableMonths(assignments: MyDeliveryAssignment[], anchor: DateAnchor): string[] {
  const months = new Set<string>()
  for (const a of assignments) {
    const key = getMonthKey(a, anchor)
    if (key) months.add(key)
  }
  return Array.from(months).sort((a, b) => b.localeCompare(a)) // ใหม่ → เก่า
}

/** สร้างข้อมูลสำหรับ UI history */
export function buildHistoryData(
  assignments: MyDeliveryAssignment[],
  mode: HistoryMode,
  anchor: DateAnchor,
  monthKey?: string,
  now?: Date
): HistoryFilterResult {
  const availableMonths = getAvailableMonths(assignments, anchor)
  const currentMonthKey = monthKey ?? (availableMonths[0] ?? '')
  const filtered = filterAssignments(assignments, mode, anchor, monthKey, now)

  return {
    assignments: filtered,
    availableMonths,
    currentMonthKey,
  }
}

/** จัดรูปแบบ label เดือนภาษาไทย: 'พฤศจิกายน 2569' */
export function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number)
  if (!year || !month) return monthKey
  const thaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ]
  const buddhistYear = year + 543
  return `${thaiMonths[month - 1]} ${buddhistYear}`
}