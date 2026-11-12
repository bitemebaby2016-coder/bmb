// ============================================
// Bite Me Baby — Social AI Grounding Data (R96 Phase 1)
// ============================================
// ดึงข้อมูลผลิตภัณฑ์/ราคา/สถานะแบบ real-time สำหรับ grounding AI reply
// ใช้ใน social-ai-worker เพื่อป้องกัน AI มโนข้อมูลสินค้า
// READ-ONLY — ไม่เขียน DB
// ============================================

export interface GroundingProduct {
  id: string
  name: string
  price: number
  is_available: boolean
  category_id: string | null
}

export interface GroundingSchedule {
  product_id: string
  scheduled_date: string
  is_published: boolean
}

export interface GroundingData {
  products: GroundingProduct[]
  schedules: GroundingSchedule[]
  timestamp: number
}

export interface GroundingDeps {
  sbUrl: string
  serviceKey: string
}

// Cache 30 seconds (shorter than shopContext's 5 min for more real-time accuracy)
const GROUNDING_CACHE_MS = 30_000
let groundingCache: { at: number; data: GroundingData } | null = null

async function restGet(sbUrl: string, serviceKey: string, path: string): Promise<any[] | null> {
  try {
    const r = await fetch(sbUrl + path, {
      headers: { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey },
      signal: AbortSignal.timeout(5000),
    })
    if (!r.ok) return null
    const j = await r.json().catch(() => null)
    return Array.isArray(j) ? j : null
  } catch {
    return null
  }
}

/**
 * ดึงข้อมูลสินค้าจริงจาก DB สำหรับ grounding
 * ใช้ใน social-ai-worker ก่อนตอบ AI ทุกครั้ง
 */
export async function fetchGroundingData(deps: GroundingDeps): Promise<GroundingData> {
  // Check cache first
  if (groundingCache && Date.now() - groundingCache.at < GROUNDING_CACHE_MS) {
    return groundingCache.data
  }

  const bkkToday = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10)

  const [products, schedules] = await Promise.all([
    restGet(deps.sbUrl, deps.serviceKey,
      '/rest/v1/products?select=id,name,price,category_id,is_available&order=sort_order.asc&limit=200'),
    restGet(deps.sbUrl, deps.serviceKey,
      `/rest/v1/menu_schedule?select=product_id,scheduled_date,is_published&is_published=eq.true&scheduled_date=gte.${bkkToday}&order=scheduled_date.asc&limit=200`),
  ])

  const data: GroundingData = {
    products: (products || []).map((p: any) => ({
      id: String(p.id),
      name: String(p.name),
      price: Number(p.price),
      is_available: Boolean(p.is_available),
      category_id: p.category_id ? String(p.category_id) : null,
    })),
    schedules: (schedules || []).map((s: any) => ({
      product_id: String(s.product_id),
      scheduled_date: String(s.scheduled_date).slice(0, 10),
      is_published: Boolean(s.is_published),
    })),
    timestamp: Date.now(),
  }

  groundingCache = { at: Date.now(), data }
  return data
}

/**
 * สร้างข้อความ grounding สำหรับ inject เข้า prompt
 * รวม product IDs, prices, availability, และ schedule dates
 */
export function buildGroundingPrompt(data: GroundingData, relevantProductIds?: string[]): string {
  const products = relevantProductIds
    ? data.products.filter(p => relevantProductIds.includes(p.id))
    : data.products.filter(p => p.is_available)

  if (products.length === 0 && relevantProductIds?.length) {
    return 'PRODUCT GROUNDING: ไม่พบข้อมูลสินค้าที่เกี่ยวข้อง — ห้ามเดาข้อมูลเอง'
  }

  const productLines = products.map(p =>
    `  - ${p.name} (ID: ${p.id}) — ${p.price}฿ — ${p.is_available ? 'ขายได้' : 'หมด/ปิดรับ'}`
  ).join('\n')

  const scheduleLines = data.schedules
    .filter(s => products.some(p => p.id === s.product_id))
    .map(s => `  - ${s.product_id} → พรีออเดอร์วันที่ ${s.scheduled_date}`)
    .join('\n')

  return [
    '--- PRODUCT GROUNDING DATA (ข้อมูลสินค้าจริงจาก DB — ตอบจากนี้เท่านั้น) ---',
    productLines || '  (ไม่มีสินค้าที่ขายได้ในขณะนี้)',
    scheduleLines ? `\nPRE-ORDER SCHEDULE (ปฎิทินเมนูจริง):\n${scheduleLines}` : '',
    '',
    'กติกาบังคับ (MUST FOLLOW):',
    '- ชื่อเมนู/ราคา/สถานะ ต้องมาจากข้อมูลข้างบนเท่านั้น — ห้ามแต่ง/เดา/จำจากโพสต์เก่า',
    '- ถ้าสินค้ามี is_available = false → ต้องบอกว่า "ปิดรับออเดอร์แล้ว" หรือ "หมดวันนี้"',
    '- ถ้าไม่พบสินค้าในรายการ → ตอบว่า "ไม่พบในเมนูปัจจุบัน" แล้วชวนดูที่ biteme-baby.com/shop',
    '- ราคาที่บอกต้องตรงกับฐานข้อมูลเป๊ะ ๆ — ห้ามปัด/เดา/เพิ่มภาษีเอง',
    '- วันพรีออเดอร์ต้องมาจาก PRE-ORDER SCHEDULE ข้างบนเท่านั้น — ห้ามเดาวันเอง',
  ].join('\n')
}

/**
 * ดึงสินค้าที่เกี่ยวข้องจากข้อความลูกค้า (simple keyword matching)
 * ใช้กรอง grounding data ให้เล็กลง
 */
export function extractRelevantProductIds(userMessage: string, products: GroundingProduct[]): string[] {
  const normalized = userMessage.toLowerCase()
  return products
    .filter(p => normalized.includes(p.name.toLowerCase()))
    .map(p => p.id)
}

/** Clear cache (for testing or forced refresh) */
export function resetGroundingCache(): void {
  groundingCache = null
}