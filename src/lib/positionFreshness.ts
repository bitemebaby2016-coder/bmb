// ============================================
// Bite Me Baby — positionFreshness (R46 · 2026-11-17)
// ============================================
// Owner สั่ง: "ใช้จากตำแหน่งจริงที่ร่วมกันของผู้ใช้ทั้ง 3 แบบให้ถูกต้องจริง" —
// พิกัดไรเดอร์ใน DB (drivers.current_*) เขียนเฉพาะตอนหน้า /rider เปิดค้างไว้
// → ถ้าไม่เปิดนาน ๆ พิกัดเก่าจะถูกโชว์ราวกับ live (บั๊กจริง: จุด กทม. ทั้งที่ไรเดอร์อยู่จันทบุรี)
// กติกา: ทุกจุดบนแผนที่ต้องบอกอายุของตัวเอง — เก่าเกิน POSITION_STALE_MIN = ตำแหน่งเก่า (สีเทา)
// ============================================

/** เกณฑ์ตำแหน่งเก่า (นาที) — heartbeat 10 วิระหว่างมีงาน / 30 วิปกติ → 10 นาที = เก่าชัดเจน */
export const POSITION_STALE_MIN = 10

export interface PositionAgeInfo {
  /** true = เก่าเกินเกณฑ์ (หรือไม่มีเวลาให้ตรวจ = ถือว่าเก่า — ห้ามอวดว่า live) */
  stale: boolean
  /** true = มีเวลาให้ตรวจ (updated_at ไม่ null) */
  known: boolean
  /** อายุเป็นนาที (known = false → null) */
  ageMin: number | null
  /** ข้อความแสดงผลภาษาไทย เช่น "ล่าสุด 14:32" / "ตำแหน่งเก่า (ล่าสุด 14:32)" */
  label: string
}

function formatClock(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

export function positionAgeInfo(updatedAt: string | null | undefined, now: Date = new Date()): PositionAgeInfo {
  if (!updatedAt) {
    return { stale: true, known: false, ageMin: null, label: 'ไม่ทราบเวลาตำแหน่ง' }
  }
  const t = Date.parse(updatedAt)
  if (!Number.isFinite(t)) {
    return { stale: true, known: false, ageMin: null, label: 'ไม่ทราบเวลาตำแหน่ง' }
  }
  const ageMin = Math.max(0, Math.round((now.getTime() - t) / 60_000))
  const stale = ageMin >= POSITION_STALE_MIN
  const clock = formatClock(new Date(t))
  return {
    stale,
    known: true,
    ageMin,
    label: stale ? `ตำแหน่งเก่า (ล่าสุด ${clock})` : `ล่าสุด ${clock}`,
  }
}
