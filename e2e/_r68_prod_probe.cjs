'use strict'
// _r68_prod_probe — ยืนยัน production เสิร์ฟโค้ด R68 (marker ใหม่ของ Web POS) — one-shot
// usage: node e2e/_r68_prod_probe.cjs [baseUrl]
const BASE = process.argv[2] || 'https://biteme-baby.com'
const MARKERS = ['pos-quick-links', 'pos-after-hours-banner', 'pos-live-clock', 'pos-link-order-', 'pos-shift-elapsed']
;(async () => {
  const out = { at: new Date().toISOString(), base: BASE, html: null, jsChecked: 0, markers: {}, details: [] }
  const h = await fetch(BASE, { headers: { 'User-Agent': 'bmb-r68-probe' } })
  out.html = { status: h.status }
  const html = await h.text()
  const assets = [...new Set((html.match(/\/assets\/[^"' )]+\.js/g) || []))]
  out.assets_found = assets.length
  // BFS ระดับ 2: หา chunk ที่ lazy-load (AdminPos ไม่อยู่ใน HTML)
  const seen = new Set()
  const queue = [...assets]
  let guard = 0
  while (queue.length && guard < 80) {
    const a = queue.shift()
    if (!a || seen.has(a)) continue
    seen.add(a)
    guard++
    try {
      const r = await fetch(BASE + a, { headers: { 'User-Agent': 'bmb-r68-probe' } })
      const t = await r.text()
      out.jsChecked++
      for (const m of MARKERS) {
        if (t.includes(m) && !out.markers[m]) { out.markers[m] = a; out.details.push(m + ' @ ' + a) }
      }
      for (const nested of (t.match(/\/assets\/[^"' )\\]+\.js/g) || [])) {
        if (!seen.has(nested)) queue.push(nested)
      }
    } catch (e) { out.details.push('ERR ' + a + ' ' + String(e).slice(0, 80)) }
  }
  out.scanned = seen.size
  // Phase 2: ตรง ๆ จากชื่อ chunk ใน dist build ท้องถิ่น (Vite hash) — พิสูจน์ว่า production เสิร์ฟ build เดียวกับที่รัน gates
  try {
    const fs = require('fs'), path = require('path')
    const distAssets = path.join(__dirname, '..', 'dist', 'assets')
    const chunks = fs.readdirSync(distAssets).filter((f) => /^AdminPos-.*\.js$/.test(f) || /^AdminOrders-.*\.js$/.test(f))
    for (const c of chunks) {
      const r = await fetch(BASE + '/assets/' + c, { headers: { 'User-Agent': 'bmb-r68-probe' } })
      const t = r.status === 200 ? await r.text() : ''
      out.details.push('chunk ' + c + ' http=' + r.status + ' len=' + t.length + ' looksLikeHtml=' + /^<!doctype html/i.test(t.trim()))
      // ถ้า server คืน index.html (SPA fallback) = chunk นี้ยังไม่อยู่บน production
      if (/^<!doctype html/i.test(t.trim())) continue
      for (const m of MARKERS) {
        if (t.includes(m) && !out.markers[m]) { out.markers[m] = '/assets/' + c; out.details.push(m + ' @ /assets/' + c) }
      }
    }
  } catch (e) { out.details.push('dist-phase ERR ' + String(e).slice(0, 120)) }
  out.allFound = MARKERS.every((m) => out.markers[m])
  require('fs').writeFileSync(require('path').join(__dirname, '_r68_prod_probe.json'), JSON.stringify(out, null, 2))
  console.log(JSON.stringify(out, null, 1))
})().catch((e) => { console.error(String(e).slice(0, 300)); process.exit(1) })