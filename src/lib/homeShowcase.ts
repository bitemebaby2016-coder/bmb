// ============================================
// Bite Me Baby — Home showcase (CAT-WL-00)
// Pure display mirror: หน้า Home (Drinks/Snacks) อ่านสินค้าจาก canonical
// catalog เท่านั้น (products + product_categories) — ไม่มี mockup array
// ============================================

import type { Product, ProductCategory } from '@/types'

export interface HomeShowcaseItem {
  id: string
  name: string
  price: string | number
  description: string
  image: string
  categoryId: string
}

/**
 * เลือกสินค้าของหมวด (ตาม slug) จาก canonical data เพื่อโชว์บน Home
 * - เฉพาะหมวดที่ is_active และสินค้าที่ is_available (RLS กรองแล้วฝั่ง server —
 *   filter ซ้ำที่นี่เป็น pure-mirror เพื่อกัน caller ส่ง full list เข้ามา)
 * - ไม่มีหมวด/ไม่มีสินค้า = array ว่าง (section จะซ่อนตัวเอง)
 */
export function selectHomeShowcase(
  products: Product[],
  categories: ProductCategory[],
  slug: string,
): HomeShowcaseItem[] {
  const cat = categories.find((c) => c.slug === slug && c.is_active)
  if (!cat) return []
  return products
    .filter((p) => p.category_id === cat.id && p.is_available)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      description: p.description ?? '',
      image: p.image_url ?? '',
      categoryId: p.category_id,
    }))
}
