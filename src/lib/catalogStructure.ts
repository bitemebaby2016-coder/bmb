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
/**
 * ลำดับหัวข้อหมวดหมู่ — คำสั่ง Owner ใหม่ (N-4 #7 · 2026-10-26 · ใช้ทั้งแนวนอน/แนวตั้ง/ฟุตเตอร์):
 *   1. ส่งวันนี้/Same day → 2. จองล่วงหน้า/Pre order → 3. เมนูสุขภาพ → 4. เครื่องดื่ม
 *   → 5. ของทานเล่น/ผลไม้ (≡ของหวานลัน/ผลไม้) → 6. สินค้าสำเร็จรูป (≡เมนู_สำเร็จ)
 *   (แทนท่า Feature B 2026-10-25 ที่หมวดโหมดขายอยู่ท้ายลิสต์)
 * เทียบแบบ "ชื่อ/ชื่อเล่น = ความหมายเดียวกัน" (alias) — ชื่อจริงใน DB ไม่ตรงเป๊ะกับลิสต์
 * หมวดนอกลิสต์ = ตามด้วย sort_order ของแอดมิน (จัดการได้เหมือนเดิม)
 */
export const CATEGORY_DISPLAY_ORDER: ReadonlyArray<readonly string[]> = [
  ['ส่งวันนี้ / Same Day', 'ส่งวันนี้', 'same day'],
  ['จองล่วงหน้า / พรีออเดอร์', 'พรีออเดอร์', 'จองล่วงหน้า', 'preorder'],
  ['เมนูสุขภาพ'],
  ['เครื่องดื่ม'],
  ['ของทานเล่น / ผลไม้', 'ของหวานลัน / ผลไม้', 'ของกินเล่น / ผลไม้'],
  ['สินค้าสำเร็จรูป', 'เมนูสำเร็จ'],
]

/** เลขลำดับแสดงผลของหมวดหมู่ (ไม่พบชื่อ/ชื่อเล่นใดเลย = ท้ายรายการ) — ทนช่องว่าง/สแลช/พิมพ์เล็กใหญ่ */
export function categoryDisplayRank(name: string | null | undefined): number {
  const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase()
  const target = norm(String(name ?? ''))
  const i = CATEGORY_DISPLAY_ORDER.findIndex((aliases) => aliases.some((a) => norm(a) === target))
  return i === -1 ? CATEGORY_DISPLAY_ORDER.length : i
}

export function buildHeadingGroups(
  products: Product[],
  categories: ProductCategory[],
): HeadingGroup[] {
  const sellable = (products || []).filter((p) => p.is_available && !p.archived)
  return (categories || [])
    .filter((c) => c.is_active && !c.archived)
    .sort((a, b) => categoryDisplayRank(a.name) - categoryDisplayRank(b.name) || (a.sort_order ?? 0) - (b.sort_order ?? 0))
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

/**
 * L-4 (N-4 #4 · Owner 2026-10-26): รายการที่แท็บโหมดจะแสดงจริง — ใช้ทั้งตอนกรอง list
 * และตอนนับตัวเลขบนแท็บ (ป้ายต้องตรงกับที่เห็น เดิมนับคนละสูตรจึงเพี้ยน):
 * - ทั้งสองโหมด: ตัด archived + ค้นด้วย search (trim/case-insensitive) เหมือน list
 * - **Owner 2026-10-27 (พรีออเดอร์ = เมนูตาราง = อันเดียวกัน):** เมื่อมี scheduleMap
 *   (ProductScheduleMap จาก menu_schedule) ใช้ตารางเป็นตัวแบ่งแท็บทั้ง list/ตัวเลข —
 *   pre-order tab = เฉพาะเมนูปฏิทิน · same-day tab = เมนูสั่งทันทีที่เหลือ
 *   (ปิดจุด "บางหน้าบอก 2 บางหน้าบอก 20" — เดิมแท็บพรีออเดอร์นับทั้งแคตตาล็อก)
 * - ไม่ส่ง scheduleMap = ของเดิม (same-day: available_same_day ?? !is_preorder ·
 *   pre-order: ทั้งหมด) — เก็บไว้ให้ caller ที่ไม่มีตาราง (และ test เดิม)
 */
export function menuTabItems(
  products: Product[],
  tab: 'same-day' | 'pre-order',
  search: string,
  scheduleMap?: Readonly<Record<string, string>>,
): Product[] {
  const q = (search || '').trim().toLowerCase()
  return (products || []).filter((p) => {
    if (p.archived) return false
    if (q && !p.name.toLowerCase().includes(q)) return false
    if (scheduleMap) {
      const isCalendar = !!scheduleMap[p.id]
      return tab === 'pre-order' ? isCalendar : !isCalendar
    }
    if (tab === 'same-day') return p.available_same_day ?? !p.is_preorder
    return true
  })
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

/**
 * ทางเข้า Pre-order workflow เดียวที่ปุ่มทุกตำแหน่งใช้ร่วมกัน (Directive §8: จุดบน
 * HomePage ก่อน Popular Menu + ปุ่ม Footer ต้องเข้าสู่ workflow เดียวกัน ไม่คนละชุด):
 * - มีหมวดพรีออเดอร์ (ตาม saleModeOfCategory) → /menu?category=<id> (deep-link ที่
 *   MenuPage รองรับอยู่แล้ว — เทียบด้วย category id) → ลูกค้าเลือกสินค้า → ปุ่ม
 *   "จองล่วงหน้า" ทุกใบ → handlePreOrder → /checkout?mode=pre-order (เลือกวัน/รอบ
 *   จาก delivery_rounds จริง + menu_schedule gate)
 * - ไม่มีหมวดพรีออเดอร์ → /menu (เมนูรวม — สินค้า pre-order มีปุ่มจองล่วงหน้าทุกใบ)
 */
export function preOrderEntryPath(categories: Array<Pick<ProductCategory, 'id' | 'name' | 'slug'>>): string {
  const cat = categories.find((c) => saleModeOfCategory(c) === 'pre_order')
  return cat ? `/menu?category=${encodeURIComponent(cat.id)}` : '/menu'
}

/**
 * แนบ ?tab=pre-order ให้ deep-link เข้าหน้าเมนูแล้ว "เปิดแท็บจองล่วงหน้าทันที"
 * (Owner 2026-10-18: ปุ่มจองล่วงหน้าก่อนฟุตเตอร์เดิมลิงก์กลับ URL เดิมเฉย ๆ
 * กดแล้วไม่มีอะไรเกิดขึ้น — ต่อ tab นี้ให้ทุกจุดเข้า workflow เดียวกัน)
 */
export function withPreOrderTab(path: string): string {
  return `${path}${path.includes('?') ? '&' : '?'}tab=pre-order`
}
