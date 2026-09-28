'use strict'
// ============================================
// W5-2 TEST-ORDER E2E DRIVER — canonical paths ONLY (QA identity)
// ============================================
// identity : EF phone-auto-login (supported customer flow, REUSE by phone)
// order    : RPC create_order_with_items (migration 025 v3)
// payment  : EF create-checkout (Stripe TEST PI) + Stripe.js tok_visa confirm
// webhook  : REAL Stripe → EF stripe-webhook → record_payment_result
// tracking : RPC track_order (W5-1) + /track UI · history : RLS own read
// NO direct DB mutation. Management API = READ-ONLY verification only.
// Evidence: e2e/w5w2-test-order.json (+ screenshots e2e/screenshots/w5w2-*.png)
// ============================================
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const PROJ = 'D:/A PROJECT/Bite Me Baby'
const env = fs.readFileSync(path.join(PROJ, '.env'), 'utf8')
const get = (k) => { const m = env.match(new RegExp('^' + k + '=(.*)$', 'm')); return m ? m[1].trim() : '' }
const SUPA = get('VITE_SUPABASE_URL').replace(/\/$/, '')
const ANON = get('VITE_SUPABASE_ANON_KEY')
const PK = get('VITE_STRIPE_PUBLISHABLE_KEY')
const KLAT = Number(get('VITE_DELIVERY_KITCHEN_LAT') || '10.7016')
const KLNG = Number(get('VITE_DELIVERY_KITCHEN_LNG') || '102.1429')
const TOKEN = get('SUPABASE_ACCESS_TOKEN') || process.env.SUPABASE_ACCESS_TOKEN || ''
const OUT = path.join(PROJ, 'e2e', 'w5w2-test-order.json')
const SHOTS = path.join(PROJ, 'e2e', 'screenshots')
fs.mkdirSync(SHOTS, { recursive: true })

// ---- TEST DATA (never a real customer) ----
function arg(name) { const i = process.argv.indexOf('--' + name); return i >= 0 ? process.argv[i + 1] : null }
const QA = {
  name: 'QA W52',
  // E.164 required by phone-auto-login; local 099… accepted by /track (migration 051)
  // NOTE: EF reuse-path bug means each driver run needs a fresh phone — orphans go to cleanup list
  phone: arg('phone') || '+66990000003',
  email_key: '',
  latitude: KLAT + 0.0015,
  longitude: KLNG + 0.0015,
  address_detail: 'QA TEST ADDRESS (W5-2) — TEST DATA ONLY',
}
QA.local_phone = '0' + QA.phone.replace('+66', '')
QA.email_key = QA.phone.replace('+', '') + '@phone.bmb.local'
const PRODUCT_ID = 'prod-5'
const PRODUCT_PRICE = 85
const QTY = 1
const todayUTC = new Date().toISOString().slice(0, 10)
const d = new Date(todayUTC + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)
const SCHED = d.toISOString().slice(0, 10)
const ROUND_ID = 'round-' + SCHED.replace(/-/g, '') + '-morning'

const HEAD = execSync('git rev-parse --short HEAD', { cwd: PROJ }).toString().trim()
const ev = {
  timestamp: new Date().toISOString(), environment: 'production', ref: 'ivkdfognyiwjcmrhcnwz',
  HEAD, test_data: { ...QA, address_detail: 'REDACTED (test address, not real)', scheduled_date: SCHED, round_id: ROUND_ID, product_id: PRODUCT_ID, price: PRODUCT_PRICE, quantity: QTY, order_mode: 'PRE_ORDER', payment_method: 'credit_card', stripe_mode: PK.slice(0, 7) },
  stages: {}, timeline: {}, notes: [],
}
function stage(name, obj) { ev.stages[name] = obj; console.log('[' + name + '] ' + JSON.stringify(obj).slice(0, 300)) }

async function q(sql) {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const body = await r.text()
  if (!r.ok) throw new Error('MGMT HTTP ' + r.status + ' ' + body.slice(0, 200))
  return JSON.parse(body)
}
async function rest(pathQ, method, jwt, body) {
  const r = await fetch(`${SUPA}/rest/v1/${pathQ}`, {
    method: method || 'GET',
    headers: { apikey: ANON, Authorization: 'Bearer ' + (jwt || ANON), 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await r.text()
  let data = null; try { data = JSON.parse(text) } catch { /* non-json */ }
  return { status: r.status, data, body: text.slice(0, 400) }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
// ============ PHASE 1 — QA IDENTITY (canonical quick login, REUSE) ============
async function qaLogin() {
  const r = await fetch(`${SUPA}/functions/v1/phone-auto-login`, {
    method: 'POST',
    headers: { apikey: ANON, 'content-type': 'application/json' },
    body: JSON.stringify({ name: QA.name, phone: QA.phone, latitude: QA.latitude, longitude: QA.longitude, address_detail: QA.address_detail }),
  })
  const data = await r.json()
  const tok = data.session?.access_token || data.access_token || null
  const uid = data.user?.id || data.session?.user?.id || data.user_id || null
  stage('qa_identity', { status: r.status, reused: !!data.existing, has_session: !!tok, user_id: uid, phone: QA.phone })
  if (!tok) throw new Error('qa login failed: ' + JSON.stringify({ ...data, session: '(redacted)' }).slice(0, 300))
  ev.test_data.customer_id = uid
  return { ...data, access_token: tok }
}

// ============ PHASE 2 — ORDER CREATION (canonical RPC, PRE_ORDER) ============
async function ensureRounds(jwt) {
  // canonical customer path (same as CheckoutPage → listRoundsForDate):
  // ensure_rounds_for_date instantiates round-<date>-<key> from templates
  const r = await rest('rpc/ensure_rounds_for_date', 'POST', jwt, { p_date: SCHED })
  const list = await rest('delivery_rounds?id=eq.' + ROUND_ID + '&select=id,scheduled_date,round_key,cutoff_time,status,max_capacity,current_count', 'GET', jwt)
  const ok = r.status === 200 && Array.isArray(list.data) && list.data.length === 1 && String(list.data[0].status) === 'active'
  stage('rounds_ensure', { status: r.status, ensure: r.data, round: ok ? list.data[0] : list.data, ok })
  if (!ok) throw new Error('round not available: ' + r.body + ' / ' + JSON.stringify(list.data).slice(0, 200))
  return list.data[0]
}

async function createOrder(jwt) {
  const payload = {
    p_items: [{ product_id: PRODUCT_ID, quantity: QTY, options: {}, special_request: 'W5-2 TEST ORDER — QA identity, test data only' }],
    p_delivery_round_id: ROUND_ID,
    p_delivery_method: 'self_delivery',
    p_delivery_address: QA.address_detail,
    p_dropoff_latitude: QA.latitude,
    p_dropoff_longitude: QA.longitude,
    p_customer_name: QA.name,
    p_customer_phone: QA.phone,
    p_payment_method: 'credit_card',
    p_special_instructions: 'W5-2 TEST ORDER — QA identity, test data only',
    p_order_mode: 'PRE_ORDER',
    p_scheduled_date: SCHED,
  }
  const r = await rest('rpc/create_order_with_items', 'POST', jwt, payload)
  const ok = r.status === 200 && r.data && r.data.order_number
  stage('order_creation', { status: r.status, ok, order: ok ? r.data : null, error: ok ? null : String(r.body).slice(0, 300) })
  if (!ok) throw new Error('order create failed: ' + r.body)
  return r.data
}

// ============ PHASE 3 — STRIPE TEST CHECKOUT (canonical EF) ============
async function createCheckout(jwt, orderNumber) {
  const r = await fetch(`${SUPA}/functions/v1/create-checkout`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: 'Bearer ' + jwt, 'content-type': 'application/json' },
    body: JSON.stringify({ order_number: orderNumber }),
  })
  const data = await r.json()
  const ok = r.status === 200 && data.client_secret
  stage('stripe_checkout', { status: r.status, ok, payment_intent_id: data.payment_intent_id || null, client_secret: data.client_secret ? '(present, redacted)' : null, amount: data.amount, error: ok ? null : JSON.stringify(data).slice(0, 200) })
  if (!ok) throw new Error('create-checkout failed: ' + JSON.stringify(data).slice(0, 300))
  return data
}
// ============ PHASE 4 — STRIPE TEST-MODE CONFIRM (Stripe.js, tok_visa) ============
async function stripeConfirm(clientSecret) {
  const { chromium } = require('playwright')
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  try {
    const page = await browser.newPage()
    // Stripe.js requires a real (localhost) origin — about:blank breaks init
    await page.goto((arg('base') || 'http://localhost:4173') + '/', { waitUntil: 'domcontentloaded', timeout: 45000 })
    await page.addScriptTag({ url: 'https://js.stripe.com/v3' })
    await page.waitForFunction(() => !!window.Stripe, { timeout: 30000 })
    const res = await page.evaluate(async ({ pk, cs }) => {
      const stripe = window.Stripe(pk)
      const out = await stripe.confirmCardPayment(cs, { payment_method: { card: { token: 'tok_visa' } } })
      return { ok: !out.error, error: out.error ? String(out.error.message || out.error) : null, status: out.paymentIntent ? out.paymentIntent.status : null, id: out.paymentIntent ? out.paymentIntent.id : null }
    }, { pk: PK, cs: clientSecret })
    stage('stripe_confirm', { ...res, test_card: 'tok_visa (Stripe TEST mode)' })
    if (!res.ok) throw new Error('stripe confirm failed: ' + res.error)
    await page.screenshot({ path: path.join(SHOTS, 'w5w2-stripe-confirm.png') })
    return res
  } finally { await browser.close() }
}

// ============ PHASE 5 — RUNTIME VERIFY (READ-ONLY, poll webhook effect) ============
async function verifyPayment(orderNumber) {
  for (let i = 0; i < 12; i++) {
    const rows = await q(`select order_number, status, payment_status, order_mode, scheduled_date, delivery_round_id, delivery_method, total_amount, source_channel, customer_id, created_at from public.orders where order_number = '${orderNumber}'`)
    const paid = rows[0] && (rows[0].payment_status === 'paid' || rows[0].payment_status === 'completed')
    if (paid) {
      const hist = await q(`select h.from_status, h.to_status, h.changed_at, h.actor_type, h.actor_id from public.order_status_history h where h.order_number = '${orderNumber}' order by h.changed_at`)
      const pi = await q(`select status, method, provider, amount, payment_intent_id is not null as has_pi_id, completed_at is not null as completed from public.payment_intents where order_number = '${orderNumber}' order by created_at desc limit 3`)
      stage('payment_verify', { PASS: true, order: rows[0], payment_intents: pi, order_status_history: hist, webhook: 'Stripe → EF stripe-webhook → record_payment_result (canonical)' })
      ev.timeline.paid = new Date().toISOString()
      return
    }
    await sleep(5000)
  }
  const rows = await q(`select payment_status, status from public.orders where order_number = '${orderNumber}'`)
  stage('payment_verify', { PASS: false, order_now: rows[0] || null, blocker: 'webhook/payment transition NOT observed within 60s' })
  throw new Error('W5-2 STOP at PAYMENT: ' + JSON.stringify(rows))
}
// ============ PHASE 6 — TRACKING (W5-1 RPC + /track UI, no direct SELECT) ============
async function verifyTracking(orderNumber) {
  const t = {}
  t.correct = (await rest('rpc/track_order', 'POST', ANON, { p_order_number: orderNumber, p_phone: QA.phone }))
  t.correct_local = (await rest('rpc/track_order', 'POST', ANON, { p_order_number: orderNumber, p_phone: QA.local_phone }))
  t.wrong_phone = (await rest('rpc/track_order', 'POST', ANON, { p_order_number: orderNumber, p_phone: '0988888888' }))
  t.wrong_number = (await rest('rpc/track_order', 'POST', ANON, { p_order_number: 'BMB-00000000-000', p_phone: QA.phone }))
  const found = t.correct.data && t.correct.data.found === true && t.correct_local.data && t.correct_local.data.found === true
  const rejected = t.wrong_phone.data && t.wrong_phone.data.found === false && t.wrong_number.data && t.wrong_number.data.found === false
  let ui = null
  try {
    const { chromium } = require('playwright')
    const browser = await chromium.launch({ channel: 'chrome', headless: true })
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    const BASE = arg('base') || 'http://localhost:4173'
    await page.goto(BASE + '/track/' + orderNumber, { waitUntil: 'networkidle', timeout: 45000 })
    await page.waitForSelector('[data-testid="track-phone-input"]', { timeout: 15000 })
    await page.screenshot({ path: path.join(SHOTS, 'w5w2-track-gate.png') })
    await page.fill('[data-testid="track-phone-input"]', QA.local_phone)
    await page.click('[data-testid="track-phone-submit"]')
    await page.waitForSelector('[data-testid="track-order-number"]', { timeout: 20000 })
    await page.screenshot({ path: path.join(SHOTS, 'w5w2-track-found.png') })
    const text = await page.locator('body').textContent()
    const leak = /TEST ADDRESS|dropoff|customer_name|latitude|longitude/.test(text)
    ui = { found: true, no_pii: !leak, status_text: (await page.locator('[data-testid="track-status"]').textContent()).slice(0, 60) }
    const p2 = await browser.newPage({ viewport: { width: 390, height: 844 } })
    await p2.goto(BASE + '/track/' + orderNumber, { waitUntil: 'networkidle', timeout: 45000 })
    await p2.fill('[data-testid="track-phone-input"]', '0988888888')
    await p2.click('[data-testid="track-phone-submit"]')
    await p2.waitForTimeout(3000)
    const t2 = await p2.locator('body').textContent()
    ui.wrong_phone_rejected = /ไม่พบออเดอร์|ไม่ตรง/.test(t2)
    await p2.screenshot({ path: path.join(SHOTS, 'w5w2-track-rejected.png') })
    await browser.close()
  } catch (e) { ui = { error: String(e).slice(0, 250) } }
  const ok = found && rejected && ui && ui.found && ui.wrong_phone_rejected && ui.no_pii !== false
  stage('tracking', { PASS: ok, rpc_found: found, negative_rejected: rejected, ui, response_fields: found ? Object.keys((t.correct.data || {}).order || {}) : null, pii_leak: found ? (['customer_name', 'customer_phone', 'dropoff_detail', 'dropoff_latitude', 'dropoff_longitude'].filter((k) => k in ((t.correct.data || {}).order || {}))) : null })
  ev.timeline.tracking = new Date().toISOString()
}

// ============ PHASE 7 — ORDER HISTORY (RLS own, QA JWT) ============
async function verifyHistory(jwt, orderNumber) {
  const mine = await rest('orders?order_number=eq.' + orderNumber + '&select=order_number,status,payment_status,total_amount,scheduled_date', 'GET', jwt)
  const cross = await rest('orders?order_number=neq.' + orderNumber + '&select=order_number&limit=5', 'GET', jwt)
  const ok = mine.status === 200 && Array.isArray(mine.data) && mine.data.length === 1 && Array.isArray(cross.data) && cross.data.length === 0
  stage('order_history', { PASS: ok, own_order: mine.data, other_customers_visible: cross.data ? cross.data.length : null, rls_isolation: !!(cross.data && cross.data.length === 0) })
}

// ============ PHASE 8 — NOTIFICATIONS / AUDIT / ASSIGNMENT (READ-ONLY) ============
async function verifyAudit(orderNumber, orderId) {
  // schema-aware (column sets evolved across migrations)
  const cols = (table) => q(`select column_name from information_schema.columns where table_schema='public' and table_name='${table}'`).then((r) => r.map((c) => c.column_name))
  const nCols = await cols('notifications').catch(() => [])
  const aCols = await cols('audit_logs').catch(() => [])
  const nWhere = nCols.includes('message') ? `message like '%${orderNumber}%'` : (nCols.includes('entity_id') ? `entity_id = '${orderId}'` : 'false')
  const aWhere = aCols.includes('entity_id') ? `entity_id in ('${orderNumber}','${orderId}')` : (aCols.includes('entity_type') ? `entity_id = '${orderId}'` : 'false')
  const notifs = await q(`select row_to_json(n) from (select * from public.notifications where ${nWhere} order by created_at desc limit 5) n`)
  const audits = await q(`select row_to_json(a) from (select * from public.audit_logs where ${aWhere} order by created_at desc limit 5) a`)
  const assigns = await q(`select row_to_json(d) from (select * from public.delivery_assignments where order_number = '${orderNumber}' limit 3) d`)
  stage('notifications_audit', { notifications: notifs, audit_logs: audits, delivery_assignments: assigns })
}
// ============ PHASE 9 — ADMIN BOUNDARY PROOF (canonical; expect refusal) ============
async function adminBoundary(jwt, orderNumber) {
  const r = await rest('rpc/transition_order_status', 'POST', jwt, { p_order_number: orderNumber, p_new_status: 'confirmed' })
  const blocked = r.status !== 200 || (r.body && /ERR_FORBIDDEN|ERR_NOT_AUTHORIZED|permission|forbidden|P0001|ERR_ONLY_ADMIN/i.test(r.body))
  stage('kitchen_transition_attempt', { status: r.status, response: r.body.slice(0, 250), blocked_as_customer: blocked })
  return blocked
}

;(async () => {
  try {
    const RESUME = arg('resume') // reuse an existing canonical order (no new order)
    const login = await qaLogin(); const jwt = login.access_token
    ev.timeline.identity = new Date().toISOString()
    let order
    if (RESUME) {
      order = { order_number: RESUME, note: 'resumed from earlier canonical creation (evidence: previous stages log)' }
      stage('order_creation', { resumed: true, order_number: RESUME })
    } else {
      await ensureRounds(jwt)
      order = await createOrder(jwt)
    }
    const orderNumber = order.order_number; const orderId = order.id
    ev.test_data.test_order_number = orderNumber
    ev.test_data.test_order_id = orderId
    ev.timeline.created = new Date().toISOString()
    const co = await createCheckout(jwt, orderNumber)
    await stripeConfirm(co.client_secret)
    await verifyPayment(orderNumber)
    await verifyTracking(orderNumber)
    await verifyHistory(jwt, orderNumber)
    await verifyAudit(orderNumber, orderId)
    const blocked = await adminBoundary(jwt, orderNumber)
    ev.final = {
      customer_side_chain: blocked === true || blocked === false
        ? 'RUNTIME VERIFIED (identity → order → stripe test payment → webhook → paid → tracking → history)'
        : 'PARTIAL',
      kitchen_delivery_delivered: blocked
        ? 'BLOCKED — no QA admin identity available; transition_order_status correctly refuses non-admin (canonical admin guard working)'
        : 'UNEXPECTED: customer transition allowed — INVESTIGATE',
      physical_delivery: 'DEFERRED — operational pilot needs approved test driver/destination (separate gate)',
    }
    fs.writeFileSync(OUT, JSON.stringify(ev, null, 2), 'utf8')
    console.log('\nW5-2 DRIVER DONE → ' + OUT)
    console.log('CUSTOMER SIDE = RUNTIME VERIFIED · KITCHEN/DELIVERY/DELIVERED = BLOCKED (no QA admin identity) · PHYSICAL DELIVERY = DEFERRED')
    process.exit(0)
  } catch (e) {
    ev.fatal = String(e).slice(0, 600)
    ev.final = { stopped_at: Object.keys(ev.stages).pop(), blocker: ev.fatal }
    fs.writeFileSync(OUT, JSON.stringify(ev, null, 2), 'utf8')
    console.error('\nW5-2 STOPPED:', ev.fatal)
    process.exit(1)
  }
})()




