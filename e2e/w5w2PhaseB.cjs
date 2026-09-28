'use strict'
// ============================================
// W5-2 Phase B — ADMIN-SIDE LIFECYCLE E2E (Owner-approved OPTION A)
// Temp-promote QA identity → admin, walk canonical lifecycle, REVOKE.
// Canonical paths ONLY: transition_order_status / upsert_driver / assign_driver /
// driver_accept_assignment / driver_update_delivery_status / create-checkout EF.
// Management API = READ-ONLY verification, except the Owner-approved promote/revoke.
// Evidence: e2e/w5w2-test-order.json (merged) + screenshots.
// ============================================
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const PROJ = 'D:/A PROJECT/Bite Me Baby'
const env = fs.readFileSync(path.join(PROJ, '.env'), 'utf8')
const get = (k) => { const m = env.match(new RegExp('^' + k + '=(.*)$', 'm')); return m ? m[1].trim() : '' }
const SUPA = get('VITE_SUPABASE_URL').replace(/\/$/, '')
const ANON = get('VITE_SUPABASE_ANON_KEY')
const TOKEN = get('SUPABASE_ACCESS_TOKEN') || process.env.SUPABASE_ACCESS_TOKEN || ''
const OUT = path.join(PROJ, 'e2e', 'w5w2-test-order.json')
const SHOTS = path.join(PROJ, 'e2e', 'screenshots')
fs.mkdirSync(SHOTS, { recursive: true })
const arg = (n) => { const i = process.argv.indexOf('--' + n); return i >= 0 ? process.argv[i + 1] : null }
const QA = {
  name: 'QA W52',
  phone: arg('phone') || '+66990000003',
  local: '0990000003',
  email: '',
  latitude: Number(get('VITE_DELIVERY_KITCHEN_LAT') || '10.7016') + 0.0015,
  longitude: Number(get('VITE_DELIVERY_KITCHEN_LNG') || '102.1429') + 0.0015,
  address_detail: 'QA TEST ADDRESS (W5-2) — TEST DATA ONLY',
}
QA.local = '0' + QA.phone.replace('+66', '')
const ORDER = arg('order') || 'PO-20260929-131'
const DRIVER = { name: 'QA W52 Driver', phone: '+66990000100', vehicle: 'QA TEST VEHICLE' }
const HEAD = execSync('git rev-parse --short HEAD', { cwd: PROJ }).toString().trim()
const BASE = arg('base') || 'http://127.0.0.1:4517'

const ev = {
  phase: 'B', timestamp: new Date().toISOString(), environment: 'production', ref: 'ivkdfognyiwjcmrhcnwz', HEAD,
  test_data: { order: ORDER, phone: QA.phone, driver_phone: DRIVER.phone },
  lifecycle: {}, admin_promotion: {}, payment_guard: {}, cleanup: {},
}
function stage(name, obj) { ev[name] = obj; console.log('[' + name + '] ' + JSON.stringify(obj).slice(0, 260)) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
// transient-safe fetch (retries idempotent reads/RPCs)
const _fetch = globalThis.fetch
globalThis.fetch = async (u, i) => {
  let last
  for (let a = 0; a < 4; a++) { try { return await _fetch(u, i) } catch (e) { last = e; if (a === 3) break; await sleep(1500 * (a + 1)) } }
  throw last
}
// guaranteed revoke even on fatal error
let REVOKE_SAFE = null

async function q(sql) {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const b = await r.text()
  if (!r.ok) throw new Error('MGMT ' + r.status + ' ' + b.slice(0, 200))
  return JSON.parse(b)
}
async function rest(p, method, jwt, body) {
  const r = await fetch(`${SUPA}/rest/v1/${p}`, {
    method: method || 'GET',
    headers: { apikey: ANON, Authorization: 'Bearer ' + (jwt || ANON), 'content-type': 'application/json', Prefer: 'return=representation' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const t = await r.text(); let d = null; try { d = JSON.parse(t) } catch {}
  return { status: r.status, data: d, body: t.slice(0, 300) }
}
async function qaLogin() {
  const r = await fetch(`${SUPA}/functions/v1/phone-auto-login`, {
    method: 'POST',
    headers: { apikey: ANON, 'content-type': 'application/json' },
    body: JSON.stringify({ name: QA.name, phone: QA.phone, latitude: QA.latitude, longitude: QA.longitude, address_detail: QA.address_detail }),
  })
  const data = await r.json()
  const tok = data.session?.access_token || data.access_token
  if (!tok) throw new Error('qa login failed: ' + JSON.stringify(data).slice(0, 300))
  return { jwt: tok, uid: (data.user?.id || data.session?.user?.id || '') }
}
async function orderRow() {
  const rows = await q(`select status, payment_status, order_mode, scheduled_date, delivery_round_id, total_amount from public.orders where order_number = '${ORDER}'`)
  return rows[0]
}
async function history() {
  return q(`select from_status, to_status, actor_type, actor_id from public.order_status_history where order_number='${ORDER}' order by changed_at`)
}
async function audits() {
  return q(`select action, entity_type, entity_id, metadata, created_at from public.audit_logs where entity_id='${ORDER}' or (metadata::text like '%${ORDER}%') order by created_at`)
}
async function trans(jwt, status) {
  const r = await rest('rpc/transition_order_status', 'POST', jwt, { p_order_number: ORDER, p_new_status: status })
  return r
}
// ---- promote / revoke admin (Owner-approved temporary; Management API admin op) ----
async function promoteAdmin(uid) {
  const before = await q(`select role from public.profiles where id='${uid}'`)
  const priorRole = before.length ? before[0].role : null
  const t0 = Date.now()
  await q(`INSERT INTO public.profiles (id, phone, name, role, created_at, updated_at)
           VALUES ('${uid}','${QA.phone}','${QA.name}','admin',now(),now())
           ON CONFLICT (id) DO UPDATE SET role='admin', updated_at=now()`)
  const after = await q(`select role from public.profiles where id='${uid}'`)
  const promoted = after[0] && after[0].role === 'admin'
  const meta = { prior_role: priorRole, now_role: after[0]?.role, promoted, ms: Date.now() - t0 }
  ev.admin_promotion.promote = meta
  console.log('[promote] ' + JSON.stringify(meta))
  return { priorRole }
}
async function revokeAdmin(uid, priorRole) {
  const t0 = Date.now()
  if (priorRole == null) {
    await q(`DELETE FROM public.profiles WHERE id='${uid}'`)
  } else {
    await q(`UPDATE public.profiles SET role='${priorRole}', updated_at=now() WHERE id='${uid}'`)
  }
  const after = await q(`select id, role from public.profiles where id='${uid}'`)
  ev.admin_promotion.revoke = { prior_role: priorRole, now: after[0] || null, ms: Date.now() - t0 }
  console.log('[revoke] ' + JSON.stringify(ev.admin_promotion.revoke))
}

// ---- tracking verify ----
async function trackingDelivered() {
  const t1 = await rest('rpc/track_order', 'POST', ANON, { p_order_number: ORDER, p_phone: QA.phone })
  const ok = t1.data && t1.data.found === true && t1.data.order && t1.data.order.status === 'delivered'
  let ui = null
  try {
    const { chromium } = require('playwright')
    const browser = await chromium.launch({ channel: 'chrome', headless: true })
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    await page.goto(`${BASE}/track/${ORDER}`, { waitUntil: 'networkidle', timeout: 45000 })
    await page.fill('[data-testid="track-phone-input"]', QA.local)
    await page.click('[data-testid="track-phone-submit"]')
    await page.waitForSelector('[data-testid="track-order-number"]', { timeout: 20000 })
    await page.screenshot({ path: path.join(SHOTS, 'w5w2-track-delivered.png') })
    const txt = await page.locator('body').textContent()
    const noPii = !/QA W52|TEST ADDRESS|dropoff|latitude|longitude/.test(txt)
    const st = await page.locator('[data-testid="track-status"]').textContent()
    ui = { found: true, delivered_ui: /delivered|จัดส่ง|รับแล้ว/i.test(st) || /delivered|จัดส่ง/i.test(txt), no_pii: noPii }
    await browser.close()
  } catch (e) { ui = { error: String(e).slice(0, 200) } }
  stage('tracking_delivered', { PASS: ok && ui && ui.found, rpc: t1.data && { status: t1.data.order && t1.data.order.status, payment_status: t1.data.order && t1.data.order.payment_status }, response_fields: t1.data && t1.data.order ? Object.keys(t1.data.order) : null, ui })
  return ok
}
// ============ MAIN (Part 1) ============
;(async () => {
  const log = {}
  try {
    const { jwt, uid } = await qaLogin()
    ev.qa_uid = uid
    const { priorRole } = await promoteAdmin(uid)
    REVOKE_SAFE = { uid, priorRole }
    try {
      const adminRead = await rest('orders?order_number=eq.' + ORDER + '&select=order_number,status,payment_status,customer_name', 'GET', jwt)
    ev.lifecycle.admin_visibility_pre = { status: adminRead.status, rows: adminRead.data }

    // --- KITCHEN: pending -> confirmed -> preparing -> ready_for_dispatch ---
    for (const st of ['confirmed', 'preparing', 'ready_for_dispatch']) {
      const r = await trans(jwt, st)
      const row = await orderRow()
      const h = await history()
      log[st] = { resp: r.status + ' ' + r.body, order_status: row && row.status, history_len: h.length }
    }

    // --- ASSIGNMENT (canonical admin path) ---
    const dup = await rest('rpc/upsert_driver', 'POST', jwt, { p_name: DRIVER.name, p_phone: DRIVER.phone, p_vehicle_label: DRIVER.vehicle })
    ev.lifecycle.driver_upsert = { status: dup.status, body: dup.body }
    const driverId = dup.data && dup.data.driver_id
    const add = await rest('rpc/assign_driver', 'POST', jwt, { p_order_number: ORDER, p_driver_id: driverId })
    ev.lifecycle.assignment = { status: add.status, body: add.body, driver_id: driverId }
    const daAfter = await q(`select id, order_number, driver_id, status, assigned_at from public.delivery_assignments where order_number='${ORDER}'`)
    const drvRow = await q(`select id, phone, status from public.drivers where id='${driverId}'`)
    ev.lifecycle.assignment_rows = { delivery_assignments: daAfter, driver: drvRow }

    // --- OUT_FOR_DELIVERY + RIDER hops ---
    const ofd = await trans(jwt, 'dispatched')
    log['ofd(dispatched)'] = { resp: ofd.status + ' ' + ofd.body, order_status: (await orderRow()).status }
    const accept = await rest('rpc/driver_accept_assignment', 'POST', jwt, { p_order_number: ORDER, p_driver_phone: DRIVER.phone })
    log.driver_accept = { status: accept.status, body: accept.body }
    const pu = await rest('rpc/driver_update_delivery_status', 'POST', jwt, { p_order_number: ORDER, p_driver_phone: DRIVER.phone, p_status: 'picked_up' })
    log.driver_picked_up = { status: pu.status, body: pu.body }
    const it = await trans(jwt, 'in_transit')
    log.order_in_transit = { resp: it.status + ' ' + it.body }
    const din = await rest('rpc/driver_update_delivery_status', 'POST', jwt, { p_order_number: ORDER, p_driver_phone: DRIVER.phone, p_status: 'in_transit' })
    log.driver_in_transit = { status: din.status, body: din.body }
    const arr = await trans(jwt, 'arrived')
    log.order_arrived = { resp: arr.status + ' ' + arr.body }
    const del = await trans(jwt, 'delivered')
    log.order_delivered = { resp: del.status + ' ' + del.body }
    const ddel = await rest('rpc/driver_update_delivery_status', 'POST', jwt, { p_order_number: ORDER, p_driver_phone: DRIVER.phone, p_status: 'delivered' })
    log.driver_delivered = { status: ddel.status, body: ddel.body }
    ev.lifecycle.raw_log = log
// --- POST-DELIVERED verification ---
    const row = await orderRow()
    const h = await history()
    const au = await audits()
    const notifs = await q(`select notification_type, count(*) as n from public.notifications where message like '%${ORDER}%' group by notification_type order by notification_type`)
    const daF = await q(`select row_to_json(d) from (select * from public.delivery_assignments where order_number='${ORDER}') d`)
    const drvF = await q(`select id, status from public.drivers where id='${driverId}'`)
    const adminReadF = await rest('orders?order_number=eq.' + ORDER + '&select=order_number,status,payment_status', 'GET', jwt)
    const deliveredOk = row && row.status === 'delivered' && row.payment_status === 'paid'
    ev.lifecycle.post_delivered = { PASS: deliveredOk, order: row, history: h, audit: au, notifications: notifs, delivery_assignment: daF, driver: drvF, admin_visibility: adminReadF.data }

    // --- IDEMPOTENCY / DUPLICATE SAFETY ---
    const hLenBefore = h.length
    const againDelivered = await trans(jwt, 'delivered')
    const hAfterSame = (await history()).length
    const bad = await trans(jwt, 'confirmed')
    const hAfterBad = (await history()).length
    const reAssign = await rest('rpc/assign_driver', 'POST', jwt, { p_order_number: ORDER, p_driver_id: driverId })
    const daCountRe = await q(`select count(*) as c from public.delivery_assignments where order_number='${ORDER}'`)
    const dupDriverDeliver = await rest('rpc/driver_update_delivery_status', 'POST', jwt, { p_order_number: ORDER, p_driver_phone: DRIVER.phone, p_status: 'delivered' })
    stage('idempotency', {
      same_state_delivered: { resp: againDelivered.status + ' ' + againDelivered.body, history_unchanged: hLenBefore === hAfterSame },
      invalid_delivered_to_confirmed: { resp: bad.status + ' ' + bad.body, history_unchanged: hLenBefore === hAfterBad },
      reassign_still_single_row: { resp: reAssign.status + ' ' + reAssign.body, assignment_count: daCountRe[0] && daCountRe[0].c },
      duplicate_deliver_rider: { resp: dupDriverDeliver.status + ' ' + dupDriverDeliver.body },
    })
// --- PAYMENT GUARD RUNTIME (a): create-checkout on delivered/paid order → 409 ---
    const coR = await fetch(`${SUPA}/functions/v1/create-checkout`, {
      method: 'POST',
      headers: { apikey: ANON, Authorization: 'Bearer ' + jwt, 'content-type': 'application/json' },
      body: JSON.stringify({ order_number: ORDER }),
    })
    const coBody = await coR.json()

    // --- PAYMENT GUARD RUNTIME (b): single-open-PI reuse on a fresh pending order ---
    const today = new Date().toISOString().slice(0, 10)
    const rnd = 'round-' + today.replace(/-/g, '') + '-morning'
    await rest('rpc/ensure_rounds_for_date', 'POST', jwt, { p_date: today })
    const qbRes = await rest('rpc/create_order_with_items', 'POST', jwt, {
      p_items: [{ product_id: 'prod-5', quantity: 1, options: {}, special_request: 'W5-2 GUARD QA' }],
      p_delivery_round_id: rnd, p_delivery_method: 'self_delivery', p_delivery_address: QA.address_detail,
      p_dropoff_latitude: QA.latitude, p_dropoff_longitude: QA.longitude,
      p_customer_name: QA.name, p_customer_phone: QA.phone,
      p_payment_method: 'credit_card', p_order_mode: 'SAME_DAY', p_scheduled_date: today,
    })
    const qbNumber = qbRes.data && qbRes.data.order_number
    const cof = (n) => fetch(`${SUPA}/functions/v1/create-checkout`, { method: 'POST', headers: { apikey: ANON, Authorization: 'Bearer ' + jwt, 'content-type': 'application/json' }, body: JSON.stringify({ order_number: n }) }).then((r) => r.json())
    const c1 = await cof(qbNumber)
    const c2 = await cof(qbNumber)
    const samePi = !!(c1.payment_intent_id && c1.payment_intent_id === c2.payment_intent_id)
    stage('payment_guard', {
      a_already_paid: { status: coR.status, body: coBody },
      b_reuse_same_pi: { first_pi: c1.payment_intent_id, second_pi: c2.payment_intent_id, same: samePi, first_reused: c1.reused || false, second_reused: c2.reused || false },
      fresh_order: qbNumber,
    })
    const cancelQb = await rest('rpc/transition_order_status', 'POST', jwt, { p_order_number: qbNumber, p_new_status: 'cancelled' })
    ev.payment_guard.close_fresh_order = { order: qbNumber, cancel_resp: cancelQb.status + ' ' + cancelQb.body }

    // --- REVOKE (immediately after) + boundary ---
    await revokeAdmin(uid, priorRole)
    const revokeProbe = await rest('rpc/assign_driver', 'POST', jwt, { p_order_number: ORDER, p_driver_id: driverId || 'x' })
    ev.admin_promotion.post_revoke_boundary = { assign_driver: { status: revokeProbe.status, body: revokeProbe.body } }

    await trackingDelivered()
      fs.writeFileSync(OUT, JSON.stringify(ev, null, 2), 'utf8')
      console.log('\nPHASE B DONE → ' + OUT)
      console.log('ORDER=' + ORDER + ' status=' + (row ? row.status : '?') + ' payment=' + (row ? row.payment_status : '?'))
      console.log('history_rows=' + h.length + ' · audit_rows=' + au.length)
      process.exit(0)
    } catch (innerErr) {
      // guaranteed revoke (best-effort) before surfacing
      if (REVOKE_SAFE) { try { await revokeAdmin(REVOKE_SAFE.uid, REVOKE_SAFE.priorRole) } catch (re) { console.error('revoke-fail', String(re).slice(0, 120)) } }
      throw innerErr
    }
  } catch (e) {
    ev.fatal = String(e).slice(0, 700)
    fs.writeFileSync(OUT, JSON.stringify(ev, null, 2), 'utf8')
    console.error('\nPHASE B STOPPED:', ev.fatal)
    process.exit(1)
  }
})()