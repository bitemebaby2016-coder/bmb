// ============================================
// Bite Me Baby — Home showcase (CAT-WL-00)
// Pure display mirror: หน้า Home (Drinks/Snacks) อ่านสินค้าจาก canonical
// catalog เท่านั้น (products + product_categories) — ไม่มี mockup array
// ============================================

import type { Product, ProductCategory } from '@/types'
import type { ProductScheduleMap } from './productSchedule'

export interface HomeShowcaseItem {
  id: string
  name: string
  price: string | number
  description: string
  image: string
  categoryId: string
  /** FIX (owner report 2026-10-01): cart CTA needs mode/availability flags —
   * showcase cards used to render with no add-to-cart button at all. */
  isAvailable: boolean
  /** same-day orderable (canonical migration 023 + alias fallback) */
  sameDay: boolean
  /** pre-orderable (canonical migration 023 + alias fallback) */
  preorder: boolean
  /** วันจัดส่งจริงของเมนูจองล่วงหน้า (menu_schedule — ผ่าน ProductScheduleMap; ไม่ใช้ products.scheduled_date) */
  scheduledDate?: string
}

/**
 * เลือกสินค้าของหมวด (ตาม id หรือ slug) จาก canonical data เพื่อโชว์บน Home
 * - รองรับทั้ง category id (ค่าหลัก — กัน slug ซ้ำกัน) และ slug (ค่าเดิม)
 * - เฉพาะหมวดที่ is_active และสินค้าที่ is_available (RLS กรองแล้วฝั่ง server —
 *   filter ซ้ำที่นี่เป็น pure-mirror เพื่อกัน caller ส่ง full list เข้ามา)
 * - ไม่มีหมวด/ไม่มีสินค้า = array ว่าง (section จะซ่อนตัวเอง)
 */
export function selectHomeShowcase(
  products: Product[],
  categories: ProductCategory[],
  slug: string,
  schedule: ProductScheduleMap = {},
): HomeShowcaseItem[] {
  const cat = categories.find((c) => c.id === slug && c.is_active)
    ?? categories.find((c) => c.slug === slug && c.is_active)
  if (!cat) return []
  return products
    .filter((p) => p.category_id === cat.id && p.is_available && !p.archived)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      description: p.description ?? '',
      image: p.image_url ?? '',
      categoryId: p.category_id,
      isAvailable: !!p.is_available && !p.archived,
      sameDay: !!(p.available_same_day ?? !p.is_preorder),
      preorder: !!(p.available_preorder ?? p.is_preorder),
      scheduledDate: schedule[p.id],
    }))
}
