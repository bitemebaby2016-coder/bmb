// ============================================
// Bite Me Baby — social order intake contract (Owner 2026-10-17 §3/§4)
// AI สร้างออเดอร์ "ใหม่" ผ่าน workflow ที่อนุญาต (canonical RPC, idempotent)
// ห้ามแก้ไขออเดอร์เดิม · ห้ามเคลมสำเร็จก่อนระบบยืนยัน · ไม่ชัดเจน = ถามก่อน
// ============================================

import { describe, it, expect, vi } from 'vitest'
import intakeSrc from '../../supabase/functions/_shared/socialOrderIntake.ts?raw'
import workerSrc from '../../supabase/functions/social-ai-worker/index.ts?raw'
import channelWebhookSrc from '../../supabase/functions/channel-webhook/index.ts?raw'
import {
  semanticOrderExtract,
  matchOrderItems,
  scopeCatalogToPost,
  buildIntakeLine,
  submitNewOrder,
  cartFooterForMatch,
  buildCartLink,
  buildSocialSummary,
  encodeContextParam,
  ORDER_EXTRACT_SCHEMA,
  type SubmitOrderResult,
} from '../../supabase/functions/_shared/socialOrderIntake.ts'
import { decodeSocialContextParam } from '../../src/lib/socialHandoff.ts'
import { parseStructuredOutput } from '../../supabase/functions/_shared/aiStructuredOutput.ts'
import type { OrderExtractCheck } from '../../supabase/functions/_shared/socialOrderIntake.ts'

/** Narrow helper: assert ok แล้วคืน value (ไม่ให้ test เข้าถึง .value ตรง ๆ). */
function val(s: OrderExtractCheck) {
  if (!s.ok) throw new Error('expected ok, got: ' + s.reason)
  return s.value
}

const extract = (over: Record<string, unknown> = {}) => ({
  wants_order: true,
  items: [{ name: 'ผัดไทย', quantity: 2 }],
  confirmed: true,
  order_mode: 'SAME_DAY',
  scheduled_date: '',
  customer_phone: '0812345678',
  address: 'บ้านเลขที่ 1',
  unclear: '',
  ...over,
})

describe('ORDER_EXTRACT_SCHEMA — structured extraction ผ่าน validator จริง', () => {
  it('JSON ครบ schema → ผ่าน', () => {
    const r = parseStructuredOutput(JSON.stringify(extract()), ORDER_EXTRACT_SCHEMA as never)
    expect(r.ok).toBe(true)
  })
  it('missing field / wrong enum → fail closed', () => {
    expect(parseStructuredOutput(JSON.stringify(extract({ unclear: undefined })), ORDER_EXTRACT_SCHEMA as never).ok).toBe(false)
    expect(parseStructuredOutput(JSON.stringify(extract({ order_mode: 'DELIVER_NOW' })), ORDER_EXTRACT_SCHEMA as never).ok).toBe(false)
  })
})

describe('R64 scopeCatalogToPost — ใช้เฉพาะ MENU ของโพสต์นี้ (deferred C-6 #1)', () => {
  const cat = [
    { id: 'p1', name: 'บะหมี่ไก่ย่างเทริยากิ' },
    { id: 'p2', name: 'ข้าวหมูกรอบ' },
    { id: 'p3', name: 'เคาหยก' },
  ]
  it('โพสต์ระบุเมนู → allowed = เฉพาะเมนูนั้น + scopeLine บังคับใช้', () => {
    const r = scopeCatalogToPost(cat, 'วันนี้แนะนำ บะหมี่ไก่ย่างเทริยากิ อร่อยมาก 79 บาท')
    expect(r.allowed.map((p) => p.id)).toEqual(['p1'])
    expect(r.scopeLine).toContain('บะหมี่ไก่ย่างเทริยากิ')
    expect(r.scopeLine).toContain('ห้ามพิมพ์/เดาเมนูอื่น')
  })
  it('โพสต์ไม่มีข้อความ/ไม่ระบุเมนูไหน = catalog เดิม + scopeLine ว่าง (ไม่ตัดช่องทางสั่ง)', () => {
    expect(scopeCatalogToPost(cat, '')).toEqual({ allowed: cat, scopeLine: '' })
    expect(scopeCatalogToPost(cat, 'เปิดร้านแล้ววันนี้ 9 โมง')).toEqual({ allowed: cat, scopeLine: '' })
  })
  it('เมนูที่โพสต์ไม่ได้เสนอ = ตกจาก allowed (คอมเมนต์พิมพ์เมนูอื่น → unmatched → ระบบถาม ไม่เดา)', () => {
    const r = scopeCatalogToPost(cat, 'บะหมี่ไก่ย่างเทริยากิ เท่านั้น')
    expect(r.allowed.map((p) => p.id)).toEqual(['p1'])
    const m = matchOrderItems(r.allowed, [{ name: 'เคาหยก', quantity: 1 }])
    expect(m.matched).toHaveLength(0)
    expect(m.unmatched).toEqual(['เคาหยก'])
  })
  it('worker ต่อ postMsg เข้า runOrderIntake + ใช้ scope ก่อน match (source contract)', () => {
    expect(workerSrc).toContain('scopeCatalogToPost(catalog0, postMsg)')
    expect(workerSrc).toMatch(/runOrderIntake\(ev, userMsg, ev\.event_type[\s\S]{0,80}postMsg\)/)
    expect(workerSrc).toContain('matchOrderItems(allowed, x.items)')
    // extractor ได้บรรทัดกติกาของโพสต์นี้
    expect(workerSrc).toContain('ORDER_EXTRACT_SYSTEM + scopeLine')
  })
})

describe('semanticOrderExtract — ถามก่อน ห้ามเดา (§4)', () => {
  it('confirmed ครบข้อมูล → ผ่าน', () => {
    const s = val(semanticOrderExtract(extract()))
    expect(s.confirmed).toBe(true)
    expect(s.items[0]).toEqual({ name: 'ผัดไทย', quantity: 2 })
  })
  it('unclear ไม่ว่าง → confirmed ถูกบังคับ false (ต้องถามลูกค้าก่อน)', () => {
    const s = val(semanticOrderExtract(extract({ unclear: 'ไม่แน่ใจจำนวน' })))
    expect(s.confirmed).toBe(false)
  })
  it('quantity นอกช่วง 1-20 → reject (ไม่ปัดเศษ/เดาแทนลูกค้า)', () => {
    expect(semanticOrderExtract(extract({ items: [{ name: 'ก', quantity: 0 }] })).ok).toBe(false)
    expect(semanticOrderExtract(extract({ items: [{ name: 'ก', quantity: 21 }] })).ok).toBe(false)
    expect(semanticOrderExtract(extract({ items: [{ name: 'ก', quantity: 1.5 }] })).ok).toBe(false)
    expect(semanticOrderExtract(extract({ items: [{ name: '', quantity: 1 }] })).ok).toBe(false)
  })
  it('PRE_ORDER ไม่ระบุวันที่ → confirmed ถูกบังคับ false', () => {
    const s = val(semanticOrderExtract(extract({ order_mode: 'PRE_ORDER', scheduled_date: '' })))
    expect(s.confirmed).toBe(false)
  })
  it('order_mode UNSURE → confirmed ถูกบังคับ false', () => {
    expect(val(semanticOrderExtract(extract({ order_mode: 'UNSURE' }))).confirmed).toBe(false)
  })
  it('items ไม่ใช่ array / raw ไม่ใช่ object → fail closed ไม่ throw', () => {
    expect(semanticOrderExtract(null).ok).toBe(true)
    const s = semanticOrderExtract(extract({ items: 'x' }))
    expect(s.ok).toBe(true)
    expect(val(s).confirmed).toBe(false)
  })
})

describe('matchOrderItems — จับคู่กับ Catalog จริงเท่านั้น (ห้ามเดาสินค้าแทนลูกค้า)', () => {
  const catalog = [
    { id: 'prod-1', name: 'ผัดไทยกุ้งสด', is_available: true },
    { id: 'prod-2', name: 'ข้าวผัด', is_available: true },
  ]
  it('ชื่อตรง/ชื่อย่อ → match', () => {
    const m = matchOrderItems(catalog, [{ name: 'ผัดไทยกุ้งสด', quantity: 1 }, { name: 'ข้าวผัด', quantity: 2 }])
    expect(m.unmatched).toEqual([])
    expect(m.matched).toEqual([
      { product_id: 'prod-1', name: 'ผัดไทยกุ้งสด', quantity: 1 },
      { product_id: 'prod-2', name: 'ข้าวผัด', quantity: 2 },
    ])
  })
  it('ชื่อที่ไม่มีใน catalog → unmatched (ให้ถามลูกค้า ไม่สั่งแทน)', () => {
    const m = matchOrderItems(catalog, [{ name: 'พิซซ่า', quantity: 1 }])
    expect(m.matched).toEqual([])
    expect(m.unmatched).toEqual(['พิซซ่า'])
  })
})

describe('buildIntakeLine — ระบบเป็นคนเขียน ห้ามเคลมก่อนระบบยืนยัน (§3)', () => {
  const ok: SubmitOrderResult = { ok: true, order_number: 'BMB-20261017-001', duplicate: false }
  it('สำเร็จ → มีเลขที่ออเดอร์จากระบบจริง + ลิงก์ชำระเงิน (ไม่เคลมว่าชำระเงินแล้ว)', () => {
    const line = buildIntakeLine(ok)
    expect(line.confirmed).toBe(true)
    expect(line.text).toContain('BMB-20261017-001')
    expect(line.text).toContain('/payment/BMB-20261017-001')
    expect(line.text).not.toMatch(/ชำระเงินสำเร็จ|ยืนยันการชำระเงิน/)
  })
  it('duplicate (webhook retry) → เลขที่เดิม + บอกว่าเคยบันทึกแล้ว (ไม่สร้างซ้ำ)', () => {
    const line = buildIntakeLine({ ...ok, duplicate: true })
    expect(line.confirmed).toBe(true)
    expect(line.text).toContain('BMB-20261017-001')
    expect(line.text).toContain('เคยบันทึกไว้แล้ว')
  })
  it('ล้มเหลว → ไม่มีเลขที่ออเดอร์ ไม่บอกว่าสำเร็จ + ชี้ไปหน้าร้าน', () => {
    const line = buildIntakeLine({ ok: false, error: 'ERR_CAPACITY_FULL' })
    expect(line.confirmed).toBe(false)
    expect(line.text).not.toMatch(/เลขที่|BMB-/)
    expect(line.text).toContain('ยังไม่ยืนยัน')
    expect(line.text).toContain('/checkout')
  })
})

describe('shared intake = CREATE-ONLY + idempotent (source contract)', () => {
  it('create ผ่าน canonical RPC เท่านั้น + idempotent ด้วย external ref', () => {
    expect(intakeSrc).toMatch(/rpc\/create_order_with_items/)
    expect(intakeSrc).toMatch(/p_external_ref_id/)
    expect(intakeSrc).toMatch(/p_source_channel/)
    // create-only: ห้ามมี mutation surface ของออเดอร์เดิม
    expect(intakeSrc).not.toMatch(/record_payment|confirm_offline_payment|transition_order_status|mark_payment_failed|cancel_order|refund|update_order|delete_order|assign_driver|delivery_assignments|transition_order/)
  })
  it('ไม่มี update/delete/upsert บนตารางธุรกิจ', () => {
    expect(intakeSrc).not.toMatch(/\.update\(|\.delete\(|\.upsert\(/)
    expect(intakeSrc).not.toMatch(/orders\?id=eq|from\('orders'\)/)
  })
  it('round resolution อ่านเฉพาะรอบ active + มีที่ว่าง (server re-validate ตอน create)', () => {
    expect(intakeSrc).toMatch(/status=eq\.active/)
    expect(intakeSrc).toMatch(/max_capacity/)
    expect(intakeSrc).toMatch(/ERR_NO_EXTERNAL_REF/)
  })
})

describe('worker wiring — intake เฉพาะช่องทางส่วนตัว + ไม่เงียบ (§4/§5)', () => {
  it('สร้างออเดอร์เฉพาะ event_type === message — comment = สรุป+ลิงก์ตะกร้า ไม่สร้างเอง ไม่เปิดเผยส่วนตัว (R27 ปรับตาม Owner)', () => {
    expect(workerSrc).toMatch(/ev\.event_type === 'message'/)
    expect(workerSrc).toMatch(/mode === 'comment'/)
    expect(workerSrc).toMatch(/ห้ามเปิดเผยข้อมูลส่วนตัวในคอมเมนต์/)
    // R92 (Owner 2026-11-11): footer ตะกร้า = cartFooterForMatch จุดเดียว (ติดทุก reply ที่จับคู่ได้บางส่วนด้วย)
    expect(workerSrc).toMatch(/cartFooterForMatch\(m, undefined, cartCtx\)/)
    expect(workerSrc).toMatch(/buildSocialSummary\(/)
  })
  it('มี fallback เมื่อ draft พังแต่ระบบมีผลจริงแล้ว — ไม่เงียบหาย', () => {
    expect(workerSrc).toMatch(/fallbackIntakeReply/)
    expect(workerSrc).toMatch(/intake_fallback/)
  })
  it('footer ระบบแนบท้ายจากผลจริงเท่านั้น + ห้าม AI แต่งเลขที่เอง', () => {
    expect(workerSrc).toMatch(/buildIntakeLine/)
    expect(workerSrc).toMatch(/ห้ามแต่งเลขที่อ/)
  })
  it('idempotency: submit ด้วย event id เสมอ (webhook retry ไม่สร้างซ้ำ)', () => {
    expect(workerSrc).toMatch(/externalRef: ev\.event_id/)
  })
})

describe('R74 — parse dictionary จากข้อความจริง: ออปชันไม่ใช่เมนู + note ไหลเข้าออเดอร์', () => {
  it('ออปชัน/การปรุงใน item.note = ไม่หลุดเป็นเมนู + คงข้อความลูกค้าไว้ (semantic)', () => {
    const r = semanticOrderExtract(extract({
      items: [{ name: 'ผัดไทย', quantity: 2, note: 'ไม่เผ็ด เพิ่มไข่ดาว' }],
    }))
    const v = val(r)
    expect(v.items).toHaveLength(1)
    expect(v.items[0].name).toBe('ผัดไทย')
    expect(v.items[0].note).toBe('ไม่เผ็ด เพิ่มไข่ดาว')
  })
  it('matchOrderItems พก note ต่อเข้า MatchedItem (ชื่อจับคู่จาก catalog จริงเท่านั้น)', () => {
    const m = matchOrderItems(
      [{ id: 'p1', name: 'ผัดไทย' }],
      [{ name: 'ผัดไทย', quantity: 2, note: 'ไม่เผ็ด' }],
    )
    expect(m.matched).toEqual([{ product_id: 'p1', name: 'ผัดไทย', quantity: 2, note: 'ไม่เผ็ด' }])
    expect(m.unmatched).toEqual([])
  })
  it('source contract: extractor สั่งออปชันไม่เป็นเมนู + จำนวนภาษาพูด + ยืนยันตามหลังสนทนา', () => {
    expect(intakeSrc).toMatch(/ห้ามใส่เป็น item เด็ดขาด/)
    expect(intakeSrc).toMatch(/ที่นึง/)
    expect(intakeSrc).toMatch(/เมนูนี้/)
    expect(intakeSrc).toMatch(/ดึงรายการที่ลูกค้ากำลังยืนยันจากบทสนทนา/)
  })
  it('source contract: worker ส่ง customizations.notice (คีย์เดียวกับ collectOrderNotices ฝั่งเว็บ)', () => {
    expect(workerSrc).toMatch(/customizations: \{ notice: i\.note \}/)
  })
  it('ห้ามใช้พิกัด fallback เก่า (10.7016) ใน EF ฝั่ง intake/webhook — ใช้ resolveKitchenPoint แทน', () => {
    expect(intakeSrc).not.toMatch(/10\.7016/)
    expect(channelWebhookSrc).not.toMatch(/10\.7016/)
    expect(intakeSrc).toMatch(/resolveKitchenPoint/)
    expect(channelWebhookSrc).toMatch(/resolveKitchenPoint/)
    expect(intakeSrc).toMatch(/p_dropoff_latitude: input\.dropoff\?\.latitude \?\? kitchenPoint\.latitude/)
    expect(channelWebhookSrc).toMatch(/p_dropoff_latitude: order\.dropoff_latitude \?\? kitchenPoint\.latitude/)
  })
})

describe('R74 submitNewOrder — ไม่มี GPS = ใช้พิกัดครัว (server authority) + พก customizations', () => {
  it('body ที่ยิงเข้า canonical RPC: dropoff = พิกัดครัวจาก business_settings + customizations ของบรรทัด + idempotent ref', async () => {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: { body?: string }) => {
      const u = String(url)
      if (u.includes('business_settings')) {
        return new Response(JSON.stringify([{ value: { latitude: 12.615659, longitude: 102.098063 } }]), { status: 200 })
      }
      calls.push({ url: u, body: JSON.parse(String(init?.body || '{}')) })
      return new Response(JSON.stringify({ order_number: 'BMB-20261106-77', duplicate: false }), { status: 200 })
    }))
    try {
      const res = await submitNewOrder('https://sb.test', 'svc', {
        items: [{ product_id: 'p1', quantity: 2, customizations: { notice: 'ไม่เผ็ด เพิ่มไข่ดาว' } }],
        roundId: 'round-1',
        orderMode: 'SAME_DAY',
        scheduledDate: null,
        customerName: 'R74',
        customerPhone: '',
        address: 'ที่อยู่ทดสอบ',
        sourceChannel: 'MESSENGER',
        externalRef: 'msg-r74-x',
        customerRef: 'uid-x',
      })
      expect(res.ok).toBe(true)
      expect(res.order_number).toBe('BMB-20261106-77')
      const b = calls[0].body as any
      expect(calls[0].url).toContain('/rest/v1/rpc/create_order_with_items')
      // ไม่มี GPS จากลูกค้า → ใช้พิกัดครัว (12.615659, 102.098063 — m134) ไม่ใช่ค่าเก่า/ไม่ใช่ null
      expect(b.p_dropoff_latitude).toBe(12.615659)
      expect(b.p_dropoff_longitude).toBe(102.098063)
      expect(b.p_items).toEqual([{ product_id: 'p1', quantity: 2, customizations: { notice: 'ไม่เผ็ด เพิ่มไข่ดาว' } }])
      expect(b.p_external_ref_id).toBe('msg-r74-x')
      expect(b.p_source_channel).toBe('MESSENGER')
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('R92 cartFooterForMatch — ลิงก์ตะกร้าติดทุก reply ที่จับคู่ได้บางส่วน (Owner 2026-11-11)', () => {
  const matched = [
    { product_id: 'p1', name: 'เมี่ยงอกไก่', quantity: 1 },
    { product_id: 'p2', name: 'เมี่ยงแซลมอน', quantity: 2 },
  ]

  it('matched ครบ → footer เดิม (buildCartSummaryFooter — มี ?cart= + บรรทัดลิงก์ภายนอก)', () => {
    const f = cartFooterForMatch({ matched, unmatched: [] })
    expect(f).toContain('/shop?cart=')
    expect(f).toContain('เมี่ยงอกไก่ x1')
    expect(f).toContain('เมี่ยงแซลมอน x2')
    expect(f).toContain('ภายนอก Facebook')
    expect(f).not.toContain('ยังจับคู่ไม่ได้')
  })

  it('matched บางส่วน → footer = ลิงก์ของรายการที่จับคู่ได้เท่านั้น + ระบบแจ้งของที่ยังไม่รวม (ไม่ซ่อนลิงก์ทั้งหมด)', () => {
    const f = cartFooterForMatch({ matched, unmatched: ['ลาบหมูเพี้ยน'] })
    expect(f).toContain('/shop?cart=')
    // ลิงก์มีเฉพาะรายการ matched — ของเพี้ยนไม่ถูกฝังลงตะกร้า (zero-fake)
    expect(decodeCartFromFooter(f).map((i) => i.id)).toEqual(['p1', 'p2'])
    expect(f).toContain('ลาบหมูเพี้ยน')
    expect(f).toContain('ยังจับคู่ไม่ได้')
    expect(f).toContain('ยืนยันชื่อเมนูที่ถูกต้อง')
  })

  it('matched=0 → footer ว่าง (เดิม — worker ให้ AI ถามชื่อเมนูแทน)', () => {
    expect(cartFooterForMatch({ matched: [], unmatched: ['พิซซ่า'] })).toBe('')
  })

  /** ถอด ?cart= จาก footer — round-trip ผ่านตัวถอดฝั่งเว็บเดียวกัน (cartDeepLink mirror) */
  function decodeCartFromFooter(footer: string): Array<{ id: string; q: number }> {
    const enc = footer.match(/cart=([A-Za-z0-9_-]+)/)![1]
    const padded = enc.replace(/-/g, '+').replace(/_/g, '/')
    const bin = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
    const parsed = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))) as { items: Array<{ id: string; q: number }> }
    return parsed.items
  }
})

describe('R92 ?s= บริบทต่อเนื่องข้ามช่องทาง — encode (server) ↔ decode (web) round-trip', () => {
  const matched = [{ product_id: 'p1', name: 'เมี่ยงอกไก่', quantity: 2 }]

  it('buildCartLink + ctx → ลิงก์มี &s= · ถอดฝั่งเว็บได้ src+t ตรงกัน', () => {
    const ctx = { src: 'messenger' as const, t: buildSocialSummary('messenger', 'SAME_DAY', matched) }
    const link = buildCartLink(matched, 'https://biteme-baby.com', ctx)
    expect(link).toMatch(/^https:\/\/biteme-baby\.com\/shop\?cart=[^&]+&s=[^&]+$/)
    const s = new URL(link).searchParams.get('s')!
    const dec = decodeSocialContextParam(s)
    expect(dec).not.toBeNull()
    expect(dec!.src).toBe('messenger')
    expect(dec!.summary).toContain('คุยกันบนMessenger')
    expect(dec!.summary).toContain('ส่งวันนี้')
    expect(dec!.summary).toContain('เมี่ยงอกไก่ x2')
  })

  it('buildSocialSummary = ระบบเขียนจากข้อมูลจริง (channel+โหมด+ชื่อ matched) · cap 200', () => {
    expect(buildSocialSummary('facebook', 'PRE_ORDER', matched)).toBe('คุยกันบนFacebook · พรีออเดอร์ · เมี่ยงอกไก่ x2')
    expect(buildSocialSummary('facebook', 'UNSURE', matched)).toContain('ยังไม่ระบุรอบ')
    const many = Array.from({ length: 20 }, (_, i) => ({ product_id: 'p' + i, name: 'เมนูยาวมากกก ' + i, quantity: 1 }))
    expect(buildSocialSummary('messenger', 'SAME_DAY', many).length).toBeLessThanOrEqual(200)
  })

  it('fail-closed: t มี URL / เกิน 200 / src ไม่รู้จัก → &s= ไม่ถูกเติม · ฝั่งถอด = null', () => {
    expect(encodeContextParam({ src: 'messenger', t: 'ไปที่ https://x.com ก็ได้' })).toBe('')
    expect(encodeContextParam({ src: 'messenger', t: 'x'.repeat(201) })).toBe('')
    expect(encodeContextParam({ src: 'tiktok' as never, t: 'โอเค' })).toBe('')
    expect(buildCartLink(matched, 'https://biteme-baby.com', { src: 'messenger', t: 'มี https://bad.example' })).not.toContain('&s=')
    expect(decodeSocialContextParam('บูมไม่ใช่ b64')).toBeNull()
    expect(decodeSocialContextParam(null)).toBeNull()
  })
})