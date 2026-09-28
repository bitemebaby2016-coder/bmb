'use strict'
// W5-0 PRODUCTION PRODUCT READINESS AUDIT — READ-ONLY probes (no mutations)
// Evidence: e2e/w5-prod-probes.json
const fs = require('fs')
const path = require('path')
const PROJ = 'D:/A PROJECT/Bite Me Baby'
// read .env for anon key (client publishable key)
const env = fs.readFileSync(path.join(PROJ, '.env'), 'utf8')
const get = (k) => { const m = env.match(new RegExp('^' + k + '=(.*)$', 'm')); return m ? m[1].trim() : '' }
const SUPA = get('VITE_SUPABASE_URL').replace(/\/$/, '')
const ANON = get('VITE_SUPABASE_ANON_KEY')
const OUT = path.join(PROJ, 'e2e', 'w5-prod-probes.json')
const ev = { timestamp: new Date().toISOString(), supa: SUPA, probes: [] }
async function rec(name, fn) {
  try { ev.probes.push({ name, ...(await fn()) }) }
  catch (e) { ev.probes.push({ name, fatal: String(e).slice(0, 200) }) }
}
async function main() {
  // 1. Edge functions (POST/GET no-op — expect auth-control responses, NOT 404)
  const fns = ['ai-proxy', 'stripe-webhook', 'create-checkout', 'stripe-refund', 'automation-worker', 'phone-auto-login', 'daily-report']
  for (const f of fns) {
    await rec('fn:' + f, async () => {
      const r = await fetch(`${SUPA}/functions/v1/${f}`, { method: 'POST', headers: { apikey: ANON, 'content-type': 'application/json' }, body: '{}' })
      return { status: r.status, body: (await r.text()).slice(0, 120) }
    })
  }
  // 2. REST anon reads (RLS behavior read-only)
  const tbls = ['products?select=id&limit=5', 'delivery_rounds?select=id,round_key,cutoff_time,max_capacity,current_count,status,date&order=date.desc&limit=5', 'orders?select=id,status&limit=3', 'pre_orders?select=id&limit=3', 'business_settings?select=key,value&limit=5', 'promotions?select=id,name,is_active&limit=5', 'order_status_history?select=id&limit=3', 'drivers?select=id,user_id&limit=3']
  for (const t of tbls) {
    const name = 'rest:' + t.split('?')[0]
    await rec(name, async () => {
      const r = await fetch(`${SUPA}/rest/v1/${t}`, { headers: { apikey: ANON, Authorization: 'Bearer ' + ANON } })
      return { status: r.status, body: (await r.text()).slice(0, 400) }
    })
  }
  // 3. S-1 re-verify: public demo cred must still be INVALID
  await rec('auth:s1-demo-cred', async () => {
    const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON, 'content-type': 'application/json' }, body: JSON.stringify({ email: 'admin@bmb.co.th', password: 'admin123' }) })
    return { status: r.status, body: (await r.text()).slice(0, 120) }
  })
  // 4. Production site smoke
  await rec('prod:home', async () => { const r = await fetch('https://bitemebaby-5f7.pages.dev/'); return { status: r.status, len: (await r.text()).length } })
  fs.writeFileSync(OUT, JSON.stringify(ev, null, 2))
  for (const p of ev.probes) console.log(p.name, '→', p.status ?? p.fatal, (p.body || '').slice(0, 80))
}
main()