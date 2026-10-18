// ============================================
// Bite Me Baby — Theater open/close preference (directive §2, 2026-10-18)
// ============================================
// "เปิด/ปิด Theater ได้ และยังเลือกซื้อผ่านหน้าร้านปกติได้" — สถานะเปิด/ปิด
// โรงละคร (FoodTheater stage บน /shop) เป็น preference ฝั่งผู้ใช้รายเครื่อง
// เก็บเฉพาะ boolean ใน localStorage (ไม่มี business authority — ร้านค้าปกติ
// ทั้ง /shop sections และ /menu ใช้ได้เสมอไม่ว่าโรงละครจะเปิดหรือปิด)
// Pure + safe: default = เปิด (เปิดประสบการณ์ Theater ตามดีไซน์เดิม),
// localStorage พัง/ไม่มี → default เสมอ ไม่ throw
// ============================================

export const THEATER_OPEN_KEY = 'bmb_theater_open'

/** อ่าน preference — เสีย/ไม่มี/ไม่ใช่ boolean → default = เปิด (true) */
export function readTheaterOpen(): boolean {
  try {
    const raw = localStorage.getItem(THEATER_OPEN_KEY)
    if (raw === '0' || raw === 'false') return false
    return true
  } catch {
    return true
  }
}

/** บันทึก preference — best-effort, ไม่ throw (private mode / quota) */
export function writeTheaterOpen(open: boolean): void {
  try {
    localStorage.setItem(THEATER_OPEN_KEY, open ? '1' : '0')
  } catch {
    /* ignore — ปุ่มยังทำงานใน session ปัจจุบัน */
  }
}
