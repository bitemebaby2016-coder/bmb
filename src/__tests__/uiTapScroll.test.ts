// ============================================
// L-3 (N-4 #3 · Owner 2026-10-26): จิ้มแท็บ/ลิงก์แล้วเลื่อนไปเป้าหมาย — เหมือนกันทุกหน้า
//   หน้าแรก/เมนู/ฟุตเตอร์/nav ล่าง · section เป้าหมายไม่มีจริง → fallback ด้านบนของหน้า
//   (ห้ามจิ้มแล้วนิ่ง) — scroll window จริง = <main> ไม่ใช่ window (ดู Layout.tsx)
// ============================================
import { describe, it, expect, beforeEach, vi } from 'vitest'

import { scrollMainToTop, scrollToSectionOrTop } from '@/lib/scrollTo'
import layoutSrc from '../components/layout/Layout.tsx?raw'

import homePageSrc from '../pages/HomePage.tsx?raw'
import menuPageSrc from '../pages/MenuPage.tsx?raw'
import headerSrc from '../components/layout/Header.tsx?raw'
import bottomNavSrc from '../components/layout/BottomNav.tsx?raw'
import footerSrc from '../components/layout/Footer.tsx?raw'

function appendMain(): HTMLElement {
  const main = document.createElement('main')
  document.body.appendChild(main)
  Object.defineProperty(main, 'scrollTop', { value: 500, writable: true, configurable: true })
  return main
}

describe('scrollTo helpers — ไม่ให้จิ้มแล้วนิ่ง (fallback = ด้านบนของหน้า)', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  it('scrollMainToTop: เลื่อน <main> ขึ้นบน (guard แบบเดียวกับ Layout — jsdom ไม่ implement scrollTo)', () => {
    const main = appendMain()
    scrollMainToTop()
    expect(main.scrollTop).toBe(0)
  })

  it('scrollToSectionOrTop: มี section เป้าหมาย → scrollIntoView smooth block start', () => {
    const el = document.createElement('section')
    el.id = 'target-sec'
    document.body.appendChild(el)
    const spy = vi.fn()
    ;(el as unknown as { scrollIntoView: ReturnType<typeof vi.fn> }).scrollIntoView = spy
    scrollToSectionOrTop('target-sec')
    expect(spy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
  })

  it('scrollToSectionOrTop: section ไม่มีจริง (บางแท็บชี้เป้าว่าง) → fallback เลื่อนขึ้นบน ไม่นิ่ง', () => {
    const main = appendMain()
    scrollToSectionOrTop('no-such-section-xyz')
    expect(main.scrollTop).toBe(0)
  })
})

describe('L-3 source invariants — ทุกผิวหน้า scroll ตรงกัน', () => {
  it('Layout: scroll-to-top ทั้ง pathname + search (footer ?category= บนหน้าเดิมต้องเลื่อนด้วย)', () => {
    expect(layoutSrc).toContain('}, [location.pathname, location.search])')
    expect(layoutSrc).toContain('el.scrollTo({ top: 0 })')
  })

  it('หน้าแรก: แท็บ chips ใช้ scrollToSectionOrTop (fallback เมื่อ section ไม่มีจริง)', () => {
    expect(homePageSrc).toContain('scrollToSectionOrTop(')
    expect(homePageSrc).toContain('scrollToSection(`home-cat-${cat.id}`)')
  })

  it('/menu: pickCategory + switchTab เลื่อนขึ้นบนทุกครั้ง (scrollMainToTop ถูกเรียก ≥ 2 จุด)', () => {
    const calls = menuPageSrc.match(/scrollMainToTop\(\)/g) || []
    expect(calls.length).toBeGreaterThanOrEqual(2)
    expect(menuPageSrc).toContain("import { scrollMainToTop } from '@/lib/scrollTo'")
  })

  it('Header + BottomNav: จิ้มลิงก์เป็นหน้าปัจจุบัน (pathname เดิม → Layout ไม่ fire) → scroll เอง', () => {
    expect(headerSrc).toContain('scrollIfSamePath')
    expect(headerSrc).toContain('scrollMainToTop()')
    expect(bottomNavSrc).toContain('scrollMainToTop()')
    expect(bottomNavSrc).toContain('location.pathname === item.path')
  })

  it('Footer: จิ้มลิงก์ URL เดิมเป๊ะ → scroll เอง (ต่าง URL = navigate → Layout จัดการ)', () => {
    expect(footerSrc).toContain('scrollIfSameUrl')
    expect(footerSrc).toContain('scrollMainToTop()')
  })
})