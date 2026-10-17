// ============================================
// Bite Me Baby — ระบบ "หัวข้อเมนู" เดียว (unified heading model, 2026-10-17)
// ============================================
// Regression จากบั๊กจริง: เดิม category ที่ผูก menu_sections ซึ่งถูกปิด/ถูกลบ
// หายจากหน้าลูกค้าทั้งหมวด (ชาไทย 3 รายการหาย) ทั้งที่แอดมินเห็นป้าย "ลูกค้าเห็น"
// → หัวข้อเมนู = หมวดหมู่ชั้นเดียว ค่า menu_section_id เก่าต้องไม่มีผลอีกต่อไป

import { describe, it, expect } from 'vitest'

import { buildHeadingGroups, headingChips, customerVisibilityIssue, CUSTOMER_VISIBILITY_LABEL } from '@/lib/catalogStructure'
import type { Product, ProductCategory } from '@/types'

const cat = (id: string, over: Partial<ProductCategory> = {}): ProductCategory =>
  ({ id, name: id, slug: id, icon: '', sort_order: 1, is_active: true, menu_section_id: null, archived: false, ...over } as ProductCategory)

const prod = (id: string, categoryId: string, over: Partial<Product> = {}): Product =>
  ({
    id, name: id, description: '', price: 50, category_id: categoryId, image_url: '',
    is_available: true, is_featured: false, is_preorder: false, available_same_day: true,
    available_preorder: false, prep_minutes: 5, sort_order: 1, archived: false, ...over,
  } as Product)

describe('ระบบหัวข้อเมนู — buildHeadingGroups (แหล่งความจริงเดียวของ /shop และ /menu)', () => {
  it('จัดกลุ่มตามหัวข้อ (หมวดหมู่) เรียงตาม sort_order — ไม่มีชั้นซ้อน', () => {
    const cats = [cat('c2', { sort_order: 2 }), cat('c1', { sort_order: 1 })]
    const products = [prod('p1', 'c1'), prod('p2', 'c2')]
    const groups = buildHeadingGroups(products, cats)
    expect(groups.map((g) => g.category.id)).toEqual(['c1', 'c2'])
    expect(groups[0].products.map((p) => p.id)).toEqual(['p1'])
    expect(groups[1].products.map((p) => p.id)).toEqual(['p2'])
  })

  it('ซ่อนเฉพาะ: สินค้า archived/ปิดขาย และหัวข้อ archived/ปิด — หัวข้อว่างซ่อน', () => {
    const cats = [cat('c1'), cat('c2', { archived: true }), cat('c3', { is_active: false }), cat('c4', { sort_order: 4 })]
    const products = [
      prod('p1', 'c1'), prod('p2', 'c1', { archived: true }), prod('p3', 'c1', { is_available: false }),
      prod('p4', 'c2'), prod('p5', 'c3'),
    ]
    const groups = buildHeadingGroups(products, cats)
    expect(groups).toHaveLength(1)
    expect(groups[0].category.id).toBe('c1')
    expect(groups[0].products.map((p) => p.id)).toEqual(['p1'])
  })

  it('REGRESSION (บั๊กจริง 17 ต.ค.): menu_section_id เก่า/ค้าง ต้องไม่ทำให้เมนูหายอีก', () => {
    // สถานการณ์จริง: cat-4 เครื่องดื่ม ผูก section ที่ is_active=false → เดิมหายทั้งหมวด
    const cats = [cat('cat-4', { menu_section_id: 'sec-gone' }), cat('cat-loose')]
    const products = [prod('ชาไทยพีช', 'cat-4'), prod('p9', 'cat-loose')]
    const groups = buildHeadingGroups(products, cats)
    expect(groups.map((g) => g.category.id)).toEqual(['cat-4', 'cat-loose'])
    expect(groups[0].products.map((p) => p.id)).toEqual(['ชาไทยพีช'])
  })

  it('เมนูถูกตัดทิ้งเฉพาะเมื่อหมวดตัวเองปิด/หาย — ตรงกับ customerVisibilityIssue', () => {
    const cats = [cat('c1', { is_active: false })]
    const products = [prod('p1', 'c1')]
    expect(buildHeadingGroups(products, cats)).toHaveLength(0)
    expect(customerVisibilityIssue({ category_id: 'c1' }, cats)).toBe('category_inactive')
  })
})

describe('ระบบหัวข้อเมนู — headingChips (กติกาเดียวกับแถวหัวข้อทุกหน้า)', () => {
  it('chips = หัวข้อที่มีเมนูขายได้เท่านั้น เรียงเหมือนกัน — ไม่มีตัวซ้อน', () => {
    const cats = [cat('c2', { sort_order: 2 }), cat('c1', { sort_order: 1 }), cat('c-empty', { sort_order: 3 })]
    const products = [prod('p1', 'c1'), prod('p2', 'c2'), prod('p3', 'c-empty', { archived: true })]
    const chips = headingChips(cats, products)
    expect(chips.map((c) => c.id)).toEqual(['c1', 'c2'])
  })

  it('หัวข้อที่ menu_section_id ค้างอยู่ยังโผล่ใน chips (บั๊กเดิมทำให้ปุ่มกรองหาย)', () => {
    const cats = [cat('cat-4', { menu_section_id: 'sec-closed' })]
    const chips = headingChips(cats, [prod('p1', 'cat-4')])
    expect(chips.map((c) => c.id)).toEqual(['cat-4'])
  })
})

describe('customerVisibilityIssue + labels (คงเดิม)', () => {
  it('label ภาษาไทยครบทุกกรณี', () => {
    expect(CUSTOMER_VISIBILITY_LABEL.category_inactive).toContain('ปิด')
    expect(CUSTOMER_VISIBILITY_LABEL.category_archived).toContain('จัดเก็บ')
    expect(CUSTOMER_VISIBILITY_LABEL.category_missing).toContain('ไม่มี')
  })
})
