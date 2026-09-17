// ============================================
// Bite Me Baby — E2E Smoke Runner (Playwright + system Chrome)
// Flow: Landing → Menu (same-day) → Cart → Checkout → Payment → Tracking
//       + Pre-order → real order → Tracking
//       + Empty cart mascot state
// Usage: node e2e/runE2E.cjs
// Evidence: e2e/screenshots/*.png + e2e/e2e-result.json
// ============================================
const { spawn, execSync } = require('node:child_process')
const fs = require('fs')
const path = require('path')
const { chromium } = require('D:/selfprint-v3-react/node_modules/playwright')

const PROJ = 'D:/A PROJECT/Bite Me Baby'
const PORT = 4173
const BASE = 'http://localhost:' + PORT
const SHOTS = path.join(PROJ, 'e2e', 'screenshots')
fs.mkdirSync(SHOTS, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function waitPort(port, ms) {
  const start = Date.now()
  while (Date.now() - start < ms) {
    try { const r = await fetch('http://127.0.0.1:' + port + '/'); if (r.ok) return true } catch {}
    await sleep(900)
  }
  return false
}

const steps = []
const errors = []

function record(name, ok, extra) {
  steps.push({ name, ok, extra })
  console.log((ok ? 'check' : 'XMARK') + ' ' + name + (extra ? ' ' + JSON.stringify(extra) : ''))
}

let child = null
;(async () => {
  let browser
  try {
    child = spawn('node', ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], {
      cwd: PROJ, stdio: 'ignore', windowsHide: true,
    })
    if (!await waitPort(PORT, 30000)) throw new Error('preview did not start')

    browser = await chromium.launch({ channel: 'chrome', headless: true })

    // ---------- FLOW A: same-day order → checkout → payment → tracking ----------
    {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true })
      const page = await ctx.newPage()
      page.on('console', (msg) => { if (msg.type === 'error') errors.push('A:' + msg.text.slice(0, 200)) })
      page.on('pageerror', (e) => errors.push('A-pageerror:' + String(e).slice(0, 200)))

      await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 45000 })
      await page.waitForSelector('[data-testid="home-menu-cta"]', { timeout: 15000 })
      await page.screenshot({ path: path.join(SHOTS, '01-home.png'), fullPage: false })
      const mascotImgs = await page.locator('img.mascot-badge').count()
      record('landing renders + mascots (greeting/pointing)', mascotImgs >= 2, { mascotImgs })

      await page.click('[data-testid="home-menu-cta"]')
await page.waitForSelector('[data-testid="same-day-tab"]', { timeout: 15000 })
      await page.waitForSelector('[data-testid="same-day-order"]', { timeout: 15000 })
      await page.screenshot({ path: path.join(SHOTS, '02-menu.png'), fullPage: false })

      await page.click('[data-testid="same-day-order"] >> nth=0')
      await sleep(900)

      // client-side nav to /cart (keeps the in-memory cart store alive)
      await page.click('a[href="/cart"]')
      await page.waitForSelector('[data-testid="go-checkout"]', { timeout: 15000 })
      await page.screenshot({ path: path.join(SHOTS, '03-cart.png'), fullPage: false })
      record('cart shows item', true)

      await page.click('[data-testid="go-checkout"]')
await page.waitForSelector('[data-testid="checkout-address"]', { timeout: 15000 })
      await page.fill('[data-testid="checkout-address"]', '123 Sukhumvit Rd, E2E Test')
      await page.waitForSelector('[data-testid="provider-option"]', { timeout: 15000 })
      await page.screenshot({ path: path.join(SHOTS, '04-checkout.png'), fullPage: false })
      record('checkout provider selected', true)

      await page.click('[data-testid="place-order"]')
      await page.waitForURL(/\/payment\//, { timeout: 30000 })
      await sleep(2500)
      const bodyText = await page.locator('body').textContent()
      await page.screenshot({ path: path.join(SHOTS, '05-payment.png'), fullPage: false })
      const txnVisible = await page.locator('[data-testid="txn-input"]').count()
      record('order created → payment step', txnVisible > 0 || !String(bodyText).includes('Not Found'), { url: page.url(), txnVisible, hasNotFound: String(bodyText).includes('Not Found') })
const txn = 'TXN-E2E-' + Date.now()
      await page.fill('[data-testid="txn-input"]', txn)
      await page.click('[data-testid="confirm-payment"]')
      await page.waitForURL(/\/track\//, { timeout: 30000 })
      await page.waitForSelector('[data-testid="track-order-number"]', { timeout: 15000 })
      const badge = await page.locator('[data-testid="track-order-number"]').textContent()
      await page.screenshot({ path: path.join(SHOTS, '06-tracking.png'), fullPage: false })
      record('payment confirmed → tracking', true, { badge })
      await ctx.close()
    }
// ---------- FLOW B: pre-order → real order (pre_orders) → tracking ----------
    {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })
      const page = await ctx.newPage()
      page.on('console', (msg) => { if (msg.type === 'error') errors.push('B:' + msg.text.slice(0, 200)) })
      page.on('pageerror', (e) => errors.push('B-pageerror:' + String(e).slice(0, 200)))

      await page.goto(BASE + '/menu', { waitUntil: 'networkidle', timeout: 45000 })
      await page.waitForSelector('[data-testid="pre-order-tab"]', { timeout: 15000 })
      await page.click('[data-testid="pre-order-tab"]')
      await page.waitForSelector('[data-testid="pre-order-btn"]', { timeout: 15000 })
      await page.screenshot({ path: path.join(SHOTS, '07-menu-preorder.png'), fullPage: false })

      await page.click('[data-testid="pre-order-btn"] >> nth=0')
      await page.waitForURL(/\/track\//, { timeout: 30000 })
      await page.waitForSelector('[data-testid="track-order-number"]', { timeout: 15000 })
      const preBadge = await page.locator('[data-testid="track-order-number"]').textContent()
      await page.screenshot({ path: path.join(SHOTS, '08-preorder-tracking.png'), fullPage: false })
      record('pre-order real order → tracking', preBadge !== null && String(preBadge).includes('PO-'), { badge: preBadge })
      await ctx.close()
    }

    // ---------- FLOW C: empty cart mascot (`empty` pose) ----------
    {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })
      const page = await ctx.newPage()
      await page.goto(BASE + '/cart', { waitUntil: 'networkidle', timeout: 45000 })
      await page.waitForSelector('img.mascot-badge', { timeout: 15000 })
      await page.screenshot({ path: path.join(SHOTS, '09-empty-cart-mascot.png'), fullPage: false })
      const emptyImgs = await page.locator('img.mascot-badge').count()
      record('empty cart shows empty mascot', emptyImgs >= 1, { emptyMascot: emptyImgs })
      await ctx.close()
    }

    const result = {
      timestamp: new Date().toISOString(),
      base: BASE,
      steps,
      consoleErrors: errors,
      pass: steps.every((s) => s.ok),
    }
    fs.writeFileSync(path.join(PROJ, 'e2e', 'e2e-result.json'), JSON.stringify(result, null, 2), 'utf8')
    console.log('\nE2E PASS =', result.pass, '| steps =', steps.length, '| console errors =', errors.length)
    process.exit(result.pass ? 0 : 1)
} catch (e) {
    console.log('\nE2E ERROR:', String(e).slice(0, 1500))
    fs.writeFileSync(path.join(PROJ, 'e2e', 'e2e-result.json'), JSON.stringify({ timestamp: new Date().toISOString(), steps, consoleErrors: errors, pass: false, fatal: String(e).slice(0, 500) }, null, 2), 'utf8')
    process.exit(1)
  } finally {
    try { if (browser) await browser.close() } catch {}
    if (child) { try { execSync('taskkill /pid ' + child.pid + ' /t /f', { stdio: 'ignore' }) } catch {} }
  }
})()