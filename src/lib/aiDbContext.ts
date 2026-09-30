// ============================================
// Bite Me Baby — AI DB Context Builder (AI-CTX / WS-3)
// ============================================
// ดึงข้อมูลจริงจาก Supabase (anon key + RLS เท่านั้น — ไม่ใช้ service role)
// แล้วย่อเป็น context กระชับให้โมเดล "ตอบจาก context เท่านั้น" กันมโนราคา/เมนู
//
// Security:
//   - อ่านผ่าน public client เดิม (src/lib/supabase.ts) — RLS กรองอยู่แล้ว
//   - ตารางที่อ่านมี anon SELECT grant (migration 097/100): products,
//     product_categories, promotions, business_settings
//   - READ-ONLY เด็ดขาด (ตาม AI-02 guardrail)
//
// Cache: 1 fetch ต่อ ~7 นาที (ไม่ query ทุกข้อความ) + invalidate() สำหรับ invalidate
// เมื่อเปลี่ยนหน้าเมนู/แก้แคตตาล็อก
// ============================================

import { supabase } from './supabase'

// จำกัดขนาด context กันโมเดลโดนทิ้ง (≤ ~3,500 chars ≈ ~1,000 tokens —
// ต่ำกว่าเพดาน ~1,500 tokens ที่ handoff กำหนด และต้องเผื่อคำตอบ)
const MAX_CONTEXT_CHARS = 3500

// ความสดของ cache (7 นาที — handoff แนะ 5–10 นาที)
const CACHE_TTL_MS = 7 * 60 * 1000

interface CacheEntry {
  builtAt: number
  text: string
}

let cache: CacheEntry | null = null

/** Invalidate the cached DB context (call after catalog/settings changes). */
export function invalidateDbContext(): void {
  cache = null
}

/** Test-only: clear cache synchronously. */
export function resetDbContextCacheForTests(): void {
  cache = null
}

interface RawProduct {
  id: string
  name: string
  price: number
  category_id: string | null
  is_available: boolean
  is_featured: boolean
  stock?: number | null
}

interface RawCategory {
  id: string
  name: string
}

interface RawPromotion {
  name: string
  description: string | null
  discount_type: string | null
  discount_value: number | null
  min_order_amount: number | null
  end_date: string | null
}

interface RawSetting {
  key: string
  value: Record<string, unknown>
}

export interface DbContextResult {
  /** ข้อความ context ที่ inject ได้ทันที ('' ถ้าดึงไม่ได้เลย) */
  text: string
  /** true เมื่อดึงสำเร็จอย่างน้อย 1 ตาราง */
  ok: boolean
  /** ตารางที่ดึงล้มเหลว (skip ข้อมูลส่วนนั้น — ไม่ทำให้ทั้ง context พัง) */
  failedTables: string[]
}

/** Read one table; failure of a single table must not break the rest. */
async function safeSelect<T>(
  tableName: string,
  failedTables: string[],
  build: () => PromiseLike<{ data: T[] | null; error: { message?: string } | null }>
): Promise<T[]> {
  try {
    const { data, error } = await build()
    if (error) throw error
    return data ?? []
  } catch (e) {
    console.warn(`[AI DB Context] skip table "${tableName}":`, e instanceof Error ? e.message : e)
    failedTables.push(tableName)
    return []
  }
}

/** ดึงข้อมูลจาก DB (fresh query เสมอ — caller ควรผ่าน cache wrapper) */
async function fetchDbContext(): Promise<DbContextResult> {
  const failedTables: string[] = []

  const [products, categories, promotions, settings] = await Promise.all([
    safeSelect<RawProduct>('products', failedTables, () =>
      supabase
        .from('products')
        .select('id,name,price,category_id,is_available,is_featured,stock')
        .order('sort_order', { ascending: true })
        .limit(200)
    ),
    safeSelect<RawCategory>('product_categories', failedTables, () =>
      supabase.from('product_categories').select('id,name').limit(50)
    ),
    safeSelect<RawPromotion>('promotions', failedTables, () =>
      supabase
        .from('promotions')
        .select('name,description,discount_type,discount_value,min_order_amount,end_date,is_active')
        .eq('is_active', true)
        .limit(20)
    ),
    safeSelect<RawSetting>('business_settings', failedTables, () =>
      supabase.from('business_settings').select('key,value').limit(40)
    ),
  ])

  const ok =
    products.length > 0 || categories.length > 0 || promotions.length > 0 || settings.length > 0
  if (!ok) {
    // ทุกตารางล้มเหลว → ไม่มี context (โมเดลใช้ base prompt และบอกตามจริงแทนการมโน)
    return { text: '', ok: false, failedTables }
  }

  const catName = new Map(categories.map((c) => [c.id, c.name]))
  const available = products.filter((p) => p.is_available)
  const unavailable = products.filter((p) => !p.is_available)

  const lines: string[] = []

  // --- เมนู (กลุ่มตามหมวด, เฉพาะที่ขายได้) ---
  if (available.length > 0) {
    lines.push('MENU (ขายได้วันนี้ — ราคาจาก DB):')
    const byCat = new Map<string, RawProduct[]>()
    for (const p of available) {
      const key = p.category_id || 'อื่น ๆ'
      if (!byCat.has(key)) byCat.set(key, [])
      byCat.get(key)!.push(p)
    }
    for (const [catId, items] of byCat) {
      const catLabel = catName.get(catId) || catId
      lines.push(
        `  [${catLabel}]: ` +
          items
            .map((p) => `${p.name} ${p.price}฿${p.is_featured ? '★แนะนำ' : ''}`)
            .join(', ')
      )
    }
  }
  if (unavailable.length > 0) {
    lines.push(`MENU หมดวันนี้ (ห้ามบอกว่าสั่งได้): ${unavailable.map((p) => p.name).join(', ')}`)
  }

  // --- โปรโมชันที่ active ---
  if (promotions.length > 0) {
    lines.push('PROMOTIONS (active):')
    for (const promo of promotions) {
      const parts = [promo.name]
      if (promo.discount_type === 'percentage' && promo.discount_value != null) {
        parts.push(`ลด ${promo.discount_value}%`)
      } else if (promo.discount_type === 'fixed_amount' && promo.discount_value != null) {
        parts.push(`ลด ${promo.discount_value}฿`)
      }
      if (promo.min_order_amount) parts.push(`ขั้นต่ำ ${promo.min_order_amount}฿`)
      if (promo.end_date) parts.push(`ถึงวันที่ ${promo.end_date}`)
      if (promo.description) parts.push(`(${promo.description})`)
      lines.push(`  - ${parts.join(' ')}`)
    }
  }

  // --- ตั้งค่าร้าน (เวลาร้าน/โซนส่ง/วิธีชำระ — เลือกเฉพาะ key ที่โมเดลใช้ตอบได้) ---
  if (settings.length > 0) {
    lines.push('STORE SETTINGS:')
    for (const s of settings) {
      // value เป็น JSONB — ย่อเป็น JSON สั้น ๆ (ตัดข้อมูลยาว/ไม่เกี่ยว)
      const brief = JSON.stringify(s.value)
      if (brief && brief.length <= 200) {
        lines.push(`  - ${s.key}: ${brief}`)
      }
    }
  }

  return { text: lines.join('\n'), ok: true, failedTables }
}

/**
 * ข้อความ context พร้อมคำสั่งกันมโน — พร้อม inject ใน system message.
 * ใช้ cache (TTL 7 นาที); `forceRefresh = true` เพื่อ bypass cache.
 * ถ้าดึงไม่ได้เลย → คืน '' (โมเดลใช้ base prompt + บอกว่าเช็คข้อมูลไม่ได้ ห้ามเดา).
 */
export async function getDbContextPrompt(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cache && Date.now() - cache.builtAt < CACHE_TTL_MS) {
    return cache.text
  }
  const result = await fetchDbContext()
  let text = result.ok
    ? result.text + '\n\nห้ามมโน: ตอบจากข้อมูลใน context นี้เท่านั้น ' +
      '(เฉพาะราคา/เมนู/โปรโมชัน/ตั้งค่าร้าน) ถ้าไม่มีข้อมูลใน context ให้บอกตามจริงและแนะนำถามทางร้าน ' +
      'ราคาใช้ตัวเลขจาก context เท่านั้น ห้ามปรับราคาเอง'
    : ''
  // cap รวม suffix กันมโนด้วย — เพดานต้องรวมทุกอย่างที่จะ inject จริง
  if (text.length > MAX_CONTEXT_CHARS) {
    text = text.slice(0, MAX_CONTEXT_CHARS - 3) + '...'
  }
  cache = { builtAt: Date.now(), text }
  return text
}

/** ตรวจว่า cache ยังอยู่ (test/debug) */
export function hasDbContextCache(): boolean {
  return cache !== null
}
