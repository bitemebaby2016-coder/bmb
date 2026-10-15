// ============================================
// Bite Me Baby — "เมนูยอดนิยม" + site copy tests (UX 2026-10-14)
// ============================================

import { describe, it, expect } from 'vitest'
import {
  DEFAULT_HOME_POPULAR,
  DEFAULT_SITE_COPY,
  parseHomePopularConfig,
  parseSiteCopy,
  popularRotationOffset,
  productModeOf,
  resolvePopularItems,
  toPopularHomeProduct,
  type HomePopularConfig,
} from '@/lib/homePopular'
import type { Product, ProductCategory } from '@/types'

function prod(id: string, over: Partial<Product> = {}): Product {
  return {
    id,
    name: `เมนู ${id}`,
    description: '',
    price: 100,
    category_id: 'cat-a',
    image_url: '',
    is_available: true,
    is_featured: false,
    is_preorder: false,
    prep_minutes: 10,
    sort_order: 0,
    created_at: '',
    ...over,
  } as Product
}

function cat(id: string, over: Partial<ProductCategory> = {}): ProductCategory {
  return { id, name: id, slug: id, icon: '🍜', sort_order: 0, is_active: true, ...over }
}

const cfg = (over: Partial<HomePopularConfig> = {}): HomePopularConfig => ({
  ...DEFAULT_HOME_POPULAR,
  productIds: [],
  disabledIds: [],
  ...over,
})

describe('homePopular — parse config/copy', () => {
  it('ค่าที่ไม่ใช่ object → ได้ค่า default (เมนูยอดนิยม)', () => {
    expect(parseHomePopularConfig(null).title).toBe('เมนูยอดนิยม')
    expect(parseHomePopularConfig('x').title).toBe(DEFAULT_HOME_POPULAR.title)
    expect(parseHomePopularConfig(undefined).autoRotate).toBe(true)
  })

  it('อ่านค่าที่แอดมินบันทึก + ตัดค่าที่ผิดประเภทออก', () => {
    const c = parseHomePopularConfig({
      title: '  ขายดีสัปดาห์นี้  ',
      productIds: ['a', 3, 'b', ''],
      disabledIds: ['x'],
      autoRotate: false,
      showCount: 99,
    })
    expect(c.title).toBe('ขายดีสัปดาห์นี้')
    expect(c.productIds).toEqual(['a', 'b'])
    expect(c.disabledIds).toEqual(['x'])
    expect(c.autoRotate).toBe(false)
    expect(c.showCount).toBe(24) // clamp ไม่เกิน 24
  })

  it('parseSiteCopy ใช้ข้อความ default เมื่อค่าว่าง/ไม่ครบ', () => {
    const s = parseSiteCopy({ adNotice: 'จำกัด 1 ท่านต่อ 1 สิทธิ์' })
    expect(s.adNotice).toBe('จำกัด 1 ท่านต่อ 1 สิทธิ์')
    expect(s.homePreOrderTitle).toBe(DEFAULT_SITE_COPY.homePreOrderTitle)
    expect(parseSiteCopy(null)).toEqual(DEFAULT_SITE_COPY)
  })
})

describe('homePopular — โหมดขาย + การสลับโชว์', () => {
  it('productModeOf: available_preorder ชนะ alias is_preorder', () => {
    expect(productModeOf({ available_preorder: true, is_preorder: false })).toBe('pre-order')
    expect(productModeOf({ available_preorder: false, is_preorder: true })).toBe('same-day')
    expect(productModeOf({ is_preorder: true })).toBe('pre-order')
    expect(productModeOf({ is_preorder: false })).toBe('same-day')
  })

  it('offset สลับทุก 30 นาที และคงที่ภายในรอบเดียวกัน', () => {
    const t = 1_760_000_000_000
    const a = popularRotationOffset(5, t, true)
    expect(popularRotationOffset(5, t + 60_000, true)).toBe(a) // ในรอบเดียวกัน
    expect(popularRotationOffset(5, t + 31 * 60_000, true)).not.toBe(a) // ข้ามรอบ
    expect(popularRotationOffset(5, t, false)).toBe(0) // ปิดสลับ = ไม่เลื่อน
    expect(popularRotationOffset(0, t, true)).toBe(0)
  })
})

describe('homePopular — resolvePopularItems', () => {
  const cats = [cat('cat-a'), cat('cat-b'), cat('cat-off', { is_active: false }), cat('cat-arch', { archived: true })]

  it('เลือกตามที่แอดมินเลือก — จากหลายหมวด รวมเมนูจองล่วงหน้า + คงลำดับที่เลือก', () => {
    const products = [
      prod('p1', { category_id: 'cat-a' }),
      prod('p2', { category_id: 'cat-b', available_preorder: true, is_preorder: true, scheduled_date: '2026-10-20' }),
      prod('p3', { category_id: 'cat-a' }),
    ]
    const out = resolvePopularItems(products, cats, cfg({ productIds: ['p2', 'p1'], autoRotate: false }))
    expect(out.map((p) => p.id)).toEqual(['p2', 'p1'])
    expect(productModeOf(out[0])).toBe('pre-order')
  })

  it('ตัดเมนูที่ toggle ปิด + เมนูที่ไม่มีจริง/หมวดปิด/เก็บถาวรออก', () => {
    const products = [
      prod('p1'),
      prod('p2'),
      prod('p3', { category_id: 'cat-off' }),
      prod('p4', { category_id: 'cat-arch' }),
      prod('p5', { archived: true }),
    ]
    const out = resolvePopularItems(
      products,
      cats,
      cfg({ productIds: ['p1', 'p2', 'p3', 'p4', 'p5', 'ghost'], disabledIds: ['p2'], autoRotate: false }),
    )
    expect(out.map((p) => p.id)).toEqual(['p1'])
  })

  it('ยังไม่ได้เลือก → ระบบคละสั่งวันนี้/จองล่วงหน้าจากทุกหมวดให้อัตโนมัติ', () => {
    const products = [
      prod('s1'),
      prod('s2'),
      prod('s3'),
      prod('pr1', { available_preorder: true, is_preorder: true }),
      prod('pr2', { available_preorder: true, is_preorder: true }),
    ]
    const out = resolvePopularItems(products, cats, cfg({ autoRotate: false, showCount: 10 }))
    expect(out.length).toBe(5)
    const modes = out.map((p) => productModeOf(p))
    expect(modes).toContain('same-day')
    expect(modes).toContain('pre-order')
    expect(modes[0]).not.toBe(modes[1])
  })

  it('สลับสับเปลี่ยนอัตโนมัติ: ต่างรอบเวลา → ได้รายการขึ้นต้นต่างกัน (จำกัดตาม showCount)', () => {
    const products = Array.from({ length: 6 }, (_, i) => prod(`p${i}`, { sort_order: i }))
    const t = 1_760_000_000_000
    const a = resolvePopularItems(products, cats, cfg({ autoRotate: true, showCount: 3 }), t)
    const b = resolvePopularItems(products, cats, cfg({ autoRotate: true, showCount: 3 }), t + 31 * 60_000)
    expect(a.length).toBe(3)
    expect(a[0].id).not.toBe(b[0].id)
  })
})

describe('homePopular — toPopularHomeProduct', () => {
  it('map เป็น HomeProduct พร้อมโหมดขายจริง + วันจัดส่งจาก menu_schedule', () => {
    const p = prod('p9', {
      category_id: 'cat-b',
      price: 120,
      available_preorder: true,
      is_preorder: true,
      scheduled_date: '2026-10-25', // ค่าเก่า (products.scheduled_date) — ต้องไม่ถูกใช้
    })
    const item = toPopularHomeProduct(p, cat('cat-b', { name: 'ของคาว', icon: '🍛' }), { p9: '2026-10-25' })
    expect(item.mode).toBe('pre-order')
    expect(item.scheduledDate).toBe('2026-10-25')
    expect(item.cta).toBe('📅 จองล่วงหน้า')
    expect(item.categoryName).toBe('ของคาว')
    expect(item.price).toBe(120)
  })

  it('ค่าเก่า products.scheduled_date ไม่ถูกใช้ — ไม่มี map (menu_schedule) = ไม่มีวันจัดส่งบนการ์ด', () => {
    const p = prod('p9', { available_preorder: true, is_preorder: true, scheduled_date: '2026-10-25' })
    expect(toPopularHomeProduct(p, cat('cat-b')).scheduledDate).toBeUndefined()
  })
})