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

export type CustomerVisibilityIssue = 'category_missing' | 'category_inactive' | 'category_archived'

/**
 * P0 (2026-10-14): explain WHY a product never renders on the customer menu —
 * buildCatalogGroups only shows products whose category is present, active and
 * unarchived in the CUSTOMER category read (RLS product_categories_public_read
 * = is_active). The admin screens must surface this gate, otherwise the admin
 * cannot tell that customers never see the item (live case: products bound to
 * cat-1/cat-2 while only cat-3/4/5/... are customer-visible).
 */
export function customerVisibilityIssue(
  product: Pick<Product, 'category_id'>,
  categories: Array<Pick<ProductCategory, 'id' | 'is_active' | 'archived'>>,
): CustomerVisibilityIssue | null {
  const cat = categories.find((c) => c.id === product.category_id)
  if (!cat) return 'category_missing'
  if (cat.archived) return 'category_archived'
  if (!cat.is_active) return 'category_inactive'
  return null
}

/** Thai label for the admin badge (customer-hidden reason). */
export const CUSTOMER_VISIBILITY_LABEL: Record<CustomerVisibilityIssue, string> = {
  category_missing: 'ไม่มีหมวดหมู่นี้แล้ว',
  category_inactive: 'หมวดหมู่ปิดอยู่',
  category_archived: 'หมวดหมู่ถูกจัดเก็บ',
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

// ============================================
// UX fix 2026-10-15 — ปุ่มกรองหมวด + โหมดขายของช่อง/หมวด
// ============================================

/** โหมดขายที่ผูกกับช่อง/หมวด — ใช้บังคับ CTA เดียวต่อการ์ด (SectionMode) */
export type SaleMode = 'same_day' | 'pre_order' | 'auto'

/**
 * หมวด/ช่องที่ผูกกับโหมดขาย (ตามชื่อ/slug ที่แอดมินตั้ง):
 * - "จองล่วงหน้า / พรีออเดอร์" → pre_order · "ส่งวันนี้ / Same Day" → same_day
 * - หมวดกลาง ๆ → 'auto' (ใช้โหมดขายจริงของสินค้า)
 */
export function saleModeOfCategory(cat: Pick<ProductCategory, 'name' | 'slug'>): SaleMode {
  const s = `${cat?.name ?? ''} ${cat?.slug ?? ''}`.toLowerCase()
  if (/จองล่วงหน้า|พรีออเดอร์|ล่วงหน้า|pre[\s-]?order/.test(s)) return 'pre_order'
  if (/ส่งวันนี้|สั่งวันนี้|same[\s-]?day/.test(s)) return 'same_day'
  return 'auto'
}

export interface CategoryChipGroup {
  section: MenuSection | null
  categories: ProductCategory[]
}

/**
 * ปุ่มกรองหมวด — จัดกลุ่ม/เรียงตามหมวดหลัก (MenuSection) เหมือนกันทั้ง /shop และ /menu
 * (D2) — หมวดว่าง/หมวดในกลุ่มปิด = ซ่อน ตามกติกาเดียวกับ buildCatalogGroups (D3)
 */
export function groupCategoriesForChips(
  categories: ProductCategory[],
  sections: MenuSection[],
  products: Pick<Product, 'category_id' | 'is_available' | 'archived'>[],
): CategoryChipGroup[] {
  const sellable = (products || []).filter((p) => p.is_available && !p.archived)
  const hasItems = (catId: string) => sellable.some((p) => p.category_id === catId)
  const activeCats = categories.filter((c) => c.is_active && !c.archived && hasItems(c.id))
  const groups: CategoryChipGroup[] = []

  for (const section of [...sections].filter((s) => s.is_active).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))) {
    const cats = activeCats
      .filter((c) => c.menu_section_id === section.id)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    if (cats.length > 0) groups.push({ section, categories: cats })
  }

  const loose = activeCats
    .filter((c) => !c.menu_section_id)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  if (loose.length > 0) groups.push({ section: null, categories: loose })

  return groups
}
