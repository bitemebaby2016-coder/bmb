'use strict'
// W5-2 payment-gard probe (b): single-open-PI reuse — NO admin, NO charges (confirm never called)
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const PROJ = 'D:/A PROJECT/Bite Me Baby'
const env = fs.readFileSync(path.join(PROJ, '.env'), 'utf8')
const get = (k) => { const m = env.match(new RegExp('^' + k + '=(.*)$', 'm')); return m ? m[1].trim() : '' }
const SUPA = get('VITE_SUPABASE_URL').replace(/\/$/, '')
const ANON = get('VITE_SUPABASE_ANON_KEY')
const TOKEN = get('SUPABASE_ACCESS_TOKEN') || process.env.SUPABASE_ACCESS_TOKEN || ''
const arg = (n) => { const i = process.argv.indexOf('--' + n); return i >= 0 ? process.argv[i + 1] : null }
const PHONE = arg('phone') || '+66990000003'
const LOCAL = '0' + PHONE.replace('+66', '')
const KLAT = Number(get('VITE_DELIVERY_KITCHEN_LAT') || '10.7016') + 0.0015
const KLNG = Number(get('VITE_DELIVERY_KITCHEN_LNG') || '102.1429') + 0.0015
const _fetch = globalThis.fetch
globalThis.fetch = async (u, i) => { let l; for (let a = 0; a < 5; a++) { try { return await _fetch(u, i) } catch (e) { l = e; await new Promise((r) => setTimeout(r, 2000)) } } throw l }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function q(sql) { const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: sql }) }); const b = await r.text(); if (!r.ok) throw new Error('M ' + r.status + ' ' + b.slice(0, 160)); return JSON.parse(b) }
async function rest(p, method, jwt, body) { const r = await fetch(`${SUPA}/rest/v1/${p}`, { method: method || 'GET', headers: { apikey: ANON, Authorization: 'Bearer ' + (jwt || ANON), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); const t = await r.text(); let d = null; try { d = JSON.parse(t) } catch {}; return { status: r.status, data: d, body: t.slice(0, 240) } }
const OUT = { timestamp: new Date().toISOString(), phone: PHONE, steps: {} }
async function login() { const r = await fetch(`${SUPA}/functions/v1/phone-auto-login`, { method: 'POST', headers: { apikey: ANON, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'QA W52', phone: PHONE, latitude: KLAT, longitude: KLNG, address_detail: 'QA TEST ADDRESS (W5-2)' }) }); const d = await r.json(); const tok = d.session?.access_token || d.access_token; if (!tok) throw new Error('login: ' + JSON.stringify(d).slice(0, 200)); return tok }
const cof = (jwt, n) => fetch(`${SUPA}/functions/v1/create-checkout`, { method: 'POST', headers: { apikey: ANON, Authorization: 'Bearer ' + jwt, 'content-type': 'application/json' }, body: JSON.stringify({ order_number: n }) }).then((r) => r.json())
;(async () => {
  try {
    const jwt = await login()
    const today = new Date().toISOString().slice(0, 10)
    const rnd = 'round-' + today.replace(/-/g, '') + '-morning'
    await rest('rpc/ensure_rounds_for_date', 'POST', jwt, { p_date: today })
    const create = await rest('rpc/create_order_with_items', 'POST', jwt, {
      p_items: [{ product_id: 'prod-5', quantity: 1, options: {}, special_request: 'W5-2 GUARD-R2 QA' }],
      p_delivery_round_id: rnd, p_delivery_method: 'self_delivery', p_delivery_address: 'QA TEST ADDRESS (W5-2)',
      p_dropoff_latitude: KLAT, p_dropoff_longitude: KLNG,
      p_customer_name: 'QA W52', p_customer_phone: PHONE,
      p_payment_method: 'credit_card', p_order_mode: 'SAME_DAY', p_scheduled_date: today,
    })
    const order = create.data && create.data.order_number
    OUT.steps.first_order = { status: create.status, order }
    if (!order) throw new Error('create order failed: ' + create.body)
    const c1 = await cof(jwt, order)
    await sleep(2000)
    const c2 = await cof(jwt, order)
    const rows = await q(`select id, status, payment_intent_id, client_secret is not null has_secret from public.payment_intents where order_number='${order}' order by created_at`)
    const same = !!(c1.payment_intent_id && c1.payment_intent_id === c2.payment_intent_id)
    OUT.steps.checkout = { c1: { pi: c1.payment_intent_id, reused: !!c1.reused }, c2: { pi: c2.payment_intent_id, reused: !!c2.reused }, same_pi: same, db_rows: rows }
    // owner-cancel (canonical, no admin)
    const cancel = await rest('rpc/transition_order_status', 'POST', jwt, { p_order_number: order, p_new_status: 'cancelled' })
    OUT.steps.cancel = { status: cancel.status, body: cancel.body }
    const verify = await q(`select status, payment_status from public.orders where order_number='${order}'`)
    OUT.steps.cancelled_state = verify
    OUT.pass = same && rows.length === 1 && !!rows[0].has_secret && verify[0] && verify[0].status === 'cancelled'
    console.log(JSON.stringify(OUT, null, 2))
    process.exit(OUT.pass ? 0 : 2)
  } catch (e) { console.error('PROBE', String(e).slice(0, 400)); process.exit(1) }
})()