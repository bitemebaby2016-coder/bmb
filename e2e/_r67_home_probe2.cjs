'use strict'
// _r67_home_probe2 — capture the ACTUAL error behind the ErrorBoundary on "/"
const { spawn, execSync } = require('node:child_process')
const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright')

const PROJ = 'D:/A PROJECT/Bite Me Baby'
const PORT = 4181
const BASE = 'http://localhost:' + PORT
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function waitPort(port, ms) {
  const s = Date.now()
  while (Date.now() - s < ms) {
    try { const r = await fetch('http://127.0.0.1:' + port + '/'); if (r.ok) return true } catch {}
    await sleep(900)
  }
  return false
}

let child = null
;(async () => {
  const events = []
  let browser
  try {
    child = spawn('node', ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { cwd: PROJ, stdio: 'ignore', windowsHide: true })
    if (!await waitPort(PORT, 30000)) throw new Error('preview did not start')
    browser = await chromium.launch({ channel: 'chrome', headless: true })
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => events.push('pageerror: ' + ((e && e.stack) ? e.stack : String(e)).slice(0, 2500)))
    page.on('console', (m) => { if (m.type() === 'error') events.push('console: ' + m.text().slice(0, 800)) })
    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 45000 }).catch((e) => events.push('goto:' + String(e).slice(0, 150)))
    await sleep(2500)
    // expand the ErrorBoundary details to read the real error
    const detailText = await page.evaluate(() => {
      const out = []
      for (const d of document.querySelectorAll('details')) out.push(d.textContent || '')
      return out.join('\n---\n')
    })
    const bodyText = await page.locator('body').textContent().catch(() => '')
    fs.writeFileSync(path.join(PROJ, 'e2e', '_r67_home_probe2.json'), JSON.stringify({
      timestamp: new Date().toISOString(),
      detailText: detailText.slice(0, 3000),
      bodySample: String(bodyText).slice(0, 600),
      events: events.slice(0, 10),
    }, null, 2), 'utf8')
    console.log('detailLen=' + detailText.length + ' events=' + events.length)
    process.exit(0)
  } catch (e) {
    fs.writeFileSync(path.join(PROJ, 'e2e', '_r67_home_probe2.json'), JSON.stringify({ fatal: String(e).slice(0, 400), events }, null, 2), 'utf8')
    console.log('FATAL ' + String(e).slice(0, 200))
    process.exit(1)
  } finally {
    try { if (browser) await browser.close() } catch {}
    if (child) { try { execSync('taskkill /pid ' + child.pid + ' /t /f', { stdio: 'ignore' }) } catch {} }
  }
})()
