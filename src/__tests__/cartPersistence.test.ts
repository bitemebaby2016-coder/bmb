// ============================================
// Bite Me Baby — Cart Persistence tests (Owner D01)
// Covers: minimal serialization, malformed/tampered storage, catalog-backed
// restoration (prices never trusted), explicit drops, mode isolation,
// revalidation, and the boot wiring (hydrate + debounced writes).
// ============================================

import { describe, it, expect, beforeEach } from 'vitest'
import {
  serializeCart,
  parseStoredCart,
  restoreWithCatalog,
  revalidateWithCatalog,
  reportToToastMessage,
  type StoredCart,
} from '@/lib/cartPersistence'
import { useCartStore } from '@/store/cartStore'
import type { Product } from '@/types'

function mkProduct(overrides: Partial<Product> & { id: string; price: number }): Product {
  return {
    name: `Menu ${overrides.id}`,
    description: '',
    category_id: 'cat-1',
    image_url: '',
    is_available: true,
    is_featured: false,
    is_preorder: false,
    prep_minutes: 10,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  } as Product
}

const prodA = mkProduct({ id: 'p-a', price: 69, name: 'ผัดไทยกุ้งสด' })
const prodB = mkProduct({ id: 'p-b', price: 79, name: 'ข้าวคลุกซุปอ่อน' })

function stored(partial: Partial<StoredCart> & { items: StoredCart['items'] }): StoredCart {
  return { v: 1, savedAt: '', order_mode: 'SAME_DAY', couponCode: '', ...partial }
}

beforeEach(() => {
  useCartStore.getState().clearCart()
  localStorage.clear()
  sessionStorage.clear()
})

describe('serializeCart — minimal data only (D01)', () => {
  it('persists ids/qty/customizations/mode/coupon and NEVER prices or totals', () => {
    useCartStore.getState().addItem(prodA, 2, { topping: ['ไข่'] }, 'SAME_DAY')
    useCartStore.getState().setCouponCode('WELCOME10')
    const raw = serializeCart(useCartStore.getState())
    const parsed = JSON.parse(raw)
    expect(parsed.v).toBe(1)
    expect(parsed.items).toEqual([
      { productId: 'p-a', quantity: 2, customizations: { topping: ['ไข่'] } },
    ])
    expect(parsed.couponCode).toBe('WELCOME10')
    expect(parsed.order_mode).toBe('SAME_DAY')
    // no authoritative fields anywhere in the payload
    expect(raw).not.toMatch(/price|subtotal|total|discount|stock|payment/i)
  })
})

describe('parseStoredCart — untrusted storage (D01)', () => {
  it('round-trips a valid payload', () => {
    const raw = serializeCart({ items: [{ product: prodA, quantity: 1, customizations: {} }], order_mode: 'SAME_DAY', couponCode: '' })
    const parsed = parseStoredCart(raw)
    expect(parsed?.items).toHaveLength(1)
    expect(parsed?.items[0].productId).toBe('p-a')
  })

  it('rejects malformed JSON, wrong versions and broken shapes', () => {
    expect(parseStoredCart(null)).toBeNull()
    expect(parseStoredCart('not json {')).toBeNull()
    expect(parseStoredCart('[]')).toBeNull()
    expect(parseStoredCart(JSON.stringify({ v: 99, items: [] }))).toBeNull()
    expect(parseStoredCart(JSON.stringify({ v: 1, items: 'x' }))).toBeNull()
    expect(parseStoredCart(JSON.stringify({ v: 1, items: [{ quantity: 1 }] }))).toBeNull()
    expect(parseStoredCart(JSON.stringify({ v: 1, items: [{ productId: 'p', quantity: -3 }] }))).toBeNull()
    expect(parseStoredCart(JSON.stringify({ v: 1, items: [{ productId: 'p', quantity: 'NaN' }] }))).toBeNull()
  })

  it('strips unknown/tampered fields from items (price injection is ignored)', () => {
    const raw = JSON.stringify({
      v: 1,
      items: [{ productId: 'p-a', quantity: 3, price: 0.01, subtotal: 0, customizations: { note: 'x', bad: { deep: 1 } } }],
    })
    const parsed = parseStoredCart(raw)
    expect(parsed?.items[0]).toEqual({ productId: 'p-a', quantity: 3, customizations: { note: 'x' } })
  })
})

describe('restoreWithCatalog — trusted catalog rebuild (D01)', () => {
  it('restores quantity + customizations with catalog-derived pricing', () => {
    const report = restoreWithCatalog(
      stored({ items: [{ productId: 'p-a', quantity: 2, customizations: { topping: ['ไข่'] } }] }),
      [prodA, prodB],
    )
    expect(report).toEqual({ restored: 1, dropped: [] })
    const items = useCartStore.getState().items
    expect(items).toHaveLength(1)
    expect(items[0].quantity).toBe(2)
    expect(items[0].product.price).toBe(69) // fresh catalog, not storage
    expect(items[0].subtotal).toBe(69 * 2)
    expect(useCartStore.getState().order_mode).toBe('SAME_DAY')
  })

  it('drops removed and unavailable products explicitly', () => {
    const unavailable = mkProduct({ id: 'p-out', price: 20, is_available: false })
    const report = restoreWithCatalog(
      stored({ items: [
        { productId: 'p-gone', quantity: 1 },
        { productId: 'p-out', quantity: 1 },
        { productId: 'p-a', quantity: 1 },
      ] }),
      [prodA, unavailable], // p-gone is not in the catalog anymore
    )
    expect(report.restored).toBe(1)
    expect(report.dropped.map((d) => d.reason).sort()).toEqual(['missing', 'unavailable'])
    expect(useCartStore.getState().items).toHaveLength(1)
    expect(useCartStore.getState().items[0].product.id).toBe('p-a')
    const msg = reportToToastMessage(report, 'hydrate')
    expect(msg).toContain('นำรายการที่ใช้ไม่ได้ออกจากตะกร้า')
  })

  it('respects mode isolation: conflicting-mode rows are dropped, not merged', () => {
    useCartStore.getState().addItem(mkProduct({ id: 'p-pre', price: 100 }), 1, {}, 'PRE_ORDER')
    const report = restoreWithCatalog(
      stored({ order_mode: 'SAME_DAY', items: [{ productId: 'p-a', quantity: 1 }] }),
      [prodA],
    )
    expect(report.restored).toBe(0)
    expect(report.dropped[0].reason).toBe('mode_conflict')
    expect(useCartStore.getState().order_mode).toBe('PRE_ORDER') // existing lock untouched
  })

  it('restores the coupon code only (server still re-validates it)', () => {
    restoreWithCatalog(stored({ couponCode: 'WELCOME10', items: [{ productId: 'p-a', quantity: 1 }] }), [prodA])
    expect(useCartStore.getState().couponCode).toBe('WELCOME10')
  })
})

describe('revalidateWithCatalog — pre-checkout pass (D01)', () => {
  it('rebuilds the live cart from fresh catalog data and reports drops', () => {
    useCartStore.getState().addItem(prodA, 2, {}, 'SAME_DAY')
    useCartStore.getState().addItem(prodB, 1, {}, 'SAME_DAY')
    const cheaperA = mkProduct({ id: 'p-a', price: 50, name: 'ผัดไทยกุ้งสด' }) // price changed
    const report = revalidateWithCatalog([cheaperA]) // prodB removed from catalog
    expect(report.restored).toBe(1)
    expect(report.dropped).toEqual([{ productId: 'p-b', name: 'ข้าวคลุกซุปอ่อน', reason: 'missing' }])
    const items = useCartStore.getState().items
    expect(items).toHaveLength(1)
    expect(items[0].subtotal).toBe(100) // 50 x 2 — canonical recalc, stale price gone
    expect(useCartStore.getState().subtotal).toBe(100)
    expect(reportToToastMessage(report, 'checkout')).toContain('อัปเดตรายการล่าสุด')
  })

  it('is a no-op on an empty cart', () => {
    expect(revalidateWithCatalog([prodA])).toEqual({ restored: 0, dropped: [] })
  })
})

