// ============================================
// Bite Me Baby — Customer ownership helpers (null/guest safety)
// ============================================
// ทำไมถึงมีไฟล์นี้:
//   `customers.user_id` สามารถเป็น NULL ได้จริงใน production
//   (ปัจจุบัน 3 จาก 37 แถว — ข้อมูลย้ายมาก่อนมีระบบ login)
//   RLS `customers_own_read` ใช้ `user_id = auth.uid()`
//   ⇒ แถว NULL จะ "มองไม่เห็น" สำหรับ user ทั่วไปโดยอัตโนมัติ
//
// หน้าที่ของไฟล์นี้คือ "บังคับให้โค้ดทุกจุดคิดถึง null"
// และไม่ทำให้เกิด runtime error เมื่อเจอแถวที่ไม่มีเจ้าของ
//
// ขอบเขต: เป็น pure function ล้วน — ไม่แตะ DB / RLS / RPC / business rules
// ============================================

/** ค่าว่างที่ถือว่า "ไม่มีเจ้าของ" จริง (null / undefined / '' / whitespace) */
function isBlank(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '')
}

/**
 * แถว customers ที่ไม่มี Auth user ผูก — "orphan row"
 * เหตุผลที่ต้องมี: ข้อมูลย้ายจากระบบเดิมที่ไม่มี concept ของบัญชี
 */
export function isOrphanCustomer(c: { user_id?: string | null } | null | undefined): boolean {
  if (!c) return true
  return isBlank(c.user_id)
}

/**
 * ตรวจสิทธิ์แบบ null-safe ให้ตรงกับ semantics ของ RLS
 * `customers_own_read`: `user_id = auth.uid() OR is_admin()`
 *
 * SQL: `NULL = 'anything'` ได้ `NULL` (ไม่ใช่ true) → แถว orphan ถูก "ปฏิเสธ"
 * ฟังก์ชันนี้ต้องให้ผล "ตรงกัน" กับ SQL ทุกกรณี
 */
export function canCustomerBeReadBy(
  c: { user_id?: string | null } | null | undefined,
  authUid: string | null | undefined,
  isAdmin = false,
): boolean {
  if (isBlank(authUid)) return isAdmin
  if (isAdmin) return true
  if (isOrphanCustomer(c)) return false // NULL = auth.uid() → NULL → false
  return c!.user_id === authUid
}

/** สรุปสถานะเพื่อแสดงในหน้าแอดมิน (ไม่รั่วข้อมูลส่วนตัว) */
export function describeOwnershipState(c: { user_id?: string | null } | null | undefined): string {
  if (!c) return 'ไม่พบข้อมูลลูกค้า'
  if (isOrphanCustomer(c)) return 'ข้อมูลไม่มีบัญชีผูก — แอดมินเท่านั้นที่เห็น'
  return 'มีบัญชีผูกแล้ว'
}

/**
 * จำนวนแถวที่ไม่มีเจ้าของ — ใช้ตอนสรุปตัวเลข (กัน null crash ตอนนับ)
 */
export function countOwnedAndOrphan<T extends { user_id?: string | null }>(
  rows: readonly T[] | null | undefined,
): { total: number; owned: number; orphan: number } {
  const list = rows ?? []
  let orphan = 0
  for (const r of list) if (isOrphanCustomer(r)) orphan += 1
  return { total: list.length, owned: list.length - orphan, orphan }
}
