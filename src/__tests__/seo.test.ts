import { describe, it, expect } from 'vitest'
import {
  SITE_CONFIG,
  seoUrl,
  getHomeMeta,
  getShopMeta,
  getMenuMeta,
  getFaqMeta,
  generateJsonLd,
} from '@/lib/seo'
import { faqs } from '@/lib/faqContent'
// Vite `?raw` imports — no node types in this project; these resolve at test build time.
import sitemap from '../../public/sitemap.xml?raw'
import robots from '../../public/robots.txt?raw'
import indexHtml from '../../index.html?raw'

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
      expect(m.description).not.toContain('Bite ช่วย')
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
  })
})

describe('index.html — static head is Helmet-owned, no duplicate SEO blocks', () => {
  it('every static title/canonical/og/twitter tag is marked data-react-helmet', () => {
    // SeoHelmet (react-helmet-async v3) only replaces tags carrying its `data-rh`
    // attribute; unmarked static tags would DUPLICATE every per-page tag (verified
    // live: two <title>, two canonicals, two og:url on /shop before this fix).
    const lines = indexHtml.split('\n').filter((l) =>
      /<(title|meta|link)\s/.test(l) &&
      /(<title|rel="canonical"|rel="alternate"|name="description"|name="keywords"|name="twitter:|property="og:)/.test(l),
    )
    expect(lines.length).toBeGreaterThan(0)
    // react-helmet-async v3 manages tags marked with its attribute: data-rh
    for (const line of lines) expect(line).toContain('data-rh="true"')
  })

  it('no static JSON-LD script — structured data comes only from seo.ts via Helmet', () => {
    expect(indexHtml).not.toContain('application/ld+json')
  })

  it('exactly one static canonical, pointing at the site root as fallback', () => {
    const canonicals = indexHtml.match(/rel="canonical" href="([^"]+)"/g) ?? []
    expect(canonicals).toHaveLength(1)
    expect(canonicals[0]).toContain('https://biteme-baby.com/"')
  })
})