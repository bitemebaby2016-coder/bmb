// Phase 6c — capture production /voice-demo lazy chunk and scan for secrets
'use strict'
const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright')
const BASE = 'https://bitemebaby-5f7.pages.dev'
const OUT = path.join(process.cwd(), 'e2e', 'prod-phase6-voicechunk.json')

async function main() {
  const ev = { timestamp: new Date().toISOString(), chunks: [], hits: {} }
  const browser = await chromium.launch({ headless: true, channel: 'msedge' })
  const page = await browser.newPage()
  const jsUrls = new Set()
  page.on('response', async (r) => {
    const u = r.url()
    if (u.endsWith('.js') && u.includes('/assets/')) jsUrls.add(u)
  })
  await page.goto(BASE + '/voice-demo', { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {})
  await page.waitForTimeout(3000)
  await browser.close()
  const patterns = { openrouter_key: /sk-or-[a-zA-Z0-9-]{10,}/g, stripe_secret: /sk_(test|live)_[a-zA-Z0-9]{10,}/g, sb_secret: /sb_secret_[a-zA-Z0-9-]{10,}/g }
  for (const u of jsUrls) {
    try {
      const js = await (await fetch(u, { signal: AbortSignal.timeout(20000) })).text()
      const found = {}
      for (const [k, re] of Object.entries(patterns)) { const m = js.match(re); if (m) found[k] = m.length }
      ev.chunks.push({ url: u.slice(BASE.length), size: js.length, found })
      for (const [k, n] of Object.entries(found)) ev.hits[k] = (ev.hits[k] || 0) + n
    } catch (e) { ev.chunks.push({ url: u, error: String(e).slice(0, 120) }) }
  }
  fs.writeFileSync(OUT, JSON.stringify(ev, null, 2), 'utf8')
  console.log('P6c done | chunks=' + jsUrls.size + ' | hits=' + JSON.stringify(ev.hits))
  for (const c of ev.chunks) if (Object.keys(c.found || {}).length) console.log('HIT: ' + JSON.stringify(c))
}
main().catch(e => { console.error('FATAL ' + String(e).slice(0, 300)); process.exit(1) })