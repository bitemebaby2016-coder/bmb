import { describe, expect, it } from 'vitest'
import { selectHomeShowcase, type HomeShowcaseItem } from '@/lib/homeShowcase'
import type { Product, ProductCategory } from '@/types'

const cat = (id: string, slug: string, is_active = true): ProductCategory =>
  ({ id, name: slug, slug, icon: '', sort_order: 0, is_active, created_at: '' } as ProductCategory)

const prod = (id: string, category_id: string, opts: Partial<Product> = {}): Product =>
  ({
    id, name: id, description: 'd', price: 50, category_id, image_url: 'img',
    is_available: true, is_featured: false, is_preorder: false, prep_minutes: 5,
    sort_order: 0, created_at: '', updated_at: '', ...opts,
  } as Product)

describe('selectHomeShowcase (CAT-WL-00 canonical home showcase)', () => {
  it('returns products of the matching active category only, sorted by sort_order', () => {
    const cats = [cat('cat-drinks', 'drinks'), cat('cat-snacks', 'snacks')]
    const products = [
      prod('p2', 'cat-drinks', { sort_order: 2 }),
      prod('p1', 'cat-drinks', { sort_order: 1 }),
      prod('p3', 'cat-snacks'),
      prod('p4', 'cat-other'),
    ]
    const drinks: HomeShowcaseItem[] = selectHomeShowcase(products, cats, 'drinks')
    expect(drinks.map((i) => i.id)).toEqual(['p1', 'p2'])
    const snacks = selectHomeShowcase(products, cats, 'snacks')
    expect(snacks.map((i) => i.id)).toEqual(['p3'])
  })

  it('excludes unavailable products (availability guard mirror)', () => {
    const cats = [cat('cat-drinks', 'drinks')]
    const products = [prod('p1', 'cat-drinks'), prod('p2', 'cat-drinks', { is_available: false })]
    expect(selectHomeShowcase(products, cats, 'drinks').map((i) => i.id)).toEqual(['p1'])
  })

  it('returns empty when category missing or inactive → section hides', () => {
    const cats = [cat('cat-drinks', 'drinks', false), cat('cat-2', 'other')]
    expect(selectHomeShowcase([prod('p1', 'cat-drinks')], cats, 'drinks')).toEqual([])
    expect(selectHomeShowcase([prod('p1', 'cat-drinks')], [], 'drinks')).toEqual([])
    expect(selectHomeShowcase([], [cat('c', 'drinks')], 'drinks')).toEqual([])
  })

  it('maps canonical fields name/price/description/image/categoryId', () => {
    const cats = [cat('cat-drinks', 'drinks')]
    const products = [prod('p1', 'cat-drinks', { name: 'ชามะนาวสด', price: 35, description: 'ดับสดชื่น', image_url: 'x.png', sort_order: 1 })]
    const item = selectHomeShowcase(products, cats, 'drinks')[0]
    expect(item).toEqual({ id: 'p1', name: 'ชามะนาวสด', price: 35, description: 'ดับสดชื่น', image: 'x.png', categoryId: 'cat-drinks' })
  })
})
