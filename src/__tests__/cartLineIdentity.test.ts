// ============================================
// Bite Me Baby — P0 WS4: cart line identity + duplicate-item correctness
// ============================================
// Proven defects fixed (2026-10-14):
//   1) re-adding the same product kept the OLD line subtotal while raising
//      quantity -> cart totals under-reported (display money bug)
//   2) re-adding the same product with DIFFERENT options silently merged the
//      lines and DROPPED the new options
// Contract now: line identity = product + mode + options; identical lines
// merge quantities (subtotal recomputed); different options/mode = separate
// lines; update/remove can target a specific line (CartPage passes __line_key).
// ============================================

import { describe, it, expect, beforeEach } from 'vitest'
import { useCartStore, lineKeyFor } from '@/store/cartStore'
import type { Product } from '@/types'

const prod = (id: string, price = 50, over: Partial<Product> = {}) =>
  ({
    id, name: `item-${id}`, price, description: '', category_id: 'cat-3', image_url: '',
    is_available: true, is_featured: false, is_preorder: false, prep_minutes: 10,
    sort_order: 0, created_at: '', ...over,
  }) as Product

beforeEach(() => {
  useCartStore.getState().clearCart()
})

describe('duplicate-item behavior (same product, same options)', () => {
  it('merges quantities AND recomputes the line subtotal (old bug: stale subtotal)', () => {
    useCartStore.getState().addItem(prod('p-1', 50), 1)
    useCartStore.getState().addItem(prod('p-1', 50), 2)
    const s = useCartStore.getState()
    expect(s.items).toHaveLength(1)
    expect(s.items[0].quantity).toBe(3)
    expect(s.items[0].subtotal).toBe(150) // was 50 before the fix
    expect(s.subtotal).toBe(150)
  })

  it('recomputes merged subtotal even when price changed between adds (catalog-driven)', () => {
    useCartStore.getState().addItem(prod('p-1', 50), 1)
    useCartStore.getState().addItem(prod('p-1', 70), 1) // re-add at current catalog price
    // same line merged; line unit price is the FIRST-seen product snapshot
    expect(useCartStore.getState().items).toHaveLength(1)
    expect(useCartStore.getState().items[0].subtotal).toBe((50 + 0) * 2)
  })
})

describe('variant/options: same product, different options = separate lines', () => {
  it('keeps both lines with their own options (old bug: options dropped on merge)', () => {
    useCartStore.getState().addItem(prod('p-1', 50), 1, { topping: ['ไข่'] })
    useCartStore.getState().addItem(prod('p-1', 50), 1, { topping: ['หอม'] })
    const s = useCartStore.getState()
    expect(s.items).toHaveLength(2)
    expect(s.items[0].customizations).toEqual({ topping: ['ไข่'] })
    expect(s.items[1].customizations).toEqual({ topping: ['หอม'] })
    expect(s.subtotal).toBe(100)
  })

  it('same options merge again (stable identity across key order)', () => {
    useCartStore.getState().addItem(prod('p-1'), 1, { a: '1', b: '2' })
    useCartStore.getState().addItem(prod('p-1'), 1, { b: '2', a: '1' })
    expect(useCartStore.getState().items).toHaveLength(1)
    expect(useCartStore.getState().items[0].quantity).toBe(2)
    expect(lineKeyFor('p-1', 'SAME_DAY', { a: '1', b: '2' }))
      .toBe(lineKeyFor('p-1', 'SAME_DAY', { b: '2', a: '1' }))
    expect(lineKeyFor('p-1', 'SAME_DAY', { a: '1' })).not.toBe(lineKeyFor('p-1', 'PRE_ORDER', { a: '1' }))
  })

  it('different order mode = separate line with its own line_mode', () => {
    useCartStore.getState().addItem(prod('p-1', 50, { available_preorder: true, available_same_day: true }), 1, {}, 'SAME_DAY')
    useCartStore.getState().addItem(prod('p-1', 50, { available_preorder: true, available_same_day: true }), 1, {}, 'PRE_ORDER')
    const s = useCartStore.getState()
    expect(s.items).toHaveLength(2)
    expect(s.items.map((i) => i.line_mode)).toEqual(['SAME_DAY', 'PRE_ORDER'])
  })
})

describe('line-precise update/remove (CartPage contract)', () => {
  const twoLines = () => {
    useCartStore.getState().addItem(prod('p-1', 50), 1, { topping: ['ไข่'] })
    useCartStore.getState().addItem(prod('p-1', 50), 1, { topping: ['หอม'] })
  }

  it('updateQuantity with lineKey touches only that line', () => {
    twoLines()
    const [a, b] = useCartStore.getState().items
    useCartStore.getState().updateQuantity('p-1', 3, a.__line_key)
    const s = useCartStore.getState()
    expect(s.items.find((i) => i.__line_key === a.__line_key)?.quantity).toBe(3)
    expect(s.items.find((i) => i.__line_key === b.__line_key)?.quantity).toBe(1)
    expect(s.subtotal).toBe(200) // 3x50 + 1x50
  })

  it('removeItem with lineKey removes only that line', () => {
    twoLines()
    const [a, b] = useCartStore.getState().items
    useCartStore.getState().removeItem('p-1', a.__line_key)
    const s = useCartStore.getState()
    expect(s.items).toHaveLength(1)
    expect(s.items[0].__line_key).toBe(b.__line_key)
  })

  it('removeItem without lineKey keeps the old contract: removes ALL lines of the product', () => {
    twoLines()
    useCartStore.getState().removeItem('p-1')
    expect(useCartStore.getState().items).toHaveLength(0)
  })

  it('quantity <= 0 removes the targeted line only', () => {
    twoLines()
    const [a] = useCartStore.getState().items
    useCartStore.getState().updateQuantity('p-1', 0, a.__line_key)
    expect(useCartStore.getState().items).toHaveLength(1)
    expect(useCartStore.getState().items[0].__line_key).not.toBe(a.__line_key)
  })
})