// ============================================
// Bite Me Baby — shop hours LOGIC (pure — no I/O)
// sync กับ business_settings.hours { open, close } (Owner 2026-10-26:
// "ร้านปิด 20:00 แต่ยังสั่งเซมเดย์ได้ = ไม่ได้ซิงค์ค่าที่แอดมินตั้ง")
// ZERO-FAKE: ไม่มีข้อมูล/parse ไม่ได้ = ห้ามเดาปิด (คืน null → ผู้เรียกข้ามกฎ)
// ============================================

export interface ShopHours { open: string; close: string }
export interface ShopHoursMs { openMs: number; closeMs: number }

/** '8:00' | '08:00' | '20:00:00' → ms-of-day (นาที) หรือ null */
export function parseHHMM(v: unknown): number | null {
  const raw = String(v ?? '').trim()
  if (!raw) return null
  const m = raw.match(/^(\d{1,2}):(\d{2})/)
  if (!m) return null
  const h = Number(m[1])
  const mm = Number(m[2])
  if (!Number.isFinite(h) || !Number.isFinite(mm) || h < 0 || h > 23 || mm < 0 || mm > 59) return null
  return h * 3_600_000 + mm * 60_000
}

export function hoursToMs(h: ShopHours | null | undefined): ShopHoursMs | null {
  if (!h) return null
  const openMs = parseHHMM(h.open)
  const closeMs = parseHHMM(h.close)
  if (openMs === null || closeMs === null) return null
  return { openMs, closeMs }
}

/**
 * true = ms-of-day (Bangkok) อยู่ในช่วงเปิดร้าน
 * - ไม่มีข้อมูล (hm null / ms null) = true (ห้ามเดาปิด — ZERO-FAKE)
 * - รองรับข้ามเที่ยงคืน (close <= open → เปิดตั้งแต่ open ถึงเที่ยงคืน + 00:00 ถึง close)
 */
export function withinShopHours(msOfDay: number | null, hm: ShopHoursMs | null): boolean {
  if (msOfDay === null || !hm) return true
  if (hm.closeMs <= hm.openMs) return msOfDay >= hm.openMs || msOfDay < hm.closeMs
  return msOfDay >= hm.openMs && msOfDay < hm.closeMs
}
