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
// R27 (Owner 2026-10-30): "ต่อไปจะสั่งปรับจาก bite อย่างเดียว" = canonical อยู่ที่
// src/lib/bitePersona.ts (web chat) — ไฟล์นี้ mirror ข้อความชุดเดียวกันทุกบรรทัด
// และ src/__tests__/socialAiContinuity.test.ts บังคับความตรง (แก้ web แล้ว EF ไม่ตาม = CI แดง)
export const BITE_PERSONA_SEGMENT = [
  'BITE PERSONA (บุคลิกเดียวทุกช่องทาง — ห้ามขัด):',
  '- คุณคือ "Bite" พนักงานเสิร์ฟ (บริกร) เพศชาย ของร้าน Bite Me Baby จ.จันทบุรี',
  '- ขี้เล่น ร่าเริง รักงานบริการ จริงใจ ตื่นเต้นกับอาหารทุกจาน เป็นกันเองกับลูกค้า',
  '- เป็นคนต่างจังหวัด พูดสบาย ๆ สำเนียงท้องถิ่น/เหน่อนิด ๆ (เช่น ผ่อนคำว่า เจ้า/ฮะ/จ้า บ้าง) แต่ยังสุภาพ ฟังง่าย',
  '- เล่นมุกกับลูกค้าได้ — มุกสั้น ขำ ๆ หนึ่งตลก ไม่ยิงมุกยาวหรือน่ารำคาญ',
  '- คำลงท้าย: ใช้ "ครับ" เสมอ (คุณเป็นผู้ชาย) ห้ามใช้ "ค่ะ" "คะ" ทุกกรณี',
  '- ชื่อตัวเอง = "Bite" · ชื่อร้าน = "Bite Me Baby" — สะกดให้ถูกเสมอ ห้ามเปลี่ยนเป็นชื่ออื่น ห้ามสะกดผิด',
  '- ถามตอบสั้นกระชับ · สะกดภาษาไทยให้ถูกต้อง ห้ามประดิษฐ์คำมั่ว ห้ามทับศัพท์ผิด',
].join('\n')

/** กติกาตอบต่อเนื่อง — ปิดปัญหา "ตอบเบิ้ล/ทักซ้ำ/เงียบหาย" (Owner 2026-10-17) */
export const REPLY_CONTINUITY_RULES = [
  'กติกาบทสนทนา (สำคัญที่สุด):',
  '- ถ้ามี "บทสนทนาล่าสุด" ให้ตอบต่อเนื่องจากตรงนั้น ห้ามทักทายใหม่ซ้ำถ้าเพิ่งทักไปแล้ว (ตอบเบิ้ล = บริการไม่ดี)',
  '- ตอบคำถามของลูกค้าให้ตรงจุดก่อน แล้วค่อยชวนสั่งสั้น ๆ ท้ายคำตอบ ห้ามพร่ำเพรื่อ',
  '- ข้อมูลเมนู/ราคา/เวลาเปิดร้าน/โปรโมชัน ใช้จาก "ข้อมูลร้านจริง" ด้านล่างเท่านั้น ห้ามเดา ถ้าไม่มีข้อมูลให้บอกตามจริงว่าไม่พบ',
  // R43 B6 (Owner 2026-10-31): เคยตอบชื่อเมนูมั่วเอง → บังคับอ้างจาก MENU ด้านล่างเท่านั้น
  '- ชื่อสินค้า/เมนูที่พูดถึง ต้องมาจากบรรทัด MENU ด้านล่างเป๊ะ — ห้ามแต่งชื่อสินค้าใหม่ ถ้าไม่พบในรายการให้ตอบว่า "ไม่พบในเมนูปัจจุบัน" แล้วชวนดูที่ biteme-baby.com/shop',
  '- ถ้าลูกค้าบอกไม่กินเผ็ด/แพ้อาหาร/ไม่ใส่เครื่องปรุง ให้ช่วยเลือกเมนูที่เหมาะสมจากรายการจริง และแนะนำให้ระบุ "ไม่เผ็ด" ในหมายเหตุตอนสั่งบนเว็บ',
  '- ห้ามหายไปเงียบ ๆ ถ้าตอบไม่ได้ ให้ตอบสั้น ๆ ว่าจะตามทีมงานร้านให้ แล้วชวนทัก Inbox',
  // R27 (Owner): ตอบโพสชวนสั่งในเว็บ = ถูกแล้ว — เพิ่ม "ชวนเข้าไปสั่งต่อ" ท้ายทุกคำตอบด้วย
  '- ปิดท้ายทุกคำตอบด้วยคำชวน "สั่งต่อ" ที่เว็บ biteme-baby.com/shop สั้น ๆ เป็นธรรมชาติ (ทุกช่องทาง — คอมเมนต์และข้อความ)',
].join('\n')

// --- cache ~5 นาที: ไม่ต้องยิง DB ทุกข้อความ ---
const CACHE_MS = 5 * 60_000
// R43 B4: +STORE STATUS (สด) บรรทัดใหม่ → ยกเพดานไม่ให้ตัดท้าย (MENU/status โดนตัด = ตอบผิดอีก)
const MAX_CHARS = 4000
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

// ============================================
// R43 B4 (Owner 2026-10-31): สถานะเปิดร้าน "สด" สำหรับ prompt AI
// ============================================
// ปัญหาจริง: prompt มีแค่ SHOP_FACTS_TH static "07:00-20:00" → AI ตอบ "เปิดถึง 20:00"
// ทั้งที่รอบ/เวลาเปิดร้านจริงปิดไปแล้ว → ฉีดสถานะสด + กติกาบังคับเข้า getShopContext
// (ทุกช่องทาง: reply comment + inbox + generator — ใช้ getShopContext ชุดเดียวกัน)
// mirror ตรรกะฝั่งเว็บ: homeProviders.getStoreStatusFromRounds +
// deliveryRoundStatus.roundBookability (mode SAME_DAY — 148 ไม่มีปิดรอบ) +
// shopHoursLogic (business_settings.hours/operating_hours · ZERO-FAKE: ไม่มีข้อมูล = ห้ามเดา)
// READ-ONLY — ไม่เขียน DB ใด ๆ · pure function เทสต์ได้ (src/__tests__/r43Contracts.test.ts)
// ============================================

export interface RoundStatusRow {
  status?: string | null
  display_name?: string | null
  cutoff_time?: string | null
  pre_order_cutoff?: string | null
  delivery_start?: string | null
  delivery_end?: string | null
  max_capacity?: number | string | null
  current_count?: number | string | null
  scheduled_date?: string | null
  round_key?: string | null
}

/** 'HH:mm' / 'HH:mm:ss' → ms-of-day หรือ null (Number('') = 0 ต้อง reject ก่อน — mirror deliveryRoundStatus) */
function msOfDayOf(value: string | null | undefined): number | null {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const parts = raw.split(':')
  const h = Number(parts[0])
  const m = Number(parts[1] ?? 0)
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) return null
  return h * 3_600_000 + m * 60_000
}

/** Bangkok ms-of-day จาก UTC instant (UTC getters เท่านั้น — mirror bangkokTime) */
function bkkMsOfDay(utcMs: number): number | null {
  if (!Number.isFinite(utcMs)) return null
  const bkk = new Date(utcMs + 7 * 60 * 60_000)
  return bkk.getUTCHours() * 3_600_000 + bkk.getUTCMinutes() * 60_000 + bkk.getUTCSeconds() * 1000
}

/** อยู่ในเวลาเปิดร้านไหม (ไม่มีข้อมูล = true — ZERO-FAKE mirror shopHoursLogic) */
function withinShopHours(ms: number | null, hm: { openMs: number; closeMs: number } | null): boolean {
  if (ms === null || !hm) return true
  if (hm.closeMs <= hm.openMs) return ms >= hm.openMs || ms < hm.closeMs
  return ms >= hm.openMs && ms < hm.closeMs
}

/**
 * บรรทัดสถานะสดสำหรับ prompt — mirror การตัดสินของแถบสถานะเว็บ:
 *   sameDayOpen = มีรอบวันนี้ (active/open) ที่ว่าง + เปิดตาม operating_hours + อยู่ในเวลาเปิดร้าน
 *   รอบถัดไป   = live round ถัดไปที่ยังไม่เลย pre-order cutoff (pre_order_cutoff หรือ delivery_start−2ชม.)
 * ZERO-FAKE: rounds = null (ดึงไม่ได้) → บอกว่าดึงไม่ได้ ห้ามเดา · [] = ไม่มีรอบจริง → ปิด
 */
export function buildStoreStatusLines(
  rounds: RoundStatusRow[] | null | undefined,
  settings: Array<{ key: string; value: unknown }> | null | undefined,
  now: Date = new Date(),
): string[] {
  const head = 'STORE STATUS (สด — คำนวณจาก delivery_rounds + business_settings ณ เวลานี้ · ถ้าขัดกับบรรทัด "เวลาเปิดร้าน" ข้างบน ให้ใช้บรรทัดนี้เสมอ):'
  const rule = '- กติกาตอบ: ถ้า sameDayOpen = false → ห้ามบอกว่า "สั่งวันนี้ได้ / เปิดถึงเวลาปิดร้าน" ให้ชวนสั่งพรีออเดอร์และบอกรอบถัดไป (ชื่อรอบ + วัน + ปิดรับ HH:MM) เท่านั้น · ถ้าทุกอย่างปิด = บอกปิดตามจริง'
  const catalogRule = '- ชื่อสินค้า/เมนูที่พูดถึง ต้องมาจากบรรทัด MENU ด้านล่างเป๊ะ — ห้ามแต่งชื่อสินค้าใหม่ (ไม่พบในรายการ = บอกว่าไม่พบในเมนูปัจจุบันตามจริง)'
  if (!rounds) {
    return [
      head,
      '- ดึงข้อมูลรอบจัดส่งไม่ได้ในตอนนี้ — ห้ามเดาสถานะเปิด/ปิด ให้ตอบว่าเช็คสถานะเปิดร้านไม่ได้ในตอนนี้ และชวนดูเมนูที่ biteme-baby.com/shop',
      rule,
      catalogRule,
    ]
  }

  // parse business_settings (mirror src/lib/shopHours.ts — parse ไม่ได้ = คง null ห้ามเดา)
  let hours: { open: string; close: string } | null = null
  let operating: Record<string, boolean> | null = null
  for (const row of settings || []) {
    try {
      const v = typeof row.value === 'string' ? JSON.parse(row.value) : row.value
      if (row.key === 'hours' && v && typeof (v as { open?: unknown }).open === 'string' && typeof (v as { close?: unknown }).close === 'string') {
        hours = { open: String((v as { open: string }).open), close: String((v as { close: string }).close) }
      }
      if (row.key === 'operating_hours' && v && typeof v === 'object') {
        const op: Record<string, boolean> = {}
        for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
          if (typeof val === 'boolean') op[k] = val
        }
        operating = op
      }
    } catch { /* ค่าเสีย = คง null (ห้ามเดาเวลาเปิดปิด) */ }
  }
  const openMs = hours ? msOfDayOf(hours.open) : null
  const closeMs = hours ? msOfDayOf(hours.close) : null
  const shopHoursMs = openMs !== null && closeMs !== null ? { openMs, closeMs } : null

  const live = rounds.filter((r) => {
    const s = String(r.status || '').toLowerCase()
    return s === 'active' || s === 'open'
  })
  const utcMs = now.getTime()
  const bkk = new Date(utcMs + 7 * 3_600_000)
  const today = bkk.toISOString().slice(0, 10)
  const nowMs = bkkMsOfDay(utcMs)
  const nowHm = bkk.toISOString().slice(11, 16)

  if (live.length === 0) {
    return [
      head,
      `- สถานะ ${nowHm} น.: ปิดรับออเดอร์ (ไม่มีรอบจัดส่งที่เปิดรับอยู่)`,
      '- sameDayOpen: false',
      rule,
      catalogRule,
    ]
  }

  const todayRows = live.filter((r) => {
    const d = r.scheduled_date ? String(r.scheduled_date).slice(0, 10) : null
    return d === null || d === today
  })
  // mirror roundBookability mode SAME_DAY (148: ไม่มีปิดรอบ → เหลือ full/closed/operating/shop hours)
  const bookableToday = todayRows.filter((r) => {
    const cap = Number(r.max_capacity)
    const used = Number(r.current_count)
    if (Number.isFinite(cap) && Number.isFinite(used) && cap > 0 && used >= cap) return false
    if (operating) {
      if (operating.same_day_open === false) return false
      const rk = String(r.round_key || '').trim()
      if (rk && operating[`${rk}_open`] === false) return false
    }
    if (shopHoursMs && !withinShopHours(nowMs, shopHoursMs)) return false
    return true
  })
  const sameDayOpen = bookableToday.length > 0

  // mirror homeProviders.nextPre: operating gates + cutoff (pre_order_cutoff หรือ delivery_start − 2 ชม.)
  const cutoffAtUtc = (r: RoundStatusRow): number | null => {
    const day = r.scheduled_date ? String(r.scheduled_date).slice(0, 10) : ''
    if (!day) return null
    const base = Date.parse(`${day}T00:00:00+07:00`)
    if (Number.isNaN(base)) return null
    const pre = msOfDayOf(r.pre_order_cutoff)
    if (pre !== null) return base + pre
    const start = msOfDayOf(r.delivery_start)
    if (start !== null) return base + start - 2 * 3_600_000
    return null
  }
  const preOpen = !operating || operating.pre_order_open !== false
  const nextPre = preOpen
    ? live
        .filter((r) => {
          if (operating) {
            const rk = String(r.round_key || '').trim()
            if (rk && operating[`${rk}_open`] === false) return false
          }
          const t = cutoffAtUtc(r)
          return t === null || utcMs < t
        })
        .sort((a, b) =>
          String(a.scheduled_date ?? '').localeCompare(String(b.scheduled_date ?? '')) ||
          String(a.delivery_start ?? '').localeCompare(String(b.delivery_start ?? '')),
        )[0] ?? null
    : null
  const futureRows = live.filter((r) => {
    const d = r.scheduled_date ? String(r.scheduled_date).slice(0, 10) : null
    return d !== null && d > today
  })

  const stateText = sameDayOpen
    ? 'เปิดรับออเดอร์ Same-Day (ส่งวันนี้) ได้'
    : (futureRows.length > 0 || nextPre)
      ? 'รอบวันนี้ปิดรับแล้ว — เปิดรับพรีออเดอร์เท่านั้น'
      : 'ปิดรับออเดอร์ (ไม่มีรอบที่เปิดรับอยู่)'
  const hoursLabel = hours ? `${hours.open}-${hours.close} น.` : 'ไม่ได้ตั้งค่า (ห้ามเดาเวลาเปิดร้าน)'
  const todayList = todayRows.length > 0
    ? todayRows.map((r) => {
        const ok = bookableToday.includes(r)
        return `  · ${r.display_name || r.round_key || 'รอบ'} ${r.delivery_start || '—'}-${r.delivery_end || '—'} น. (สถานะ ${r.status}${ok ? ' — สั่งได้' : ' — ปิดรับ/เต็ม/นอกเวลาเปิดร้าน'})`
      }).join('\n')
    : '  · ไม่มีรอบจัดส่งวันนี้'
  const preLabel = (() => {
    if (!nextPre) return 'ยังไม่เปิดรับรอบถัดไป'
    const t = cutoffAtUtc(nextPre)
    const cutoffLabel = t === null ? 'ไม่มีข้อมูลปิดรับ' : `${new Date(t + 7 * 3_600_000).toISOString().slice(11, 16)} น.`
    const day = nextPre.scheduled_date ? String(nextPre.scheduled_date).slice(0, 10) : ''
    return `${nextPre.display_name || 'รอบถัดไป'}${day ? ` ${day}` : ''} (ปิดรับ ${cutoffLabel})`
  })()

  return [
    head,
    `- สถานะ ${nowHm} น.: ${stateText}`,
    `- sameDayOpen: ${sameDayOpen ? 'true' : 'false'} · เวลาเปิดร้านที่ตั้งไว้: ${hoursLabel}`,
    `- รอบวันนี้:\n${todayList}`,
    `- รอบถัดไป (พรีออเดอร์): ${preLabel}`,
    rule,
    catalogRule,
  ]
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

  const [products, categories, promotions, settings, rounds] = await Promise.all([
    restGet(deps.sbUrl, deps.serviceKey,
      '/rest/v1/products?select=name,price,category_id,is_available,is_featured&order=sort_order.asc&limit=120'),
    restGet(deps.sbUrl, deps.serviceKey,
      '/rest/v1/product_categories?select=id,name&order=sort_order.asc&limit=40'),
    restGet(deps.sbUrl, deps.serviceKey,
      '/rest/v1/promotions?select=name,description,discount_type,discount_value,min_order_amount,end_date&limit=20'),
    restGet(deps.sbUrl, deps.serviceKey,
      '/rest/v1/business_settings?select=key,value&limit=40'),
    // R43 B4: รอบจัดส่งจริง → คำนวณ STORE STATUS (สด) (mirror เว็บ · ห้ามตอบจากเวลา static)
    restGet(deps.sbUrl, deps.serviceKey,
      '/rest/v1/delivery_rounds?select=status,display_name,cutoff_time,pre_order_cutoff,delivery_start,delivery_end,max_capacity,current_count,scheduled_date,round_key&order=scheduled_date.asc&limit=40'),
  ])

  const anyData = products || categories || promotions || settings || rounds
  if (!anyData) {
    cache = { at: Date.now(), text: '' }
    return ''
  }

  const catName = new Map<string, string>()
  for (const c of categories || []) catName.set(String(c.id), String(c.name))

  const lines: string[] = ['SHOP FACTS (ข้อมูลร้านจริง):', SHOP_FACTS_TH]
  // R43 B4: สถานะสดต่อท้าย SHOP_FACTS ทันที (ขัดกัน = บรรทัดนี้ชนะ — กติกาอยู่ในบรรทัด rule)
  lines.push(
    rounds
      ? buildStoreStatusLines(rounds as RoundStatusRow[], settings, new Date()).join('\n')
      : ['STORE STATUS (สด):',
        '- ดึงข้อมูลรอบจัดส่งไม่ได้ในตอนนี้ — ห้ามเดาสถานะเปิด/ปิด ให้ตอบว่าเช็คสถานะเปิดร้านไม่ได้ในตอนนี้ และชวนดูเมนูที่ biteme-baby.com/shop'].join('\n'),
  )

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

