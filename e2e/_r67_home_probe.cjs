'use strict'
// _r67_home_probe — spawn a FRESH preview (own port) and verify the restored
// landing contract renders: home-menu-cta + pointing mascot + >= 2 mascot imgs
const { spawn, execSync } = require('node:child_process')
const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright')

const PROJ = 'D:/A PROJECT/Bite Me Baby'
const PORT = 4180
const BASE = 'http://localhost:' + PORT
const OUT = path.join(PROJ, 'e2e', '_r67_home_probe.json')
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
    page.on('pageerror', (e) => events.push('pageerror:' + String(e).slice(0, 300)))
    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 45000 }).catch((e) => events.push('goto:' + String(e).slice(0, 150)))
    let ctaVisible = false
    try { await page.waitForSelector('[data-testid="home-menu-cta"]', { timeout: 15000 }); ctaVisible = true } catch {}
    const mascotImgs = await page.locator('img.mascot-badge').count().catch(() => -1)
    const pointCta = await page.locator('img.mascot-point-cta').count().catch(() => -1)
    await page.screenshot({ path: path.join(PROJ, 'e2e', 'screenshots', 'r67-home-probe.png'), fullPage: false })
    const out = { timestamp: new Date().toISOString(), ctaVisible, mascotImgs, pointCta, events }
    fs.writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8')
    console.log('ctaVisible=' + ctaVisible + ' mascotImgs=' + mascotImgs + ' pointCta=' + pointCta)
    process.exit(0)
  } catch (e) {
    fs.writeFileSync(OUT, JSON.stringify({ fatal: String(e).slice(0, 400), events }, null, 2), 'utf8')
    console.log('FATAL ' + String(e).slice(0, 200))
    process.exit(1)
  } finally {
    try { if (browser) await browser.close() } catch {}
    if (child) { try { execSync('taskkill /pid ' + child.pid + ' /t /f', { stdio: 'ignore' }) } catch {} }
  }
})()
