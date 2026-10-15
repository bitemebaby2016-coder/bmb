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
 * - หลายวันต่อสินค้า = วันที่ใกล้ที่สุด (next delivery day)
 */
export function pickNextScheduleDates(rows: ProductScheduleRow[], today: string): ProductScheduleMap {
  const map: ProductScheduleMap = {}
  for (const r of rows || []) {
    if (!r || typeof r.product_id !== 'string' || !r.product_id) continue
    if (!r.is_published) continue
    const d = r.scheduled_date
    if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d) || d < today) continue
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
    const map = pickNextScheduleDates((data || []) as ProductScheduleRow[], today)
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
