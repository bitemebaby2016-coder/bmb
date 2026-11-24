// ============================================
// BMB — R104 "1 reply = 1 ลิงก์ของระบบ · เปิด ?cart= = ตั้งตะกร้า" (Owner อนุมัติ 2026-11-24)
// ============================================
// Live evidence 10:45-10:46 (5 ภาพ · ก่อน R104):
//   ① ตะกร้าโตขึ้นเรื่อย ๆ: 26 ชิ้น ฿2,134 → 32 ชิ้น ฿2,608 (+6 ชิ้น × ฿79 = +฿474 เป๊ะ
//      = ราคาเมนูที่ AI สรุป) — Layout เติม payload ทับรายการเดิม (addItem merge บวกจำนวน)
//      ทุกครั้งที่กดลิงก์จาก reply ใหม่ (payload คนละ fingerprint — guard R102 กันแค่ payload เดิมซ้ำ)
//   ② เปิดลิงก์ใน Chrome แล้วตะกร้าว่าง: URL bar = `biteme-baby.com/` ไม่มี query — ลูกค้ากด
//      "ลิงก์เปล่า" ที่ AI เขียนเองตาม prompt เดิม (`?cart=<encoded>` template ที่ AI คำนวณไม่ได้)
// แก้ 2 ขา: ① Layout ?cart= = ตั้งตะกร้าตามลิงก์ (resolve→clear→เติม · ไม่มีของใช้ได้ = ห้ามทำลายตะกร้า)
//   ② กฎ 1 reply = 1 ลิงก์ของระบบ — prompt ห้าม AI เขียน URL + stripBareShopLinks ตัดลิงก์ใน draft
//      + ระบบแนบ CTA ร้านเดียวเมื่อไม่มี footer ใดมีลิงก์
// ============================================

import { describe, it, expect } from 'vitest'
import { stripBareShopLinks, normalizeAiTextLinks } from '../../supabase/functions/_shared/socialLinkFormat.ts'

import workerSrc from '../../supabase/functions/social-ai-worker/index.ts?raw'
import layoutSrc from '../components/layout/Layout.tsx?raw'
import bannerSrc from '../components/InAppBrowserBanner.tsx?raw'

// ============================================
// A — stripBareShopLinks: draft ห้ามมีลิงก์ร้านเองทุกรูปแบบ
// ============================================
describe('R104-A — stripBareShopLinks (ตัดลิงก์ร้านออกจาก draft)', () => {
  it('ลิงก์เปล่า /shop → "ลิงก์ท้ายข้อความ (ระบบแนบให้)"', () => {
    expect(stripBareShopLinks('สั่งผ่านเว็บ https://biteme-baby.com/shop เลยครับ'))
      .toBe('สั่งผ่านเว็บ ลิงก์ท้ายข้อความ (ระบบแนบให้) เลยครับ')
  })

  it('template ?cart=<encoded> ที่ AI พิมพ์เอง = ลิงก์เสีย → ตัดทิ้งทั้ง URL', () => {
    expect(stripBareShopLinks('กดลิงก์นี้เพื่อใส่ตะกร้า: https://biteme-baby.com/shop?cart=<encoded>'))
      .toBe('กดลิงก์นี้เพื่อใส่ตะกร้า: ลิงก์ท้ายข้อความ (ระบบแนบให้)')
  })

  it('โดเมนเปล่า / www / checkout / orders — ทุกแบบตัด', () => {
    expect(stripBareShopLinks('ดูที่ biteme-baby.com/shop ครับ'))
      .toBe('ดูที่ ลิงก์ท้ายข้อความ (ระบบแนบให้) ครับ')
    expect(stripBareShopLinks('ชำระเงินที่ https://biteme-baby.com/checkout ครับ'))
      .toBe('ชำระเงินที่ ลิงก์ท้ายข้อความ (ระบบแนบให้) ครับ')
    expect(stripBareShopLinks('แก้ออเดอร์ที่ https://biteme-baby.com/orders ได้ครับ'))
      .toBe('แก้ออเดอร์ที่ ลิงก์ท้ายข้อความ (ระบบแนบให้) ได้ครับ')
  })

  it('วรรคตอนท้ายคงเดิม (จุด/วงเล็บไม่หาย)', () => {
    expect(stripBareShopLinks('สั่งที่ biteme-baby.com/shop.')).toBe('สั่งที่ ลิงก์ท้ายข้อความ (ระบบแนบให้).')
    expect(stripBareShopLinks('(https://biteme-baby.com/shop)'))
      .toBe('(ลิงก์ท้ายข้อความ (ระบบแนบให้))')
  })

  it('ไม่แตะ URL ภายนอกอื่น · ไม่แตะ host ที่ยาวกว่า · idempotent', () => {
    expect(stripBareShopLinks('ดูที่ https://example.com/shop ครับ'))
      .toBe('ดูที่ https://example.com/shop ครับ')
    expect(stripBareShopLinks('biteme-baby.commerce ไม่ใช่เรา'))
      .toBe('biteme-baby.commerce ไม่ใช่เรา')
    const once = stripBareShopLinks('ที่ biteme-baby.com/shop')
    const twice = stripBareShopLinks(once)
    expect(twice).toBe(once)
    expect(stripBareShopLinks('')).toBe('')
  })

  it('normalizeAiTextLinks เดิมไม่พัง (r75 pin คงอยู่) · strip ทำงานก่อน normalize ได้ผลถูก', () => {
    expect(normalizeAiTextLinks('ที่ biteme-baby.com/shop')).toBe('ที่ https://biteme-baby.com/shop')
    // pipeline จริง: strip draft → normalize → ผล = ข้อความอ้างอิง + ลิงก์ระบบท้าย
    const draft = 'สั่งผ่านเว็บ https://biteme-baby.com/shop ครับ'
    const footer = '🛒 สรุปรายการของคุณ — กดลิงก์นี้: https://biteme-baby.com/shop?cart=ABC'
    const out = normalizeAiTextLinks([stripBareShopLinks(draft), footer].filter(Boolean).join('\n\n'))
    expect(out).toContain('สั่งผ่านเว็บ ลิงก์ท้ายข้อความ (ระบบแนบให้) ครับ')
    expect(out).toContain('https://biteme-baby.com/shop?cart=ABC') // ลิงก์ระบบรอด
    expect(out.match(/biteme-baby\.com\/shop/g) || []).toHaveLength(1) // ลิงก์เดียวจริง
  })
})

// ============================================
// B — Worker: prompt ห้าม AI เขียน URL + ประกอบข้อความแบบ 1 ลิงก์
// ============================================
describe('R104-B — worker: prompt + assembly (1 reply = 1 ลิงก์ของระบบ)', () => {
  it('prompt ห้ามเขียน URL เอง · ไม่มี template ?cart=<encoded> ที่ AI คำนวณไม่ได้อีกต่อไป', () => {
    expect(workerSrc).toContain('ห้ามเขียน URL เอง')
    expect(workerSrc).toContain('ระบบจะแนบลิงก์จริงที่แตะได้ท้ายข้อความให้เสมอ')
    expect(workerSrc).not.toContain('shop?cart=<encoded>')
    expect(workerSrc).not.toContain('https://biteme-baby.com/shop เสมอ')
    expect(workerSrc).not.toContain('ทุกลิงก์ต้องเขียนเป็น URL เต็มรูปแบบ')
  })

  it('draft ผ่าน stripBareShopLinks ก่อนประกอบ finalText เสมอ (r75 pin: normalizeAiTextLinks คงอยู่)', () => {
    expect(workerSrc).toContain("from '../_shared/socialLinkFormat.ts'")
    expect(workerSrc).toContain("import { normalizeAiTextLinks, stripBareShopLinks } from '../_shared/socialLinkFormat.ts'")
    expect(workerSrc).toContain('const draftTextClean = stripBareShopLinks(draftOut.draft_text)')
    expect(workerSrc).toContain('const finalText = normalizeAiTextLinks(')
    expect(workerSrc).toContain('normalizeAiTextLinks(footer)') // fallbackIntakeReply path (r75 pin)
  })

  it('default CTA: ไม่มี footer ใดมีลิงก์ → ระบบแนบ CTA ร้านเดียวเอง (ข้อความ AI อ้างลิงก์ท้ายข้อความได้จริง)', () => {
    expect(workerSrc).toContain('const hasSystemShopLink = [intakeFooter, orderActionFooter].some((f) => f && f.includes(\'biteme-baby.com\'))')
    expect(workerSrc).toMatch(/const defaultShopFooter = hasSystemShopLink \? '' : '🛍️ เมนูทั้งหมดและสั่งซื้อ: https:\/\/biteme-baby\.com\/shop'/)
    expect(workerSrc).toContain('[draftTextClean, intakeFooter, orderActionFooter, defaultShopFooter].filter(Boolean).join(\'\\n\\n\')')
  })
})

// ============================================
// C — Layout: ?cart= = ตั้งตะกร้า (replace) — กันกองซ้ำ
// ============================================
describe('R104-C — Layout ?cart= replace semantics', () => {
  it('resolve ก่อนแตะตะกร้า — รายการไม่มีอะไรใช้ได้เลย = ห้ามทำลายตะกร้าเดิม', () => {
    expect(layoutSrc).toMatch(/const resolvable: Array<\{ p: Product; it: \(typeof items\)\[number\] \}> = \[\]/)
    const atResolvable = layoutSrc.indexOf('if (resolvable.length === 0) {')
    const atClear = layoutSrc.indexOf('useCartStore.getState().clearCart()')
    expect(atResolvable).toBeGreaterThan(-1)
    expect(atClear).toBeGreaterThan(atResolvable)
  })

  it('ตั้งตะกร้า: clearCart ก่อนเติม payload เสมอ (กันกองซ้ำ — live +6 ชิ้น × ฿79)', () => {
    const atClear = layoutSrc.indexOf('useCartStore.getState().clearCart()')
    const atAdd = layoutSrc.indexOf('useCartStore.getState().addItem(', atClear)
    expect(atClear).toBeGreaterThan(-1)
    expect(atAdd).toBeGreaterThan(atClear)
    // ไม่มี "เติม" ก่อน clearCart ที่ผิดลำดับอีกแล้ว
    expect(layoutSrc.indexOf('useCartStore.getState().addItem(')).toBeGreaterThan(atClear)
  })

  it('guard R102 คงอยู่: ลิงก์เดิมซ้ำ = ข้าม (ของที่ลูกค้าเพิ่มเองหลังลิงก์นั้นไม่หาย)', () => {
    expect(layoutSrc).toContain("const processedKey = 'bmb:cart-processed-' + cartParamFingerprint(raw)")
    const atGuard = layoutSrc.indexOf("alreadyProcessed = sessionStorage.getItem(processedKey) === '1'")
    const atClear = layoutSrc.indexOf('useCartStore.getState().clearCart()')
    expect(atGuard).toBeGreaterThan(-1)
    expect(atClear).toBeGreaterThan(atGuard)
  })

  it('toast ผลสำเร็จคงเดิมเป๊ะ (เกณฑ์ live test H-1/I-5 ใน REMAIN_TESTS)', () => {
    expect(layoutSrc).toContain("'เปิดรายการที่สรุปไว้ให้แล้ว 🛒 ' + added + ' รายการ — เช็คเอาท์หรือเพิ่มเมนูต่อได้เลย'")
  })

  it('mark processed ก่อน replaceState + retry เฉพาะ addedTotal === 0 (R102 คงเดิม)', () => {
    const atMark = layoutSrc.indexOf("sessionStorage.setItem(processedKey, '1')")
    const atReplace = layoutSrc.indexOf('window.history.replaceState', atMark)
    expect(atMark).toBeGreaterThan(-1)
    expect(atReplace).toBeGreaterThan(atMark)
    expect(layoutSrc).toMatch(/if \(!cancelled && addedTotal === 0\) void runAdd\(true\)/)
  })
})

// ============================================
// D — Banner: R102 contract คงเดิม (fbclid ก่อน chain · live cart priority · testid)
// ============================================
describe('R104-D — banner contracts คงเดิม (ไม่ถอย)', () => {
  it('strip fbclid ก่อน encodeLiveCartParam · live cart priority · testid', () => {
    const atStrip = bannerSrc.indexOf("u.searchParams.delete('fbclid')")
    const atEncode = bannerSrc.indexOf('encodeLiveCartParam(')
    expect(atStrip).toBeGreaterThan(-1)
    expect(atEncode).toBeGreaterThan(atStrip)
    expect(bannerSrc).toMatch(/if \(!enc && cartHandoff\?\.raw\) \{/)
    expect(bannerSrc).toContain('data-testid="inapp-live-cart-count"')
  })
})
