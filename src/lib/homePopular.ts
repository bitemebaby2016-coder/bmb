// ============================================
// Bite Me Baby — "เมนูยอดนิยม" (Home popular showcase) + site copy
// ============================================
// - คอลเลกชัน "เมนูยอดนิยม" ประจำหน้าแรก: แอดมินเลือกเมนูได้จากทุกกลุ่ม/ทุกหมวด
//   (รวมเมนูจองล่วงหน้า) และสลับสับเปลี่ยนรายการที่โชว์ได้อัตโนมัติ
// - เก็บค่าใน business_settings (คีย์ home_popular_menu) — แอดมินแก้ได้ที่หน้า
//   แอดมินโดยไม่ต้อง deploy (ค่า default อยู่ในไฟล์นี้ — ถ้าอ่านค่าไม่ได้จะใช้ค่า default)
// - site_copy (คีย์ site_copy): ข้อความหลักบนหน้าเว็บที่แอดมินแก้ได้เช่นกัน
// Pure display logic — no fetching, no mutation.
// ============================================

import type { HomeProduct, Product, ProductCategory } from '@/types'
import type { ProductScheduleMap } from './productSchedule'

export const HOME_POPULAR_KEY = 'home_popular_menu'
export const SITE_COPY_KEY = 'site_copy'

export interface HomePopularConfig {
  /** หัวข้อ section (default: เมนูยอดนิยม) */
  title: string
  /** รหัสเมนูที่แอดมินเลือก (ลำดับที่เลือก = ลำดับโชว์; เลือกได้จากทุกเซกชัน) */
  productIds: string[]
  /** รหัสเมนูที่ปิดชั่วคราวด้วยปุ่มเปิด-ปิด (ยังอยู่ในรายการแต่ไม่โชว์) */
  disabledIds: string[]
  /** true = สลับสับเปลี่ยนเมนูที่โชว์อัตโนมัติ */
  autoRotate: boolean
  /** จำนวนเมนูสูงสุดที่โชว์ต่อรอบ */
  showCount: number
}

export const DEFAULT_HOME_POPULAR: HomePopularConfig = {
  title: 'เมนูยอดนิยม',
  productIds: [],
  disabledIds: [],
  autoRotate: true,
  showCount: 10,
}

function toStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.length > 0) : []
}

export function parseHomePopularConfig(raw: unknown): HomePopularConfig {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_HOME_POPULAR, productIds: [], disabledIds: [] }
  const r = raw as Record<string, unknown>
  const showCount = Number(r.showCount)
  return {
    title: typeof r.title === 'string' && r.title.trim() ? r.title.trim() : DEFAULT_HOME_POPULAR.title,
    productIds: toStringArray(r.productIds),
    disabledIds: toStringArray(r.disabledIds),
    autoRotate: r.autoRotate !== false,
    showCount: Number.isFinite(showCount) && showCount > 0
      ? Math.min(Math.floor(showCount), 24)
      : DEFAULT_HOME_POPULAR.showCount,
  }
}

export interface SiteCopy {
  /** หัวข้อ section จองล่วงหน้าบนหน้าแรก */
  homePreOrderTitle: string
  /** ข้อความเตือนใต้ป้ายแคมเปญ (โฟลตติ้งแอด) */
  adNotice: string
}

export const DEFAULT_SITE_COPY: SiteCopy = {
  homePreOrderTitle: 'จองล่วงหน้า — สั่งอาหารจันทบุรี เตรียมพร้อมส่ง',
  adNotice: 'โปรโมชั่นมีจำนวนจำกัด เงื่อนไขเป็นไปตามที่ร้านกำหนด',
}

export function parseSiteCopy(raw: unknown): SiteCopy {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SITE_COPY }
  const r = raw as Record<string, unknown>
  const pick = (k: keyof SiteCopy): string =>
    typeof r[k] === 'string' && (r[k] as string).trim() ? (r[k] as string).trim() : DEFAULT_SITE_COPY[k]
  return {
    homePreOrderTitle: pick('homePreOrderTitle'),
    adNotice: pick('adNotice'),
  }
}


/** โหมดขายของเมนู — จองล่วงหน้าเมื่อเปิด available_preorder (alias เดิม: is_preorder) */
export function productModeOf(p: Pick<Product, 'available_preorder' | 'is_preorder'>): 'same-day' | 'pre-order' {
  return (p.available_preorder ?? p.is_preorder) ? 'pre-order' : 'same-day'
}

/**
 * offset สำหรับสลับรายการโชว์ — เปลี่ยนทุก 30 นาทีตามเวลาจริง
 * (deterministic ต่อช่วงเวลา: refresh กี่ครั้งในรอบเดียวกัน ได้ลำดับเดียวกัน)
 */
export function popularRotationOffset(poolSize: number, nowMs: number, autoRotate: boolean): number {
  if (!autoRotate || poolSize <= 0) return 0
  const SLOT_MS = 30 * 60 * 1000
  return Math.floor(nowMs / SLOT_MS) % poolSize
}

/**
 * สร้างรายการ "เมนูยอดนิยม":
 * - ถ้าแอดมินเลือกไว้ (productIds) → ใช้ลำดับที่เลือก (เลือกได้จากทุกเซกชัน รวมเมนูจองล่วงหน้า)
 * - ถ้ายังไม่ได้เลือก → รวมเมนูแนะนำจากทุกหมวด สลับสั่งวันนี้/จองล่วงหน้าคละกันอัตโนมัติ
 * - ตัดเมนูที่ toggle ปิดออก, สลับลำดับตามรอบเวลา (autoRotate) แล้วตัดโชว์ตาม showCount
 */
export function resolvePopularItems(
  products: Product[],
  categories: ProductCategory[],
  config: HomePopularConfig,
  nowMs: number = Date.now(),
  schedule: import('./productSchedule').ProductScheduleMap = {},
): Product[] {
  const cats = categories || []
  const activeCatIds = new Set(cats.filter((c) => c.is_active && !c.archived).map((c) => c.id))
  const sellable = (products || []).filter((p) => {
    if (!p.is_available || p.archived) return false
    // ถ้ามีข้อมูลหมวด → โชว์เฉพาะเมนูที่ลูกค้ามองเห็นจริง (หมวดเปิดอยู่)
    return cats.length === 0 || activeCatIds.has(p.category_id)
  })
  const hidden = new Set(config.disabledIds)

  let pool: Product[]
  if (config.productIds.length > 0) {
    const byId = new Map(sellable.map((p) => [p.id, p]))
    pool = config.productIds.map((id) => byId.get(id)).filter((p): p is Product => !!p)
  } else {
    // auto: เมนูแนะนำ (is_featured) มาก่อน แล้วสลับโหมดขายคละกัน (สั่งวันนี้/จองล่วงหน้า)
    const ranked = [...sellable].sort(
      (a, b) => Number(b.is_featured) - Number(a.is_featured) || (a.sort_order ?? 0) - (b.sort_order ?? 0),
    )
    const sameDay = ranked.filter((p) => productModeOf(p) === 'same-day')
    const preOrder = ranked.filter((p) => productModeOf(p) === 'pre-order')
    pool = []
    const n = Math.max(sameDay.length, preOrder.length)
    for (let i = 0; i < n; i++) {
      if (i < sameDay.length) pool.push(sameDay[i])
      if (i < preOrder.length) pool.push(preOrder[i])
    }
  }

  const visible = pool.filter((p) => {
    if (hidden.has(p.id)) return false
    // R34 (Owner): พรีออเดอร์ที่ "ยังไม่ลงปฏิทินรอบถัดไป" = ไม่โชว์ในช่องเมนูยอดนิยม
    // (การ์ดจะมีปุ่มล็อก 'ยังไม่ลงปฏิทินรอบถัดไป' — เอาออกแทนการโชว์ปุ่มตาย)
    if (productModeOf(p) === 'pre-order' && !schedule[p.id]) return false
    return true
  })
  if (visible.length === 0) return []
  const offset = popularRotationOffset(visible.length, nowMs, config.autoRotate)
  const rotated = visible.slice(offset).concat(visible.slice(0, offset))
  return rotated.slice(0, Math.min(config.showCount, rotated.length))
}

/** map Product → HomeProduct ของการ์ด "เมนูยอดนิยม" (โหมดขายจริง + วันจัดส่งจาก menu_schedule) */
export function toPopularHomeProduct(p: Product, cat: ProductCategory | undefined, schedule: ProductScheduleMap = {}): HomeProduct {
  const mode = productModeOf(p)
  return {
    id: p.id,
    name: p.name,
    image: p.image_url || '',
    price: Number(p.price) || 0,
    description: p.description || '',
    category_id: p.category_id,
    categoryName: cat?.name,
    categoryIcon: cat?.icon,
    mode,
    availability: p.is_available ? 'available' : 'sold_out',
    stock: p.stock ?? 0,
    cta: mode === 'pre-order' ? '📅 จองล่วงหน้า' : '🛒 เพิ่มลงตะกร้า',
    scheduledDate: schedule[p.id],
  }
}
