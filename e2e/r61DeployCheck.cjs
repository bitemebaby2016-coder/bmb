'use strict'
// เช็คว่า production เสิร์ฟ build ใหม่แล้วหรือยัง (marker ของ R61 ที่เพิ่ง push)
// ใช้ซ้ำได้: node e2e/r61DeployCheck.cjs  → อ่านอย่างเดียว
const MARKERS = [
  ['R61 promo panel (โปรโมชั่น ภาพ+มาสคอต)', 'promo-attach-panel'],
  ['R61 compose preview', 'promo-compose-preview'],
  ['R61 mascot std buttons', 'promo-mascot-std-'],
  ['R61 mascot clear', 'ไม่ใช้มาสคอต'],
  ['R57 inapp redirect (ของเดิม)', 'bmb:inapp-ext-redirected'],
]
;(async () => {
  const html = await (await fetch('https://biteme-baby.com/')).text()
  const assets = [...new Set(html.match(/\/assets\/[A-Za-z0-9_.\-]+\.js/g) || [])]
  let all = ''
  const perAsset = []
  for (const a of assets) {
    const js = await (await fetch('https://biteme-baby.com' + a)).text()
    perAsset.push(a + ' (' + (js.length / 1024).toFixed(0) + 'KB)')
    all += js
  }
  const hits = MARKERS.filter(([, m]) => all.includes(m)).map(([n]) => n)
  const missing = MARKERS.filter(([, m]) => ! all.includes(m)).map(([n]) => n)
  console.log('assets=' + perAsset.join(' '))
  console.log('HITS(' + hits.length + '/' + MARKERS.length + ')=' + hits.join(' | '))
  console.log('MISSING=' + (missing.join(' | ') || 'none'))
  console.log('DEPLOY_READY=' + (missing.length === 0))
})().catch((e) => { console.error('CHECK_FAIL ' + e.message); process.exit(1) })
