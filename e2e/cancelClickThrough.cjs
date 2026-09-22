// ============================================
// Bite Me Baby — Customer cancel UI REAL browser click-through (LOCAL stack)
// ============================================
// Proves the PWA customer self-cancel END-TO-END in a real browser:
//   1. real login via /login
//   2. real SAME_DAY order through the UI: menu → cart → checkout → payment → tracking
//   3. CANCEL #1 on the tracking page  ([data-testid="track-cancel"])
//      → success toast + cancelled state text + DB status + round capacity released
//   4. second real order → CANCEL #2 on /orders ([data-testid="cancel-<num>"])
//      → success toast + row label ยกเลิก + button gone + DB + capacity
// Target: LOCAL stack ONLY (vite dev env-overridden to 127.0.0.1:54321). Production untouched.
// Evidence: e2e/screenshots/ct-*.png + e2e/cancel-clickthrough-result.json
// Usage: node e2e/cancelClickThrough.cjs
// ============================================
'use strict'
const { spawn, spawnSync, execSync } = require('node:child_process')
const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright')

const PROJ = 'D:/A PROJECT/Bite Me Baby'
const PORT = 4175
const SHOTS = path.join(PROJ, 'e2e', 'screenshots')
const OUT = path.join(PROJ, 'e2e', 'cancel-clickthrough-result.json')
fs.mkdirSync(SHOTS, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ---- local stack credentials via `supabase status -o env` (local demo keys only) ----
// NOTE: `supabase status` can report a stale/wrong API_URL when ANOTHER project's
// local stack holds the default 54321 port (two stacks on one machine). We
// therefore PROBE candidate ports and pick the one that actually serves this
// project's schema (`products` must resolve — PGRST205 means wrong stack/port).
function localEnv() {
  const p = spawnSync('supabase', ['status', '-o', 'env'], { cwd: PROJ, encoding: 'utf8', timeout: 60000 })
  const env = {}
  for (const line of String(p.stdout || '').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)="(.*)"$/)
    if (m) env[m[1]] = m[2]
  }
  if (!env.ANON_KEY || !env.SERVICE_ROLE_KEY) {
    throw new Error('could not parse supabase status -o env — is the local stack running?')
  }
  return env
}

async function resolveApiUrl(env) {
  const candidates = [env.API_URL, 'http://127.0.0.1:54331', 'http://127.0.0.1:54321'].filter(Boolean)
  const seen = new Set()
  for (const base of candidates) {
    if (seen.has(base)) continue
    seen.add(base)
    try {
      const r = await fetch(base + '/rest/v1/products?select=id&limit=1', {
        headers: { apikey: env.ANON_KEY, Authorization: 'Bearer ' + env.ANON_KEY },
      })
      if (r.ok) return base
    } catch {}
  }
  throw new Error('no local API port serves this project (tried: ' + [...seen].join(', ') + ') — is the right stack up?')
}

const ENV = localEnv()
const BASE = 'http://localhost:' + PORT
const SVC = ENV.SERVICE_ROLE_KEY

async function rest(p, method = 'GET', body = null, token = null) {
  // token=null → service key (auth admin API only); token=userJwt → RLS-scoped customer reads
  const r = await fetch(ENV.API_URL + p, {
    method,
    headers: { apikey: ENV.ANON_KEY, Authorization: 'Bearer ' + (token || SVC), 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: r.status, body: await r.json() }
}
let userJwt = null
const getOrderRow = async (n) => (await rest('/rest/v1/orders?order_number=eq.' + encodeURIComponent(n) + '&select=order_number,status,order_mode,delivery_round_id,scheduled_date', 'GET', null, userJwt)).body[0] || null
const getRound = async (id) => (await rest('/rest/v1/delivery_rounds?id=eq.' + encodeURIComponent(id) + '&select=id,current_count,max_capacity', 'GET', null, userJwt)).body[0] || null

let testUserId = null
async function createTestUser() {
  const email = 'ct' + Date.now() + '@bmb.test'
  const password = 'Ct!' + Date.now() + 'Aa'
  const r = await rest('/auth/v1/admin/users', 'POST', { email, password, email_confirm: true })
  if (!r.body || !r.body.id) throw new Error('create test user failed: ' + JSON.stringify(r.body).slice(0, 200))
  testUserId = r.body.id
  return { email, password }
}
async function deleteTestUser() {
  if (testUserId) { try { await rest('/auth/v1/admin/users/' + testUserId, 'DELETE') } catch {} }
}

async function waitPort(port, ms) {
  const start = Date.now()
  while (Date.now() - start < ms) {
    try { const r = await fetch('http://127.0.0.1:' + port + '/'); if (r.ok) return true } catch {}
    await sleep(800)
  }
  return false
}

async function loginUser(page, email, password) {
  await page.goto(BASE + '/login', { waitUntil: 'commit', timeout: 45000 })
  await page.waitForSelector('input[type="email"]', { timeout: 15000 })
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 30000 }).catch(() => {})
  // capture the REAL customer JWT (supabase-js localStorage session) —
  // DB asserts run under the customer's own RLS (service_role has no table grants here)
  userJwt = await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) {
      if (k.includes('auth-token')) {
        try { const v = JSON.parse(localStorage.getItem(k)); if (v && v.access_token) return v.access_token } catch {}
      }
    }
    return null
  })
  if (!userJwt) throw new Error('could not capture customer JWT from localStorage after login')
}

// REAL UI purchase flow (same-day): menu → cart → checkout → payment → tracking
const todayICT = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' })
const nowICT = () => new Date().toLocaleTimeString('sv-SE', { timeZone: 'Asia/Bangkok' })
const LOCAL_CTR = 'supabase_db_ivkdfognyiwjcmrhcnwz'
async function pickOpenRound(page) {
  const today = todayICT()
  const read = async () => {
    const res = await rest('/rest/v1/delivery_rounds?scheduled_date=eq.' + today + '&select=id,cutoff_time,status,current_count,max_capacity', 'GET', null, userJwt)
    return Array.isArray(res.body) ? res.body : []
  }
  let rounds = await read()
  let open = rounds.filter((r) => r.status === 'active' && String(r.cutoff_time).slice(0, 8) > nowICT())
  if (open.length === 0) {
    // local-only fallback (documented): the gate must be runnable at any hour —
    // widen TODAY's cutoffs via local psql (no role holds UPDATE on
    // delivery_rounds over REST in the hardened grants lineage)
    spawnSync('docker', ['exec', LOCAL_CTR, 'psql', '-U', 'postgres', '-d', 'postgres', '-c',
      "update delivery_rounds set cutoff_time = '23:59' where scheduled_date = '" + today + "'"], { encoding: 'utf8' })
    await sleep(1200)
    rounds = await read()
    open = rounds.filter((r) => r.status === 'active')
  }
  if (!open.length) throw new Error('no bookable round for today even after widening cutoffs')
  open.sort((a, b) => (String(a.cutoff_time) < String(b.cutoff_time) ? -1 : 1))
  const chosen = open[0]
  await page.check('input[name="round"][value="' + chosen.id + '"]')
  return chosen.id
}

async function createSameDayOrderViaUI(page) {
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 45000 })
  await page.click('[data-testid="home-menu-cta"]')
  await page.waitForSelector('[data-testid="same-day-tab"]', { timeout: 15000 })
  await page.waitForSelector('[data-testid="same-day-order"]', { timeout: 15000 })
  await page.click('[data-testid="same-day-order"] >> nth=0')
  try { await page.waitForSelector('[data-testid="ob-confirm"]', { timeout: 8000 }) } catch {}
  if (await page.locator('[data-testid="ob-confirm"]').count() > 0) {
    await page.click('[data-testid="ob-confirm"]')
    await sleep(400)
  }
  await page.click('a[href="/cart"]')
  await page.waitForSelector('[data-testid="go-checkout"]', { timeout: 15000 })
  await page.click('[data-testid="go-checkout"]')
  await page.waitForSelector('[data-testid="checkout-address"]', { timeout: 15000 })
  await page.fill('[data-testid="checkout-address"]', '999 ClickThrough Rd (local e2e)')
  // round picker must list at least one active round (UI auto-selects the first) —
  // the rounds effect is async (ensure RPC + REST), so WAIT, don't count instantly.
  await page.waitForSelector('input[name="round"]', { timeout: 20000 })
  // the UI lists every active round regardless of cutoff; the SERVER rejects a
  // closed round (ERR_ROUND_CLOSED) → pick a round that is genuinely still open
  const chosenRoundId = await pickOpenRound(page)
  await page.waitForSelector('[data-testid="place-order"]:not([disabled])', { timeout: 10000 })
  await page.click('[data-testid="place-order"]')
  await page.waitForURL(/\/payment\//, { timeout: 30000 })
  await sleep(2000)
  await page.waitForSelector('[data-testid="txn-input"]', { timeout: 15000 })
  await page.fill('[data-testid="txn-input"]', '15160001' + String(Date.now()).slice(-8))
  await page.click('[data-testid="confirm-payment"]')
  await page.waitForURL(/\/track\//, { timeout: 30000 })
  await page.waitForSelector('[data-testid="track-order-number"]', { timeout: 15000 })
  const badge = (await page.locator('[data-testid="track-order-number"]').textContent()).trim()
  return badge.replace(/^#/, '')
}

const steps = []
const errors = []
function record(name, ok, extra) {
  steps.push({ name, ok, extra: extra ?? null })
  console.log((ok ? 'check' : 'XMARK') + ' ' + name + (extra ? ' ' + JSON.stringify(extra) : ''))
}

let child = null
let browser = null
let pageRef = null
;(async () => {
  try {
    ENV.API_URL = await resolveApiUrl(ENV)
    console.log('local supabase API resolved: ' + ENV.API_URL)
    child = spawn('node', ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], {
      cwd: PROJ,
      env: { ...process.env, VITE_SUPABASE_URL: ENV.API_URL, VITE_SUPABASE_ANON_KEY: ENV.ANON_KEY },
      stdio: 'ignore', windowsHide: true,
    })
    if (!await waitPort(PORT, 60000)) throw new Error('vite dev did not start')
    console.log('vite dev on ' + BASE + ' | supabase: ' + ENV.API_URL)

    try { browser = await chromium.launch({ channel: 'chrome', headless: true }) }
    catch { browser = await chromium.launch({ headless: true }) }

    const user = await createTestUser()
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })
    const page = await ctx.newPage()
    pageRef = page
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)) })
    page.on('pageerror', (e) => errors.push('pageerror:' + String(e).slice(0, 160)))

    await loginUser(page, user.email, user.password)
    record('real login via /login', true, { userId: testUserId })

    // ---------- ORDER 1 → CANCEL VIA TRACK PAGE ----------
    const n1 = await createSameDayOrderViaUI(page)
    await page.screenshot({ path: path.join(SHOTS, 'ct-01-track-order1.png') })
    const o1 = await getOrderRow(n1)
    record('UI order #1 created through the real checkout (SAME_DAY, pending)', !!o1 && o1.status === 'pending', { n1, mode: o1 && o1.order_mode })
    const r1before = await getRound(o1.delivery_round_id)

    await page.waitForSelector('[data-testid="track-cancel"]', { timeout: 10000 })
    await page.click('[data-testid="track-cancel"]')
    let toast1 = ''
    try {
      await page.waitForSelector('.toast', { timeout: 5000 })
      toast1 = (await page.locator('.toast').allTextContents()).join(' | ')
    } catch {}
    await page.screenshot({ path: path.join(SHOTS, 'ct-02-cancel-toast-track.png') })
    record('TRACK cancel click → success toast', /ยกเลิกออเดอร์สำเร็จ/.test(toast1), { toast1: toast1.slice(0, 80) })

    await page.waitForSelector('text=ออเดอร์นี้ถูกยกเลิกแล้ว', { timeout: 10000 })
    record('TRACK page renders cancelled state text', true)
    const o1b = await getOrderRow(n1)
    const r1after = await getRound(o1.delivery_round_id)
    record('DB status=cancelled + round capacity released (track surface)',
      o1b.status === 'cancelled' && r1after.current_count === r1before.current_count - 1,
      { status: o1b.status, capacity: r1before.current_count + '→' + r1after.current_count })
    record('TRACK cancel button hidden after cancel', (await page.locator('[data-testid="track-cancel"]').count()) === 0)
    await page.screenshot({ path: path.join(SHOTS, 'ct-03-track-cancelled.png') })

    // ---------- ORDER 2 → CANCEL VIA ORDERS PAGE ----------
    const n2 = await createSameDayOrderViaUI(page)
    const o2 = await getOrderRow(n2)
    record('UI order #2 created through the real checkout (SAME_DAY, pending)', !!o2 && o2.status === 'pending', { n2 })
    const r2before = await getRound(o2.delivery_round_id)

    await page.goto(BASE + '/orders', { waitUntil: 'networkidle', timeout: 45000 })
    await page.waitForSelector('[data-testid="orders-list"]', { timeout: 15000 })
    await page.waitForSelector('[data-testid="cancel-' + n2 + '"]', { timeout: 15000 })
    await page.screenshot({ path: path.join(SHOTS, 'ct-04-orders-list.png') })
    await page.click('[data-testid="cancel-' + n2 + '"]')
    let toast2 = ''
    try {
      await page.waitForSelector('.toast', { timeout: 5000 })
      toast2 = (await page.locator('.toast').allTextContents()).join(' | ')
    } catch {}
    await page.screenshot({ path: path.join(SHOTS, 'ct-05-cancel-toast-orders.png') })
    record('ORDERS cancel click → success toast', /ยกเลิกออเดอร์สำเร็จ/.test(toast2), { toast2: toast2.slice(0, 80) })

    await page.waitForSelector('[data-testid="cancel-' + n2 + '"]', { state: 'detached', timeout: 10000 }).catch(() => {})
    await sleep(800) // let the refetch settle
    const o2b = await getOrderRow(n2)
    const r2after = await getRound(o2.delivery_round_id)
    record('DB status=cancelled + round capacity released (orders surface)',
      o2b.status === 'cancelled' && r2after.current_count === r2before.current_count - 1,
      { status: o2b.status, capacity: r2before.current_count + '→' + r2after.current_count })
    record('ORDERS cancel button gone after cancel', (await page.locator('[data-testid="cancel-' + n2 + '"]').count()) === 0)
    const listText = await page.locator('[data-testid="orders-list"]').textContent()
    record('ORDERS row shows ยกเลิก status label', /ยกเลิก/.test(listText))
    await page.screenshot({ path: path.join(SHOTS, 'ct-06-orders-cancelled.png') })

    const result = {
      timestamp: new Date().toISOString(), base: BASE, supabase: ENV.API_URL, orders: [n1, n2],
      steps, consoleErrors: errors, pass: steps.every((s) => s.ok),
    }
    fs.writeFileSync(OUT, JSON.stringify(result, null, 2), 'utf8')
    console.log('\nCLICK-THROUGH PASS = ' + result.pass + ' | steps = ' + steps.length + ' | console errors = ' + errors.length + ' → ' + OUT)
    process.exitCode = result.pass ? 0 : 1
  } catch (e) {
    console.log('\nCLICK-THROUGH ERROR: ' + String(e).slice(0, 1500))
    try {
      if (pageRef) {
        console.log('CURRENT URL: ' + pageRef.url())
        const bt = await pageRef.locator('body').textContent()
        console.log('BODY SNIP: ' + String(bt).replace(/\s+/g, ' ').slice(0, 300))
        console.log('CONSOLE ERRORS SO FAR: ' + JSON.stringify(errors.slice(-5)))
        await pageRef.screenshot({ path: path.join(SHOTS, 'ct-fatal.png') })
      }
    } catch {}
    fs.writeFileSync(OUT, JSON.stringify({ timestamp: new Date().toISOString(), steps, consoleErrors: errors, pass: false, fatal: String(e).slice(0, 500) }, null, 2), 'utf8')
    process.exitCode = 1
  } finally {
    await deleteTestUser()
    try { if (browser) await browser.close() } catch {}
    if (child) { try { execSync('taskkill /pid ' + child.pid + ' /t /f', { stdio: 'ignore' }) } catch {} }
  }
})()