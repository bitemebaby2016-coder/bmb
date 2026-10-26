// ============================================
// L-7 (N-4 #7 · Owner 2026-10-26): หัวข้อแท็บแนวนอน/แนวตั้ง/ฟุตเตอร์
//   ลำดับ: ส่งวันนี้ → จองล่วงหน้า → สุขภาพ → เครื่องดื่ม → ของทานเล่น → สำเร็จรูป
//   ลิงก์ไปหมวดจริง · ชื่อ = ที่แอดมินตั้ง · ฟุตเตอร์เรียงลำดับเดียวกัน + ลิงก์จริงทุกอัน
// ============================================
import { describe, it, expect } from 'vitest'

import { categoryDisplayRank, CATEGORY_DISPLAY_ORDER, headingChips, buildHeadingGroups } from '@/lib/catalogStructure'

import type { Product, ProductCategory } from '@/types'

import catalogSrc from '../lib/catalogStructure.ts?raw'

import homePageSrc from '../pages/HomePage.tsx?raw'

import menuPageSrc from '../pages/MenuPage.tsx?raw'

import footerSrc from '../components/layout/Footer.tsx?raw'

import appSrc from '../App.tsx?raw'

const cat = (id: string, name: string): ProductCategory =>
  ({ id, name, slug: id, icon: '', sort_order: 99, is_active: true, created_at: '' } as ProductCategory)
const prod = (id: string, category_id: string): Product => ({
  id, name: id, description: '', price: 50, category_id, image_url: '',
  is_available: true, is_featured: false, is_preorder: false, prep_minutes: 5,
  sort_order: 99, created_at: '',
} as Product)

describe('ลำดับ displayRank = N-4 #7 (Owner 2026-10-26 · แทนท่า Feature B 2026-10-25)', () => {

  it(' CATEGORY_DISPLAY_ORDER: modes ขึ้นก่อน — ส่งวันนี้ → จองล่วงหน้า → สุขภาพ → ... → สำเร็จรูป', () => {
    expect([...CATEGORY_DISPLAY_ORDER]).toEqual([
      ['ส่งวันนี้ / Same Day', 'ส่งวันนี้', 'same day'],
      ['จองล่วงหน้า / พรีออเดอร์', 'พรีออเดอร์', 'จองล่วงหน้า', 'preorder'],
      ['เมนูสุขภาพ'],
      ['เครื่องดื่ม'],
      ['ของทานเล่น / ผลไม้', 'ของหวานลัน / ผลไม้', 'ของกินเล่น / ผลไม้'],
      ['สินค้าสำเร็จรูป', 'เมนูสำเร็จ'],
    ])
    expect(categoryDisplayRank('ส่งวันนี้ / Same Day')).toBe(0)
    expect(categoryDisplayRank('ส่งวันนี้')).toBe(0)
    expect(categoryDisplayRank('same day')).toBe(0)
    expect(categoryDisplayRank('จองล่วงหน้า / พรีออเดอร์')).toBe(1)
    expect(categoryDisplayRank('พรีออเดอร์')).toBe(1)
    expect(categoryDisplayRank('เมนูสุขภาพ')).toBe(2)
    expect(categoryDisplayRank('เครื่องดื่ม')).toBe(3)
    expect(categoryDisplayRank('ของทานเล่น / ผลไม้')).toBe(4)
    expect(categoryDisplayRank('ของหวานลัน / ผลไม้')).toBe(4) // alias ชื่อจริงใน DB
    expect(categoryDisplayRank('สินค้าสำเร็จรูป')).toBe(5)
    expect(categoryDisplayRank('เมนูสำเร็จ')).toBe(5) // alias ชื่อจริงใน DB
    expect(categoryDisplayRank('สินค้าตรุษจีน')).toBe(CATEGORY_DISPLAY_ORDER.length) // นอกลิสต์ = ท้าย
  })

  it('ทั้ง chips (แนวนอน) และ sections (แนวตั้ง) เรียงตาม displayRank — ส่งวันนี้มาก่อนสุขภาพ', () => {
    const cats = [
      cat('c-health', 'เมนูสุขภาพ'),
      cat('c-sameday', 'ส่งวันนี้ / Same Day'),
      cat('c-pre', 'จองล่วงหน้า / พรีออเดอร์'),
      cat('c-drink', 'เครื่องดื่ม'),
    ]
    const prods = cats.map((c) => prod(`p-${c.id}`, c.id))
    const expected = ['ส่งวันนี้ / Same Day', 'จองล่วงหน้า / พรีออเดอร์', 'เมนูสุขภาพ', 'เครื่องดื่ม']
    expect(headingChips(cats, prods).map((c) => c.name)).toEqual(expected)
    expect(buildHeadingGroups(prods, cats).map((g) => g.category.name)).toEqual(expected)
    expect(catalogSrc).toContain('categoryDisplayRank(a.name) - categoryDisplayRank(b.name)')
  })
})

describe('L-7 — แนวตั้งหน้าแรก: theater + เมนูแนะนำ แล้วตามลำดับข้างต้น', () => {
  it(' FoodTheater → เมนูแนะนำ → ส่งวันนี้ → พรีออเดอร์ → CategorySections', () => {
    const iTheater = homePageSrc.indexOf('<FoodTheater')
    const iRec = homePageSrc.indexOf('id="home-sec-recommended"')
    const iSame = homePageSrc.indexOf('id="home-sec-sameday"')
    const iPre = homePageSrc.indexOf('id="home-sec-preorder"')
    const iCat = homePageSrc.indexOf('<CategorySections')
    expect(iTheater).toBeGreaterThan(-1)
    expect(iRec).toBeGreaterThan(iTheater)
    expect(iSame).toBeGreaterThan(iRec)
    expect(iPre).toBeGreaterThan(iSame)
    expect(iCat).toBeGreaterThan(iPre)
  })

  it('/menu sections ใช้ buildHeadingGroups(ordered) = displayRank (modes ขึ้นก่อนตาม N-4 #7)', () => {
    expect(menuPageSrc).toContain('buildHeadingGroups(ordered, categories)')
  })
})

describe('L-7 — ฟุตเตอร์: ลำดับเดียวกับหัวข้อเมนู + ลิงก์จริงทุกอัน', () => {
  it('Footer sort = displayRank ก่อน sort_order (เดิม sort_order อย่างเดียว → ลำดับเพี้ยน)', () => {
    expect(footerSrc).toContain('categoryDisplayRank(a.name) - categoryDisplayRank(b.name) || (a.sort_order || 0) - (b.sort_order || 0)')
  })
  it('ลิงก์เมนูหมวดใช้ชื่อจริงจาก DB + deep-link ?category= ที่ MenuPage รองรับ', () => {
    expect(footerSrc).toContain('path: `/menu?category=${encodeURIComponent(c.slug || c.id)}`')
    expect(footerSrc).toContain('${c.icon ? c.icon + \' \' : \'\'}${c.name}')
    expect(menuPageSrc).toContain('categories.find((c) => c.id === want) ?? categories.find((c) => c.slug === want)')
  })
  it('ลิงก์ static ของฟุตเตอร์ทุกอันชี้ไป route ที่มีจริงใน App.tsx', () => {
    const footerPaths = [...footerSrc.matchAll(/path: '([^']+)'/g)].map((m2) => m2[1].split('?')[0])
    expect(footerPaths.length).toBeGreaterThan(5)
    for (const p of footerPaths) {
      expect(appSrc, `footer path ${p} ต้องมีใน App routes`).toContain(`path="${p}"`)
    }
  })
})