import { describe, it, expect } from 'vitest'
import {
  SITE_CONFIG,
  seoUrl,
  getHomeMeta,
  getShopMeta,
  getMenuMeta,
  getFaqMeta,
  getCheckoutMeta,
  generateJsonLd,
  getOrderTrackMeta,
  getOrdersMeta,
  getNotificationsMeta,
  getReviewsMeta,
  getReviewDetailMeta,
  getPaymentMeta,
} from '@/lib/seo'
import { faqs } from '@/lib/faqContent'
// Vite `?raw` imports — no node types in this project; these resolve at test build time.
import sitemap from '../../public/sitemap.xml?raw'
import robots from '../../public/robots.txt?raw'
import indexHtml from '../../index.html?raw'
import appSource from '../App.tsx?raw'

describe('SEO meta — stable, correct canonical, no rotation leakage', () => {
  it('site config points at the production origin', () => {
    expect(SITE_CONFIG.url).toBe('https://biteme-baby.com')
    expect(seoUrl('/shop')).toBe('https://biteme-baby.com/shop')
  })

  it('/shop canonical is itself and meta is deterministic', () => {
    const a = getShopMeta()
    const b = getShopMeta()
    expect(a.url).toBe('https://biteme-baby.com/shop')
    expect(a.title).toContain(SITE_CONFIG.name)
    expect(a.description).toBe(SITE_CONFIG.description)
    // Same output every call — titles/canonical must never wobble with time,
    // copy rotation, remounts or random state.
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('home/menu meta deterministic with correct canonicals', () => {
    expect(JSON.stringify(getHomeMeta())).toBe(JSON.stringify(getHomeMeta()))
    expect(getHomeMeta().url).toBe('https://biteme-baby.com/')
    expect(JSON.stringify(getMenuMeta())).toBe(JSON.stringify(getMenuMeta()))
    expect(getMenuMeta().url).toBe('https://biteme-baby.com/menu')
  })

  it('theater daily copy never leaks into core SEO titles/descriptions', () => {
    const metas = [getHomeMeta(), getShopMeta(), getMenuMeta()]
    for (const m of metas) {
      expect(m.title).not.toContain('วันนี้อยากกิน')
      expect(m.description).not.toContain('ไบ๊ ช่วย')
    }
  })

  it('home JSON-LD Restaurant identity matches SITE_CONFIG (GEO consistency)', () => {
    const schema = getHomeMeta().schema as { '@graph': Array<Record<string, unknown>> }
    const restaurant = schema['@graph'].find((n) => n['@type'] === 'Restaurant')
    expect(restaurant).toBeDefined()
    expect(restaurant!.name).toBe(SITE_CONFIG.name)
    expect(restaurant!.url).toBe('https://biteme-baby.com/')
  })
})

describe('FAQ structured data — matches the visible FaqPage content (AEO)', () => {
  it('FAQPage mainEntity mirrors the rendered faqs array 1:1', () => {
    const schema = getFaqMeta().schema as {
      '@type': string
      mainEntity: Array<{ '@type': string; name: string; acceptedAnswer: { text: string } }>
    }
    expect(schema['@type']).toBe('FAQPage')
    expect(schema.mainEntity).toHaveLength(faqs.length)
    schema.mainEntity.forEach((q, i) => {
      expect(q['@type']).toBe('Question')
      expect(q.name).toBe(faqs[i].q)
      expect(q.acceptedAnswer.text).toBe(faqs[i].a)
    })
  })

  it('no empty questions or answers', () => {
    for (const f of faqs) {
      expect(f.q.trim().length).toBeGreaterThan(0)
      expect(f.a.trim().length).toBeGreaterThan(0)
    }
  })
})

describe('generateJsonLd — safe inline rendering', () => {
  it('escapes closing script tags', () => {
    const out = generateJsonLd({ evil: '</script><img src=x>' })
    expect(out).not.toContain('</script>')
    expect(out).toContain('<\\/script>')
  })
})

describe('sitemap.xml + robots.txt — /shop discoverable, valid namespace', () => {
  it('sitemap uses the real sitemaps.org namespace', () => {
    expect(sitemap).toContain('http://www.sitemaps.org/schemas/sitemap/0.9')
    expect(sitemap).not.toContain('siteml.org')
  })

  it('lists /shop exactly once', () => {
    expect(sitemap.match(/https:\/\/biteme-baby\.com\/shop</g) ?? []).toHaveLength(1)
    expect(sitemap).not.toMatch(/biteme-baby\.com\/shop\//) // no duplicate subpaths
  })

  it('robots.txt points at the sitemap and blocks private areas', () => {
    expect(robots).toContain('Sitemap: https://biteme-baby.com/sitemap.xml')
    expect(robots).toContain('Disallow: /admin*')
    expect(robots).toContain('Disallow: /track/*')
    // /payment/:orderNumber มีเลขออเดอร์ใน URL — canonical ชี้ /checkout อยู่แล้ว
    // และต้องไม่ถูก crawl/index (กันเลขที่ออเดอร์หลุดเข้า search index)
    expect(robots).toContain('Disallow: /payment/*')
  })
})

describe('index.html — no static SEO block (React 19 hoists SeoHelmet tags)', () => {
  it('has no static title/description/canonical/og/twitter tags', () => {
    // React 19 natively hoists <title>/<meta>/<link> rendered by SeoHelmet into
    // <head>; a static copy co-existed with them (verified live: two <title>,
    // two canonicals, two og:url on /shop; document.title stuck on home title).
    const staticSeo = indexHtml.match(
      /<(title|link|meta)\s[^>]*(rel="canonical"|rel="alternate"|name="description"|name="keywords"|name="twitter:|property="og:|>Bite Me Baby)[^>]*>/g,
    ) ?? []
    expect(staticSeo).toHaveLength(0)
  })

  it('no static JSON-LD script — structured data comes only from seo.ts', () => {
    expect(indexHtml).not.toContain('application/ld+json')
  })

  it('still declares charset/viewport/robots basics', () => {
    expect(indexHtml).toContain('charset="UTF-8"')
    expect(indexHtml).toContain('name="viewport"')
    expect(indexHtml).toContain('name="robots"')
  })
})

describe('Param-route SEO — no literal placeholders, canonical uses REAL params', () => {
  it('/track/:orderNumber uses the real order number in title + canonical', () => {
    const m = getOrderTrackMeta('BM-20261012-001')
    expect(m.title).toContain('BM-20261012-001')
    expect(m.url).toBe('https://biteme-baby.com/track/BM-20261012-001')
    expect(JSON.stringify(m)).not.toContain(':orderNumber')
  })

  it('/reviews/:productId shares the /reviews canonical (thin param pages, like /payment → /checkout)', () => {
    const m = getReviewDetailMeta('prod-42')
    expect(m.url).toBe('https://biteme-baby.com/reviews')
    expect(m.description).toContain('prod-42')
    expect(JSON.stringify(m)).not.toContain(':productId')
  })

  it('/payment/:orderNumber keeps the /checkout canonical but the title names the real order', () => {
    // canonical คงชี้ /checkout (กัน index ซ้ำ) — แต่ title ต่างจาก /checkout
    // เพื่อให้ลูกค้าที่เปิดหลายแท็บแยกหน้าจ่ายเงินได้ (handoff §11 P2#2)
    const m = getPaymentMeta('BM-20261012-001')
    expect(m.url).toBe('https://biteme-baby.com/checkout')
    expect(m.title).toContain('BM-20261012-001')
    expect(m.title).not.toBe(getCheckoutMeta().title)
    expect(JSON.stringify(m)).not.toContain(':orderNumber')
  })

  it('/payment meta falls back to plain checkout meta when the order number is missing', () => {
    expect(JSON.stringify(getPaymentMeta(''))).toBe(JSON.stringify(getCheckoutMeta()))
    expect(JSON.stringify(getPaymentMeta('   '))).toBe(JSON.stringify(getCheckoutMeta()))
  })

  it('meta stays deterministic per call (no rotation leakage)', () => {
    expect(JSON.stringify(getOrderTrackMeta('X1'))).toBe(JSON.stringify(getOrderTrackMeta('X1')))
    expect(JSON.stringify(getReviewDetailMeta('p9'))).toBe(JSON.stringify(getReviewDetailMeta('p9')))
  })
})

describe('Account/UGC routes — meta exists with correct canonical', () => {
  it('/orders canonical is itself', () => {
    const m = getOrdersMeta()
    expect(m.url).toBe('https://biteme-baby.com/orders')
    expect(m.title).toContain(SITE_CONFIG.name)
    expect(m.description.length).toBeGreaterThan(0)
    expect(JSON.stringify(m)).toBe(JSON.stringify(getOrdersMeta()))
  })

  it('/notifications canonical is itself', () => {
    const m = getNotificationsMeta()
    expect(m.url).toBe('https://biteme-baby.com/notifications')
    expect(m.title).toContain(SITE_CONFIG.name)
  })

  it('/reviews canonical is itself', () => {
    const m = getReviewsMeta()
    expect(m.url).toBe('https://biteme-baby.com/reviews')
    expect(m.title).toContain(SITE_CONFIG.name)
  })
})

describe('App.tsx SEO route wiring — source contract (regression guard)', () => {
  it('never passes the literal ":orderNumber" placeholder into a meta builder', () => {
    expect(appSource).not.toMatch(/getOrderTrackMeta\(\s*':orderNumber'\s*\)/)
    expect(appSource).not.toMatch(/getReviewDetailMeta\(\s*':productId'\s*\)/)
  })

  it('registers SeoHelmet entries for /orders, /notifications, /reviews and the param variants', () => {
    expect(appSource).toContain('path="/orders" element={<SeoHelmet seo={getOrdersMeta()} />}')
    expect(appSource).toContain('path="/notifications" element={<SeoHelmet seo={getNotificationsMeta()} />}')
    expect(appSource).toContain('path="/reviews" element={<SeoHelmet seo={getReviewsMeta()} />}')
    expect(appSource).toContain('<TrackOrderSeo />')
    expect(appSource).toContain('<ReviewDetailSeo />')
  })

  it('/payment/:orderNumber is wired to PaymentSeo, not a static checkout meta', () => {
    // เดิมใช้ getCheckoutMeta() ตรง ๆ -> title เท่ากันทุกออเดอร์และไม่มีเลขออเดอร์
    expect(appSource).not.toContain('path="/payment/:orderNumber" element={<SeoHelmet seo={getCheckoutMeta()} />}')
    expect(appSource).toContain('<PaymentSeo />')
    // guard: ห้ามส่ง literal placeholder เข้า PaymentSeo/meta builder
    expect(appSource).not.toMatch(/getPaymentMeta\(\s*':orderNumber'\s*\)/)
  })

  it('ProtectedRoute forwards the intended path as login state (returnTo)', () => {
    expect(appSource).toContain('state={{ from: location.pathname + location.search }}')
  })
})