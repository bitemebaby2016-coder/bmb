// ============================================
// Bite Me Baby — theaterStage (R86 · Owner 2026-11-08)
// ============================================
// "เมนูที่เลยรอบไปแล้วไม่ต้องเอาขึ้นเธียเตอร์" — กติกาเดียวกับ L-8 ที่
// FoodTheater.add()/customize() block อยู่แล้ว แต่เดิมการเลือก "picks" ขึ้นเวที
// ไม่ผ่านกติกานี้ = เมนูพรีออเดอร์ที่เลยรอบ/ยังไม่ลงปฏิทินยังถูกยกขึ้นโชว์บนเวที
// (schedule map กรองวันเลยรอบด้วย R77 — ค่าที่หายไป = ไม่มีรอบถัดไป/เลยรอบแล้ว)
// ZERO-FAKE: same-day/dual คงอยู่เสมอ (สั่งได้จริง · server ตัดสินซ้ำตอนสั่งจริง)
// ============================================
import type { Product } from '@/types'
import { deriveOrderMode, pickTopAvailable } from './talkToBite'

export type TheaterScheduleMap = Record<string, string>

/** เหมาะขึ้นเวที theater หรือไม่ — pre-order-only ที่ไม่มีรอบถัดไปในปฏิทิน = ไม่ขึ้น */
export function theaterStageEligible(p: Product, schedule: TheaterScheduleMap = {}): boolean {
  if (deriveOrderMode(p) === null) return false
  return !(deriveOrderMode(p) === 'PRE_ORDER' && !schedule[p.id])
}

/** picks ของเวที = pickTopAvailable ที่ผ่านกติกาเวที (same-day คงอยู่เสมอ) */
export function pickTheaterStage(
  products: Product[],
  schedule: TheaterScheduleMap = {},
  count = 3,
): Product[] {
  return pickTopAvailable(
    (products || []).filter((p) => theaterStageEligible(p, schedule)),
    count,
  )
}
