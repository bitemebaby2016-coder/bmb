'use strict'
// _close_prodver — is production already serving THIS build? (one-shot, no polling)
const fs = require('fs')
const path = require('path')

function extract(html) {
  const pick = (re) => { const m = html.match(re); return m ? m[1] : null }
  return {
    entry: pick(/<script type="module"[^>]*src="([^"]+)"/),
    reactVendor: pick(/href="(\/assets\/react-vendor-[^"]+)"/),
    css: pick(/<link rel="stylesheet"[^>]*href="(\/assets\/[^"]+\.css)"/),
    title: (html.match(/<title>([^<]*)<\/title>/) || [])[1] || null,
  }
}

;(async () => {
  const localHtml = fs.readFileSync(path.join(__dirname, '..', 'dist', 'index.html'), 'utf8')
  const local = extract(localHtml)
  const out = { at: new Date().toISOString(), local }
  try {
    const r = await fetch('https://biteme-baby.com/', { headers: { 'User-Agent': 'bmb-probe' } })
    out.status = r.status
    const html = await r.text()
    out.prodSize = html.length
    out.prod = extract(html)
    out.entryMatch = out.prod.entry === local.entry
    out.vendorMatch = out.prod.reactVendor === local.reactVendor
    out.cssMatch = out.prod.css === local.css
    out.verdict = out.entryMatch && out.vendorMatch ? 'PRODUCTION_HAS_THIS_BUILD' : 'PRODUCTION_DIFFERS_FROM_LOCAL_BUILD'
  } catch (e) {
    out.error = String(e).slice(0, 300)
    out.verdict = 'PROBE_FAILED'
  }
  fs.writeFileSync(path.join(__dirname, '_close_prodver.json'), JSON.stringify(out, null, 2), 'utf8')
  console.log('verdict=' + out.verdict + ' status=' + out.status + ' local=' + local.entry + ' prod=' + (out.prod && out.prod.entry))
  process.exit(0)
})().catch((e) => { console.log('FATAL ' + String(e).slice(0, 200)); process.exit(1) })