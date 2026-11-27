// ============================================
// Bite Me Baby — floatingAdResolver tests
// CANONICAL = config.items; flags เป็นเพียงคลังวัตถุดิบ; items ว่าง = แสดงอะไรเลย
// ============================================

import { describe, it, expect } from 'vitest'
import { resolveFloatingAdCards, type FloatingAdCatalog } from '@/lib/floatingAdResolver'
import type { FloatingAdConfig } from '@/types'

const TODAY = '2026-11-27'

function cfg(over: Partial<FloatingAdConfig> = {}): FloatingAdConfig {
  return {
    enabled: true,
    maxCount: 3,
    sources: {
      promotions: { enabled: true, maxItems: 3 },
      posts: { enabled: true, maxItems: 3 },
      products: { enabled: true, maxItems: 3 },
    },
    items: [],
    ...over,
  }
}

function promo(over: Record<string, unknown> = {}) {
  return {
    id: 'p1', name: 'Promo 1', description: 'desc', code: 'C1',
    discount_type: 'percentage', discount_value: 10, min_order_amount: 0,
    is_active: true, is_banner: true, banner_image: 'img',
    start_date: '2026-11-01', end_date: '2026-11-30', created_at: '2026-11-01',
    ...over,
  } as any
}
function product(over: Record<string, unknown> = {}) {
  return {
    id: 'pr1', name: 'Product 1', description: 'pdesc', price: 100, image_url: 'pimg',
    is_available: true, is_floating_ad: true, archived: false, ...over,
  } as any
}
function post(over: Record<string, unknown> = {}) {
  return {
    id: 'po1', title: 'Post 1', body: 'pbody', image_urls: ['poimg'],
    status: 'published', is_floating_ad: true, ...over,
  } as any
}

const emptyCatalog: FloatingAdCatalog = { promotions: [], products: [], posts: [] }

describe('resolveFloatingAdCards — canonical = config.items', () => {
  it('enabled=false → ไม่มีการ์ด', () => {
    const out = resolveFloatingAdCards({
      config: cfg({ enabled: false, items: [{ id: 'p1', type: 'promotion', order: 0, enabled: true }] }),
      catalog: { ...emptyCatalog, promotions: [promo()] },
      todayKey: TODAY,
    })
    expect(out).toEqual([])
  })

  it('items ว่าง → ไม่มีการ์ด (ไม่มี seed จาก flag)', () => {
    const out = resolveFloatingAdCards({
      config: cfg({ items: [] }),
      catalog: { ...emptyCatalog, promotions: [promo()], products: [product()], posts: [post()] },
      todayKey: TODAY,
    })
    expect(out).toEqual([])
  })

  it('เรียงตาม order, ตัด enabled=false, และ cap ตาม maxCount', () => {
    const out = resolveFloatingAdCards({
      config: cfg({
        maxCount: 2,
        items: [
          { id: 'p1', type: 'promotion', order: 2, enabled: true },
          { id: 'pr1', type: 'product', order: 0, enabled: true },
          { id: 'po1', type: 'post', order: 1, enabled: false },
        ],
      }),
      catalog: { promotions: [promo()], products: [product()], posts: [post()] },
      todayKey: TODAY,
    })
    expect(out.map((c) => c.id)).toEqual(['prod-pr1', 'promo-p1'])
  })

  it('promotion: ต้อง is_banner + is_active + อยู่ในช่วงวันที่', () => {
    const base = { ...emptyCatalog, promotions: [promo()] }
    const items = [{ id: 'p1', type: 'promotion' as const, order: 0, enabled: true }]
    expect(resolveFloatingAdCards({ config: cfg({ items }), catalog: base, todayKey: TODAY })).toHaveLength(1)
    expect(resolveFloatingAdCards({ config: cfg({ items }), catalog: { ...base, promotions: [promo({ is_banner: false })] }, todayKey: TODAY })).toHaveLength(0)
    expect(resolveFloatingAdCards({ config: cfg({ items }), catalog: { ...base, promotions: [promo({ is_active: false })] }, todayKey: TODAY })).toHaveLength(0)
    expect(resolveFloatingAdCards({ config: cfg({ items }), catalog: { ...base, promotions: [promo({ start_date: '2026-12-01' })] }, todayKey: TODAY })).toHaveLength(0)
  })

  it('promotion: ถ้ามี approval_id + รูป ต้องอยู่ใน approvedImages', () => {
    const items = [{ id: 'p1', type: 'promotion' as const, order: 0, enabled: true }]
    const p = promo({ approval_id: 'a1', banner_image: 'approved-img' })
    const catalog = { ...emptyCatalog, promotions: [p] }
    expect(resolveFloatingAdCards({ config: cfg({ items }), catalog, todayKey: TODAY, approvedImages: new Set(['approved-img']) })).toHaveLength(1)
    expect(resolveFloatingAdCards({ config: cfg({ items }), catalog, todayKey: TODAY, approvedImages: new Set() })).toHaveLength(0)
  })

  it('product: ต้อง is_floating_ad + is_available + ไม่ archived', () => {
    const items = [{ id: 'pr1', type: 'product' as const, order: 0, enabled: true }]
    const base = { ...emptyCatalog, products: [product()] }
    expect(resolveFloatingAdCards({ config: cfg({ items }), catalog: base, todayKey: TODAY })).toHaveLength(1)
    expect(resolveFloatingAdCards({ config: cfg({ items }), catalog: { ...base, products: [product({ is_floating_ad: false })] }, todayKey: TODAY })).toHaveLength(0)
    expect(resolveFloatingAdCards({ config: cfg({ items }), catalog: { ...base, products: [product({ is_available: false })] }, todayKey: TODAY })).toHaveLength(0)
    expect(resolveFloatingAdCards({ config: cfg({ items }), catalog: { ...base, products: [product({ archived: true })] }, todayKey: TODAY })).toHaveLength(0)
  })

  it('post: ต้อง is_floating_ad + status=published', () => {
    const items = [{ id: 'po1', type: 'post' as const, order: 0, enabled: true }]
    const base = { ...emptyCatalog, posts: [post()] }
    expect(resolveFloatingAdCards({ config: cfg({ items }), catalog: base, todayKey: TODAY })).toHaveLength(1)
    expect(resolveFloatingAdCards({ config: cfg({ items }), catalog: { ...base, posts: [post({ status: 'draft' })] }, todayKey: TODAY })).toHaveLength(0)
  })

  it('override title/description/image จาก item; href/coupon จาก base', () => {
    const out = resolveFloatingAdCards({
      config: cfg({ items: [{ id: 'p1', type: 'promotion', order: 0, enabled: true, title: 'Override', description: 'OD', image: 'oimg' }] }),
      catalog: { ...emptyCatalog, promotions: [promo()] },
      todayKey: TODAY,
    })
    expect(out[0]).toMatchObject({ id: 'promo-p1', sourceType: 'promotion', title: 'Override', description: 'OD', image: 'oimg', coupon: 'C1' })
  })

  it('กรอง dismissed ออก', () => {
    const out = resolveFloatingAdCards({
      config: cfg({ items: [
        { id: 'p1', type: 'promotion', order: 0, enabled: true },
        { id: 'pr1', type: 'product', order: 1, enabled: true },
      ] }),
      catalog: { promotions: [promo()], products: [product()], posts: [] },
      todayKey: TODAY,
      dismissed: new Set(['promo-p1']),
    })
    expect(out.map((c) => c.id)).toEqual(['prod-pr1'])
  })
})