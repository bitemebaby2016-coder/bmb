// ============================================
// Bite Me Baby — Order-Mode Notice (R132)
// ============================================
// One-time-per-mode informational popup shown after an add-to-cart. Pure
// helpers only (no React) so they are unit-testable and reusable:
//   - the cart store dispatches ORDER_MODE_ADD_EVENT on a successful add
//   - <OrderModeNoticeModal> (mounted by Layout) listens, decides whether to
//     show (count < NOTICE_MAX per subject+mode), and bumps the counter on
//     accept.
// Persistence = localStorage per browser (no migration/DB). Counts survive new
// sessions and are NOT reset on reload; subject = customer.id || 'guest'.
// NOTE (guest→login): subject changes (guest vs id) so counts are independent —
// a guest may see the notice again after logging in. Accepted per "per user".
// ============================================

import type { OrderMode } from '@/config/platformConfig'

/** Window event fired by cartStore.addItem on a successful ('added') add. */
export const ORDER_MODE_ADD_EVENT = 'bmb:order-mode-add'

/** Show the notice while count < this; increment on accept. */
export const NOTICE_MAX = 2

/**
 * Fire the order-mode add event. MUST be called at the add-click entry point
 * (the moment the customer taps "เพิ่มลงตะกร้า"), BEFORE any add-on / add-to-cart
 * sheet (OrderBuilderModal) opens — so the notice precedes the sheet, not after
 * the item is already added. Guarded for non-browser contexts.
 */
export function emitOrderModeAdd(mode: OrderMode): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(ORDER_MODE_ADD_EVENT, { detail: { mode } }))
}

const NOTICE_KEY_PREFIX = 'bmb:order-notice:v1'

const NOTICE_BUTTON = 'เข้าใจแล้ว ดำเนินการต่อ'
const NOTICE_HINT = 'ขออภัยในความไม่สะดวก การแจ้งเตือนจะหายไปอัตโนมัติหลังกดปุ่มแล้ว 2 ครั้ง'

export interface OrderNoticeContent {
  title: string
  body: string
  button: string
  hint: string
}

/** localStorage key for one subject+mode counter. */
export function noticeKey(subject: string, mode: OrderMode): string {
  return `${NOTICE_KEY_PREFIX}:${subject}:${mode}`
}

/** Subject identity for persistence — logged-in id, else 'guest'. */
export function noticeSubject(customerId?: string | null): string {
  const id = (customerId ?? '').trim()
  return id || 'guest'
}

/** "คุณ<name>" when a name is present, else "คุณ" (guest). */
export function noticeWho(name?: string | null): string {
  const n = (name ?? '').trim()
  return n ? `คุณ${n}` : 'คุณ'
}

/** Current acknowledgement count for a subject+mode (0 when unset/blocked). */
export function getNoticeCount(subject: string, mode: OrderMode): number {
  if (typeof window === 'undefined') return 0
  try {
    const raw = window.localStorage.getItem(noticeKey(subject, mode))
    const n = Number(raw)
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0
  } catch {
    return 0
  }
}

/** Increment the acknowledgement count for a subject+mode (clamped ≥ 0). */
export function bumpNoticeCount(subject: string, mode: OrderMode): number {
  if (typeof window === 'undefined') return 0
  const next = getNoticeCount(subject, mode) + 1
  try {
    window.localStorage.setItem(noticeKey(subject, mode), String(next))
  } catch {
    /* storage blocked = no persistence, keep in-memory callers happy */
  }
  return next
}

/** Show policy: count < NOTICE_MAX (per subject+mode, independent). */
export function shouldShowNotice(subject: string, mode: OrderMode): boolean {
  return getNoticeCount(subject, mode) < NOTICE_MAX
}

/** Exact title/body/button/hint for a mode. `who` = noticeWho(name). */
export function noticeContent(mode: OrderMode, who: string): OrderNoticeContent {
  if (mode === 'PRE_ORDER') {
    return {
      title: '🍱 จองอาหารล่วงหน้า (Preorder)',
      body: `${who}กำลังสั่งอาหารจองล่วงหน้า\n\nระบบจัดส่งตามวันที่ปฏิทินแสดงบนเมนูด้านขวามุมบนโดยอัตโนมัติ กรุณาเลือกรอบเวลาที่สะดวกให้ร้านจัดส่งด้วยตัวเอง`,
      button: NOTICE_BUTTON,
      hint: NOTICE_HINT,
    }
  }
  return {
    title: '⚡ ส่งวันนี้ (Same-day)',
    body: `${who}กำลังสั่งอาหารส่งวันนี้ระบบจัดส่งให้อัตโนมัติทันทีหลังปรุงเสร็จ`,
    button: NOTICE_BUTTON,
    hint: NOTICE_HINT,
  }
}