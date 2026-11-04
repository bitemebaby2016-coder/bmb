'use strict'
// _r67_t6_test2 — fix bad assertion + append SEO/E2E contracts to r67Contracts.test.ts
const fs = require('fs')
const FILE = 'src/__tests__/r67Contracts.test.ts'
let src = fs.readFileSync(FILE, 'utf8')

// fix: wrapped Promise.all still contains 'Promise.all([' — assert the WRAPPED form instead
const bad = "    expect(talkSrc).not.toContain('Promise.all([')"
if (src.includes(bad)) {
  src = src.replace(bad, "    // ทุก Promise.all ต้องอยู่ใต้ withDeadline (ไม่มี bare await)\n    expect(talkSrc).not.toMatch(/await Promise\\.all\\(/)")
  console.log('OK fixed Promise.all assertion')
} else {
  console.log('SKIP assertion already fixed')
}

const B = `
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
`

src = src.trimEnd() + '\n' + B
src = src.replace(
  "import { buildFaqs, getFaqs, faqs, PAYMENT_METHOD_LABELS } from '../lib/faqContent'",
  "import { buildFaqs, getFaqs, faqs, PAYMENT_METHOD_LABELS } from '../lib/faqContent'\nimport { getRiderMeta, getOrdersMeta, getNotificationsMeta, getOrderTrackMeta } from '../lib/seo'",
)
fs.writeFileSync(FILE, src, 'utf8')
console.log('OK appended SEO/E2E describes + seo import')
console.log('T6_OK')
