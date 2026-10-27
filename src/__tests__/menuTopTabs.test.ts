// ============================================
// L-4 (N-4 #4 · Owner 2026-10-26): เมนูจากแท็บ/ปุ่มด้านบน
//   "แสดงครบทุกหัวข้อ + ถูกทั้งสองโหมด"
// ============================================

import { describe, it, expect } from 'vitest'

import { menuTabItems, headingChips } from '@/lib/catalogStructure'

import type { Product, ProductCategory } from '@/types'

import menuPageSrc from '../pages/MenuPage.tsx?raw'

import homePageSrc from '../pages/HomePage.tsx?raw'

import foodMenuCardSrc from '../components/FoodMenuCard.tsx?raw'

const prod = (id: string, over: Partial<Product> = {}): Product => ({
  id, name: id, description: '', price: 50, category_id: 'c1', image_url: '',
  is_available: true, is_featured: false, is_preorder: false, prep_minutes: 5,
  sort_order: 0, created_at: '', ...over,
} as Product)

const catalog = [
  prod('same-only', { available_same_day: true, available_preorder: false }),
  prod('pre-only', { available_same_day: false, available_preorder: true }),
  prod('dual', { available_same_day: true, available_preorder: true }),
  prod('sold-out', { available_same_day: false, is_available: false, is_preorder: true, available_preorder: true }),
  prod('archived-item', { archived: true }),
]

describe('menuTabItems — ป้ายตัวเลขบนแท็บ = รายการที่แท็บแสดงจริง (สูตรเดียวกับ list)', () => {

  it('same-day tab: รวมสินค้าที่สั่งวันนี้ได้ (canonical + alias) — ตัด archived/จองล่วงหน้าล้วนออก', () => {
    const ids = menuTabItems(catalog, 'same-day', '').map((p) => p.id)
    expect(ids).toEqual(['same-only', 'dual'])
    expect(ids).not.toContain('archived-item')
    expect(ids).not.toContain('pre-only')
  })

  it('pre-order tab (Feature A): ทั้งหมดที่ไม่ใช่ archived = สินค้าทั่วไปร่วมรอบจองได้ — ไม่ใช่เฉพาะเมนูปฏิทิน', () => {
    const ids = menuTabItems(catalog, 'pre-order', '').map((p) => p.id)
    expect(ids).toEqual(['same-only', 'pre-only', 'dual', 'sold-out'])
    expect(ids).not.toContain('archived-item')
  })

  it('ค้นหา (search) ตรงกับที่ list กรอง — case-insensitive + trim', () => {
    expect(menuTabItems(catalog, 'pre-order', '  DUAL ').map((p) => p.id)).toEqual(['dual'])
    expect(menuTabItems(catalog, 'same-day', 'dual').map((p) => p.id)).toEqual(['dual'])
    expect(menuTabItems(catalog, 'pre-order', 'zzz')).toEqual([])
  })

  it('Owner 2026-10-27: มี scheduleMap = พรีออเดอร์กับเมนูตารางอันเดียวกัน — pre-order tab = เมนูปฏิทินเท่านั้น', () => {
    // สองเมนูบนตาราง (ป้ายปฏิทิน) — ปิดจุด "บางหน้าบอก 2 บางหน้าบอก 20"
    const map = { 'pre-only': '2026-10-28', 'same-only': '2026-10-28' }
    expect(menuTabItems(catalog, 'pre-order', '', map).map((p) => p.id)).toEqual(['same-only', 'pre-only'])
    expect(menuTabItems(catalog, 'same-day', '', map).map((p) => p.id)).toEqual(['dual', 'sold-out'])
  })
})

describe('L-4 source — /menu: chips ครบทุกหัวข้อ + ป้ายแท็บถูกทั้งสองโหมด', () => {

  it('MenuPage ใช้ menuTabItems นับทั้งสองแท็บ (ไม่ใช่สูตรคนละชนิดกับ list อีกต่อไป)', () => {
    expect(menuPageSrc).toContain("menuTabItems(products, 'same-day', searchQuery, scheduleMap).length")
    expect(menuPageSrc).toContain("menuTabItems(products, 'pre-order', searchQuery, scheduleMap).length")
    // สูตรเดิมที่เพี้ยนต้องหายไป
    expect(menuPageSrc).not.toContain('products.filter(p => (p.available_same_day ?? !p.is_preorder) && p.is_available).length')
    expect(menuPageSrc).not.toContain('products.filter(p => !!scheduleMap[p.id]).length')
  })

  it('MenuPage chips = headingChips ครบ (รวมหมวดโหมดขายที่ render เป็น section ด้านล่าง) ไม่กรองทิ้ง', () => {
    expect(menuPageSrc).toContain('const chips = headingChips(categories, products)')
    expect(menuPageSrc).not.toContain("headingChips(categories, products).filter((c) => saleModeOfCategory(c) === 'auto')")
  })

  it('FoodMenuCard รับ prop tab — ในแท็บจองล่วงหน้าซ่อนปุ่ม "สั่งเลยวันนี้" (โหมดถูกทั้งสองแท็บ)', () => {
    expect(menuPageSrc).toContain('tab={menuTab}')
    expect(foodMenuCardSrc).toContain("tab?: 'same-day' | 'pre-order'")
    // Owner 2026-10-27: ปุ่มไม่ผูกกับแท็บแล้ว — มีป้ายปฏิทิน (เมนูตาราง) = "จองล่วงหน้า",
    // ไม่มีป้าย = "สั่งทันที" ทุกแท็บ (preOrderTab ถูกถอดออกตามคำสั่งใหม่)
    expect(foodMenuCardSrc).toContain('scheduledDate ? (')
    expect(foodMenuCardSrc).toContain('⚡ สั่งทันที')
  })

  it('หน้าแรก: แท็บลอย (ทั้งหมด/ส่งวันนี้/พรีออเดอร์) อยู่นอก guard chips.length — ห้ามหายเมื่อไม่มี chips', () => {
    // guard เดิม {chips.length > 0 && (...)} ครอบทั้งแถว → หัวข้อหายทั้งแถบ = "หัวข้อแสดงไม่ครบ"
    expect(homePageSrc).not.toContain('{chips.length > 0 && (')
    expect(homePageSrc).toContain('data-testid="home-tab-all"')
    expect(homePageSrc).toContain('data-testid="home-tab-sameday"')
    expect(homePageSrc).toContain('data-testid="home-tab-preorder"')
  })

  it('ป้ายแท็บ = label ที่ระบุ + ตัวเลขจาก menuTabItems', () => {
    expect(menuPageSrc).toContain('วันนี้ ({sameDayCount})')
    expect(menuPageSrc).toContain('จองล่วงหน้า ({preOrderCount})')
    expect(menuPageSrc).toContain('data-testid="same-day-tab"')
    expect(menuPageSrc).toContain('data-testid="pre-order-tab"')
  })
})

describe('L-4 — headingChips คืนทุกหัวข้อที่มีสินค้า (ไม่กรองหมวดโหมดทิ้ง)', () => {

  it('หมวดโหมดขาย (ส่งวันนี้/จองล่วงหน้า) อยู่ใน chips เมื่อมีสินค้า — ครบทุกหัวข้อ', () => {

    const cat = (id: string, name: string): ProductCategory =>
      ({ id, name, slug: id, icon: '', sort_order: 99, is_active: true, created_at: '' } as ProductCategory)
    const cats = [cat('c-sameday', 'ส่งวันนี้ / Same Day'), cat('c-health', 'เมนูสุขภาพ')]
    const prods = [prod('p1', { category_id: 'c-sameday' }), prod('p2', { category_id: 'c-health' })]
    const names = headingChips(cats, prods).map((c) => c.name)
    expect(names).toContain('ส่งวันนี้ / Same Day')
    expect(names).toContain('เมนูสุขภาพ')
  })
})