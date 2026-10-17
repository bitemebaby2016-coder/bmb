// ============================================
// Bite Me Baby — Catalog structure (UNIFIED "หัวข้อเมนู" model, 2026-10-17)
// ============================================
// เดิม: Menu → Section → Category → Product (3 ชั้น) — Section ชั้นบนซ้ำชื่อกับหมวด
// และการซ่อน section ทำให้เมนูหายทั้งหมวดทั้งที่แอดมินเห็นป้าย "ลูกค้าเห็น"
// (Owner directive 2026-10-17: รวมเป็นระบบเดียว — หัวข้อเมนู = หมวดหมู่ (category)
// ชั้นเดียว ใช้แสดงทั้ง /shop และ /menu จากตัวจัดกลุ่มเดียวกัน ครบทุกเมนู
// ไม่มีตัวซ้อน · แอดมินเพิ่ม/แก้/ลบหัวข้อได้ตลอด · menu_sections เกษียณแล้ว)
//
// Pure display logic: no fetching, no mutation.
// ============================================

import type { Product, ProductCategory } from '@/types'

/** หนึ่ง "หัวข้อเมนู" (heading) = หมวดหมู่ 1 หมวด + เมนูที่ขายได้ในหมวดนั้น */
export interface HeadingGroup {
  category: ProductCategory
  products: Product[]
}

export type CustomerVisibilityIssue = 'category_missing' | 'category_inactive' | 'category_archived'

/**
 * P0 (2026-10-14): explain WHY a product never renders on the customer menu —
 * visibility ของเมนู = หมวดหมู่ต้องมีอยู่ เปิดอยู่ และไม่ถูกจัดเก็บ
 * (ระบบหัวข้อเมนูเดียว 2026-10-17 — ไม่มีชั้น section ซ่อนอีกต่อไป)
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
 * จัดกลุ่มเมนูเป็น "หัวข้อเมนู" — แหล่งความจริงเดียวของทั้ง /shop และ /menu
 * - หัวข้อ = หมวดหมู่ที่ is_active และไม่ archived (เรียง sort_order)
 * - เมนูในหัวข้อ = is_available และไม่ archived (mirror ของ gate ฝั่ง server —
 *   server ยังคงเป็น authority ตอนสั่งซื้อ)
 * - หัวข้อว่าง = ซ่อน (ไม่โชว์แถวเปล่า) — กติกาเดียวกันทุกหน้า
 * - ค่า menu_section_id เก่า (ชั้นที่เกษียณแล้ว) ถูกละเลย — ไม่มีวันทำให้เมนูหายอีก
 */
export function buildHeadingGroups(
  products: Product[],
  categories: ProductCategory[],
): HeadingGroup[] {
  const sellable = (products || []).filter((p) => p.is_available && !p.archived)
  return (categories || [])
    .filter((c) => c.is_active && !c.archived)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((category) => ({
      category,
      products: sellable
        .filter((p) => p.category_id === category.id)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    }))
    .filter((g) => g.products.length > 0)
}

/**
 * ปุ่มกรองหมวด (chips) — ใช้กติกาการมองเห็นเดียวกับ buildHeadingGroups
 * (หัวข้อที่โชว์ใน chips = หัวข้อที่โชว์ในหน้าเมนูเสมอ — "เชื่อเป็นแบบเดียวกัน")
 */
export function headingChips(
  categories: ProductCategory[],
  products: Pick<Product, 'category_id' | 'is_available' | 'archived'>[],
): ProductCategory[] {
  return buildHeadingGroups(
    products as Product[],
    categories,
  ).map((g) => g.category)
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
