// ============================================
// Bite Me Baby — Theater recommendation reasons (pure logic tests)
// ============================================
// Offline + deterministic. Labels may only come from REAL signals — a fake
// reason (e.g. "ขายดี" for a non-featured item with no signal) is a bug.
// ============================================

import { describe, it, expect } from 'vitest'
import type { Product } from '@/types'
import { recommendReason, type TheaterReasonContext } from '@/lib/theaterReasons'

function product(id: string, opts: Partial<Product> = {}): Product {
  return {
    id,
    name: 'เมนูทดสอบ',
    description: '',
    price: 50,
    category_id: 'cat-1',
    image_url: '',
    is_available: true,
    is_featured: false,
    is_preorder: false,
    prep_minutes: 20,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00Z',
    ...opts,
  }
}

function ctx(overrides: Partial<TheaterReasonContext> = {}): TheaterReasonContext {
  return { favoriteCats: [], cartCategoryIds: [], ...overrides }
}

const NOW = new Date('2026-10-08T12:00:00Z')

describe('recommendReason', () => {
  it('❤️ favorite category wins first (verified memory signal)', () => {
    const p = product('p1', { is_featured: true, prep_minutes: 5 })
    const reason = recommendReason(p, ctx({ favoriteCats: ['cat-1'], now: NOW }))
    expect(reason).toEqual({ icon: '❤️', label: 'ของโปรด' })
  })

  it('🍗 pairs with cart — same category as an item already in the cart', () => {
    const p = product('p2')
    const reason = recommendReason(p, ctx({ cartCategoryIds: ['cat-1'], now: NOW }))
    expect(reason).toEqual({ icon: '🍗', label: 'เข้าคู่กับในตะกร้า' })
  })

  it('✨ new item — created_at inside 14 days (real date only)', () => {
    const p = product('p3', { created_at: '2026-10-01T00:00:00Z' })
    const reason = recommendReason(p, ctx({ now: NOW }))
    expect(reason).toEqual({ icon: '✨', label: 'เมนูใหม่' })
  })

  it('⏱️ fast prep — prep_minutes at or under 10', () => {
    const p = product('p4', { prep_minutes: 10, created_at: '2026-01-01T00:00:00Z' })
    const reason = recommendReason(p, ctx({ now: NOW }))
    expect(reason).toEqual({ icon: '⏱️', label: 'ทำเร็ว' })
  })

  it('🔥 featured proxy — only when no higher-priority signal matched', () => {
    const p = product('p5', { is_featured: true, prep_minutes: 30 })
    const reason = recommendReason(p, ctx({ now: NOW }))
    expect(reason).toEqual({ icon: '🔥', label: 'ขายดีวันนี้' })
  })

  it('returns null when NO real signal supports a label (no fake reasons)', () => {
    const p = product('p6', {
      category_id: 'cat-x',
      is_featured: false,
      prep_minutes: 25,
      created_at: '2026-01-01T00:00:00Z',
    })
    expect(recommendReason(p, ctx({ now: NOW }))).toBeNull()
  })

  it('ignores invalid created_at instead of mislabeling as new', () => {
    const p = product('p7', { created_at: '', is_featured: false, prep_minutes: 30 })
    expect(recommendReason(p, ctx({ now: NOW }))).toBeNull()
  })

  it('priority: favorite beats cart pairing and new', () => {
    const p = product('p8', { created_at: '2026-10-07T00:00:00Z' })
    const reason = recommendReason(
      p,
      ctx({ favoriteCats: ['cat-1'], cartCategoryIds: ['cat-1'], now: NOW }),
    )
    expect(reason?.label).toBe('ของโปรด')
  })
})
