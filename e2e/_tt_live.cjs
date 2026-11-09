// TT live check (ครั้งเดียว — ห้าม poll): /shop bundle ใหม่ต้องมี copy D5 + ไม่มีรอบ hardcoded เดิม
'use strict'
const https = require('https')

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'user-agent': 'Mozilla/5.0 (bmb-tt-live-check)' } }, (r) => {
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
  const newCopy = /ไม่มีรอบส่ง/.test(js.body) // D5: copy เซมเดย์ใหม่
  const oldRound = /เช้า 06-09/.test(js.body) // D5: รอบ hardcoded เดิมต้องหายไป
  const cartRetry2 = /2500/.test(js.body) // §T-A: retry ชั้นที่ 2 (ค่า ms — หยาบแต่พอเป็นสัญญาณ)
  const seeAll = /review-see-all/.test(js.body) // R90: ปุ่มใต้ปุ่มสั่ง/จอง → /reviews/:id
  const guideNew = /เปิดผ่าน Chrome หรือ Safari เพื่อการใช้งานที่สมบูรณ์ที่สุด/.test(js.body) // R92: วลีใหม่
  const guideOld = /เปิดในเบราว์เซอร์เริ่มต้น/.test(js.body) // R92: วลีเดิมต้องหาย
  console.log('D5_NEW_COPY=' + newCopy + ' TA_RETRY2=' + cartRetry2 + ' R90_SEE_ALL=' + seeAll + ' R92_GUIDE_NEW=' + guideNew + ' R92_GUIDE_OLD_GONE=' + !guideOld)
  if (seeAll && guideNew && !guideOld) {
    console.log('TT_LIVE_FRONTEND_OK (R90 + R92 markers อยู่ใน bundle แล้ว)')
  } else {
    console.log('TT_NOT_DEPLOYED_YET (build เก่า — deploy ยังไม่จบ · ห้ามยิงซ้ำ รอแล้วรายงาน)')
  }
})().catch((e) => {
  console.error('ERR', e.message)
  process.exit(1)
})