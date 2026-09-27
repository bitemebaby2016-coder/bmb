// Phase 6b — production bundle secret scan (read-only, no secret values printed)
'use strict'
const fs = require('fs')
const path = require('path')
const OUT = path.join(process.cwd(), 'e2e', 'prod-phase6-bundle-scan.json')
const BASE = 'https://bitemebaby-5f7.pages.dev'

async function main() {
  const ev = { timestamp: new Date().toISOString(), assets: [], hits: {} }
  const patterns = {
    openrouter_key: /sk-or-[a-zA-Z0-9-]{10,}/g,
    stripe_secret: /sk_(test|live)_[a-zA-Z0-9]{10,}/g,
    service_role_jwt_role: /"role":"service_role"/g,
    sb_secret: /sb_secret_[a-zA-Z0-9-]{10,}/g,
    webhook_secret: /whsec_[a-zA-Z0-9-]{10,}/g,
  }
  const html = await (await fetch(BASE + '/', { signal: AbortSignal.timeout(20000) })).text()
  const scripts = [...new Set([...html.matchAll(/src="(\/assets\/[^"]+\.js)"/g)].map(m => m[1]))]
  for (const s of scripts) {
    try {
      const js = await (await fetch(BASE + s, { signal: AbortSignal.timeout(25000) })).text()
      const found = {}
      for (const [k, re] of Object.entries(patterns)) {
        const m = js.match(re)
        if (m) found[k] = m.length
      }
      ev.assets.push({ asset: s, size: js.length, found })
      for (const [k, n] of Object.entries(found)) ev.hits[k] = (ev.hits[k] || 0) + n
    } catch (e) { ev.assets.push({ asset: s, error: String(e).slice(0, 150) }) }
  }
  fs.writeFileSync(OUT, JSON.stringify(ev, null, 2), 'utf8')
  console.log('BUNDLE SCAN done | scripts=' + scripts.length + ' | secret hits=' + JSON.stringify(ev.hits))
}
main().catch(e => { console.error('FATAL ' + String(e).slice(0, 300)); process.exit(1) })