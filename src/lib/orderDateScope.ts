// ============================================
// Bite Me Baby — Admin Orders date scope (Owner 2026-11-07)
// ============================================
// (ก) "All modes"/ทุกโหมด = แสดงเฉพาะ "วันปัจจุบัน" เท่านั้น (default scope)
// (ข) แท็บเดือนบนแถวเดียวกัน = ทางเข้าดู "ออเดอร์อดีต" แยกเป็นเดือน
// PURE helpers (ไม่มี I/O) — เงื่อนไข query จริงอยู่ที่ bmbAdminApi_orders.getOrdersPaged
// เกณฑ์ union (บทเรียน D-07 "ห้ามซ่อนออเดอร์จริง"): ออเดอร์อยู่ในสโคปเมื่อ
//   scheduled_date อยู่ในช่วง หรือ created_at อยู่ในช่วง — สองเงื่อนไข OR กัน
//   (ออเดอร์ใหม่วันนี้ที่นัดส่งอนาคต/พรีออเดอร์ที่ถึงกำหนดวันนี้ ต้องเห็นทั้งคู่)

export interface OrderDateScope {
  scheduledFrom: string // 'YYYY-MM-DD' ขอบรวม
  scheduledTo: string // 'YYYY-MM-DD' ขอบรวม
  createdFrom: string // ISO instant ขอบรวม
  createdTo: string // ISO instant ขอบ exclusive (query ด้วย created_at.lt)
}

const TH_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

const pad2 = (n: number) => String(n).padStart(2, '0')

/** 'YYYY-MM-DD' ของวันตาม timezone เครื่องผู้ใช้งาน (Owner ใช้งานจากไทย) */
export function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** 'YYYY-MM' ของเดือนตาม timezone เครื่องผู้ใช้งาน */
export function localMonthKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
}

/** สโคป "วันนี้" — scheduled_date = วันนี้ หรือ created_at อยู่ในวันนี้ (เที่ยงคืน→เที่ยงคืน) */
export function dateScopeForToday(now: Date = new Date()): OrderDateScope {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return {
    scheduledFrom: localDateStr(start),
    scheduledTo: localDateStr(start),
    createdFrom: start.toISOString(),
    createdTo: end.toISOString(),
  }
}

/** สโคปเดือน 'YYYY-MM' — scheduled_date หรือ created_at อยู่ในเดือนนั้น */
export function dateScopeForMonth(monthKey: string): OrderDateScope {
  const [y, m] = monthKey.split('-').map(Number)
  const start = new Date(y, m - 1, 1)
  const lastDay = new Date(y, m, 0) // วันสุดท้ายของเดือน
  const nextMonth = new Date(y, m, 1) // ขอบ exclusive ของ created
  return {
    scheduledFrom: localDateStr(start),
    scheduledTo: localDateStr(lastDay),
    createdFrom: start.toISOString(),
    createdTo: nextMonth.toISOString(),
  }
}

/**
 * แท็บเดือนจากข้อมูลจริง: union ของเดือน scheduled_date และเดือน created_at
 * (timezone เครื่อง) · เรียงใหม่→เก่า · ไม่ซ้ำ — เดือนไหนไม่มีออเดอร์ไม่ขึ้นแท็บ
 */
export function orderMonthKeys(rows: Iterable<{ scheduled_date?: string | null; created_at: string }>): string[] {
  const keys = new Set<string>()
  for (const r of rows) {
    if (r.scheduled_date) keys.add(String(r.scheduled_date).slice(0, 7))
    if (r.created_at) keys.add(localMonthKey(new Date(r.created_at)))
  }
  return [...keys].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
}

/** ป้ายแท็บเดือน เช่น '2026-11' → 'พ.ย. 2026' */
export function monthChipLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number)
  return `${TH_SHORT[(m - 1 + 12) % 12]} ${y}`
}