// ============================================
// Bite Me Baby — P0 2026-10-14: cart context isolation (RD-03) regression
// ============================================
// Bug ที่ปิด: resolveContextChange คืน 'cleared' ทุกกรณีที่มี item — แม้ context
// เดิมเป๊ะ → ทุกครั้งที่ BrandProvider resolve ซ้ำ (effect ผูกกับ searchParams)
// ตะกร้าถูกล้างทิ้งเอง = "เพิ่มของแล้วไม่เข้าตะกร้า/หายจากตะกร้า" ทันทีที่ flag
// VITE_FEATURE_BRAND_ROUTING เปิดใช้. RD-03 จริง = ล้างเฉพาะเมื่อ context เปลี่ยน
// ============================================

import { describe, it, expect, beforeEach } from 'vitest'
import { useCartStore } from '@/store/cartStore'
import type { Product } from '@/types'

const product = (id: string, over: Partial<Product> = {}) =>
  ({
    id,
    name: `item-${id}`,
    price: 50,
    description: '',
    category_id: 'cat-3',
    image_url: '',
    is_available: true,
    is_featured: false,
    is_preorder: false,
    prep_minutes: 10,
    sort_order: 0,
    created_at: '',
    ...over,
  }) as Product

beforeEach(() => {
  useCartStore.getState().clearCart()
})

describe('resolveContextChange — RD-03: ล้างเฉพาะเมื่อ context เปลี่ยน', () => {
  it('ตะกร้าว่าง → kept เสมอ', () => {
    expect(useCartStore.getState().resolveContextChange('t1', 'b1')).toBe('kept')
  })

  it('context เดิมเป๊ะ (tenant+brand เท่ากัน) → kept — ห้ามล้าง', () => {
    useCartStore.getState().setContextAndClearIfIncompatible('t1', 'b1')
    expect(useCartStore.getState().addItem(product('p-1'))).toBe('added')
    expect(useCartStore.getState().items).toHaveLength(1)
    expect(useCartStore.getState().resolveContextChange('t1', 'b1')).toBe('kept')
  })

  it('brand เปลี่ยนใน tenant เดียวกัน → cleared (strict isolation)', () => {
    useCartStore.getState().setContextAndClearIfIncompatible('t1', 'b1')
    useCartStore.getState().addItem(product('p-1'))
    expect(useCartStore.getState().resolveContextChange('t1', 'b2')).toBe('cleared')
  })

  it('tenant เปลี่ยน → cleared', () => {
    useCartStore.getState().setContextAndClearIfIncompatible('t1', 'b1')
    useCartStore.getState().addItem(product('p-1'))
    expect(useCartStore.getState().resolveContextChange('t2', 'b1')).toBe('cleared')
  })
})

describe('setContextAndClearIfIncompatible — คงตะกร้าเมื่อ resolve ซ้ำด้วยค่าเดิม', () => {
  it('resolve ซ้ำค่าเดิม: ตะกร้าอยู่ครบ (bug เดิม = หายทั้งตะกร้า)', () => {
    useCartStore.getState().setContextAndClearIfIncompatible('t1', 'b1')
    useCartStore.getState().addItem(product('p-1'))
    useCartStore.getState().addItem(product('p-2'))
    useCartStore.getState().setContextAndClearIfIncompatible('t1', 'b1')
    const s = useCartStore.getState()
    expect(s.items).toHaveLength(2)
    expect(s.getCartCount()).toBe(2)
    expect(s.active_context_tenant_id).toBe('t1')
  })

  it('เปลี่ยน brand: ล้างตะกร้าจริงตาม RD-03', () => {
    useCartStore.getState().setContextAndClearIfIncompatible('t1', 'b1')
    useCartStore.getState().addItem(product('p-1'))
    useCartStore.getState().setContextAndClearIfIncompatible('t1', 'b2')
    expect(useCartStore.getState().items).toHaveLength(0)
    expect(useCartStore.getState().active_context_brand_id).toBe('b2')
  })
})