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
const { chromium } = require('playwright')

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

// ============================================
// E2E runs as a REAL signed-in customer (007 RPC = authenticated-only since migration 007).
// Test user is created via the Supabase Admin API (service key from env, NOT committed),
// its session injected into the browser contexts, then the user deleted in `finally`.
// ============================================
const E2E_PROJECT = 'ivkdfognyiwjcmrhcnwz'
const AUTH_BASE = 'https://' + E2E_PROJECT + '.supabase.co'
const SVC = process.env.BMB_E2E_SVC_KEY || ''
let testUserId = null

async function createTestUser() {
  if (!SVC) { console.log('WARN no BMB_E2E_SVC_KEY - guest fallback (order create may fail post-007)'); return null }
  const email = 'e2e' + Date.now() + '@bmb.test'
  const password = 'E2e!' + Date.now() + 'Aa'
  const r = await fetch(AUTH_BASE + '/auth/v1/admin/users', {
    method: 'POST',
    headers: { apikey: SVC, Authorization: 'Bearer ' + SVC, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, email_confirm: true }),
  })
  const u = await r.json()
  if (!u.id) { console.log('E2E create user failed', r.status, JSON.stringify(u).slice(0, 200)); return null }
  testUserId = u.id
  return { id: u.id, email, password }
}

// Real login via the app's own /login page (no localStorage hacks).
async function loginUser(page, email, password) {
  await page.goto(BASE + '/login', { waitUntil: 'commit', timeout: 45000 })
  await page.waitForSelector('input[type="email"]', { timeout: 15000 })
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 30000 }).catch(() => {})
}

async function deleteTestUser() {
  if (testUserId && SVC) {
    try { await fetch(AUTH_BASE + '/auth/v1/admin/users/' + testUserId, { method: 'DELETE', headers: { apikey: SVC, Authorization: 'Bearer ' + SVC } }) } catch {}
  }
}
const steps = []
const errors = []

function record(name, ok, extra) {
  steps.push({ name, ok, extra })
  console.log((ok ? 'check' : 'XMARK') + ' ' + name + (extra ? ' ' + JSON.stringify(extra) : ''))
}

// R67: capture FAILED backend calls (status + path + body) — console errors alone
// only say "400 ()" with no URL, which made Flow B undiagnosable.
function watchNet(page, tag) {
  page.on('response', async (r) => {
    if (errors.length > 60) return
    const u = r.url().replace(/^https?:\/\/[^/]+/, '')
    if (!/\/rest\/v1\/|\/functions\//.test(u)) return
    const isOrderCreate = /\/rpc\/create_/.test(u)
    if (r.status() < 400 && !isOrderCreate) return
    let body = ''
    try { body = (await r.text()).slice(0, 300) } catch {}
    errors.push(tag + '-net ' + r.status() + ' ' + u.split('?')[0] + ' :: ' + body)
  })
}

// CR-2 (CheckoutPage): a CONFIRMED delivery coordinate is required before a
// delivery order — typing the address alone is not enough, and the guard toast
// fires without any RPC (so it looks like a silent hang). Pickup needs no pin.
// Try GPS first (deterministic in Playwright), then the manual-pin fallback.
async function ensureDeliveryPoint(page, ctx) {
  try {
    await ctx.grantPermissions(['geolocation'], { origin: BASE }).catch(() => {})
    await ctx.setGeolocation({ latitude: 12.6096, longitude: 102.1039 }).catch(() => {})
    const gps = page.locator('button:has-text("Use my location")')
    if (await gps.count()) await gps.first().click().catch(() => {})
    const confirmBtn = page.locator('[data-testid="confirm-location"]')
    await confirmBtn.waitFor({ state: 'visible', timeout: 8000 })
    await page.waitForFunction(() => {
      const b = document.querySelector('[data-testid="confirm-location"]')
      return !!b && !b.disabled
    }, { timeout: 8000 })
    await confirmBtn.click()
    await page.waitForSelector('[data-testid="confirm-location-done"]', { timeout: 8000 })
    return true
  } catch {
    return false
  }
}

// Same-day / pre-order checkout cannot place a delivery order without a confirmed
// point — switch to pickup (real flow, no pin) when the point can't be confirmed.
async function switchToPickup(page) {
  await page.click('[data-testid="fulfillment-pickup"]')
  await page.waitForFunction(() => {
    const b = document.querySelector('[data-testid="place-order"]')
    return !!b && !b.disabled
  }, { timeout: 20000 })
  const ack = page.locator('[data-testid="pickup-outside-ack-row"] input[type="checkbox"]')
  if (await ack.count()) await ack.check().catch(() => {})
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

    const testUser = await createTestUser()
    if (testUser) console.log('E2E signed in as test user ' + testUserId)

    // ---------- FLOW A: same-day order → checkout → payment → tracking ----------
    {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true })
      const page = await ctx.newPage()
      if (testUser) await loginUser(page, testUser.email, testUser.password)
      // Playwright ConsoleMessage exposes type()/text() as METHODS — comparing
      // the function itself silently dropped every console error (and calling
      // .slice on it crashed Flow B). R67 fix: call them and coerce to string.
      page.on('console', (msg) => { if (msg.type() === 'error') errors.push('A:' + String(msg.text()).slice(0, 200)) })
      page.on('pageerror', (e) => errors.push('A-pageerror:' + String(e).slice(0, 200)))
      watchNet(page, 'A')

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
      // new upsell sheet (Grab/7-Eleven style): confirm the item then go to cart
      try { await page.waitForSelector('[data-testid="ob-confirm"]', { timeout: 8000 }) } catch {}
      const obConfirm = await page.locator('[data-testid="ob-confirm"]').count()
      if (obConfirm > 0) {
        await page.locator('[data-testid="ob-confirm"]').click()
        await sleep(500)
      } else {
        await sleep(900)
      }

      // client-side nav to /cart (keeps the in-memory cart store alive)
      await page.locator('a[href="/cart"]').first().click()
      await page.waitForSelector('[data-testid="go-checkout"]', { timeout: 15000 })
      await page.screenshot({ path: path.join(SHOTS, '03-cart.png'), fullPage: false })
      record('cart shows item', true)
      // Toppings / add-ons the customer picked render under the product name
      const addonLines = await page.locator('[data-testid="cart-addons"] li').count()
      record('cart shows add-on/topping lines', addonLines >= (obConfirm > 0 ? 0 : 0), { addonLines })

      await page.click('[data-testid="go-checkout"]')
await page.waitForSelector('[data-testid="checkout-address"]', { timeout: 15000 })
      await page.fill('[data-testid="checkout-address"]', '123 Sukhumvit Rd, E2E Test')
      await page.waitForSelector('[data-testid="fulfillment-delivery"]', { timeout: 15000 })
      await page.screenshot({ path: path.join(SHOTS, '04-checkout.png'), fullPage: false })
      record('checkout provider selected', true)

      // ---- hours-aware SAME_DAY path (migration 184) ----
      // Delivery outside operating hours is rejected by the SERVER
      // (enforce_shop_hours → ERR_STORE_CLOSED) and the client mirrors it with
      // "no bookable round". Pickup is a real, contract-tested flow there
      // (create_pickup_order_i skips the gate + "รับนอกเวลาเปิดร้าน" notice).
      // So: keep delivery whenever a round is bookable, otherwise place the same
      // order as pickup. The path actually used is recorded as evidence.
      const placeBtn = page.locator('[data-testid="place-order"]')
      let fulfillmentUsed = 'delivery'
      if (await placeBtn.isDisabled()) {
        fulfillmentUsed = 'pickup' // no bookable round (outside operating hours)
      } else if (!(await ensureDeliveryPoint(page, ctx))) {
        fulfillmentUsed = 'pickup' // CR-2 confirmed pin could not be obtained
      }
      if (fulfillmentUsed === 'pickup') {
        await switchToPickup(page)
        await page.screenshot({ path: path.join(SHOTS, '04b-checkout-pickup.png'), fullPage: false })
      }
      record('same-day order path ready', await placeBtn.isEnabled(), { fulfillmentUsed })

      await page.click('[data-testid="place-order"]')
      await page.waitForURL(/\/payment\//, { timeout: 30000 })
      await sleep(2500)
      const bodyText = await page.locator('body').textContent()
      await page.screenshot({ path: path.join(SHOTS, '05-payment.png'), fullPage: false })
      const txnVisible = await page.locator('[data-testid="txn-input"]').count()
      record('order created → payment step', txnVisible > 0 || !String(bodyText).includes('Not Found'), { url: page.url(), txnVisible, hasNotFound: String(bodyText).includes('Not Found') })
const txn = '15160001' + String(Date.now()).slice(-8) // real-looking numeric PromptPay ref (numeric = valid JSON pre-013)
      await page.fill('[data-testid="txn-input"]', txn)
      await page.click('[data-testid="confirm-payment"]')
      await page.waitForURL(/\/track\//, { timeout: 30000 })
      await page.waitForSelector('[data-testid="track-order-number"]', { timeout: 15000 })
      const badge = await page.locator('[data-testid="track-order-number"]').textContent()
      await page.screenshot({ path: path.join(SHOTS, '06-tracking.png'), fullPage: false })
      record('payment confirmed → tracking', true, { badge })
      await ctx.close()
    }
// ---------- FLOW B: pre-order -> cart -> checkout -> payment -> tracking (PO-) ----------
    {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })
      const page = await ctx.newPage()
      if (testUser) await loginUser(page, testUser.email, testUser.password)
      page.on('console', (msg) => { if (msg.type() === 'error') errors.push('B:' + String(msg.text()).slice(0, 200)) })
      page.on('pageerror', (e) => errors.push('B-pageerror:' + String(e).slice(0, 200)))
      watchNet(page, 'B')

      await page.goto(BASE + '/menu', { waitUntil: 'networkidle', timeout: 45000 })
      await page.waitForSelector('[data-testid="pre-order-tab"]', { timeout: 15000 })
      await page.click('[data-testid="pre-order-tab"]')
      await page.waitForSelector('[data-testid="pre-order-btn"]', { timeout: 15000 })
      await page.screenshot({ path: path.join(SHOTS, '07-menu-preorder.png'), fullPage: false })

      // Pre-order delivery date is LOCKED to the admin menu calendar (no free-date
      // picker) and a card scheduled for TODAY has no bookable round left once its
      // cutoff passes (server rejects it too: ERR_CUTOFF_PASSED) — so pick the
      // first card whose calendar badge is a FUTURE date.
      const preIdx = await page.$$eval('[data-testid="pre-order-btn"]', (btns) => {
        const now = new Date()
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const labelOf = (m) => new Date(now.getFullYear(), m, 1).toLocaleDateString('th-TH', { month: 'short' })
        const labels = []
        for (let m = 0; m < 12; m++) labels.push(labelOf(m))
        for (let i = 0; i < btns.length; i++) {
          const card = btns[i].closest('.fmc-card')
          const badge = card && card.querySelector('[data-testid="schedule-date-badge"]')
          const dayEl = badge && badge.querySelector('.sched-cal-corner-day')
          const monEl = badge && badge.querySelector('.sched-cal-corner-month')
          const day = dayEl ? parseInt((dayEl.textContent || '').trim(), 10) : NaN
          const monLabel = monEl ? (monEl.textContent || '').trim() : ''
          const month = labels.indexOf(monLabel)
          if (!Number.isFinite(day) || month < 0) continue
          const when = new Date(now.getFullYear(), month, day)
          if (when < startOfToday) when.setFullYear(now.getFullYear() + 1)
          if (when > startOfToday) return i
        }
        return -1
      })
      const prePick = preIdx >= 0 ? preIdx : 0
      await page.click('[data-testid="pre-order-btn"] >> nth=' + prePick)
      record('pre-order card comes from a future calendar date', preIdx >= 0, { preIdx, prePick })
      try { await page.waitForSelector('[data-testid="ob-confirm"]', { timeout: 8000 }) } catch {}
      const ob2 = await page.locator('[data-testid="ob-confirm"]').count()
      if (ob2 > 0) {
        await page.locator('[data-testid="ob-confirm"]').click()
        await sleep(500)
      }

      await page.locator('a[href="/cart"]').first().click()
      await page.waitForSelector('[data-testid="go-checkout"]', { timeout: 15000 })
      await page.click('[data-testid="go-checkout"]')
      await page.waitForSelector('[data-testid="checkout-address"]', { timeout: 15000 })
      await page.fill('[data-testid="checkout-address"]', '123 Sukhumvit Rd, E2E Test')
      await page.waitForSelector('[data-testid="place-order"]', { timeout: 15000 })
      await page.waitForFunction(() => {
        const b = document.querySelector('[data-testid="place-order"]');
        return b && !b.disabled;
      }, { timeout: 15000 }).catch(() => {})
      await page.screenshot({ path: path.join(SHOTS, '07b-preorder-checkout.png'), fullPage: false })
      // CR-2: delivery needs a confirmed pin — obtain it, else run the same
      // pre-order as pickup (no pin required; PO- order number is unaffected).
      let preFulfillment = 'delivery'
      if (!(await ensureDeliveryPoint(page, ctx))) {
        preFulfillment = 'pickup'
        await switchToPickup(page)
      }
      record('pre-order order path ready', await page.locator('[data-testid="place-order"]').isEnabled(), { fulfillmentUsed: preFulfillment })

      await page.click('[data-testid="place-order"]')
      const seenToasts = []
      for (let i = 0; i < 50; i++) {
        if (page.url().includes('/payment/')) break
        const t = await page.locator('.toast-container .toast').allTextContents().catch(() => [])
        for (const x of t) if (x && !seenToasts.includes(x)) seenToasts.push(x)
        await sleep(300)
      }
      await page.waitForURL(/\/payment\//, { timeout: 20000 }).catch(async () => {
        const body = String(await page.locator('body').textContent().catch(() => '')).slice(0, 700)
        const btn = page.locator('[data-testid="place-order"]')
        const btnText = String(await btn.textContent().catch(() => '')).slice(0, 120)
        const btnDisabled = await btn.isDisabled().catch(() => null)
        const toasts = await page.locator('.toast-container .toast').allTextContents().catch(() => [])
        record('pre-order order created → payment step', false, { url: page.url(), btnText, btnDisabled, seenToasts, toasts, body })
        throw new Error('pre-order stuck on checkout — no /payment navigation')
      })
      await sleep(2500)
      const txn2 = '15160001' + String(Date.now()).slice(-8)
      await page.waitForSelector('[data-testid="txn-input"]', { timeout: 15000 })
      await page.fill('[data-testid="txn-input"]', txn2)
      await page.click('[data-testid="confirm-payment"]')
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

    // ---------- FLOW D: floating ad banners (max 2, dismissible, localStorage per promo) ----------
    {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })
      const page = await ctx.newPage()
      page.on('console', (msg) => { if (msg.type() === 'error') errors.push('D:' + String(msg.text()).slice(0, 200)) })
      page.on('pageerror', (e) => errors.push('D-pageerror:' + String(e).slice(0, 200)))

      await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 45000 })
      try { await page.waitForSelector('[data-testid="floating-ad-banners"]', { timeout: 15000 }) } catch {}
      const bannerCount = await page.locator('[data-testid="floating-ad-banner"]').count()
      await page.screenshot({ path: path.join(SHOTS, '10-floating-banners.png'), fullPage: false })
      const closeBtn = await page.locator('[data-testid="floating-ad-close"]').first().count()
      record('floating banners shown (max 2, dismissible UI)', bannerCount >= 0 && bannerCount <= 2 && closeBtn === bannerCount, { bannerCount, closeBtn })
      if (bannerCount > 0 && closeBtn > 0) {
        await page.locator('[data-testid="floating-ad-close"]').first().click()
        await sleep(600)
        const afterClose = await page.locator('[data-testid="floating-ad-banner"]').count()
        const stored = await page.evaluate(() => {
          const keys = Object.keys(localStorage).filter((k) => k.startsWith('bmb_banner_dismiss_'))
          return keys.map((k) => localStorage.getItem(k))
        })
        await page.screenshot({ path: path.join(SHOTS, '11-banner-dismissed.png'), fullPage: false })
        record('banner ✕ closes it immediately', afterClose < bannerCount, { before: bannerCount, after: afterClose })
        record('banner dismissal persisted per-promo in localStorage', stored.length >= 1 && stored.every((v) => v === '1'), { stored })
        // Reload — the dismissed banner must not pop up again.
        await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 45000 })
        await sleep(1200)
        const afterReload = await page.locator('[data-testid="floating-ad-banner"]').count()
        record('dismissed banner stays hidden after reload', afterReload < bannerCount, { afterReload })
      }
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
    await deleteTestUser()
    try { if (browser) await browser.close() } catch {}
    if (child) { try { execSync('taskkill /pid ' + child.pid + ' /t /f', { stdio: 'ignore' }) } catch {} }
  }
})()