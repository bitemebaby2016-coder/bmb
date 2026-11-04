'use strict'
// _r67_chat_live — R67 Chat-Hang LIVE proof: send a real message in Talk to Bite
// and assert the send path always SETTLES (reply lands OR typing resets within
// CHAT_QUERY_TIMEOUT_MS 15s + slack) — a hung network must never leave the input
// locked forever.
const { spawn, execSync } = require('node:child_process')
const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright')

const PROJ = 'D:/A PROJECT/Bite Me Baby'
const PORT = 4184
const BASE = 'http://localhost:' + PORT
const OUT = path.join(PROJ, 'e2e', '_r67_chat_live.json')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function waitPort(port, ms) {
  const s = Date.now()
  while (Date.now() - s < ms) {
    try { const r = await fetch('http://127.0.0.1:' + port + '/'); if (r.ok) return true } catch {}
    await sleep(800)
  }
  return false
}

let child = null
;(async () => {
  const events = []
  const out = { timestamp: new Date().toISOString() }
  let browser
  try {
    child = spawn('node', ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { cwd: PROJ, stdio: 'ignore', windowsHide: true })
    if (!await waitPort(PORT, 30000)) throw new Error('preview did not start')
    browser = await chromium.launch({ channel: 'chrome', headless: true })
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })
    const page = await ctx.newPage()
    page.on('console', (m) => { if (m.type() === 'error') events.push('console: ' + String(m.text()).slice(0, 200)) })
    page.on('pageerror', (e) => events.push('pageerror: ' + String(e).slice(0, 200)))

    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 45000 })
    await page.waitForSelector('[data-testid="ttb-talk"]', { timeout: 15000 })
    await page.click('[data-testid="ttb-talk"]')
    await page.waitForSelector('[data-testid="ttb-input"], [data-testid="ttb-typing"]', { timeout: 15000 })

    // switch to keyboard mode when the voice/typing toggle is what rendered
    const typingToggle = page.locator('button[data-testid="ttb-typing"]')
    if (await typingToggle.count()) { await typingToggle.first().click().catch(() => {}) }
    await page.waitForSelector('[data-testid="ttb-input"]', { timeout: 15000 })
    await page.fill('[data-testid="ttb-input"]', 'มีอะไรอร่อยบ้าง')
    const t0 = Date.now()
    await page.click('[data-testid="ttb-send"]')

    // Anti-hang contract: `typing` must reset — the INPUT is `disabled={typing}`,
    // so it re-enabling = the send path settled (the send button itself stays
    // disabled afterwards because the input is cleared: `!input.trim() || typing`).
    // aiService allows up to CHAT_TOTAL_TIMEOUT_MS (60s) before falling back,
    // so poll for 75s.
    let settled = false
    for (let i = 0; i < 150; i++) {
      const inputReady = await page.locator('[data-testid="ttb-input"]').isEnabled().catch(() => false)
      if (inputReady) { settled = true; break }
      await sleep(500)
    }
    out.elapsedMs = Date.now() - t0
    out.settled = settled
    out.inputEnabled = await page.locator('[data-testid="ttb-input"]').isEnabled().catch(() => null)
    out.sendEnabled = await page.locator('[data-testid="ttb-send"]').isEnabled().catch(() => null)
    out.chatText = String(await page.locator('[data-testid="talk-to-bite"]').textContent().catch(() => '')).slice(-600)
    await page.screenshot({ path: path.join(PROJ, 'e2e', 'screenshots', 'r67-chat-live.png'), fullPage: false })
    out.pass = out.settled
    out.events = events.slice(0, 10)
    fs.writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8')
    console.log('CHAT_LIVE pass=' + out.pass + ' settled=' + out.settled + ' sendEnabled=' + out.sendEnabled + ' ms=' + out.elapsedMs)
    await browser.close()
    try { execSync('taskkill /pid ' + child.pid + ' /t /f', { stdio: 'ignore' }) } catch {}
    process.exit(out.pass ? 0 : 1)
  } catch (e) {
    out.fatal = String(e).slice(0, 400)
    out.events = events.slice(0, 10)
    fs.writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8')
    console.log('FATAL ' + String(e).slice(0, 300))
    try { if (browser) await browser.close() } catch {}
    try { if (child) execSync('taskkill /pid ' + child.pid + ' /t /f', { stdio: 'ignore' }) } catch {}
    process.exit(1)
  }
})()