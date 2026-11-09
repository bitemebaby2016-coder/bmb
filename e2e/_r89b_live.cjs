// R89b LIVE CHECK (ครั้งเดียว — ห้าม poll): /shop bundle ใหม่มี "review-store-logo" + ไม่มี
// "verified-reviews-heading" (VerifiedReviewsSection ถูกตัดออกจาก HomePage แล้ว)
'use strict'
const https = require('https')

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'user-agent': 'Mozilla/5.0 (bmb-live-check)' } }, (r) => {
        let d = ''
        r.on('data', (c) => (d += c))
        r.on('end', () => resolve({ status: r.statusCode, body: d }))
      })
      .on('error', reject)
  })
}

;(async () => {
  const base = 'https://biteme-baby.com'
  const idx = await get(base + '/shop')
  console.log('SHOP_HTML', idx.status)
  const m = idx.body.match(/assets\/index-[\w-]+\.js/)
  if (!m) {
    console.log('NO_INDEX_ASSET')
    process.exit(1)
  }
  const js = await get(base + '/' + m[0])
  console.log('ASSET', m[0], js.status)
  const newMark = /review-store-logo/.test(js.body)
  const oldSection = /verified-reviews-heading/.test(js.body)
  console.log('NEW_MARK_review-store-logo=' + newMark + ' OLD_SECTION_verified-reviews-heading=' + oldSection)
  if (newMark && !oldSection) {
    console.log('R89B_LIVE_NEW_BUILD_OK')
  } else if (!newMark) {
    console.log('R89B_NOT_DEPLOYED_YET (build เก่า — deploy ยังไม่จบ · ห้ามยิงซ้ำ รอแล้วรายงาน)')
  } else {
    console.log('R89B_UNEXPECTED (มีทั้งใหม่และเก่า — ต้องตรวจ bundle)')
  }
})().catch((e) => {
  console.error('ERR', e.message)
  process.exit(1)
})