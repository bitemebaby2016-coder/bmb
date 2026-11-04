'use strict'
// _r67_seo_matrix — verify EVERY public route in App.tsx has an SEO meta entry
// (README §10.5 "metadata บาง route ยังไม่ครบ" = DOC DRIFT risk — this proves reality)
const fs = require('fs')
const src = fs.readFileSync('src/App.tsx', 'utf8')

// page-block routes (the second <Routes> block = actual pages)
const pageRoutes = [...src.matchAll(/<Route path="(\/[^"]*)"/g)].map((m) => m[1])
// SEO-block entries
const seoRoutes = [...src.matchAll(/<Route path="(\/[^"]*)" element={<SeoHelmet/g)].map((m) => m[1])
const seoWrappers = src.includes('<TrackOrderSeo />') && src.includes('<ReviewDetailSeo />') && src.includes('<PaymentSeo />')

// redirects / param wrappers don't need their own SeoHelmet entry
const WRAPPER_ROUTES = ['/track/:orderNumber', '/payment/:orderNumber', '/reviews/:productId']
const REDIRECTS = ['/profile/orders', '/ai-chat', '/admin/control', '/admin/content-approvals', '/admin/asset-audit', '/admin/payment-exceptions', '/admin/route-optimization', '/admin/rounds', '/admin/print-settings', '/admin/mascot', '/admin/brands', '/admin/ai-studio', '/admin/menu-schedule', '/admin/pre-orders']

const missing = []
for (const r of new Set(pageRoutes)) {
  if (r.startsWith('/admin')) continue // covered by /admin/* entry
  if (REDIRECTS.includes(r)) continue
  if (WRAPPER_ROUTES.includes(r)) continue
  if (!seoRoutes.includes(r)) missing.push(r)
}

console.log('pageRoutes unique=' + new Set(pageRoutes).size)
console.log('seoRoutes=' + seoRoutes.join(', '))
console.log('param wrappers wired=' + seoWrappers)
console.log('MISSING=' + (missing.length ? missing.join(', ') : 'NONE'))
if (missing.length === 0 && seoWrappers) console.log('SEO_MATRIX_COMPLETE')
else { console.log('SEO_MATRIX_INCOMPLETE'); process.exit(1) }
