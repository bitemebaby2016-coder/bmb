// ============================================
// Bite Me Baby — Pre-order entry points (Directive §8)
// ปุ่มบน HomePage (ก่อน Popular Menu) + ปุ่ม Footer ต้องเข้าสู่ Pre-order
// workflow เดียวกัน — ผ่าน preOrderEntryPath ตัวเดียว ไม่สร้างระบบคนละชุด
// ============================================

import { describe, it, expect } from 'vitest'
import { preOrderEntryPath, saleModeOfCategory, withPreOrderTab } from '@/lib/catalogStructure'
import homePageSrc from '../pages/HomePage.tsx?raw'
import footerSrc from '../components/layout/Footer.tsx?raw'
import menuPageSrc from '../pages/MenuPage.tsx?raw'

describe('preOrderEntryPath — ทางเข้า Pre-order workflow เดียว', () => {
  it('มีหมวดพรีออเดอร์ → /menu?category=<id> ของหมวดนั้น (deep-link ที่ MenuPage รองรับ)', () => {
    const p = preOrderEntryPath([
      { id: 'cat-1', name: 'ส่งวันนี้', slug: 'same-day' },
      { id: 'cat-2', name: 'จองล่วงหน้า / พรีออเดอร์', slug: 'pre-order' },
    ])
    expect(p).toBe('/menu?category=cat-2')
  })

  it('ไม่มีหมวดพรีออเดอร์ → /menu (fallback ไม่พัง ไม่พาไปหน้าว่าง)', () => {
    expect(preOrderEntryPath([{ id: 'cat-1', name: 'ส่งวันนี้', slug: 'same-day' }])).toBe('/menu')
    expect(preOrderEntryPath([])).toBe('/menu')
  })

  it('ใช้ vocabulary เดียวกับ saleModeOfCategory (ชื่อหมวดกำหนดโหมด — ไม่ hardcode id)', () => {
    expect(saleModeOfCategory({ name: 'พรีออเดอร์จันทบุรี', slug: 'x' })).toBe('pre_order')
    expect(preOrderEntryPath([{ id: 'cat-9', name: 'พรีออเดอร์จันทบุรี', slug: 'x' }])).toBe('/menu?category=cat-9')
  })
})

describe('withPreOrderTab — deep-link เปิดแท็บจองล่วงหน้า (Owner 2026-10-18: ปุ่มก่อนฟุตเตอร์กดแล้วไม่ไปไหน)', () => {
  it('path ที่มี query อยู่แล้ว → ต่อ &tab=pre-order', () => {
    expect(withPreOrderTab('/menu?category=cat-2')).toBe('/menu?category=cat-2&tab=pre-order')
  })

  it('path ไม่มี query → ต่อ ?tab=pre-order', () => {
    expect(withPreOrderTab('/menu')).toBe('/menu?tab=pre-order')
  })

  it('รวมกับ preOrderEntryPath ได้ URL ที่ MenuPage ใช้เปิดแท็บทันที', () => {
    const url = withPreOrderTab(preOrderEntryPath([{ id: 'cat-2', name: 'จองล่วงหน้า / พรีออเดอร์', slug: 'pre-order' }]))
    expect(url).toBe('/menu?category=cat-2&tab=pre-order')
    expect(url).toContain('tab=pre-order')
  })
})

describe('source invariants — สองตำแหน่งเข้า workflow เดียวกัน', () => {
  it('HomePage: จุดเข้า Pre-order อยู่ก่อน Popular Menu และใช้ preOrderEntryPath(categories)', () => {
    expect(homePageSrc).toContain('data-testid="home-preorder-entry"')
    expect(homePageSrc).toContain('preOrderEntryPath(categories)')
    expect(homePageSrc).toContain('home-preorder-entry-heading')
    // ตำแหน่ง: entry ต้องมาก่อน section Popular (home-popular-heading)
    const entryIdx = homePageSrc.indexOf('home-preorder-entry')
    const popularIdx = homePageSrc.indexOf('home-popular-heading')
    expect(entryIdx).toBeGreaterThan(-1)
    expect(popularIdx).toBeGreaterThan(-1)
    expect(entryIdx).toBeLessThan(popularIdx)
  })

  it('Footer: ไม่มีปุ่ม Pre-order ค้างอยู่ (Owner 2026-10-18 สั่งนำปุ่มออกจากฟุตเตอร์ทุกหน้า)', () => {
    expect(footerSrc).not.toContain('data-testid="footer-preorder-entry"')
  })

  it('HomePage entry ใช้ withPreOrderTab เดียวกัน และ MenuPage รับ ?tab= (เปิดแท็บให้ทันที)', () => {
    expect(homePageSrc).toContain('withPreOrderTab(preOrderEntryPath(categories))')
    expect(menuPageSrc).toContain("searchParams.get('tab')")
    expect(menuPageSrc).toContain("setMenuTab(wantTab)")
  })
})
