'use strict'
// _r67_t3_seo — R67-T3 SEO Meta Routes: line-assert patches
//  A) src/lib/seo.ts — append getRiderMeta() (only page without a meta entry;
//     README §10.5 claims /orders,/notifications,/track missing = DOC DRIFT —
//     code shows R62 D-1 added them + tests lock them. Real gap = /rider.)
//  B) src/App.tsx — import + SEO-block route entry for /rider
const fs = require('fs')

function patch(file, edits) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
  for (const e of edits) {
    if (e.insertAfter) {
      const idx = e.insertAfter - 1
      if (!lines[idx].includes(e.mustContain)) {
        console.error('FAIL ' + file + ' insertAfter ' + e.insertAfter + ' expected: ' + e.mustContain + ' got: ' + lines[idx])
        process.exit(1)
      }
      const add = Array.isArray(e.next) ? e.next : [e.next]
      lines.splice(idx + 1, 0, ...add)
      console.log('OK insert ' + file + ' after@' + e.insertAfter + ' (+' + add.length + ')')
    } else {
      const idx = e.n - 1
      if (!lines[idx].includes(e.mustContain)) {
        console.error('FAIL ' + file + ' line ' + e.n + ' expected: ' + e.mustContain + ' got: ' + lines[idx])
        process.exit(1)
      }
      lines[idx] = e.next
      console.log('OK replace ' + file + ':' + e.n)
    }
  }
  fs.writeFileSync(file, lines.join('\n'), 'utf8')
}

const RIDER_META = [
  '',
  '/** /rider — หน้างานไรเดอร์ (PWA · ผู้ใช้ทั่วไปเปิดได้ · canonical ตัวเอง)',
  ' *  R67-T3: ปิดช่องว่างสุดท้ายของ SEO route matrix — ทุกหน้ามี meta ครบแล้ว */',
  'export function getRiderMeta(): SEOMeta {',
  '  return {',
  '    title: `งานจัดส่ง (ไรเดอร์) | ${SITE_CONFIG.name}`,',
  '    description: `หน้างานจัดส่งสำหรับไรเดอร์ของ ${SITE_CONFIG.name} — ดูงาน เส้นทาง และอัปเดตสถานะจัดส่ง`,',
  "    keywords: [...SITE_CONFIG.keywords, 'rider', 'delivery', 'ไรเดอร์', 'งานจัดส่ง'],",
  "    ogImage: SITE_CONFIG.ogImage, url: seoUrl('/rider'), schema: {}",
  '  }',
  '}',
]

patch('src/lib/seo.ts', [
  // seo.ts ends at 403 (getVoiceDemoMeta closing `}`) — append builder
  { insertAfter: 403, mustContain: '}', next: RIDER_META },
])

patch('src/App.tsx', [
  {
    n: 12,
    mustContain: 'getVoiceDemoMeta }',
    next: "import { getHomeMeta, getShopMeta, getMenuMeta, getCartMeta, getCheckoutMeta, getOrdersMeta, getNotificationsMeta, getReviewsMeta, getAboutMeta, getFaqMeta, getBlogMeta, getContactMeta, getPrivacyMeta, getTermsMeta, getPromotionsMeta, getRewardsMeta, getVoteMeta, getRandomMenuMeta, getShareMeta, getViralMeta, getProfileMeta, getAdminMeta, getLoginMeta, getResetPasswordMeta, getTrackIndexMeta, getTalkToBiteMeta, getVoiceDemoMeta, getRiderMeta } from './lib/seo'",
  },
  {
    insertAfter: 251,
    mustContain: 'getVoiceDemoMeta()',
    next: '        <Route path="/rider" element={<SeoHelmet seo={getRiderMeta()} />} />',
  },
])

console.log('ALL_SEO_PATCHES_OK')
