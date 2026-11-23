// ============================================
// BMB — R101 Cart Handoff Fix (Owner 2026-11-15 · A-4 live FAIL)
// ============================================
// ผล live จริง: A-3 PASS (แบนเนอร์โชว์จำนวนใน WebView เฟซ) → A-4 FAIL
// (คัดลอกลิงก์จากปุ่มสีส้ม → เปิด Chrome/Safari = ตะกร้าว่าง) · Owner ยืนยัน
// "เคยมีสินค้า — แต่ในเบราว์เซอร์ของเฟซเอง" = decode/restore ฝั่ง Layout ถูกแล้ว
// → ปัญหาแคบอยู่ที่ clipboard ข้าม WebView→Chrome + payload โดน encode มั่ว
// แก้: copy 3 ชั้น (clipboard→execCommand→prompt) + กล่องลิงก์เต็มคัดลอกเองได้ +
// normalizeCartParam (ถอด % มั่วหลายชั้น best-effort) ทั้ง Layout + Banner
// ============================================

import { describe, it, expect } from 'vitest'
import { encodeCartParam, normalizeCartParam, decodeCartParam, CART_PARAM_MAX_ITEMS } from '../lib/cartDeepLink'

import bannerSrc from '../components/InAppBrowserBanner.tsx?raw'
import layoutSrc from '../components/layout/Layout.tsx?raw'

const ITEMS = [
  { id: 'p-miang-kai', q: 2 },
  { id: 'p-kai-torn', q: 1 },
]

/** หา payload ที่ base64url มี `-` หรือ `_` จริง — b64 ของ ASCII payload ได้ `+`/`/` เฉพาะ
 *  chunk ที่ align กับ byte สูง ๆ (bit บนของ ASCII = 0) → ใช้ `~` (0x7E · bits5-0=111110=62
 *  = `+` → ถูก replace เป็น `-`) วางใน id ให้ bit pattern โดนตำแหน่งถูกต้อง */
function payloadWithDashOrUnderscore(): { enc: string; items: Array<{ id: string; q: number }> } {
  for (let n = 4; n <= 60; n += 2) {
    const items = [{ id: 'p' + '~'.repeat(n) + 'x', q: 2 }]
    const enc = encodeCartParam(items)
    if (/[-_]/.test(enc)) return { enc, items }
  }
  throw new Error('no dash/underscore payload found')
}

describe('R101-A — normalizeCartParam (pure · กัน payload โดน encode มั่ว)', () => {
  it('ค่าปกติ (b64url) = ถอดได้ตรง ๆ เหมือน decodeCartParam เดิม', () => {
    const enc = encodeCartParam(ITEMS)
    const n = normalizeCartParam(enc)
    expect(n).not.toBeNull()
    expect(n!.raw).toBe(enc)
    expect(n!.items).toEqual(ITEMS)
    // decode เดิมยังใช้ได้ (backward compatible)
    expect(decodeCartParam(enc)!.map((i) => i.id)).toEqual(ITEMS.map((i) => i.id))
  })

  it('payload ถูก encode มั่ว 1 ชั้น (- → %2D · _ → %5F จาก WebView/address bar) = ถอดได้', () => {
    // payload ต้องมี - หรือ _ จริงก่อน (b64url บาง payload ไม่มีเลย — mangle จะไม่เกิด)
    const { enc, items } = payloadWithDashOrUnderscore()
    // จำลอง re-encode แบบ aggressive ที่เกิดได้จริง: encode ทุก non-alnum รวม - และ _
    // (encodeURIComponent ไม่พอ — มันไม่แตะ - และ _ เพราะ unreserved ตาม RFC3986)
    const mangled = enc.replace(/-/g, '%2D').replace(/_/g, '%5F')
    expect(mangled).not.toBe(enc)
    const n = normalizeCartParam(mangled)
    expect(n).not.toBeNull()
    expect(n!.items).toEqual(items)
    // raw ที่คืน = ตัวสะอาด (เก็บเป็น snapshot/คัดลอกต่อได้)
    expect(n!.raw).toBe(enc)
  })

  it('payload ถูก encode มั่วซ้ำหลายชั้น (double-encode %252D) = ถอดได้ถึง 3 ชั้น', () => {
    const { enc, items } = payloadWithDashOrUnderscore()
    const once = enc.replace(/-/g, '%2D').replace(/_/g, '%5F')
    const twice = once.replace(/%/g, '%25')
    expect(twice).not.toBe(once)
    const n = normalizeCartParam(twice)
    expect(n).not.toBeNull()
    expect(n!.items).toEqual(items)
    expect(n!.raw).toBe(enc)
  })

  it('ขยะจริง ๆ (ถอดไม่ได้เลย) = null — ห้ามเดาของเอง', () => {
    expect(normalizeCartParam(null)).toBeNull()
    expect(normalizeCartParam('')).toBeNull()
    expect(normalizeCartParam('!!!not-base64!!!')).toBeNull()
    expect(normalizeCartParam('AAA%')).toBeNull() // % ค้างแต่ถอดไม่ได้
  })

  it('round-trip ผ่าน URLSearchParams จริง (set→get→normalize) = รายการครบ', () => {
    const enc = encodeCartParam(ITEMS)
    const u = new URL('https://biteme-baby.com/shop')
    u.searchParams.set('cart', enc) // URLSearchParams encode ให้เอง
    const back = new URL(u.toString())
    const n = normalizeCartParam(back.searchParams.get('cart'))
    expect(n).not.toBeNull()
    expect(n!.items).toEqual(ITEMS)
  })

  it('ขอบเขต: รายการเกิน 30 = ตัด · q ≤ 50 · q ≥ 1 (คงเดิมทุกข้อ)', () => {
    const many = Array.from({ length: 50 }, (_, i) => ({ id: 'p' + i, q: 99 }))
    const enc = encodeCartParam(many)
    const n = normalizeCartParam(enc)!
    expect(n.items.length).toBe(CART_PARAM_MAX_ITEMS)
    expect(n.items.every((i) => i.q === 50)).toBe(true)
  })
})

describe('R101-B — Banner: copy 3 ชั้น + กล่องลิงก์เต็ม (คัดลอกเองได้ทุก WebView)', () => {
  it('copy 3 ชั้น: clipboard API → execCommand textarea → prompt modal (fallback สุดท้าย)', () => {
    expect(bannerSrc).toMatch(/navigator\.clipboard\?\.writeText/)
    expect(bannerSrc).toMatch(/document\.execCommand\('copy'\)/)
    expect(bannerSrc).toMatch(/window\.prompt\(/)
    // ลำดับ: clipboard ก่อน execCommand ก่อน prompt
    const atClipboard = bannerSrc.indexOf('navigator.clipboard?.writeText')
    const atExec = bannerSrc.indexOf("document.execCommand('copy')")
    const atPrompt = bannerSrc.indexOf('window.prompt(')
    expect(atClipboard).toBeGreaterThan(-1)
    expect(atExec).toBeGreaterThan(atClipboard)
    expect(atPrompt).toBeGreaterThan(atExec)
  })

  it('กล่องลิงก์เต็ม (inapp-link-box) + ปุ่มเลือกทั้งหมด (inapp-select-link) — user คัดลอกเองได้ทุกเครื่อง', () => {
    expect(bannerSrc).toContain('data-testid="inapp-link-box"')
    expect(bannerSrc).toContain('data-testid="inapp-select-link"')
    expect(bannerSrc).toMatch(/ref=\{linkBoxRef\}/)
    expect(bannerSrc).toMatch(/readOnly/)
    // เลือกทั้งหมดเมื่อ focus ด้วย (กดเข้ากล่อง = เลือกเอง)
    expect(bannerSrc).toMatch(/onFocus=\{\(e\) => e\.currentTarget\.select\(\)\}/)
    // selectLinkBox = focus + select + setSelectionRange ครบ
    expect(bannerSrc).toMatch(/const selectLinkBox = useCallback/)
    expect(bannerSrc).toMatch(/el\.setSelectionRange\(0, el\.value\.length\)/)
  })

  it('กล่องลิงก์แสดงเมื่อมี cartHandoff หรือ live cart (ไม่มีรายการ = ข้อความแนะนำตาม R100d คงเดิม)', () => {
    expect(bannerSrc).toMatch(/\(cartHandoff \|\| liveCart\.length > 0\) && \(/)
    // ข้อความ "ไม่พบรายการตะกร้า" ยังอยู่ (ห้ามเงียบ — R43 B6)
    expect(bannerSrc).toContain('ลิงก์ที่เปิดอยู่ไม่พบรายการตะกร้า')
  })

  it('contract เดิมคงครบ: ไม่มี intent:// · hooks ก่อน early return · normalizeCartParam ใช้จริง', () => {
    expect(bannerSrc).not.toContain('intent://')
    expect(bannerSrc).not.toMatch(/\batob\(/)
    expect(bannerSrc).toContain('normalizeCartParam')
    // hooks ทุกตัว (รวม useRef ใหม่) ต้องอยู่ก่อน early return (R90-hotfix กฎถาวร)
    const earlyReturn = bannerSrc.indexOf('if (!isFB || dismissed) return')
    expect(earlyReturn).toBeGreaterThan(-1)
    for (const h of ['useState<CartHandoff', 'useRef<HTMLTextAreaElement>', 'useCallback(']) {
      const at = bannerSrc.indexOf(h)
      expect(at, `hooks ต้องมี: ${h}`).toBeGreaterThan(-1)
      expect(at, `hooks ต้องอยู่ก่อน early return: ${h}`).toBeLessThan(earlyReturn)
    }
  })

  it('snapshot bmb:cart-resume ยังเก็บทันทีที่ capture สำเร็จ (fallback อายุ 30 นาที ทำงานต่อ)', () => {
    expect(bannerSrc).toContain("localStorage.setItem(CART_RESUME_KEY")
    expect(bannerSrc).toContain('readCartResume')
  })

  it('R63b (live 2026-11-23 "คัดลอกลิงก์ → เปิดเบราว์เซอร์ภายนอก ได้ตะกร้าเก่า"): liveCart ต้องเป็น subscription hook — ห้าม getState() ใน render body (stale closure)', () => {
    // liveCart ต้อง subscribe store → banner re-render ทุกครั้งที่ตะกร้าเปลี่ยน
    expect(bannerSrc).toMatch(/const liveCart = useCartStore\(\(state\) => state\.items\)/)
    // ห้ามกลับไปอ่าน .getState().items นอก callback อีก (อ่านครั้งเดียวตอน mount = ตะกร้าเก่าเสมอ)
    expect(bannerSrc).not.toMatch(/useCartStore\.getState\(\)\.items/)
    // ปุ่มคัดลอก/กล่องลิงก์ทุกทางผ่าน buildLiveHandoffUrl (fallback chain เดียว — ไม่มี dead URL ที่สอง)
    expect(bannerSrc).not.toMatch(/const handoffUrl = /)
  })
})

describe('R101-C — Layout: normalize ใช้จริง + กติกา R43 B6 คงเดิม', () => {
  it('Layout ใช้ normalizeCartParam (ไม่ใช่ decode ตรง) — ถอด % มั่วก่อนเติมตะกร้า', () => {
    expect(layoutSrc).toContain('normalizeCartParam(searchParams.get(\'cart\'))')
    // ไม่มี decodeCartParam ตรง ๆ เหลือ (ครอบทางเดียว = normalize)
    expect(layoutSrc).not.toMatch(/decodeCartParam\(\s*raw\s*\)/)
  })

  it('decode-fail เมื่อ URL มี ?cart= = toast บอกสาเหตุเสมอ (R43 B6 — ห้ามเงียบ)', () => {
    expect(layoutSrc).toMatch(/if \(searchParams\.has\('cart'\)\)/)
    expect(layoutSrc).toContain('ลิงก์รายการในแชทไม่สมบูรณ์หรือเสียหาย')
  })

  it('strip ?cart= หลัง restore สำเร็จคงเดิม + retry 700ms/2.5s คงเดิม (§T-A)', () => {
    expect(layoutSrc).toMatch(/url\.searchParams\.delete\('cart'\)/)
    expect(layoutSrc).toMatch(/setTimeout\(\(\) => \{\s*if \(!cancelled && addedTotal === 0\) void runAdd\(true\)\s*\}, 700\)/)
    expect(layoutSrc).toMatch(/2500\)/)
  })
})
