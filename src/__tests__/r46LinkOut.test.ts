// R46 (Owner 2026-11-01) — ลิงก์นอก Facebook: แจ้งทั้งฝั่งข้อความโซเชียล + ผู้ใช้ในหน้าเว็บ
//   + ยืนยันสถานะ "ถึงปลายทาง" = มีครบ (m163/166 + canonical timeline) + known-good 80/680
import { describe, it, expect } from 'vitest'
import { isInAppBrowser } from '@/components/layout/InAppBrowserNotice'
import fs from 'node:fs'
import path from 'node:path'

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '../..', p), 'utf8')
const intakeSrc = read('supabase/functions/_shared/socialOrderIntake.ts')
const publishSrc = read('supabase/functions/social-publish-worker/index.ts')
const noticeSrc = read('src/components/layout/InAppBrowserNotice.tsx')
const layoutSrc = read('src/components/layout/Layout.tsx')
const timelineSrc = read('src/components/customer/OrderTimeline.tsx')
const vocabSrc = read('src/lib/orderVocabulary.ts')

describe('R46 — แจ้งว่าลิงก์เปิดเว็บภายนอก Facebook (ฝั่งข้อความ)', () => {
  it('buildCartSummaryFooter ต่อท้ายบรรทัดแจ้งลิงก์นอก FB + ลิงก์ /shop?cart= ยังครบ', () => {
    expect(intakeSrc).toContain('buildCartSummaryFooter')
    expect(intakeSrc).toContain('shop?cart=')
    expect(intakeSrc).toContain('ภายนอก Facebook — แตะแล้วยืนยันเพื่อเปิดในเบราว์เซอร์ของคุณได้เลย')
  })

  it('POST_CTA_FOOTER = 5 ข้อ (ข้อใหม่แจ้งลิงก์นอก) + idempotent marker เดิม', () => {
    expect(publishSrc).toContain('🔗 ลิงก์เปิดเว็บภายนอก Facebook — แตะเพื่อยืนยันเปิดในเบราว์เซอร์ของคุณ')
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

  it('แบนเนอร์ R57 = บังคับภายนอก (ไม่มีปุ่มอยู่ที่นี่ต่อ) + Layout เรียกใช้', () => {
    expect(noticeSrc).toContain('data-testid="inapp-browser-notice"')
    expect(noticeSrc).toContain('data-testid="inapp-open-external"')
    // Owner 2026-11-02 "ห้ามใช้บราวเซอร์ของเฟซ" → ปุ่มอยู่ที่นี่ต่อ/dismiss = ถูกถอดออก
    expect(noticeSrc).not.toContain('data-testid="inapp-stay"')
    expect(noticeSrc).not.toContain('DISMISS_KEY')
    expect(noticeSrc).toContain('เปิดในเบราว์เซอร์')
    // Android = พยายามเปิด intent:// แบบไม่ทำลายหน้า (R76: ห้าม location.replace —
    // FB WebView ที่ไม่รู้จัก intent:// = ERR_UNKNOWN_URL_SCHEME กลืนทั้งหน้า = ลิงก์พังทุกลิงก์)
    expect(noticeSrc).toContain('externalBrowserIntentUrl')
    expect(noticeSrc).not.toContain('window.location.replace(intent)')
    expect(noticeSrc).toContain('window.open(intent')
    expect(layoutSrc).toContain('<InAppBrowserNotice />')
    expect(layoutSrc).toContain("import { InAppBrowserNotice } from './InAppBrowserNotice'")
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