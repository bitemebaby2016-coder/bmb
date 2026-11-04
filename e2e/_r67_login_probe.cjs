'use strict'
// _r67_login_probe — diagnose why input[type="email"] never shows on /login
// (E2E matrix flow-A failure). Starts vite preview, opens /login in headless
// Chrome, records console/page errors + waits for the field, saves screenshot.
const { spawn, execSync } = require('node:child_process')
const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright')

const PROJ = 'D:/A PROJECT/Bite Me Baby'
const PORT = 4174
const BASE = 'http://localhost:' + PORT
const OUT = path.join(PROJ, 'e2e', '_r67_login_probe.json')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function waitPort(port, ms) {
  const start = Date.now()
  while (Date.now() - start < ms) {
    try { const r = await fetch('http://127.0.0.1:' + port + '/'); if (r.ok) return true } catch {}
    await sleep(900)
  }
  return false
}

let child = null
;(async () => {
  const consoleMsgs = []
  const pageErrors = []
  let browser
  try {
    child = spawn('node', ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], {
      cwd: PROJ, stdio: 'ignore', windowsHide: true,
    })
    if (!await waitPort(PORT, 30000)) throw new Error('preview did not start')

    browser = await chromium.launch({ channel: 'chrome', headless: true })
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })
    const page = await ctx.newPage()
    page.on('console', (m) => consoleMsgs.push(m.type() + ': ' + m.text().slice(0, 200)))
    page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 400)))
    page.on('requestfailed', (r) => consoleMsgs.push('REQFAIL: ' + r.url().slice(0, 120) + ' ' + (r.failure()?.errorText || '')))

    await page.goto(BASE + '/login', { waitUntil: 'commit', timeout: 45000 })
    let emailVisible = false
    try {
      await page.waitForSelector('input[type="email"]', { timeout: 20000 })
      emailVisible = true
    } catch { /* keep false */ }
    await sleep(1500)
    await page.screenshot({ path: path.join(PROJ, 'e2e', 'screenshots', 'r67-login-probe.png'), fullPage: true })
    const bodyText = await page.locator('body').textContent().catch(() => '')
    const result = {
      timestamp: new Date().toISOString(),
      url: page.url(),
      emailVisible,
      bodySample: String(bodyText).slice(0, 500),
      consoleMsgs: consoleMsgs.slice(0, 30),
      pageErrors: pageErrors.slice(0, 10),
    }
    fs.writeFileSync(OUT, JSON.stringify(result, null, 2), 'utf8')
    console.log('emailVisible=' + emailVisible + ' errors=' + pageErrors.length + ' console=' + consoleMsgs.length)
    process.exit(0)
  } catch (e) {
    fs.writeFileSync(OUT, JSON.stringify({ timestamp: new Date().toISOString(), fatal: String(e).slice(0, 500), consoleMsgs, pageErrors }, null, 2), 'utf8')
    console.log('PROBE_FATAL ' + String(e).slice(0, 300))
    process.exit(1)
  } finally {
    try { if (browser) await browser.close() } catch {}
    if (child) { try { execSync('taskkill /pid ' + child.pid + ' /t /f', { stdio: 'ignore' }) } catch {} }
  }
})()
