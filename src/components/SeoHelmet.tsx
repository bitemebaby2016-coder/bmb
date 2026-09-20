// ============================================
// Bite Me Baby — SEO Helmet Wrapper
// ใช้ react-helmet-async สำหรับ dynamic meta tags per page
// + Canonical / hreflang (TH/EN) / og:locale / html lang — Local SEO & AEO
// ============================================

import { Helmet, HelmetProvider } from 'react-helmet-async'
import type { SEOMeta } from '@/types'

const helmetContext = { context: {} }

const SITE_URL = 'https://bitemebaby.com'

function canonicalUrl(url?: string): string {
  if (!url || url === '/') return SITE_URL + '/'
  return SITE_URL + (url.startsWith('/') ? url : '/' + url)
}

export function SeoHelmet({ seo }: { seo: SEOMeta | null }) {
  if (!seo) return null

  const canonical = canonicalUrl(seo.url)
  const hasUrl = !!seo.url && seo.url !== '/'

  return (
    <Helmet {...helmetContext} htmlAttributes={{ lang: 'th', 'xml:lang': 'th' }}>
      <title>{seo.title}</title>
      <meta name="description" content={seo.description} />
      <meta name="keywords" content={seo.keywords.join(', ')} />
      <link rel="canonical" href={canonical} />

      {/* hreflang — TH/EN alternates (hrefLang is React's camelCase for hreflang) */}
      <link rel="alternate" hrefLang="th" href={hasUrl ? canonical + '?lang=th' : canonical} />
      <link rel="alternate" hrefLang="en" href={hasUrl ? canonical + '?lang=en' : canonical + '?lang=en'} />
      <link rel="alternate" hrefLang="x-default" href={canonical} />

      {/* Open Graph */}
      <meta property="og:title" content={seo.title} />
      <meta property="og:description" content={seo.description} />
      <meta property="og:image" content={canonicalUrl(seo.ogImage)} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="Bite Me Baby" />
      <meta property="og:url" content={canonical} />
      <meta property="og:locale" content="th_TH" />
      <meta property="og:locale:alternate" content="en_US" />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={seo.title} />
      <meta name="twitter:description" content={seo.description} />
      <meta name="twitter:image" content={canonicalUrl(seo.ogImage)} />

      {/* JSON-LD Schema */}
      {Object.keys(seo.schema).length > 0 && (
        <script type="application/ld+json">
          {JSON.stringify(seo.schema)}
        </script>
      )}
    </Helmet>
  )
}

export { HelmetProvider }