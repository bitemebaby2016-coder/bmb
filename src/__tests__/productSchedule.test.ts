// ============================================
// Bite Me Baby — productSchedule tests (UX fix 2026-10-15, แผน C)
// ============================================
// วันจัดส่งบนการ์ดต้องมาจาก menu_schedule เท่านั้น:
// - วันที่ต้องตรงกับ menu_schedule เสมอ (ไม่เดา/ไม่แต่งวันเอง)
// - ค่าเก่า products.scheduled_date ต้องไม่ถูกใช้แสดงผล
// - ไม่มีแถว published = ไม่มีป้ายวันที่
import { describe, expect, it } from 'vitest'
import { bangkokTodayISO, pickNextScheduleDates, type ProductScheduleRow } from '@/lib/productSchedule'
import { toPopularHomeProduct } from '@/lib/homePopular'
import { selectHomeShowcase } from '@/lib/homeShowcase'
import { getHomeProducts } from '@/lib/homeProviders'
import type { Product, ProductCategory } from '@/types'

const TODAY = '2026-10-15'

const row = (over: Partial<ProductScheduleRow> = {}): ProductScheduleRow => ({
  product_id: 'p1',
  scheduled_date: '2026-10-16',
  is_published: true,
  delivery_round_key: null,
  ...over,
})

const cat = { id: 'c1', name: 'จานเดียว', slug: 'c1', icon: 'x', sort_order: 1, is_active: true, created_at: '' } as ProductCategory

const prod = (over: Partial<Product> = {}): Product =>
  ({
    id: 'p1', name: 'p1', description: 'd', price: 50, category_id: 'c1', image_url: 'img',
    is_available: true, is_featured: false, is_preorder: false, prep_minutes: 5,
    sort_order: 0, created_at: '', updated_at: '',
    ...over,
  } as Product)

describe('pickNextScheduleDates — menu_schedule → product_id → วันจัดส่งถัดไป', () => {
  it('วันที่ต้องตรงกับ menu_schedule เสมอ (map ได้จากแถว published)', () => {
    expect(pickNextScheduleDates([row({ scheduled_date: '2026-10-16' })], TODAY)).toEqual({ p1: '2026-10-16' })
  })

  it('สินค้ามีหลายวัน = ใช้วันที่ใกล้ที่สุด (next delivery day)', () => {
    const map = pickNextScheduleDates([
      row({ scheduled_date: '2026-10-20' }),
      row({ scheduled_date: '2026-10-18' }),
      row({ scheduled_date: '2026-10-16' }),
    ], TODAY)
    expect(map.p1).toBe('2026-10-16')
  })

  it('แถว draft (is_published=false) ห้ามโชว์ป้าย', () => {
    expect(pickNextScheduleDates([row({ is_published: false })], TODAY)).toEqual({})
  })

  it('วันที่ผ่านไปแล้ว = ไม่โชว์ป้ายวันเก่า', () => {
    expect(pickNextScheduleDates([row({ scheduled_date: '2026-10-01' })], TODAY)).toEqual({})
  })

  it('ไม่มีแถว published = map ว่าง = ไม่มีป้ายวันที่', () => {
    expect(pickNextScheduleDates([], TODAY)).toEqual({})
    expect(pickNextScheduleDates([row({ is_published: false }), row({ product_id: 'p2', is_published: false })], TODAY)).toEqual({})
  })

  it('bangkokTodayISO: YYYY-MM-DD ตามเวลา Asia/Bangkok (UTC+7) deterministic ทุก timezone', () => {
    expect(bangkokTodayISO(Date.parse('2026-10-15T17:30:00Z'))).toBe('2026-10-16') // 00:30 น. ที่กรุงเทพ
    expect(bangkokTodayISO(Date.parse('2026-10-15T16:59:00Z'))).toBe('2026-10-15')
  })
})

describe('scheduledDate บนการ์ด = menu_schedule เท่านั้น (ค่าเก่า products.scheduled_date ไม่ถูกใช้)', () => {
  const legacy = { available_preorder: true, is_preorder: true, scheduled_date: '2026-10-25' } as Partial<Product>

  it('toPopularHomeProduct: วันมาจาก map — ไม่มี map = ไม่มีวัน (ไม่สน scheduled_date เก่า)', () => {
    const p = prod(legacy)
    expect(toPopularHomeProduct(p, cat).scheduledDate).toBeUndefined()
    expect(toPopularHomeProduct(p, cat, { p1: '2026-10-16' }).scheduledDate).toBe('2026-10-16')
  })

  it('selectHomeShowcase: วันมาจาก map เท่านั้น', () => {
    const p = prod(legacy)
    expect(selectHomeShowcase([p], [cat], 'c1')[0].scheduledDate).toBeUndefined()
    expect(selectHomeShowcase([p], [cat], 'c1', { p1: '2026-10-16' })[0].scheduledDate).toBe('2026-10-16')
  })

  it('getHomeProducts: วันมาจาก map เท่านั้น', () => {
    const p = prod({ ...legacy, available_same_day: false })
    expect(getHomeProducts([p], [cat]).preOrder[0].scheduledDate).toBeUndefined()
    expect(getHomeProducts([p], [cat], { p1: '2026-10-16' }).preOrder[0].scheduledDate).toBe('2026-10-16')
  })
})