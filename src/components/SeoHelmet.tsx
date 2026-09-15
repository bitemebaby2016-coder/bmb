// ============================================
// Bite Me Baby — SEO Helmet Wrapper
// ใช้ react-helmet-async สำหรับ dynamic meta tags per page
// ============================================

import { Helmet, HelmetProvider } from 'react-helmet-async'
import type { SEOMeta } from '@/types'

const helmetContext = { context: {} }

export function SeoHelmet({ seo }: { seo: SEOMeta | null }) {
  if (!seo) return null
  
  return (
    <Helmet {...helmetContext}>
      <title>{seo.title}</title>
      <meta name="description" content={seo.description} />
      <meta name="keywords" content={seo.keywords.join(', ')} />
      
      {/* Open Graph */}
      <meta property="og:title" content={seo.title} />
      <meta property="og:description" content={seo.description} />
      <meta property="og:image" content={seo.ogImage} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="Bite Me Baby" />
      
      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={seo.title} />
      <meta name="twitter:description" content={seo.description} />
      
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