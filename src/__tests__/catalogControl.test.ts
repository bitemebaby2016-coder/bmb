// ============================================
// Bite Me Baby — CAT-01: catalog structure + server-enforced visibility gate
// (migration 055, CAT-D01=B + CAT-D04=B; TEN-D01=A tenant-owned single default tenant)
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', async () => {
  const { createSupabaseMock } = await import('./helpers/supabaseMock')
  return {
    supabase: createSupabaseMock(),
    supabaseAdmin: null,
    getCurrentUser: async () => null,
    isAdmin: async () => false,
    default: null,
  }
})

import { supabase } from '@/lib/supabase'
import { buildCatalogGroups } from '@/lib/catalogStructure'
import type { MenuSection, Product, ProductCategory } from '@/types'

const cat = (id: string, over: Partial<ProductCategory> = {}): ProductCategory =>
  ({ id, name: id, slug: id, icon: '', sort_order: 1, is_active: true, menu_section_id: null, archived: false, ...over } as ProductCategory)

const prod = (id: string, categoryId: string, over: Partial<Product> = {}): Product =>
  ({
    id, name: id, description: '', price: 50, category_id: categoryId, image_url: '',
    is_available: true, is_featured: false, is_preorder: false, available_same_day: true,
    available_preorder: false, prep_minutes: 5, sort_order: 1, archived: false, ...over,
  } as Product)

const sec = (id: string, over: Partial<MenuSection> = {}): MenuSection =>
  ({ id, name: id, slug: id, description: '', sort_order: 1, is_active: true, created_at: '', updated_at: '', ...over } as MenuSection)

// ---------------------------------------------------------------------------
// buildCatalogGroups — Menu → Section → Category → Product display mirror
// ---------------------------------------------------------------------------
describe('CAT-01 · buildCatalogGroups (canonical hierarchy mirror)', () => {
  it('groups by section then category, ordered', () => {
    const sections = [sec('s1', { sort_order: 1 }), sec('s2', { sort_order: 2 })]
    const cats = [cat('c1', { menu_section_id: 's2', sort_order: 1 }), cat('c2', { menu_section_id: 's1', sort_order: 1 })]
    const products = [prod('p1', 'c1'), prod('p2', 'c2')]
    const groups = buildCatalogGroups(products, cats, sections)
    expect(groups.map((g) => g.section?.id)).toEqual(['s1', 's2'])
    expect(groups[0].categories[0].category.id).toBe('c2')
    expect(groups[0].categories[0].products[0].id).toBe('p2')
  })

  it('excludes archived/unavailable products and archived/inactive categories', () => {
    const sections = [sec('s1')]
    const cats = [cat('c1', { menu_section_id: 's1' }), cat('c2', { menu_section_id: 's1', archived: true }), cat('c3', { menu_section_id: 's1', is_active: false })]
    const products = [prod('p1', 'c1'), prod('p2', 'c1', { archived: true }), prod('p3', 'c1', { is_available: false }), prod('p4', 'c2'), prod('p5', 'c3')]
    const groups = buildCatalogGroups(products, cats, sections)
    expect(groups).toHaveLength(1)
    expect(groups[0].categories).toHaveLength(1)
    expect(groups[0].categories[0].products.map((p) => p.id)).toEqual(['p1'])
  })

  it('closed section hides its categories; unsectioned categories fall into the legacy group', () => {
    const sections = [sec('s1', { is_active: false })]
    const cats = [cat('c1', { menu_section_id: 's1' }), cat('c9')]
    const products = [prod('p1', 'c1'), prod('p9', 'c9')]
    const groups = buildCatalogGroups(products, cats, sections)
    expect(groups).toHaveLength(1)
    expect(groups[0].section).toBeNull()
    expect(groups[0].categories[0].category.id).toBe('c9')
  })
})
