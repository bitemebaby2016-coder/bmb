// R91 probe (ครั้งเดียว): ดึง rule จริงทั้งหมดที่แตะ .hc-slide / .review-card-3d
//   จาก CSS bundle สด — หาว่าอะไรทำให้ใบแรกกว้างกว่า (สเกลไม่เท่ากัน)
'use strict'
const https = require('https')
function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'user-agent': 'Mozilla/5.0 (bmb-r91)' } }, (r) => {
        let d = ''
        r.on('data', (c) => (d += c))
        r.on('end', () => resolve({ status: r.statusCode, body: d }))
      })
      .on('error', reject)
  })
}
;(async () => {
  const idx = await get('https://biteme-baby.com/shop')
  const m = idx.body.match(/assets\/index-[\w-]+\.css/)
  if (!m) { console.log('NO_CSS'); process.exit(1) }
  const css = (await get('https://biteme-baby.com/' + m[0])).body
  console.log('CSS', m[0], 'bytes=' + css.length)
  // ตัด media query ออกก่อน = rule ระดับ root (ที่ทุกใบโดนเหมือนกัน)
  const stripped = css.replace(/@media[^{]*\{/g, '\n/*MQ*/').replace(/@supports[^{]*\{/g, '\n/*SUP*/')
  // หา selector block ที่มี hc-slide
  const re = /([^{}]*\{[^{}]*\})/g
  let mm
  let n = 0
  while ((mm = re.exec(stripped)) !== null) {
    const block = mm[1]
    if (/\.hc-slide/.test(block) || (/\.review-card-3d/.test(block) && /width|flex|aspect|contain/.test(block))) {
      console.log('RULE#' + ++n + ' ' + block.slice(0, 300))
    }
  }
  // first-child / :first / :nth rules ที่แตะ review card
  const re2 = /([^{}]*:first[^{}]*\{[^{}]*\})/g
  while ((mm = re2.exec(css)) !== null) {
    if (/review|hc-slide|card-3d/.test(mm[1])) console.log('FIRST_RULE ' + mm[1].slice(0, 250))
  }
  console.log('R91_PROBE_DONE')
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })