/**
 * Phase 1 — Storefront eligibility (RC-2 · OD-3 · OD-5) — canonical rule: matrix §3.1
 *   sameDayEligible(p)  = p.available_same_day  ?? !p.is_preorder
 *   preorderEligible(p) = p.available_preorder ??  p.is_preorder
 *   ไม่มีสิทธิ์ทั้งสองโหมด = ไม่ offer ในพื้นที่สั่งซื้อ
 */
import { describe, it, expect } from 'vitest'
import type { Product } from '@/types'
import { getHomeProducts } from '@/lib/homeProviders'
import { pickTopAvailable, sameDayEligible, preorderEligible, deriveOrderMode } from '@/lib/talkToBite'

function product(id: string, opts: Partial<Product> = {}): Product {
  return {
    id,
    name: `สินค้า ${id}`,
    description: '',
    price: 50,
    category_id: '',
    image_url: '',
    is_available: true,
    is_featured: false,
    is_preorder: false,
    prep_minutes: 0,
    sort_order: 0,
    created_at: '',
    ...opts,
  } as Product
}

const NEITHER = product('p-neither', { available_same_day: false, available_preorder: false })
const SAME_ONLY = product('p-sd', { available_same_day: true, available_preorder: false })
const PRE_ONLY = product('p-po', { available_same_day: false, available_preorder: true })
const DUAL = product('p-dual', { available_same_day: true, available_preorder: true })

describe('canonical eligibility helpers (matrix §3.1)', () => {
  it('alias fallback: flags undefined → ใช้ is_preorder', () => {
    expect(sameDayEligible(product('a', { is_preorder: false }))).toBe(true)
    expect(preorderEligible(product('b', { is_preorder: false }))).toBe(false)
    expect(sameDayEligible(product('c', { is_preorder: true }))).toBe(false)
    expect(preorderEligible(product('d', { is_preorder: true }))).toBe(true)
  })

  it('deriveOrderMode: dual/same-only/pre-only/neither', () => {
    expect(deriveOrderMode(DUAL)).toBe('SAME_DAY')
    expect(deriveOrderMode(SAME_ONLY)).toBe('SAME_DAY')
    expect(deriveOrderMode(PRE_ONLY)).toBe('PRE_ORDER')
    expect(deriveOrderMode(NEITHER)).toBeNull() // OD-3: ห้าม offer
  })
})

describe('getHomeProducts (RC-2)', () => {
  it('สินค้า available_same_day=false ไม่เข้า sameDay bucket', () => {
    const { sameDay } = getHomeProducts([SAME_ONLY, NEITHER], [])
    // NEITHER (available_same_day=false + available_preorder=false) → ห้ามเข้า bucket ใด (OD-3)
    expect(sameDay.map((x) => x.id)).not.toContain(NEITHER.id)
    // SAME_ONLY ยังเข้า sameDay ได้ตามสิทธิ์
    expect(sameDay.map((x) => x.id)).toEqual([SAME_ONLY.id])
  })

  it('ไม่มีสิทธิ์ทั้งสองโหมด → ไม่อยู่ใน bucket ใด (OD-3)', () => {
    const { sameDay, preOrder } = getHomeProducts([NEITHER, SAME_ONLY, PRE_ONLY, DUAL], [])
    expect(sameDay.map((x) => x.id)).not.toContain(NEITHER.id)
    expect(preOrder.map((x) => x.id)).not.toContain(NEITHER.id)
  })

  it('preOrder bucket ไม่มีสินค้า available_preorder=false (คง invariant เดิม)', () => {
    const { preOrder, sameDay } = getHomeProducts([SAME_ONLY, NEITHER, PRE_ONLY], [])
    expect(preOrder.map((x) => x.id)).toEqual([PRE_ONLY.id])
    expect(sameDay.map((x) => x.id)).toEqual([SAME_ONLY.id]) // SAME_ONLY = same-day only → sameDay bucket
  })

  it('dual ยังเข้า preOrder bucket (split แบบเดิม ไม่เพิ่มรอยซ้ำใหม่)', () => {
    const { preOrder, sameDay } = getHomeProducts([DUAL], [])
    expect(preOrder.map((x) => x.id)).toEqual([DUAL.id])
    expect(sameDay.map((x) => x.id)).not.toContain(DUAL.id)
  })
})

describe('pickTopAvailable (OD-3 / OD-5)', () => {
  it('ไม่คืนสินค้าที่ไม่มีสิทธิ์ทั้งสองโหมด', () => {
    const picks = pickTopAvailable([NEITHER, SAME_ONLY, PRE_ONLY, DUAL], 4)
    const ids = picks.map((p) => p.id)
    expect(ids).not.toContain(NEITHER.id)
    expect(ids).toEqual(expect.arrayContaining([SAME_ONLY.id, PRE_ONLY.id, DUAL.id]))
  })

  it('ยังคงเงื่อนไขเดิม is_available && !archived', () => {
    const off = product('p-off', { is_available: false, available_same_day: true })
    const dead = product('p-dead', { archived: true, available_same_day: true })
    expect(pickTopAvailable([off, dead, SAME_ONLY], 3).map((p) => p.id)).toEqual([SAME_ONLY.id])
  })
})
