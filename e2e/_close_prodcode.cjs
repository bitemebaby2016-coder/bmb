'use strict'
// _close_prodcode — does the LIVE bundle already contain the R67 code? (one-shot)
const fs = require('fs')
const path = require('path')

const MARKERS = {
  new_faq: 'ไม่พิมพ์ตัวเลขรอบตายตัว',          // R67 FAQ (new text)
  old_footer: 'ส่งฟรีเมื่อครบ ฿200',           // pre-R67 Footer hardcode (must be GONE)
  new_footer_guard: 'freeShippingEnforced',      // Footer guard (present before/after — control)
  chat_timeout: 'CHAT_QUERY_TIMEOUT_MS',         // R67 chat time-box (may be minified away)
}

;(async () => {
  const out = { at: new Date().toISOString(), markers: {} }
  const html = await (await fetch('https://biteme-baby.com/', { headers: { 'User-Agent': 'bmb-probe' } })).text()
  const entry = (html.match(/<script type="module"[^>]*src="([^"]+)"/) || [])[1]
  out.entry = entry
  if (!entry) { out.verdict = 'NO_ENTRY'; console.log('NO_ENTRY'); process.exit(1) }
  const js = await (await fetch('https://biteme-baby.com' + entry, { headers: { 'User-Agent': 'bmb-probe' } })).text()
  out.entrySize = js.length
  for (const [k, s] of Object.entries(MARKERS)) out.markers[k] = js.includes(s)
  // also scan lazy chunks referenced by the entry for the FAQ string
  if (!out.markers.new_faq) {
    const chunkUrls = [...new Set([...js.matchAll(/["'`](\/assets\/[A-Za-z0-9_\-]+\.js)["'`]/g)].map((m) => m[1]))].slice(0, 60)
    out.scannedChunks = chunkUrls.length
    for (const u of chunkUrls) {
      try {
        const c = await (await fetch('https://biteme-baby.com' + u, { headers: { 'User-Agent': 'bmb-probe' } })).text()
        if (c.includes(MARKERS.new_faq)) { out.markers.new_faq = 'in:' + u; break }
        if (c.includes(MARKERS.old_footer)) out.markers.old_footer = 'in:' + u
      } catch {}
    }
  }
  const r67Live = out.markers.new_faq !== false && out.markers.new_faq !== true ? true : out.markers.new_faq === true
  out.verdict = r67Live ? 'R67_CODE_IS_LIVE' : 'R67_CODE_NOT_YET_LIVE'
  fs.writeFileSync(path.join(__dirname, '_close_prodcode.json'), JSON.stringify(out, null, 2), 'utf8')
  console.log(out.verdict + ' entry=' + entry + ' markers=' + JSON.stringify(out.markers))
  process.exit(0)
})().catch((e) => { console.log('FATAL ' + String(e).slice(0, 300)); process.exit(1) })