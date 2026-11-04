// ============================================
// Bite Me Baby — R67 contracts (E2E matrix fixes + Chat-Hang + SEO + FAQ auto-sync)
// ============================================
// Behavior tests สำหรับ pure logic + source contracts ตามแนวทาง ?raw ของโปรเจกต์

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

import { buildFaqs, getFaqs, faqs, PAYMENT_METHOD_LABELS } from '../lib/faqContent'
import { getRiderMeta, getOrdersMeta, getNotificationsMeta, getOrderTrackMeta } from '../lib/seo'
import type { DeliveryConfig } from '../config/platformConfig'

const read = (rel: string) => readFileSync(resolve(__dirname, '..', rel), 'utf8')
const mascotSrc = read('lib/mascotService.ts')
const talkSrc = read('components/ai/TalkToBite.tsx')
const faqSrc = read('lib/faqContent.ts')
const faqPageSrc = read('pages/FaqPage.tsx')
const seoSrc = read('lib/seo.ts')
const appSrc = read('App.tsx')
const e2eSrc = readFileSync(resolve(__dirname, '../../e2e/runE2E.cjs'), 'utf8')

const DELIVERY: DeliveryConfig = {
  biteDriveMaxDistanceKm: 5,
  biteDriveEnabled: true,
  biteDriveFlatFee: 25,
  tier2MarkupPct: 12,
  freeShippingThreshold: 300,
  freeShippingEnforced: false,
  cutoffHours: 2,
  dailyQuota: 100,
  debounceMs: 500,
}

describe('R67 Chat-Hang — mascotService ทุก query มี deadline (README §10.4)', () => {
  it('source: ทุก supabase call ถูกห่อด้วย withDeadline + มี timeout คงที่', () => {
    expect(mascotSrc).toContain('export const MASCOT_LOAD_TIMEOUT_MS = 8000')
    expect(mascotSrc).toContain('function withDeadline<T>(promise: PromiseLike<T>')
    const wrapped = mascotSrc.match(/await withDeadline\(/g) || []
    expect(wrapped.length).toBe(2)
  })

  it('source: timeout ของ getMascotOverrides คืน [] (static fallback ไม่ throw เข้าแชต)', () => {
    expect(mascotSrc).toContain('timeout/network = static fallback')
    expect(mascotSrc).toContain('return []')
  })

  it('source: cache promise ไม่มีวันค้าง — invalidate + then-chain ที่ settle เสมอ', () => {
    expect(mascotSrc).toContain('overridesPromise = getMascotOverrides().then(')
    expect(mascotSrc).toContain('export function invalidateMascotOverrides')
  })

  it('source: TalkToBite time-box ทุก query ในเส้นทางส่งข้อความ (typing ห้ามค้างถาวร)', () => {
    expect(talkSrc).toContain('const CHAT_QUERY_TIMEOUT_MS = 15000')
    expect(talkSrc).toContain('function withDeadline<T>(promise: PromiseLike<T>')
    const wrapped = talkSrc.match(/await withDeadline\(/g) || []
    expect(wrapped.length).toBeGreaterThanOrEqual(6)
    expect(talkSrc).not.toContain('pickTopAvailable(await load()')
    expect(talkSrc).not.toContain('pickFavoriteProducts(await load()')
    // ทุก Promise.all ต้องอยู่ใต้ withDeadline (ไม่มี bare await)
    expect(talkSrc).not.toMatch(/await Promise\.all\(/)
  })
})

describe('R67-T4 FAQ/Promo — ตัวเลข/ข้อความปรับตาม backend อัตโนมัติ', () => {
  it('buildFaqs: ค่าส่ง/รัศมี/ส่งฟรี มาจาก config ไม่ hardcode', () => {
    const a = buildFaqs({
      delivery: { ...DELIVERY, biteDriveMaxDistanceKm: 7, biteDriveFlatFee: 42, freeShippingThreshold: 999, freeShippingEnforced: true },
      shopHours: null,
    })
    const delivery = a.find((f) => f.q.includes('ค่าจัดส่ง'))
    expect(delivery?.a).toContain('42')
    expect(delivery?.a).toContain('999')
    expect(delivery?.a).toContain('ส่งฟรี')
    const area = a.find((f) => f.q.includes('ครอบคลุมพื้นที่'))
    expect(area?.a).toContain('7 กม.')
  })

  it('ZERO-FAKE: freeShippingEnforced=false → ห้ามสัญญา "ส่งฟรี" (ชี้หน้าโปรโมชั่นแทน)', () => {
    const a = buildFaqs({ delivery: DELIVERY, shopHours: null })
    const delivery = a.find((f) => f.q.includes('ค่าจัดส่ง'))
    expect(delivery?.a).not.toContain('ได้สิทธิ์ส่งฟรี')
    expect(delivery?.a).toContain('โปรโมชั่น')
  })

  it('วิธีชำระเงิน = ทุกตัวใน PaymentMethod (type-checked) — ไม่ใช่ "2 วิธี" hardcode', () => {
    const a = buildFaqs({ delivery: DELIVERY, shopHours: null })
    const pay = a.find((f) => f.q.includes('ชำระเงิน'))
    expect(pay?.a).toContain('3 วิธี')
    expect(pay?.a).toContain(PAYMENT_METHOD_LABELS.credit_card)
    expect(Object.keys(PAYMENT_METHOD_LABELS).sort()).toEqual(['cash_on_delivery', 'credit_card', 'promptpay_qr'])
  })

  it('เวลาเปิดร้านมาจาก shopHours ไม่ hardcode', () => {
    const withHours = buildFaqs({ delivery: DELIVERY, shopHours: { open: '08:00', close: '20:00' } })
      .find((f) => f.q.includes('ติดต่อ'))
    expect(withHours?.a).toContain('เปิด 08:00 - 20:00')
    const noHours = buildFaqs({ delivery: DELIVERY, shopHours: null }).find((f) => f.q.includes('ติดต่อ'))
    expect(noHours?.a).not.toContain('7.00 am')
  })

  it('source: ไม่มีตัวเลขค้างแข็งใน faqContent (30 บาท/200 บาท/7.00)', () => {
    expect(faqSrc).not.toContain('เริ่มต้นที่ 30 บาท')
    expect(faqSrc).not.toContain('ครบ 200 บาท')
    expect(faqSrc).not.toContain('7.00 am')
    expect(faqSrc).toContain('อัปเดตจากฐานข้อมูลร้านโดยอัตโนมัติ')
  })

  it('AEO invariant: FaqPage และ JSON-LD สร้างจาก builder เดียวกัน (schema ไม่เพี้ยนจากหน้า)', () => {
    expect(faqPageSrc).toContain('buildFaqs(')
    expect(seoSrc).toContain('getFaqs().map')
    expect(faqs.length).toBeGreaterThanOrEqual(10)
    expect(getFaqs().length).toBe(faqs.length)
  })
})

describe('R67-T3 SEO — ทุกหน้ามี meta + /track ใช้ dynamic param จริง', () => {
  it('/rider มี meta แล้ว (ปิดช่องว่างสุดท้ายของ SEO route matrix)', () => {
    const m = getRiderMeta()
    expect(m.url).toBe('https://biteme-baby.com/rider')
    expect(m.title).toContain('Bite Me Baby')
    expect(appSrc).toContain('path="/rider" element={<SeoHelmet seo={getRiderMeta()} />} />')
  })

  it('/orders + /notifications มี meta + canonical ชี้ตัวเอง (README เดิมบอกขาด = DOC DRIFT)', () => {
    expect(getOrdersMeta().url).toBe('https://biteme-baby.com/orders')
    expect(getNotificationsMeta().url).toBe('https://biteme-baby.com/notifications')
    expect(appSrc).toContain('path="/orders" element={<SeoHelmet seo={getOrdersMeta()} />}')
    expect(appSrc).toContain('path="/notifications" element={<SeoHelmet seo={getNotificationsMeta()} />}')
  })

  it('/track/:orderNumber ใช้ param จริง (ห้ามมี literal :orderNumber ใน URL/title)', () => {
    const m = getOrderTrackMeta('BMB-20261104-123')
    expect(m.url).toBe('https://biteme-baby.com/track/BMB-20261104-123')
    expect(m.title).toContain('BMB-20261104-123')
    expect(JSON.stringify(m)).not.toContain(':orderNumber')
    expect(appSrc).toContain('<TrackOrderSeo />')
  })
})

describe('R67-T1 E2E Matrix — selectors ตรง UI ปัจจุบัน (source contract)', () => {
  it('UI คืนสัญญา home-menu-cta (docs: "testid kept for E2E") บนปุ่มดูเมนู', () => {
    expect(talkSrc).toContain('data-testid="home-menu-cta"')
    expect(talkSrc).toMatch(/home-menu-cta/)
  })

  it('E2E ใช้ fulfillment-delivery (provider-option ถูกถอดตาม audit) — ไม่มี selector ตายค้าง', () => {
    expect(e2eSrc).toContain('fulfillment-delivery')
    expect(e2eSrc).not.toContain('provider-option')
  })

  it('FLOW B เดินตาม UX ปัจจุบัน: pre-order ผ่านตะกร้า → checkout → payment → track (PO-)', () => {
    expect(e2eSrc).toContain('FLOW B: pre-order -> cart -> checkout -> payment -> tracking (PO-)')
    expect(e2eSrc).toContain("String(preBadge).includes('PO-')")
    expect(e2eSrc).toContain('go-checkout')
    expect(e2eSrc).toContain('confirm-payment')
  })

  it('record ของ E2E matrix ยังอยู่ครบ (ห้ามลบ/ลด assertion)', () => {
    for (const name of [
      'landing renders + mascots',
      'cart shows item',
      'order created → payment step',
      'payment confirmed → tracking',
      'pre-order real order → tracking',
      'empty cart shows empty mascot',
      'floating banners shown',
    ]) {
      expect(e2eSrc, 'record หาย: ' + name).toContain(name)
    }
  })
})
