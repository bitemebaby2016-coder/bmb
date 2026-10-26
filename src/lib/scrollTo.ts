// ============================================
// Bite Me Baby — scroll anchors (L-3 / N-4 #3 · Owner 2026-10-26)
// ============================================
// เกณฑ์: "จิ้มแล้วต้องเลื่อน/กระโดดไปที่ทำงานจริง (ส่วนใหญ่ = ด้านบนของหน้า)
// ห้ามจิ้มแล้วนิ่ง · ทำให้เหมือนกันทุกหน้า (หน้าแรก/เมนู/ฟุตเตอร์/nav ล่าง)"
// - หน้าแรกเลื่อนไป section เป้าหมาย (ถ้ามีจริง) ไม่งั้น = ด้านบนของหน้า
// - แท็บ/ลิงก์ที่เปลี่ยน query บนหน้าเดิม (?) = Layout scroll-to-top (pathname+search)
// - จิ้มลิงก์ที่เป็นหน้าปัจจุบันอยู่แล้ว (ไม่มีการ navigate) = ต้องเลื่อนขึ้นบนเอง
// scroll window จริง = <main> (overflow-y-auto) ไม่ใช่ window — ดู Layout.tsx
// ============================================

/** scroller จริงของแอป = <main> (fallback: window สำหรับ environment ที่ยังไม่มี Layout) */
export function getMainScroller(): HTMLElement | null {
  if (typeof document === 'undefined') return null
  return document.querySelector('main')
}

/**
 * เลื่อนขึ้นด้านบนของหน้า — jsdom ไม่implement Element.scrollTo → guard + fallback
 * (รูปแบบเดียวกับ Layout scroll-to-top ที่ adminNavFeedback test คุมไว้)
 */
export function scrollMainToTop(): void {
  const el = getMainScroller()
  if (!el) {
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') window.scrollTo({ top: 0 })
    return
  }
  if (typeof el.scrollTo === 'function') el.scrollTo({ top: 0 })
  else el.scrollTop = 0
}

/**
 * เลื่อนไป section เป้าหมาย — ถ้า element ไม่มีจริง (หัวข้อถูกซ่อน/ยังไม่โหลด)
 * ต้อง "ไม่นิ่ง" → fallback = ด้านบนของหน้า (เกณฑ์ L-3: ส่วนใหญ่ = ด้านบนของหน้า)
 */
export function scrollToSectionOrTop(id: string): void {
  if (typeof document === 'undefined') return
  const el = document.getElementById(id)
  if (el && typeof el.scrollIntoView === 'function') {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    return
  }
  scrollMainToTop()
}
