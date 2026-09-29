// ============================================
// Bite Me Baby — Catalog structure mirror (CAT-01, migration 055)
// Pure display logic: Menu → Section → Category → Product grouping
// for the Customer PWA menu page. No fetching, no mutation.
// ============================================

import type { MenuSection, Product, ProductCategory } from '@/types'

export interface CatalogGroup {
  section: MenuSection | null          // null = categories without a section (legacy)
  categories: Array<{
    category: ProductCategory
    products: Product[]
  }>
}

/**
 * Group products by category → section (CAT-D01=B canonical hierarchy).
 * - skips archived categories/products and unavailable products (mirror of the
 *   server gate in migration 055 — server remains the transaction authority)
 * - skips inactive categories
 * - section order: menu_sections.sort_order; category order: sort_order
 */
export function buildCatalogGroups(
  products: Product[],
  categories: ProductCategory[],
  sections: MenuSection[],
): CatalogGroup[] {
  const activeCats = categories.filter((c) => c.is_active && !c.archived)
  const groups: CatalogGroup[] = []

  for (const section of [...sections].filter((s) => s.is_active).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))) {
    const cats = activeCats
      .filter((c) => c.menu_section_id === section.id)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((category) => ({
        category,
        products: products
          .filter((p) => p.category_id === category.id && p.is_available && !p.archived)
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
      }))
      .filter((g) => g.products.length > 0)
    if (cats.length > 0) groups.push({ section, categories: cats })
  }

  const looseCats = activeCats
    .filter((c) => !c.menu_section_id) // a category assigned to a (closed) section stays hidden — server-enforced (CAT-D01=B)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((category) => ({
      category,
      products: products
        .filter((p) => p.category_id === category.id && p.is_available && !p.archived)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    }))
    .filter((g) => g.products.length > 0)
  if (looseCats.length > 0) groups.push({ section: null, categories: looseCats })

  return groups
}
