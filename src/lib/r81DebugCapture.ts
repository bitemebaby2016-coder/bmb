// ============================================
// Bite Me Baby — R81-B1 debug capture (behind flag)
// คำสั่ง Owner R81: "แก้ตามข้อเท็จจริง ห้ามเดา" (บทเรียน 6 รอบที่แก้ blind R46→R79)
//   → debug mode นี้เก็บ UA + ผลการกดปุ่มแต่ละปุ่ม ลง localStorage (+ console)
//   Owner เปิดด้วยการเข้าเว็บพร้อม `?r81debug=1` หนเดียว (จำถาวร) แล้วกดปุ่มทีละปุ่ม
//   → ส่ง screenshot console / ค่า localStorage `bmb:r81-debug-log` มาให้ทีม
// ค่าเริ่มต้น = ปิด — คนทั่วไปไม่มี overhead ใด ๆ (ทุกฟังก์ชัน fail-safe)
// ============================================

export const R81_DEBUG_FLAG = 'bmb:r81-debug'
export const R81_DEBUG_LOG = 'bmb:r81-debug-log'
export const R81_DEBUG_MAX = 60

export interface R81DebugEntry {
  t: string
  ua: string
  action: string
  detail?: string
}

/** เปิด debug หรือยัง — flag ใน localStorage (หรือ ?r81debug=1 = เปิด+จดจำให้เอง) */
export function r81DebugEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    if (window.localStorage.getItem(R81_DEBUG_FLAG) === '1') return true
    if (typeof window.location !== 'undefined' && /[?&]r81debug=1(&|$)/.test(window.location.search)) {
      window.localStorage.setItem(R81_DEBUG_FLAG, '1')
      return true
    }
  } catch { /* private mode = ปิดเงียบ */ }
  return false
}

/** อ่าน log ที่เก็บไว้ (ให้ Owner copy ไปส่ง/เทสต์ได้) */
export function r81ReadLog(): R81DebugEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(R81_DEBUG_LOG)
    const arr = raw ? (JSON.parse(raw) as unknown) : null
    return Array.isArray(arr) ? (arr as R81DebugEntry[]) : []
  } catch { return [] }
}

/** บันทึกผลการกดปุ่ม (ทำงานเฉพาะตอน flag เปิด · เก็บ capped ที่ R81_DEBUG_MAX แถว) */
export function r81Capture(action: string, detail?: string): void {
  if (!r81DebugEnabled()) return
  const entry: R81DebugEntry = {
    t: new Date().toISOString(),
    ua: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    action,
    ...(detail ? { detail } : {}),
  }
  try {
    const log = r81ReadLog()
    log.push(entry)
    window.localStorage.setItem(R81_DEBUG_LOG, JSON.stringify(log.slice(-R81_DEBUG_MAX)))
  } catch { /* quota/edge — ไม่ทำให้หน้าพัง */ }
  try { console.info('[R81]', action, detail || '', entry.t) } catch { /* */ }
}

/** Pure — จำแนก platform จาก UA เพื่อเลือกข้อความ guide ที่ใช้ได้จริงบนเครื่องนั้น */
export function r81Platform(ua: string): 'ios' | 'android' | 'other' {
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'other'
}
