// ============================================
// Bite Me Baby — R132 (Owner 2026-11-28): Order-Mode Notice popup
//   One-time-per-mode info modal after add-to-cart (Preorder / Same-day).
//   · count < 2 → show; 3rd+ add → silent (per subject+mode, persisted)
//   · accept button bumps the counter; name = คุณ<name> else คุณ (guest)
// NOTE: ไฟล์ต้องเป็น `.ts` (vitest include ไม่รับ .tsx) — source-contract assertions
//   ผ่าน `?raw` (ไม่ต้อง render modal ที่ใช้ supabase)
// ============================================
import { describe, it, expect, beforeEach } from 'vitest'
import {
  ORDER_MODE_ADD_EVENT,
  NOTICE_MAX,
  noticeKey,
  noticeSubject,
  noticeWho,
  getNoticeCount,
  bumpNoticeCount,
  shouldShowNotice,
  noticeContent,
  emitOrderModeAdd,
} from '@/lib/orderNotice'
import cartStoreSrc from '../store/cartStore.ts?raw'
import orderEntrySrc from '../lib/orderEntry.ts?raw'
import foodTheaterSrc from '../components/theater/FoodTheater.tsx?raw'
import layoutSrc from '../components/layout/Layout.tsx?raw'
import modalSrc from '../components/order/OrderModeNoticeModal.tsx?raw'
import orderNoticeSrc from '../lib/orderNotice.ts?raw'

beforeEach(() => {
  try { localStorage.clear() } catch { /* ignore */ }
})

describe('R132 — orderNotice helpers', () => {
  it('event name + max constant', () => {
    expect(ORDER_MODE_ADD_EVENT).toBe('bmb:order-mode-add')
    expect(NOTICE_MAX).toBe(2)
  })

  it('noticeKey format = bmb:order-notice:v1:<subject>:<mode>', () => {
    expect(noticeKey('guest', 'SAME_DAY')).toBe('bmb:order-notice:v1:guest:SAME_DAY')
    expect(noticeKey('u-123', 'PRE_ORDER')).toBe('bmb:order-notice:v1:u-123:PRE_ORDER')
  })

  it('noticeSubject = id หรือ guest', () => {
    expect(noticeSubject('u-1')).toBe('u-1')
    expect(noticeSubject('')).toBe('guest')
    expect(noticeSubject(null)).toBe('guest')
    expect(noticeSubject('   ')).toBe('guest')
  })

  it('noticeWho = คุณ<name> เมื่อมีชื่อ, คุณ เมื่อไม่มี', () => {
    expect(noticeWho('สมชาย')).toBe('คุณสมชาย')
    expect(noticeWho('')).toBe('คุณ')
    expect(noticeWho(null)).toBe('คุณ')
    expect(noticeWho('  ')).toBe('คุณ')
  })

  it('shouldShow 0/1 → true, 2 → false (per mode independent)', () => {
    expect(getNoticeCount('guest', 'SAME_DAY')).toBe(0)
    expect(shouldShowNotice('guest', 'SAME_DAY')).toBe(true) // 0
    bumpNoticeCount('guest', 'SAME_DAY') // → 1
    expect(shouldShowNotice('guest', 'SAME_DAY')).toBe(true) // 1
    bumpNoticeCount('guest', 'SAME_DAY') // → 2
    expect(shouldShowNotice('guest', 'SAME_DAY')).toBe(false) // 2
    // PRE_ORDER เป็นอิสระ — ยัง count 0
    expect(shouldShowNotice('guest', 'PRE_ORDER')).toBe(true)
  })

  it('bumpNoticeCount increments and persists', () => {
    expect(bumpNoticeCount('u-9', 'PRE_ORDER')).toBe(1)
    expect(bumpNoticeCount('u-9', 'PRE_ORDER')).toBe(2)
    expect(getNoticeCount('u-9', 'PRE_ORDER')).toBe(2)
    // subject อื่นไม่ได้รับผลกระทบ
    expect(getNoticeCount('guest', 'PRE_ORDER')).toBe(0)
  })

  it('noticeContent — titles + body ใช้ who + button/hint', () => {
    const pre = noticeContent('PRE_ORDER', 'คุณสมชาย')
    expect(pre.title).toBe('🍱 จองอาหารล่วงหน้า (Preorder)')
    expect(pre.body).toContain('คุณสมชายกำลังสั่งอาหารจองล่วงหน้า')
    expect(pre.button).toBe('เข้าใจแล้ว ดำเนินการต่อ')
    expect(pre.hint).toContain('หลังกดปุ่มแล้ว 2 ครั้ง')

    const same = noticeContent('SAME_DAY', 'คุณ')
    expect(same.title).toBe('⚡ ส่งวันนี้ (Same-day)')
    expect(same.body).toContain('คุณกำลังสั่งอาหารส่งวันนี้')
    expect(same.button).toBe('เข้าใจแล้ว ดำเนินการต่อ')
  })
  it('emitOrderModeAdd dispatches ORDER_MODE_ADD_EVENT with the mode', () => {
    let seen: unknown = null
    const onEvt = (e: Event) => { seen = (e as CustomEvent).detail }
    window.addEventListener(ORDER_MODE_ADD_EVENT, onEvt)
    emitOrderModeAdd('PRE_ORDER')
    window.removeEventListener(ORDER_MODE_ADD_EVENT, onEvt)
    expect(seen).toEqual({ mode: 'PRE_ORDER' })
  })
})

describe('R132 — source wiring (event fires at add-click, BEFORE the add-on sheet)', () => {
  it('cartStore.addItem NO LONGER dispatches (moved to add-click entry)', () => {
    expect(cartStoreSrc).not.toContain('ORDER_MODE_ADD_EVENT')
    expect(cartStoreSrc).not.toContain('dispatchEvent(new CustomEvent(ORDER_MODE_ADD_EVENT')
  })

  it('runOrderBuilder emits BEFORE openBuilder (sheet opens after notice)', () => {
    expect(orderEntrySrc).toContain('emitOrderModeAdd(mode)')
    const emitIdx = orderEntrySrc.indexOf('emitOrderModeAdd(mode)')
    const openIdx = orderEntrySrc.indexOf('openBuilder(product, products')
    expect(emitIdx).toBeGreaterThanOrEqual(0)
    expect(openIdx).toBeGreaterThan(emitIdx)
  })

  it('direct-add path (FoodTheater.add) emits the notice too', () => {
    expect(foodTheaterSrc).toContain('emitOrderModeAdd(mode)')
  })

  it('Layout mounts OrderModeNoticeModal', () => {
    expect(layoutSrc).toContain('OrderModeNoticeModal')
    expect(layoutSrc).toContain('<OrderModeNoticeModal />')
  })

  it('modal + content contain button label + hint + both titles', () => {
    // Exact texts live in the pure helper (single source); the modal renders them.
    expect(orderNoticeSrc).toContain('เข้าใจแล้ว ดำเนินการต่อ')
    expect(orderNoticeSrc).toContain('หลังกดปุ่มแล้ว 2 ครั้ง')
    expect(orderNoticeSrc).toContain('จองอาหารล่วงหน้า (Preorder)')
    expect(orderNoticeSrc).toContain('ส่งวันนี้ (Same-day)')
    // Modal structure: overlay z-[60], dialog semantics, accept button, event subscription.
    expect(modalSrc).toContain('z-[60]')
    expect(modalSrc).toContain('ORDER_MODE_ADD_EVENT')
    expect(modalSrc).toContain('data-testid="order-mode-notice-accept"')
    expect(modalSrc).toContain('noticeContent(mode, who)')
  })
})