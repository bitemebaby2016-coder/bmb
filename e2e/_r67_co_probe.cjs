'use strict'
// _r67_co_probe — why is place-order disabled ("เลือกรอบจัดส่งก่อน") ?
// Walks the real E2E path to /checkout as a signed-in customer and dumps the
// delivery_rounds request status/body + the round picker DOM state.
const { spawn, execSync } = require('node:child_process')
const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright')

const PROJ = 'D:/A PROJECT/Bite Me Baby'
const PORT = 4182
const BASE = 'http://localhost:' + PORT
const OUT = path.join(PROJ, 'e2e', '_r67_co_probe.json')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const envPath = path.join(PROJ, 'supabase', 'secrets.local.env')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const AUTH_BASE = 'https://ivkdfognyiwjcmrhcnwz.supabase.co'

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
  const net = []
  const events = []
  const out = { timestamp: new Date().toISOString() }
  let browser
  try {
    child = spawn('node', ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { cwd: PROJ, stdio: 'ignore', windowsHide: true })
    if (!await waitPort(PORT, 30000)) throw new Error('preview did not start')
    browser = await chromium.launch({ channel: 'chrome', headless: true })
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })
    const page = await ctx.newPage()
    page.on('console', (m) => { if (m.type() === 'error') events.push('console: ' + m.text().slice(0, 300)) })
    page.on('pageerror', (e) => events.push('pageerror: ' + String(e).slice(0, 300)))
    page.on('response', async (r) => {
      const u = r.url()
      if (/delivery_rounds|ensure_rounds|auto_close|business_settings/.test(u)) {
        let body = ''
        try { body = (await r.text()).slice(0, 500) } catch {}
        net.push({ url: u.replace(/^https?:\/\/[^/]+/, ''), status: r.status(), body })
      }
    })

    // --- sign in a fresh test user ---
    const email = 'e2eco' + Date.now() + '@bmb.test'
    const password = 'E2e!' + Date.now() + 'Aa'
    const created = await fetch(AUTH_BASE + '/auth/v1/admin/users', {
      method: 'POST',
      headers: { apikey: SVC, Authorization: 'Bearer ' + SVC, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, email_confirm: true }),
    }).then((r) => r.json())
    out.userId = created.id || null
    await page.goto(BASE + '/login', { waitUntil: 'commit', timeout: 45000 })
    await page.waitForSelector('input[type="email"]', { timeout: 15000 })
    await page.fill('input[type="email"]', email)
    await page.fill('input[type="password"]', password)
    await page.click('button[type="submit"]')
    await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 30000 }).catch(() => {})
    out.afterLoginUrl = page.url()
// --- menu → cart → checkout (same path as FLOW A) ---
    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 45000 })
    await page.waitForSelector('[data-testid="home-menu-cta"]', { timeout: 15000 })
    await page.click('[data-testid="home-menu-cta"]')
    await page.waitForSelector('[data-testid="same-day-tab"]', { timeout: 15000 })
    await page.waitForSelector('[data-testid="same-day-order"]', { timeout: 15000 })
    await page.click('[data-testid="same-day-order"] >> nth=0')
    try { await page.waitForSelector('[data-testid="ob-confirm"]', { timeout: 8000 }) } catch {}
    if (await page.locator('[data-testid="ob-confirm"]').count()) { await page.locator('[data-testid="ob-confirm"]').click(); await sleep(500) }
    await page.locator('a[href="/cart"]').first().click()
    await page.waitForSelector('[data-testid="go-checkout"]', { timeout: 15000 })
    await page.click('[data-testid="go-checkout"]')
    await page.waitForSelector('[data-testid="checkout-address"]', { timeout: 15000 })
    await page.fill('[data-testid="checkout-address"]', '123 Sukhumvit Rd, E2E Test')
    await sleep(3000)

    out.url = page.url()
    out.placeOrder = await page.locator('[data-testid="place-order"]').textContent().catch(() => null)
    out.placeOrderDisabled = await page.locator('[data-testid="place-order"]').isDisabled().catch(() => null)
    out.noRounds = await page.locator('[data-testid="no-rounds"]').count()
    out.autoRoundText = (await page.locator('[data-testid="same-day-auto-round"]').textContent().catch(() => '')) || ''
    out.pickupOutsideAck = await page.locator('[data-testid="pickup-outside-ack-row"]').count()
    out.bodySnippet = (await page.locator('body').textContent()).slice(0, 900)
    await page.screenshot({ path: path.join(PROJ, 'e2e', 'screenshots', 'r67-checkout-probe.png'), fullPage: false })

    out.net = net
    out.events = events.slice(0, 12)
    fs.writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8')
    console.log('placeOrder=' + JSON.stringify(out.placeOrder) + ' disabled=' + out.placeOrderDisabled + ' noRounds=' + out.noRounds + ' net=' + net.length)
    await browser.close()
    try { execSync('taskkill /pid ' + child.pid + ' /t /f', { stdio: 'ignore' }) } catch {}
    process.exit(0)
  } catch (e) {
    out.fatal = String(e).slice(0, 500)
    out.net = net
    out.events = events.slice(0, 12)
    fs.writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8')
    console.log('FATAL ' + String(e).slice(0, 300))
    try { if (browser) await browser.close() } catch {}
    try { if (child) execSync('taskkill /pid ' + child.pid + ' /t /f', { stdio: 'ignore' }) } catch {}
    process.exit(1)
  }
})()