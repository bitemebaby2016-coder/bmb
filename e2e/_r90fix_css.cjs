// R90fix CSS check (ครั้งเดียว): glass top:30% + .review-see-all ต้องอยู่ใน css bundle จริง
'use strict'
const https = require('https')
function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'user-agent': 'Mozilla/5.0 (bmb-r90fix-css)' } }, (r) => {
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
  if (!m) { console.log('NO_CSS_ASSET'); process.exit(1) }
  const css = await get('https://biteme-baby.com/' + m[0])
  const glassTop30 = /\.review-card-glass\{[^}]*top:30%/.test(css.body) || /\.review-card-glass\{[^}]*top: 30%/.test(css.body)
  const seeAll = /\.review-see-all\{/.test(css.body)
  const glassTop36 = /\.review-card-glass\{[^}]*top:36%/.test(css.body) || /\.review-card-glass\{[^}]*top: 36%/.test(css.body)
  // R91: การ์ดเท่า slide เสมอ (width:100%)
  const cardFull = /\.hc-slide>\s*\.review-card-3d\{width:100%\}/.test(css.body.replace(/\s+/g, ''))
  console.log('CSS_ASSET ' + m[0] + ' ' + css.status + ' bytes=' + css.body.length)
  console.log('GLASS_TOP30=' + glassTop30 + ' GLASS_TOP36_OLD=' + glassTop36 + ' SEE_ALL_CLASS=' + seeAll + ' CARD_FULL=' + cardFull)
  console.log(glassTop30 && seeAll && cardFull ? 'R90FIX_CSS_DEPLOYED' : 'R90FIX_CSS_MISSING')
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })