// ============================================
// Bite Me Baby — productSchedule (UX fix 2026-10-15)
// ============================================
// วันจัดส่งจริงของเมนูจองล่วงหน้าบนการ์ด = ตาราง menu_schedule (migration 039)
// ที่แอดมินตั้งที่ /admin/menu-schedule เท่านั้น — ค่าเก่า products.scheduled_date
// (คอลัมน์เก่า) ต้องไม่ถูกใช้แสดงผลอีก (owner report 2026-10-15: การ์ดโชว์วันผิด)
//
// - เฉพาะแถว is_published = true (anon อ่านได้เฉพาะแถวเผยแพร่ — migration 056)
// - map: product_id → วันจัดส่ง "ถัดไป" (scheduled_date >= วันนี้ ตามเวลา Asia/Bangkok)
// - ไม่มีแถว published / โหลดไม่ได้ = {} → การ์ดไม่แสดงป้ายวันที่ (ไม่เดาวันเอง)
// - delivery_round_key: ใช้เป็นเงื่อนไขตอนสั่ง (mirrorPreOrderScheduleGate ใน
//   bmbMenuSchedule.ts) — ไม่กระทบ "วันที่" ที่โชว์มุมการ์ด (trg_menu_gate ผูกกับวัน)
// Pure logic + thin fetch wrapper (cache สั้น ๆ กันยิงซ้ำต่อหน้า)
// ============================================

import { supabase } from './supabase'
import { roundBookability, type RoundTimeInfo } from './deliveryRoundStatus'
import { getActiveRoundsForDate } from './bmbAdminApi_rounds'

export interface ProductScheduleRow {
  product_id: string
  scheduled_date: string // YYYY-MM-DD (menu_schedule.scheduled_date)
  is_published: boolean
  delivery_round_key?: string | null
}

/** product_id → วันจัดส่งถัดไป (YYYY-MM-DD) */
export type ProductScheduleMap = Record<string, string>

/** วันนี้ (ปฏิทิน Asia/Bangkok, UTC+7 คงที่) เป็น YYYY-MM-DD — deterministic ทุก timezone */
export function bangkokTodayISO(utcMs: number = Date.now()): string {
  return new Date(utcMs + 7 * 60 * 60_000).toISOString().slice(0, 10)
}

/**
 * map product_id → วันจัดส่งถัดไปจากแถว menu_schedule (pure)
 * - เฉพาะ is_published = true (แถว draft ห้ามโชว์)
 * - เฉพาะ scheduled_date >= today (วันผ่านไปแล้ว = ไม่โชว์ป้าย)
 * - R77 (Owner: "เมนูพรีออเดอร์ที่เลยรอบส่งของวันปัจจุบันไม่ต้องแสดงแล้ว"):
 *   opts.todayPassed = true → วันนี้ที่เลยรอบส่งแล้ว = ถือว่าผ่านไปแล้วเท่ากัน
 *   (ผล = เมนูวนไปโชว์วันถัดไปที่ยังไม่เลยรอบ — ตามสัญญา R5 "วนใช้รอบถัดไปได้")
 * - หลายวันต่อสินค้า = วันที่ใกล้ที่สุด (next delivery day)
 */
export function pickNextScheduleDates(rows: ProductScheduleRow[], today: string, opts?: { todayPassed?: boolean }): ProductScheduleMap {
  const map: ProductScheduleMap = {}
  for (const r of rows || []) {
    if (!r || typeof r.product_id !== 'string' || !r.product_id) continue
    if (!r.is_published) continue
    const d = r.scheduled_date
    if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d) || d < today) continue
    if (opts?.todayPassed && d === today) continue // R77: วันนี้ที่เลยรอบแล้ว = ไม่โชว์
    const prev = map[r.product_id]
    if (!prev || d < prev) map[r.product_id] = d
  }
  return map
}

// ---- fetch (anon-safe: published rows only — migration 056) ----

let cache: { atMs: number; map: ProductScheduleMap } | null = null
const CACHE_TTL_MS = 60_000

/** ดึงวันจัดส่งถัดไปของทุกเมนูจาก menu_schedule (published) — ล้มเหลว = {} (ไม่โชว์ป้าย ไม่เดา) */
export async function getProductScheduleMap(nowMs: number = Date.now()): Promise<ProductScheduleMap> {
  if (cache && nowMs - cache.atMs < CACHE_TTL_MS) return cache.map
  try {
    const today = bangkokTodayISO(nowMs)
    const { data, error } = await supabase
      .from('menu_schedule')
      .select('product_id, scheduled_date, is_published, delivery_round_key')
      .eq('is_published', true)
      .gte('scheduled_date', today)
      .order('scheduled_date', { ascending: true })
    if (error) {
      console.error('[getProductScheduleMap] Error:', error)
      return cache?.map ?? {}
    }
    // R77: วันนี้ที่ "เลยรอบส่ง" แล้ว = ไม่โชว์ (อ่านรอบส่งวันนี้แบบ read-only —
    // โหลดรอบไม่ได้ = โชว์ตามปกติ ไม่เดา/ไม่บล็อก)
    let todayPassed = false
    try {
      const rounds = await getActiveRoundsForDate(today)
      todayPassed = isPreOrderDayPassed(today, rounds as RoundTimeInfo[], { nowUtcMs: nowMs, today })
    } catch { todayPassed = false }
    const map = pickNextScheduleDates((data || []) as ProductScheduleRow[], today, { todayPassed })
    cache = { atMs: nowMs, map }
    return map
  } catch (err) {
    console.error('[getProductScheduleMap] Error:', err)
    return cache?.map ?? {}
  }
}

/** ล้างแคช (ใช้ตอนทดสอบ/เมื่อแอดมินเพิ่งเผยแพร่ตารางใหม่) */
export function resetProductScheduleCache(): void {
  cache = null
}

// ---- R5 (Owner 2026-10-23): แยก "เมนูรอบพิเศษ" ออกจาก pre-order ทั่วไป ----

/**
 * วันจัดส่งของตะกร้าที่มีเมนูรอบพิเศษ "ถูกกำหนดโดยปฏิทินแอดมิน" (ป้ายมุมเมนู)
 * - ไม่มีสินค้าผูกวัน → { date: null, conflict: [] } (pre-order ทั่วไป: ลูกค้าเลือกวัน+รอบเอง)
 * - ผูกวันเดียวกัน → { date } (checkout ล็อกวันอัตโนมัติ — ลูกค้าเลือกแค่รอบจัดส่ง)
 * - ผูกหลายวันต่างกัน → { date: null, conflict } (แจ้งแยกสั่งคนละรอบ — ไม่เดา/ไม่ merge)
 */
export function resolveMenuBoundDate(
  items: ReadonlyArray<{ product_id: string }>,
  scheduleMap: ProductScheduleMap,
): { date: string | null; conflict: string[] } {
  const dates: string[] = []
  for (const it of items || []) {
    const d = scheduleMap?.[it.product_id]
    if (d && !dates.includes(d)) dates.push(d)
  }
  if (dates.length === 0) return { date: null, conflict: [] }
  if (dates.length === 1) return { date: dates[0], conflict: [] }
  return { date: null, conflict: [...dates].sort() }
}

/**
 * วันเมนูที่ผ่านรอบจัดส่งไปแล้ว = archive (เก็บทันที): ไม่โชว์ลูกค้า,
 * แอดมินยังเห็น/วนใช้รอบถัดไปได้ (pickNextScheduleDates กรอง d < today แล้ว)
 */
export function isMenuDateArchived(dateISO: string, today: string = bangkokTodayISO()): boolean {
  return typeof dateISO === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateISO) && dateISO < today
}

/**
 * R77 (Owner 2026-11-07 "เมนูพรีออเดอร์ที่เลยรอบส่งของวันปัจจุบันไม่ต้องแสดงแล้ว (ยังมีอยู่ในเมนูยอดนิยม)
 *  ... ถ้าจะเอาไม่มีรอบขึ้นโชว์ ให้อยู่ในกฏยังไม้ลงปฏิทินแบบเดิม"): วันเมนู "เลยรอบ" =
 * - วันก่อนวันนี้ (archive เดิม) · หรือวันนี้ที่รอบส่ง PRE_ORDER ปิดรับ/หมดเวลาจัดส่งแล้ว "ทุกรอบ"
 *   (mirror roundBookability แบบวัน — เฉพาะ cutoff_passed/window_passed ที่นับว่า "เลยรอบ")
 * - วันนี้ที่ไม่มีรอบส่งเลย = ไม่มีของให้ส่งวันนี้ = ให้ไปอยู่ในสถานะ "ยังไม่ลงปฏิทิน" (map ไม่มีค่า →
 *   หน้าเมนู/เมนูยอดนิยมใช้กฎ "ยังไม่ลงปฏิทิน" เดิมต่อโดยอัตโนมัติ — ไม่สร้างกติกาใหม่)
 * Unknown/invalid times = ยังไม่ถือว่าเลยรอบ (ZERO-FAKE — server ตัดสินซ้ำตอนสั่งจริง)
 */
export function isPreOrderDayPassed(
  dateISO: string,
  rounds: RoundTimeInfo[],
  opts: { nowUtcMs?: number; today?: string; preOrderCutoffHours?: number } = {},
): boolean {
  const today = opts.today ?? bangkokTodayISO(opts.nowUtcMs ?? Date.now())
  if (dateISO < today) return true
  if (dateISO > today) return false
  if (!rounds || rounds.length === 0) return true
  return rounds.every((r) => {
    const b = roundBookability(r, {
      isToday: true,
      mode: 'PRE_ORDER',
      nowUtcMs: opts.nowUtcMs,
      preOrderCutoffHours: opts.preOrderCutoffHours ?? 2,
    })
    return b === 'cutoff_passed' || b === 'window_passed'
  })
}
