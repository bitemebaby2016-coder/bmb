// ============================================
// Bite Me Baby — Shared Shop Context for ALL AI surfaces (2026-10-17)
// ============================================
// บริบท "ข้อมูลร้านจริง" ชุดเดียวที่ใช้ร่วมกันทุกตัว AI (Owner directive:
// เอไอทุกตัวต้องทำงานต่อเนื่องร่วมกัน บริบทยึดข้อมูลจริง ห้ามมโน):
//   - social-ai-worker  (ตอบ Messenger / คอมเมนต์ Facebook)
//   - social-post-worker(ร่างโพสต์)
//   - web chat ใช้ aiDbContext ฝั่ง client ซึ่งอ่านตารางชุดเดียวกัน
//     (products / product_categories / business_settings)
//
// READ-ONLY เสมอ — โมดูลนี้ไม่เขียน DB ใด ๆ ทั้งสิ้น
// ข้อมูลติดต่อ = mirror ของ `SHOP_CONTACT` ใน
// src/components/layout/Footer.tsx (Owner ยืนยัน 2026-10-17) — ห้ามเขียนต่าง
// ============================================

export interface ShopContextDeps {
  sbUrl: string
  serviceKey: string
}

/** ข้อมูลติดต่อ/เวลาเปิดร้าน — mirror ของ Footer `SHOP_CONTACT` (Owner 2026-10-17) */
export const SHOP_FACTS_TH = [
  'ชื่อร้าน: Bite Me Baby (Cloud Kitchen) · จันทบุรี',
  'ที่อยู่: เมืองจันทบุรี',
  'โทรศัพท์: 094 2649269 · อีเมล: admin@biteme-baby.com',
  'เวลาเปิดร้าน: ทุกวัน 07:00-20:00 น. (Open Daily 7.00 am. - 20.00 pm.)',
  'สั่งอาหาร: biteme-baby.com/shop · ติดตามออเดอร์: biteme-baby.com/track',
  'การส่ง: Same-day (รอบส่งเช้า/กลางวัน/เย็น) และ Pre-order (สั่งล่วงหน้า)',
].join('\n')

/**
 * บุคลิกเดียวทุกช่องทาง — mirror ของ src/lib/bitePersona.ts (BITE_PERSONA_TH)
 * ให้เสียง/คำลงท้าย/การสะกดชื่อตรงกันทั้งแชตเว็บ เสียง Messenger และคอมเมนต์
 * (มี regression test คุมความสอดคล้องใน src/__tests__/socialAiContinuity.test.ts)
 */
export const BITE_PERSONA_SEGMENT = [
  'BITE PERSONA (บุคลิกเดียวทุกช่องทาง — ห้ามขัด):',
  '- คุณคือ "Bite" พนักงานเสิร์ฟ เพศชาย ของร้าน Bite Me Baby จ.จันทบุรี',
  '- ขี้เล่น ร่าเริง จริงใจ เป็นกันเอง ตื่นเต้นกับอาหาร ถามตอบสั้นกระชับ',
  '- คำลงท้าย: ใช้ "ครับ" เสมอ (คุณเป็นผู้ชาย) ห้ามใช้ "ค่ะ" "คะ" ทุกกรณี',
  '- ชื่อตัวเอง = "Bite" · ชื่อร้าน = "Bite Me Baby" — สะกดให้ถูกเสมอ ห้ามเปลี่ยนเป็นชื่ออื่น ห้ามสะกดผิด',
  '- สะกดภาษาไทยให้ถูกต้อง ห้ามประดิษฐ์คำมั่ว ห้ามทับศัพท์ผิด',
].join('\n')

/** กติกาตอบต่อเนื่อง — ปิดปัญหา "ตอบเบิ้ล/ทักซ้ำ/เงียบหาย" (Owner 2026-10-17) */
export const REPLY_CONTINUITY_RULES = [
  'กติกาบทสนทนา (สำคัญที่สุด):',
  '- ถ้ามี "บทสนทนาล่าสุด" ให้ตอบต่อเนื่องจากตรงนั้น ห้ามทักทายใหม่ซ้ำถ้าเพิ่งทักไปแล้ว (ตอบเบิ้ล = บริการไม่ดี)',
  '- ตอบคำถามของลูกค้าให้ตรงจุดก่อน แล้วค่อยชวนสั่งสั้น ๆ ท้ายคำตอบ ห้ามพร่ำเพรื่อ',
  '- ข้อมูลเมนู/ราคา/เวลาเปิดร้าน/โปรโมชัน ใช้จาก "ข้อมูลร้านจริง" ด้านล่างเท่านั้น ห้ามเดา ถ้าไม่มีข้อมูลให้บอกตามจริงว่าไม่พบ',
  '- ถ้าลูกค้าบอกไม่กินเผ็ด/แพ้อาหาร/ไม่ใส่เครื่องปรุง ให้ช่วยเลือกเมนูที่เหมาะสมจากรายการจริง และแนะนำให้ระบุ "ไม่เผ็ด" ในหมายเหตุตอนสั่งบนเว็บ',
  '- ห้ามหายไปเงียบ ๆ ถ้าตอบไม่ได้ ให้ตอบสั้น ๆ ว่าจะตามทีมงานร้านให้ แล้วชวนทัก Inbox',
].join('\n')

// --- cache ~5 นาที: ไม่ต้องยิง DB ทุกข้อความ ---
const CACHE_MS = 5 * 60_000
const MAX_CHARS = 2400
let cache: { at: number; text: string } | null = null

async function restGet(sbUrl: string, serviceKey: string, path: string): Promise<any[] | null> {
  try {
    const r = await fetch(sbUrl + path, {
      headers: { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey },
      signal: AbortSignal.timeout(8000),
    })
    if (!r.ok) return null
    const j = await r.json().catch(() => null)
    return Array.isArray(j) ? j : null
  } catch {
    return null
  }
}

/**
 * สร้างข้อความบริบทร้านจริงจาก DB (เมนูขายได้/หมด + โปรโมชัน + ตั้งค่าร้าน)
 * + ข้อมูลติดต่อ — คืน '' เมื่อดึงไม่ได้เลย (ผู้ใช้ prompt จะบอกตามจริงแทนมโน)
 */
export async function getShopContext(
  deps: ShopContextDeps,
  opts: { force?: boolean } = {},
): Promise<string> {
  if (!opts.force && cache && Date.now() - cache.at < CACHE_MS) return cache.text

  const [products, categories, promotions, settings] = await Promise.all([
    restGet(deps.sbUrl, deps.serviceKey,
      '/rest/v1/products?select=name,price,category_id,is_available,is_featured&order=sort_order.asc&limit=120'),
    restGet(deps.sbUrl, deps.serviceKey,
      '/rest/v1/product_categories?select=id,name&order=sort_order.asc&limit=40'),
    restGet(deps.sbUrl, deps.serviceKey,
      '/rest/v1/promotions?select=name,description,discount_type,discount_value,min_order_amount,end_date&limit=20'),
    restGet(deps.sbUrl, deps.serviceKey,
      '/rest/v1/business_settings?select=key,value&limit=40'),
  ])

  const anyData = products || categories || promotions || settings
  if (!anyData) {
    cache = { at: Date.now(), text: '' }
    return ''
  }

  const catName = new Map<string, string>()
  for (const c of categories || []) catName.set(String(c.id), String(c.name))

  const lines: string[] = ['SHOP FACTS (ข้อมูลร้านจริง):', SHOP_FACTS_TH]

  const available = (products || []).filter((p: any) => p.is_available)
  const unavailable = (products || []).filter((p: any) => !p.is_available)
  if (available.length > 0) {
    lines.push('MENU (ขายได้วันนี้ — ราคาจาก DB เท่านั้น):')
    const byCat = new Map<string, any[]>()
    for (const p of available) {
      const key = String(p.category_id || 'อื่น ๆ')
      if (!byCat.has(key)) byCat.set(key, [])
      byCat.get(key)!.push(p)
    }
    for (const [catId, items] of byCat) {
      lines.push(
        `  [${catName.get(catId) || catId}]: ` +
          items.map((p: any) => `${p.name} ${p.price}฿${p.is_featured ? '★แนะนำ' : ''}`).join(', '),
      )
    }
  }
  if (unavailable.length > 0) {
    lines.push('MENU หมดวันนี้ (ห้ามบอกว่าสั่งได้): ' + unavailable.map((p: any) => p.name).join(', '))
  }

  if (promotions && promotions.length > 0) {
    lines.push('PROMOTIONS (active):')
    for (const promo of promotions) {
      const parts = [String(promo.name)]
      if (promo.discount_type === 'percentage' && promo.discount_value != null) parts.push(`ลด ${promo.discount_value}%`)
      else if (promo.discount_type === 'fixed_amount' && promo.discount_value != null) parts.push(`ลด ${promo.discount_value}฿`)
      if (promo.min_order_amount) parts.push(`ขั้นต่ำ ${promo.min_order_amount}฿`)
      if (promo.end_date) parts.push(`ถึง ${promo.end_date}`)
      lines.push('  - ' + parts.join(' '))
    }
  }

  if (settings && settings.length > 0) {
    lines.push('STORE SETTINGS:')
    for (const s of settings) {
      const brief = JSON.stringify(s.value)
      if (brief && brief.length <= 200) lines.push(`  - ${s.key}: ${brief}`)
    }
  }

  let text = lines.join('\n')
  if (text.length > MAX_CHARS) text = text.slice(0, MAX_CHARS - 3) + '...'
  cache = { at: Date.now(), text }
  return text
}

/** Test/ops helper — ล้าง cache (ไม่กระทบ logic) */
export function resetShopContextCache(): void {
  cache = null
}

