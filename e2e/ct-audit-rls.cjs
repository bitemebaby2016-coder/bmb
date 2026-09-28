'use strict'
// STEP 3 read-only: RLS policies + key schema columns (orders/delivery_rounds) + admin routines.
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || ''
const REF = 'ivkdfognyiwjcmrhcnwz'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fet = async (u, i) => { let last; for (let a = 0; a < 5; a++) { try { return await fetch(u, i) } catch (e) { last = e; if (a === 4) break; await sleep(1200 * (a + 1)) } } throw last }
async function q(sql) {
  const r = await fet(`https://api.supabase.com/v1/projects/${REF}/database/query`, { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: sql }) })
  const b = await r.text(); if (!r.ok) throw new Error('MGMT ' + r.status + ' ' + b.slice(0, 250)); return JSON.parse(b)
}
const tabs = ['orders', 'products', 'promotions', 'inventory', 'customers', 'media_assets', 'delivery_rounds', 'notifications', 'audit_logs', 'reviews', 'business_settings', 'delivery_zones', 'order_items', 'payment_intents', 'drivers', 'recipes', 'menu_schedule']
;(async () => {
  for (const t of tabs) {
    try {
      const p = await q(`select policyname,cmd,qual,roles::text as roles_,permissive from pg_policies where schemaname='public' and tablename='${t}' order by cmd,policyname`)
      console.log(t + ' :: ' + JSON.stringify(p.map(r => ({ n: r.policyname, c: r.cmd, roles: r.roles_, perm: r.permissive, qual: r.qual }))))
    } catch (e) { console.log(t + ' :: ERR ' + String(e).slice(0, 80)) }
  }
  console.log('== ORDERS COLUMNS ==')
  console.log(JSON.stringify(await q("select column_name,data_type from information_schema.columns where table_schema='public' and table_name='orders' order by ordinal_position")))
  console.log('== DELIVERY_ROUNDS COLUMNS ==')
  console.log(JSON.stringify(await q("select column_name,data_type from information_schema.columns where table_schema='public' and table_name='delivery_rounds' order by ordinal_position")))
  console.log('== ADMIN/AGG ROUTINES ==')
  const names = (await q("select routine_name from information_schema.routines where routine_schema='public' and (routine_name like '%dashboard%' or routine_name like '%summary%' or routine_name like '%agg%' or routine_name like '%report%' or routine_name like '%queue%' or routine_name like '%_fee%' or routine_name like '%capacity%' or routine_name like '%round%' or routine_name like '%notification%' or routine_name like '%deliver%' or routine_name like '%kitchen%' or routine_name like '%inventory%' or routine_name like '%promot%')")).map(r => r.routine_name)
  console.log(JSON.stringify(names))
})().catch((e) => { console.error('FATAL', String(e).slice(0, 250)); process.exit(1) })