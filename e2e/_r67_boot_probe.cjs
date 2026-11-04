'use strict'
// _r67_boot_probe — capture the FULL stack of the boot TypeError
// ("Cannot read properties of null (reading 'useCallback')") on the preview build.
const { spawn, execSync } = require('node:child_process')
const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright')

const PROJ = 'D:/A PROJECT/Bite Me Baby'
const PORT = 4175
const BASE = 'http://localhost:' + PORT
const OUT = path.join(PROJ, 'e2e', '_r67_boot_probe.json')

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
  const events = []
  let browser
  try {
    child = spawn('node', ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], {
      cwd: PROJ, stdio: 'ignore', windowsHide: true,
    })
    if (!await waitPort(PORT, 30000)) throw new Error('preview did not start')

    browser = await chromium.launch({ channel: 'chrome', headless: true })
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => events.push({ kind: 'pageerror', stack: (e && e.stack ? e.stack : String(e)).slice(0, 3000) }))
    page.on('console', (m) => { if (m.type() === 'error') events.push({ kind: 'console', text: m.text().slice(0, 500) }) })
    page.on('requestfailed', (r) => events.push({ kind: 'reqfail', url: r.url().slice(0, 160), err: (r.failure() && r.failure().errorText) || '' }))

    await page.goto(BASE + '/login', { waitUntil: 'load', timeout: 45000 }).catch((e) => events.push({ kind: 'goto', text: String(e).slice(0, 200) }))
    await sleep(3000)
    const bodyLen = await page.locator('body').innerHTML().then((h) => h.length).catch(() => -1)
    await page.screenshot({ path: path.join(PROJ, 'e2e', 'screenshots', 'r67-boot-probe.png'), fullPage: false })
    fs.writeFileSync(OUT, JSON.stringify({ timestamp: new Date().toISOString(), url: page.url(), bodyLen, events: events.slice(0, 20) }, null, 2), 'utf8')
    console.log('events=' + events.length + ' bodyLen=' + bodyLen)
    process.exit(0)
  } catch (e) {
    fs.writeFileSync(OUT, JSON.stringify({ timestamp: new Date().toISOString(), fatal: String(e).slice(0, 500), events }, null, 2), 'utf8')
    console.log('PROBE_FATAL ' + String(e).slice(0, 300))
    process.exit(1)
  } finally {
    try { if (browser) await browser.close() } catch {}
    if (child) { try { execSync('taskkill /pid ' + child.pid + ' /t /f', { stdio: 'ignore' }) } catch {} }
  }
})()
