// ============================================
// BMB — R102 FB IAB Cart Double-Add + External Copy Empty Cart (Owner 2026-11-24)
// ============================================
// อาการ live จริง 2 อาการ (รูป FB Post/WebView/Chrome):
//   ① IAB (ในแอปเฟซ): กดลิงก์ AI ซ้ำ → นับสินค้าเพิ่มทุกครั้ง (24→26 ชิ้น)
//      = history.replaceState ล้มใน IAB → ?cart= ค้างใน URL → Layout effect รันใหม่
//        → decode ?cart= ซ้ำ → addItem ซ้ำ
//   ② External (Chrome): คัดลอกจาก IAB → เปิดแล้วตะกร้าว่าง
//      = payload ?cart= โดน re-encode มั่วข้าม WebView→address bar → ถอดไม่ได้
// แก้:
//   - Layout: sessionStorage guard `bmb:cart-processed-<raw16>` — เติมแล้ว = ข้ามเสมอ
//     (mark หลัง added>0 ก่อน replaceState — replaceState fail ใน IAB ก็ยังกันซ้ำ)
//   - Banner: strip fbclid ก่อน fallback chain + บังคับ live cart เสมอเมื่อมีของ
// ============================================

import { describe, it, expect } from 'vitest'
import {
  encodeCartParam,
  encodeLiveCartParam,
  normalizeCartParam,
  decodeCartParam,
  cartParamFingerprint,
  CART_PARAM_MAX_ITEMS,
} from '../lib/cartDeepLink'

import bannerSrc from '../components/InAppBrowserBanner.tsx?raw'
import layoutSrc from '../components/layout/Layout.tsx?raw'

/** หา v2 payload ที่ base64url มี `-` หรือ `_` จริง (ใช้ `~` วาง bit pattern — เทคนิคเดียวกับ R101) */
function livePayloadWithDashOrUnderscore(): { enc: string } {
  for (let n = 4; n <= 60; n += 2) {
    const res = encodeLiveCartParam([
      { id: 'p' + '~'.repeat(n) + 'x', quantity: 2, customizations: {}, line_mode: 'SAME_DAY' },
    ])
    if (/[-_]/.test(res.encoded)) return { enc: res.encoded }
  }
  throw new Error('no dash/underscore payload found')
}

// ============================================
// A — External copy path (อาการ ②): payload จาก IAB โดน encode มั่ว → ต้องถอดได้
// ============================================
describe('R102-A — External copy: v2 live payload ถอดได้แม้โดน re-encode มั่ว', () => {
  it('round-trip ตรง ๆ: encodeLiveCartParam (mods+lm) → normalizeCartParam คืนครบ', () => {
    const lines = [
      {
        id: 'p-miang-kai',
        quantity: 2,
        customizations: { addOns: [{ addonId: 'a1', selections: ['extra'], note: '' }] },
        line_mode: 'SAME_DAY' as const,
      },
      { id: 'p-kai-torn', quantity: 1, customizations: {}, line_mode: 'PRE_ORDER' as const },
    ]
    const { encoded } = encodeLiveCartParam(lines)
    expect(encoded).not.toBe('')
    const n = normalizeCartParam(encoded)
    expect(n).not.toBeNull()
    expect(n!.raw).toBe(encoded)
    // mods + lm รอด round-trip (Layout จะส่งต่อให้ addItem ถูก)
    const v2 = n!.items as Array<{ id: string; q: number; mods?: unknown; lm?: 0 | 1 }>
    expect(v2).toHaveLength(2)
    expect(v2[0].mods).toEqual(lines[0].customizations)
    expect(v2[0].lm).toBeUndefined() // SAME_DAY = ไม่ติด lm
    expect(v2[1].lm).toBe(1) // PRE_ORDER = lm 1
  })

  it('payload โดน encode มั่ว 1 ชั้น (- → %2D · _ → %5F) = ถอดได้', () => {
    const { enc } = livePayloadWithDashOrUnderscore()
    const mangled = enc.replace(/-/g, '%2D').replace(/_/g, '%5F')
    expect(mangled).not.toBe(enc)
    const n = normalizeCartParam(mangled)
    expect(n).not.toBeNull()
    expect(n!.raw).toBe(enc) // raw สะอาด = เก็บ/คัดลอกต่อได้
  })

  it('payload โดน double-encode (%25 ซ้อน) = ถอดได้ถึง 3 ชั้น — เคส copy ข้าม WebView', () => {
    const { enc } = livePayloadWithDashOrUnderscore()
    const once = enc.replace(/-/g, '%2D').replace(/_/g, '%5F')
    const twice = once.replace(/%/g, '%25')
    expect(twice).not.toBe(once)
    const n = normalizeCartParam(twice)
    expect(n).not.toBeNull()
    expect(n!.raw).toBe(enc)
  })

  it('round-trip ผ่าน URLSearchParams จริง (set→get→normalize) — เส้นทางเดียวกับ banner/Layout', () => {
    const { encoded: enc1 } = encodeLiveCartParam([{ id: 'p-a', quantity: 3, customizations: {}, line_mode: 'SAME_DAY' }])
    const u = new URL('https://biteme-baby.com/shop')
    u.searchParams.set('cart', enc1)
    const back = new URL(u.toString())
    const n = normalizeCartParam(back.searchParams.get('cart'))
    expect(n).not.toBeNull()
    expect(n!.items.map((i) => i.q)).toEqual([3])
  })

  it('ขยะจริง ๆ = null (ห้ามเดา) · v1 เดิมยังถอดได้ (back-compat)', () => {
    expect(normalizeCartParam(null)).toBeNull()
    expect(normalizeCartParam('!!!not-base64!!!')).toBeNull()
    const v1 = encodeCartParam([{ id: 'p-old', q: 1 }])
    const n = normalizeCartParam(v1)
    expect(n).not.toBeNull()
    expect(decodeCartParam(v1)!.map((i) => i.id)).toEqual(['p-old'])
  })

  it('ขอบเขต live cart: payload เกิน 1800 chars → truncated=true + ถอดได้ ≤ 30 บรรทัด', () => {
    // id ยาวบังคับให้ payload b64url เกิน 1800 จริง (caps เดี่ยว ๆ ยังไม่พอ — payload ต้องล้น)
    const many = Array.from({ length: 40 }, (_, i) => ({
      id: 'p' + String(i).padStart(3, '0') + 'x'.repeat(40),
      quantity: 1,
      customizations: {},
      line_mode: 'SAME_DAY' as const,
    }))
    const { encoded, truncated } = encodeLiveCartParam(many)
    expect(truncated).toBe(true)
    const n = normalizeCartParam(encoded)!
    expect(n.items.length).toBeLessThanOrEqual(CART_PARAM_MAX_ITEMS)
    expect(n.items.length).toBeGreaterThanOrEqual(1)
  })
})

// ============================================
// B — IAB double-add guard (อาการ ①): sessionStorage guard ใน Layout
// ============================================
describe('R102-B — Layout guard: เติมซ้ำไม่ได้แม้ ?cart= ค้างใน IAB URL', () => {
  it('source: processedKey = bmb:cart-processed-<fingerprint เต็ม payload> + check ก่อน side effect ใด ๆ', () => {
    // ห้าม prefix slice — b64url ของ JSON ต่างกันแต่ prefix เดียวกัน = key เดิม → บล็อกลิงก์ใหม่ผิด
    expect(layoutSrc).toContain("const processedKey = 'bmb:cart-processed-' + cartParamFingerprint(raw)")
    expect(layoutSrc).toMatch(/sessionStorage\.getItem\(processedKey\) === '1'/)
    // guard ต้องอยู่ก่อนเขียน snapshot (ไม่มี side effect ก่อน guard)
    const atGuard = layoutSrc.indexOf("alreadyProcessed = sessionStorage.getItem(processedKey) === '1'")
    const atStore = layoutSrc.indexOf("localStorage.setItem(CART_STORAGE_KEY")
    expect(atGuard).toBeGreaterThan(-1)
    expect(atStore).toBeGreaterThan(atGuard)
  })

  it('source: mark flag หลัง added > 0 และก่อน replaceState (กัน race — IAB strip fail ก็ mark แล้ว)', () => {
    const atMark = layoutSrc.indexOf("sessionStorage.setItem(processedKey, '1')")
    expect(atMark).toBeGreaterThan(-1)
    // บรรทัด strip URL ตัวแรก "หลังจาก" mark = อยู่ใน effect ?cart= ของ Layout
    const atReplace = layoutSrc.indexOf('window.history.replaceState', atMark)
    expect(atReplace).toBeGreaterThan(atMark)
    // ต้องอยู่ในบล็อก added > 0 (เติมสำเร็จเท่านั้น — fail = ยัง retry ได้)
    const atAdded = layoutSrc.lastIndexOf('if (added > 0) {', atMark)
    expect(atAdded).toBeGreaterThan(-1)
  })

  it('behavior: กดลิงก์เดิม 5 ครั้ง (reload/SPA ใน IAB) → อนุญาตเติมได้ครั้งเดียว', () => {
    // ใช้ fingerprint จริงจาก lib — mirror ความหมายของ guard ใน Layout (check ก่อน → mark เมื่อสำเร็จ)
    const store = new Map<string, string>()
    const guardAllows = (raw: string): boolean => {
      const key = 'bmb:cart-processed-' + cartParamFingerprint(raw)
      if (store.get(key)) return false
      store.set(key, '1') // mark ณ จุด added > 0
      return true
    }
    const raw = encodeLiveCartParam([{ id: 'p-x', quantity: 1, customizations: {}, line_mode: 'SAME_DAY' }]).encoded
    const results = Array.from({ length: 5 }, () => guardAllows(raw))
    expect(results).toEqual([true, false, false, false, false])
  })

  it('behavior: ลิงก์ต่าง payload = คนละ fingerprint → ไม่บล็อกลิงก์ใหม่ (AI สรุปรอบใหม่ได้ปกติ)', () => {
    const store = new Map<string, string>()
    const guardAllows = (raw: string): boolean => {
      const key = 'bmb:cart-processed-' + cartParamFingerprint(raw)
      if (store.get(key)) return false
      store.set(key, '1')
      return true
    }
    const rawA = encodeLiveCartParam([{ id: 'p-a', quantity: 1, customizations: {}, line_mode: 'SAME_DAY' }]).encoded
    const rawB = encodeLiveCartParam([{ id: 'p-b', quantity: 2, customizations: {}, line_mode: 'SAME_DAY' }]).encoded
    // regression pin: payload ต่างกันแต่ b64url prefix เหมือนกัน ต้องได้ fingerprint ต่างกัน
    expect(cartParamFingerprint(rawA)).not.toBe(cartParamFingerprint(rawB))
    expect(guardAllows(rawA)).toBe(true)
    expect(guardAllows(rawA)).toBe(false) // ลิงก์เดิมซ้ำ = บล็อก
    expect(guardAllows(rawB)).toBe(true) // ลิงก์ใหม่ = ผ่าน
  })

  it('fingerprint: payload เดิม = fingerprint เดิม (deterministic) · ต่างความยาว/เนื้อหา = ต่างค่า', () => {
    const a = encodeLiveCartParam([{ id: 'p-a', quantity: 1, customizations: {}, line_mode: 'SAME_DAY' }]).encoded
    const a2 = encodeLiveCartParam([{ id: 'p-a', quantity: 1, customizations: {}, line_mode: 'SAME_DAY' }]).encoded
    const b = encodeLiveCartParam([{ id: 'p-bb', quantity: 1, customizations: {}, line_mode: 'SAME_DAY' }]).encoded
    expect(cartParamFingerprint(a)).toBe(cartParamFingerprint(a2))
    expect(cartParamFingerprint(a)).not.toBe(cartParamFingerprint(b))
  })
})

// ============================================
// C — Banner contracts: fbclid ก่อน chain + live cart บังคับ + testid
// ============================================
describe('R102-C — Banner: strip fbclid ก่อน encode + live cart priority + testid', () => {
  it('strip fbclid เกิดก่อน encodeLiveCartParam (กัน tracking param ปน payload)', () => {
    const atStrip = bannerSrc.indexOf("u.searchParams.delete('fbclid')")
    const atEncode = bannerSrc.indexOf('encodeLiveCartParam(')
    expect(atStrip).toBeGreaterThan(-1)
    expect(atEncode).toBeGreaterThan(atStrip)
  })

  it('live cart priority: fallback snapshot/resume ใช้ได้เฉพาะเมื่อ live cart ว่าง (!enc)', () => {
    expect(bannerSrc).toMatch(/if \(!enc && cartHandoff\?\.raw\) \{/)
    expect(bannerSrc).toMatch(/if \(!enc\) \{\s*\n\s*const resume = readCartResume\(\)/)
    // live cart มาก่อน fallback เสมอ (บล็อกแรกของ chain)
    const atLive = bannerSrc.indexOf('if (liveCart.length > 0) {')
    const atSnap = bannerSrc.indexOf('if (!enc && cartHandoff?.raw) {')
    expect(atLive).toBeGreaterThan(-1)
    expect(atSnap).toBeGreaterThan(atLive)
  })

  it('testid inapp-live-cart-count อยู่บนข้อความนับรายการ (e2e assertion)', () => {
    expect(bannerSrc).toContain('data-testid="inapp-live-cart-count"')
  })

  it('contract เดิมคงครบ: ไม่มี intent:// · hooks ก่อน early return · liveCart subscription (R63b/R101)', () => {
    expect(bannerSrc).not.toContain('intent://')
    expect(bannerSrc).toMatch(/const liveCart = useCartStore\(\(state\) => state\.items\)/)
    expect(bannerSrc).not.toMatch(/useCartStore\.getState\(\)\.items/)
    const earlyReturn = bannerSrc.indexOf('if (!isFB || dismissed) return')
    expect(earlyReturn).toBeGreaterThan(-1)
    for (const h of ['useState<CartHandoff', 'useRef<HTMLTextAreaElement>', 'useCallback(']) {
      const at = bannerSrc.indexOf(h)
      expect(at, `hooks ต้องมี: ${h}`).toBeGreaterThan(-1)
      expect(at, `hooks ต้องอยู่ก่อน early return: ${h}`).toBeLessThan(earlyReturn)
    }
    // copy 3 ชั้น (R101) ยังอยู่
    expect(bannerSrc).toMatch(/navigator\.clipboard\?\.writeText/)
    expect(bannerSrc).toMatch(/document\.execCommand\('copy'\)/)
    expect(bannerSrc).toMatch(/window\.prompt\(/)
  })

  it('URL สุดท้าย set cart ทับค่าเดิมเสมอ (searchParams.set = replace) — payload แพะถูกเขียนทับด้วย live cart', () => {
    const atSet = bannerSrc.indexOf("u.searchParams.set('cart', enc)")
    expect(atSet).toBeGreaterThan(-1)
    // set ต้องเกิดหลัง strip fbclid (URL เดียวกันถูกแต่ง 2 รอบ — strip รอบแรก)
    const atStrip = bannerSrc.indexOf("u.searchParams.delete('fbclid')")
    expect(atSet).toBeGreaterThan(atStrip)
  })
})
