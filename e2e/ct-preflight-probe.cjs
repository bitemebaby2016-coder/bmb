'use strict'
// ============================================
// STEP 2 FINAL GATE — CT PREFLIGHT READ-ONLY PROBE
// Does NOT create/mutate anything. Confirms deployed EF state + inventories
// existing TEST data so controlled CTs can be scoped w/ cleanup plan.
// ============================================
const fs = require('fs')
const path = require('path')
const PROJ = 'D:/A PROJECT/Bite Me Baby'
const env = fs.readFileSync(path.join(PROJ, '.env'), 'utf8')
const get = (k) => { const m = env.match(new RegExp('^' + k + '=(.*)$', 'm')); return m ? m[1].trim() : '' }
const SUPA = (get('VITE_SUPABASE_URL') || 'https://ivkdfognyiwjcmrhcnwz.supabase.co').replace(/\/$/, '')
const ANON = get('VITE_SUPABASE_ANON_KEY')
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || ''
const REF = 'ivkdfognyiwjcmrhcnwz'
const OUT = path.join(PROJ, 'e2e', 'ct-preflight-probe.json')

async function main() {
  const ev = { step: 'CT PREFLIGHT', timestamp: new Date().toISOString(), env: 'production-db/tests-only', ref: REF, probes: {} }

  // 1) Deployed EF state (GET only; no side effects)
  for (const fn of ['stripe-webhook', 'stripe-refund', 'create-checkout', 'ai-proxy', 'phone-auto-login', 'automation-worker', 'daily-report']) {
    try {
      const r = await fetch(`${SUPA}/functions/v1/${fn}`, { method: 'GET', headers: { apikey: ANON } })
      ev.probes['GET /functions/v1/' + fn] = { status: r.status, body: (await r.text()).slice(0, 160) }
    } catch (e) { ev.probes['GET /functions/v1/' + fn] = { error: String(e).slice(0, 120) } }
  }

  // 2) Existing QA/test identity + data inventory (management API, read-only)
  async function q(sql) {
    const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
      method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: sql }),
    })
    const b = await r.text(); if (!r.ok) throw new Error('MGMT ' + r.status + ' ' + b.slice(0, 200)); return JSON.parse(b)
  }
  const inv = {}
  for (const [name, sql] of Object.entries({
    qa_orders: "select order_number,status,payment_status,payment_method,created_at from public.orders where customer_phone ~ '09[0-9]+' or customer_name like 'QA%' or customer_name like 'W2%' or customer_name like 'W52%' order by created_at desc limit 30",
    qa_payment_intents: "select id,order_number,status,amount,currency,method,provider,created_at from public.payment_intents order by created_at desc limit 30",
    qa_drivers: "select id,name,phone,status,user_id from public.drivers where phone like '09%' or name like 'QA%' order by created_at desc limit 20",
    qa_delivery_assignments: "select id,order_number,driver_id,status,assigned_at from public.delivery_assignments order by assigned_at desc limit 30",
    qa_rounds: "select id,status,date_id from public.delivery_rounds where id like 'round-%' order by id desc limit 20",
  })) {
    try { inv[name] = await q(sql) } catch (e) { inv[name] = { error: String(e).slice(0, 160) } }
  }
  ev.inventory = inv

  fs.writeFileSync(OUT, JSON.stringify(ev, null, 2), 'utf8')
  console.log('PREFLIGHT DONE -> ' + OUT)
  // concise summary
  for (const k of Object.keys(ev.probes)) console.log('PROBE', k, '::', JSON.stringify(ev.probes[k]).slice(0, 120))
  for (const k of Object.keys(inv)) console.log('INV', k, 'rows=', Array.isArray(inv[k]) ? inv[k].length : inv[k])
}
main().catch((e) => { console.error('FATAL', String(e).slice(0, 400)); process.exit(1) })