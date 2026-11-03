'use strict'
// ตรวจว่า production เสิร์ฟ build ล่าสุดจริง (R57/R58/R59 markers) — อ่านอย่างเดียว
const MARKERS = [
  ['R59 product-ai-browse', 'product-ai-browse'],
  ['R58 เปิดจองล่วงหน้าเร็ว ๆ นี้', 'เปิดจองล่วงหน้าเร็ว'],
  ['R57 bmb:inapp-ext-redirected', 'bmb:inapp-ext-redirected'],
  ['R27 cart toast', 'ลิงก์รายการในแชทไม่สมบูรณ์'],
  ['decode v!==1', 'v!==1'],
  ['decode parsed.v', '.v!==1'],
]
;(async () => {
  const html = await (await fetch('https://biteme-baby.com/')).text()
  const assets = [...new Set((html.match(/\/assets\/[A-Za-z0-9_.\-]+\.js/g) || []))]
  console.log('HTML len=' + html.length + ' assets=' + assets.length)
  console.log('html markers: cartDeepLink doc? ' + /shop\?cart=/.test(html))
  for (const a of assets) {
    const js = await (await fetch('https://biteme-baby.com' + a)).text()
    const hits = MARKERS.filter(([, m]) => js.includes(m)).map(([n]) => n)
    console.log(a + ' (' + (js.length / 1024).toFixed(0) + 'KB) hits=' + (hits.join(' | ') || 'NONE'))
    const i = js.indexOf('ลิงก์รายการในแชทไม่สมบูรณ์')
    if (i >= 0) console.log('  ctx@toast: ' + js.slice(Math.max(0, i - 500), i + 120).replace(/\s+/g, ' '))
    const j = js.indexOf('fromB64Url')
    if (j >= 0) console.log('  ctx@fromB64Url: ' + js.slice(j, j + 400).replace(/\s+/g, ' '))
  }
})().catch((e) => { console.error('FAIL ' + e.message); process.exit(1) })
