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

  it('R51 (Owner 2026-11-18 · แทน R77): มี scheduleMap — pre-order tab = ทุกเมนูขายได้ รวมที่ยังไม่ลงปฏิทิน · same-day = ไม่มีป้ายเท่านั้น', () => {
    // R77 เดิมกรองเฉพาะเมนูปฏิทิน → ไม่มีปฏิทิน = แท็บ (0) ว่าง — Owner สั่ง "ต่อให้ไม่มีลงปฏิทิน
    // ก็ต้องแสดงทั้งหมด เมนูบอกสถานะเอง พอลงปฏิทินใหม่ป้ายวันขึ้นเอง"
    const map = { 'pre-only': '2026-10-28', 'same-only': '2026-10-28' }
    expect(menuTabItems(catalog, 'pre-order', '', map).map((p) => p.id)).toEqual(['same-only', 'pre-only', 'dual', 'sold-out'])
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

  it('R50 (Owner 2026-11-18): chips จากสินค้าในแท็บที่แสดงจริง — ชิปกับรายการคือชุดเดียวกัน', () => {
    // เดิม headingChips(categories, products) = ชิปคนละชุดกับรายการ → หมวด "จองล่วงหน้า" โชว์
    // ทั้งที่แท็บนับ 0 และเมนูปฏิทินหลุดไปหมวดอื่นเมื่อกดเลือกหมวด
    expect(menuPageSrc).toContain('const chips = headingChips(categories, ordered)')
    expect(menuPageSrc).not.toContain("headingChips(categories, products).filter((c) => saleModeOfCategory(c) === 'auto')")
  })

  it('R50: แท็บโหมดกรองทุกมุมมอง (ไม่เฉพาะ "ทั้งหมด") — เมนูปฏิทินห้ามหลุดหมวดอื่นตอนแท็บวันนี้', () => {
    // เดิม tab filter อยู่ใน if (selectedCategory === 'all') → กดเลือกหมวดแล้วเมนูปฏิทินโผล่
    // ในแท็บวันนี้ (ขัด "แยกสินค้าเมนูพรีออเดอร์ออกมาใส่หมวดหมู่แท็บของมัน")
    const filterBlock = menuPageSrc.match(/const filtered = products\.filter\(\(p\) => \{[\s\S]*?\n {2}\}\)/)
    expect(filterBlock).not.toBeNull()
    expect(filterBlock![0]).not.toContain("if (selectedCategory === 'all') {")
    expect(filterBlock![0]).toContain("if (menuTab === 'same-day' && isCalendar) return false")
  })

  it('R51: แท็บจองล่วงหน้าแสดงทั้งหมด — ไม่มี isCalendar filter + ยังไม่เลือกวัน = ทั้งหมด (ไม่ fallback วันแรก)', () => {
    // R77 เดิมกรองเฉพาะเมนูปฏิทิน + fallback วันแรก → ไม่มีปฏิทิน = แท็บ (0) ว่าง
    const filterBlock = menuPageSrc.match(/const filtered = products\.filter\(\(p\) => \{[\s\S]*?\n {2}\}\)/)
    expect(filterBlock).not.toBeNull()
    expect(filterBlock![0]).not.toContain("if (menuTab === 'pre-order' && !isCalendar) return false")
    expect(filterBlock![0]).toContain("if (menuTab === 'pre-order' && activeDay && scheduleMap[p.id] !== activeDay) return false")
    // activeDay = preOrderDay ตรง ๆ (ไม่มี fallback menuDays[0])
    expect(menuPageSrc).toContain('const activeDay = preOrderDay')
    // ชิป "ทุกวัน" เลิกกรองกลับมาดูรวมได้
    expect(menuPageSrc).toContain('data-testid="preorder-day-all"')
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