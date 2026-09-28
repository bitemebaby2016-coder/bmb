'use strict'
// W5-2 BEFORE-SNAPSHOT — READ-ONLY (no business state change)
// Evidence: e2e/w5w2-before.json
// Snapshot: environment, HEAD, QA identity check, preorder products, rounds,
// business settings, payment config presence, order baseline.
// Secrets are NEVER written to the evidence file.
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const PROJ = 'D:/A PROJECT/Bite Me Baby'
const env = fs.readFileSync(path.join(PROJ, '.env'), 'utf8')
const get = (k) => { const m = env.match(new RegExp('^' + k + '=(.*)$', 'm')); return m ? m[1].trim() : '' }
const SUPA = get('VITE_SUPABASE_URL').replace(/\/$/, '')
const ANON = get('VITE_SUPABASE_ANON_KEY')
const TOKEN = get('SUPABASE_ACCESS_TOKEN') || process.env.SUPABASE_ACCESS_TOKEN || ''
const REF = 'ivkdfognyiwjcmrhcnwz'
const OUT = path.join(PROJ, 'e2e', 'w5w2-before.json')

const HEAD = execSync('git rev-parse --short HEAD', { cwd: PROJ }).toString().trim()
const out = { timestamp: new Date().toISOString(), environment: 'production', ref: REF, HEAD }

async function q(sql) {
  const r = await fetch('https://api.supabase.com/v1/projects/' + REF + '/database/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const body = await r.text()
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + body.slice(0, 300))
  return JSON.parse(body)
}
async function efProbe(name, method) {
  const r = await fetch(`${SUPA}/functions/v1/${name}`, {
    method,
    headers: { apikey: ANON, 'content-type': 'application/json' },
    body: method === 'POST' ? '{}' : undefined,
  })
  return { status: r.status, body: (await r.text()).slice(0, 140) }
}
async function main() {
  // QA identity check (REUSE-first) — READ-ONLY
  out.qa_identity = {
    test_phone: '0990000001',
    test_email_key: '0990000001@phone.bmb.local',
    existing_customers: await q("select c.id, c.user_id, c.full_name, c.phone from public.customers c where c.phone = '0990000001' or c.full_name like 'QA W52%'"),
  }
  // Test products (preorder-capable)
  out.test_products = await q("select id, name, price, is_available, is_preorder, available_preorder, prep_minutes from public.products where is_preorder = true order by sort_order limit 5")
  // Rounds: tomorrow and +2 (PRE_ORDER requires scheduled_date > today)
  out.rounds = await q("select id, scheduled_date, round_key, display_name, cutoff_time, status, max_capacity, current_count from public.delivery_rounds where scheduled_date >= (current_date + 1) order by scheduled_date, round_key limit 12")
  // Business settings (kitchen location + order policy)
  out.business_settings = await q("select key, value from public.business_settings where key in ('kitchen_location','order_policy','delivery_policy') limit 5")
  // Order baseline
  out.orders_baseline = (await q("select count(*) as total, sum(case when status='cancelled' then 1 else 0 end) as cancelled from public.orders"))[0]
  // Payment config presence (deployed EFs only — no secrets)
  out.payment_config = {
    stripe_publishable_mode: get('VITE_STRIPE_PUBLISHABLE_KEY').slice(0, 7),
    ef_create_checkout: await efProbe('create-checkout', 'GET'),
    ef_stripe_webhook: await efProbe('stripe-webhook', 'GET'),
    ef_phone_auto_login: await efProbe('phone-auto-login', 'POST'),
  }
  // Existing test artifacts (for REUSE / cleanup inventory)
  out.existing_test_artifacts = await q("select order_number, status, payment_status, created_at from public.orders where order_number like 'QA-%' or customer_name like 'QA %' order by created_at desc limit 10")
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8')
  console.log('SNAPSHOT → ' + OUT)
  console.log('HEAD=' + HEAD + ' · qa_customers=' + out.qa_identity.existing_customers.length
    + ' · preorder_products=' + out.test_products.length
    + ' · future_rounds=' + out.rounds.length
    + ' · orders_total=' + out.orders_baseline.total)
  for (const p of out.test_products) console.log('PRODUCT', p.id, p.name, p.price, 'preorder=' + p.is_preorder, 'avail_pre=' + p.available_preorder)
  for (const r of out.rounds) console.log('ROUND', r.id, r.scheduled_date, r.round_key, r.cutoff_time, r.status, r.current_count + '/' + r.max_capacity)
  console.log('EF create-checkout', JSON.stringify(out.payment_config.ef_create_checkout))
  console.log('EF stripe-webhook', JSON.stringify(out.payment_config.ef_stripe_webhook))
  console.log('EF phone-auto-login', JSON.stringify(out.payment_config.ef_phone_auto_login))
  console.log('EXISTING_QA_ARTIFACTS=' + out.existing_test_artifacts.length)
}
main().catch((e) => { console.error('FATAL', String(e).slice(0, 600)); process.exit(1) })
