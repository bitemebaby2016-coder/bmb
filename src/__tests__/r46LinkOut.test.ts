// R46 (Owner 2026-11-01) — ลิงก์นอก Facebook: แจ้งทั้งฝั่งข้อความโซเชียล + ผู้ใช้ในหน้าเว็บ
//   + ยืนยันสถานะ "ถึงปลายทาง" = มีครบ (m163/166 + canonical timeline) + known-good 80/680
import { describe, it, expect } from 'vitest'
import { isInAppBrowser, NOTICE_DISMISS_KEY } from '@/components/layout/InAppBrowserNotice'
import fs from 'node:fs'
import path from 'node:path'

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '../..', p), 'utf8')
const intakeSrc = read('supabase/functions/_shared/socialOrderIntake.ts')
const publishSrc = read('supabase/functions/social-publish-worker/index.ts')
const bannerSrc = read('src/components/InAppBrowserBanner.tsx')
const appSrc = read('src/App.tsx')
const timelineSrc = read('src/components/customer/OrderTimeline.tsx')
const vocabSrc = read('src/lib/orderVocabulary.ts')

describe('R46 — แจ้งว่าลิงก์เปิดเว็บภายนอก Facebook (ฝั่งข้อความ)', () => {
  it('buildCartSummaryFooter ต่อท้ายบรรทัดแจ้งลิงก์นอก FB + ลิงก์ /shop?cart= ยังครบ', () => {
    expect(intakeSrc).toContain('buildCartSummaryFooter')
    expect(intakeSrc).toContain('shop?cart=')
    expect(intakeSrc).toContain('ภายนอก Facebook — ถ้าแตะแล้วยังค้างอยู่ในเฟซ ให้กดคัดลอกลิงก์ในแถบที่ขึ้น')
  })

  it('POST_CTA_FOOTER = 5 ข้อ (ข้อใหม่แจ้งลิงก์นอก) + idempotent marker เดิม', () => {
    expect(publishSrc).toContain('🔗 ลิงก์เปิดเว็บภายนอก Facebook — เปิดไม่ออก? กดคัดลอกลิงก์ในแถบที่ขึ้น แล้ววางใน Chrome/Safari')
    expect(publishSrc).toContain("base.includes('ปิดการขายผ่านช่องทางไหนก็ได้')")
    expect(publishSrc.match(/พับ|สั่งใต้โพสนี้|Messenger|biteme-baby.com\/shop|ปิดการขายผ่านช่องทางไหนก็ได้|ภายนอก Facebook/g)!.length).toBeGreaterThanOrEqual(5)
  })
})

describe('R46 — แบนเนอร์ในเว็บ: FB in-app = แจ้ง + ให้ผู้ใช้ยืนยันเปิดเอง', () => {
  it('isInAppBrowser จับ UA ของ Facebook (iOS/Android/IAB) + เว็บปกติไม่ถูกจับ', () => {
    expect(isInAppBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148 [FBAN/FBAV/FBIOS;]')).toBe(true)
    expect(isInAppBrowser('Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A) [FBAN/FB4A;FBAV/]')).toBe(true)
    expect(isInAppBrowser('Mozilla/5.0 (Linux; Android 14) wv [FB_IAB]')).toBe(true)
    expect(isInAppBrowser('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0 Safari/537.36')).toBe(false)
  })

  it('แบนเนอร์ใหม่ (InAppBrowserBanner) = บังคับภายนอก + ปุ่มปิด + App เรียกใช้ wrapper', () => {
    // New banner component (InAppBrowserBanner) replaces old InAppBrowserNotice
    expect(bannerSrc).toContain('data-testid="inapp-banner"')
    // R92 (Owner 2026-11-11 ภาพ 3): ลบปุ่มเปิดแทน (intent/openExternally) — ปุ่มหลักเดียว = คัดลอกลิงก์
    expect(bannerSrc).not.toContain('data-testid="inapp-open-external"')
    // Owner 2026-11-02 "ห้ามใช้บราวเซอร์ของเฟซ" → ปุ่ม "อยู่ที่นี่ต่อ" ยังไม่มี
    expect(bannerSrc).not.toContain('data-testid="inapp-stay"')
    // R77 (Owner: "ใส่ปุ่มปิดป๊อปอัพเพิ่ม"): ปุ่มปิด (X) → ใหม่ใช้ dismiss
    expect(bannerSrc).toContain('data-testid="inapp-dismiss"')
    expect(bannerSrc).toContain('dismiss')
    // R92 regression guard ใหม่: ห้ามมี intent:// กลับมาอีกเด็ดขาด (FB Android WebView ไม่ dispatch = ERR_UNKNOWN_URL_SCHEME)
    expect(bannerSrc).not.toContain('intent://')
    expect(bannerSrc).not.toContain('intentUrl')
    expect(bannerSrc).not.toContain('openExternally')
    // App.tsx wraps routes with InAppBrowserBanner
    expect(appSrc).toContain('<InAppBrowserBanner>')
    expect(appSrc).toContain("import { InAppBrowserBanner } from '@/components/InAppBrowserBanner'")
  })

  it('R90-hotfix: hooks ทุกตัวอยู่ก่อน early return (กัน React #310) + ถอด ?cart= ด้วย decodeCartParam', () => {
    // R90 (Owner 2026-11-11): เว็บพังทั้งหน้า #310 "Rendered more hooks" เพราะ
    // useState/useEffect ถูกวางไว้หลัง `if (!isFB || dismissed) return` →
    // render แรกข้าม hooks, render ถัดไปเรียกเพิ่ม = จำนวน hooks ไม่เท่ากัน
    const earlyReturn = bannerSrc.indexOf('if (!isFB || dismissed) return')
    expect(earlyReturn).toBeGreaterThan(-1)
    for (const h of ['useInAppBrowser()', 'useState<CartHandoff', 'useCallback(']) {
      const at = bannerSrc.indexOf(h)
      expect(at, `hooks ต้องมี: ${h}`).toBeGreaterThan(-1)
      expect(at, `hooks ต้องอยู่ก่อน early return: ${h}`).toBeLessThan(earlyReturn)
    }
    // ต้องถอด ?cart= ด้วยฟังก์ชันเดียวกับ Layout (atob ดิบ = พังเมื่อไม่มี padding)
    expect(bannerSrc).toContain('decodeCartParam')
    expect(bannerSrc).not.toMatch(/\batob\(/)
    // R92 (Owner 2026-11-11): ปุ่มหลักเดียว = คัดลอกลิงก์ · เปิดใน Chrome / Safari + แผง guide
    // ต่อ platform (Messenger: ⋯→เบราว์เซอร์/แชร์→Safari · iOS: แชร์→Safari · สำรอง: วางลิงก์)
    expect(bannerSrc).toContain('📋 คัดลอกลิงก์ · เปิดใน Chrome / Safari')
    expect(bannerSrc).toContain('data-testid="inapp-copy-link"')
    expect(bannerSrc).toContain('data-testid="inapp-guide"')
    expect(bannerSrc).toContain('MESSENGER')
    expect(bannerSrc).toContain('แชร์ → Safari')
    expect(bannerSrc).toContain('วางใน Chrome / Safari')
  })
})

describe('R46 — สถานะตอนจัดส่ง: ไรเดอร์ยืนยันตำแหน่ง = "ถึงปลายทาง" (มีครบ + canonical)', () => {
  it('timeline ลูกค้ามีขั้น arrived + label มาจาก vocabulary เดียวกับ server', () => {
    expect(timelineSrc).toContain("arrived: '📍'")
    expect(timelineSrc).toContain('SERVER_STATUS_LABEL_TH')
    expect(vocabSrc).toContain("arrived: 'ถึงปลายทาง'")
    // rider = 🏁 ถึงปลายทาง (r13 contract) · notification = ถึงปลายทางแล้ว
    expect(read('src/pages/RiderPwaPage.tsx')).toContain("arrived: '🏁 ถึงปลายทาง'")
    expect(read('supabase/migrations/161_order_notifications_address_photo.sql')).toContain("'ถึงปลายทางแล้ว'")
  })
})