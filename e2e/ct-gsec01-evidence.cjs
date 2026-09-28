'use strict'
// STEP 3A / G-SEC-01 PHASE A evidence: inventory contract (read-only).
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || ''
const REF = 'ivkdfognyiwjcmrhcnwz'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fet = async (u, i) => { let last; for (let a = 0; a < 5; a++) { try { return await fetch(u, i) } catch (e) { last = e; if (a === 4) break; await sleep(1200 * (a + 1)) } } throw last }
async function q(sql) {
  const r = await fet(`https://api.supabase.com/v1/projects/${REF}/database/query`, { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: sql }) })
  const b = await r.text(); if (!r.ok) throw new Error('MGMT ' + r.status + ' ' + b.slice(0, 250)); return JSON.parse(b)
}
;(async () => {
  console.log('== INVENTORY COLUMNS ==')
  console.log(JSON.stringify(await q("select column_name,data_type,is_nullable,column_default from information_schema.columns where table_schema='public' and table_name='inventory' order by ordinal_position")))
  console.log('== INVENTORY RLS POLICIES (ALL) ==')
  console.log(JSON.stringify(await q("select policyname,cmd,qual,roles::text roles_,permissive,with_check from pg_policies where schemaname='public' and tablename='inventory' order by policyname")))
  console.log('== OTHER inventory_* tables ==')
  console.log(JSON.stringify(await q("select table_name from information_schema.tables where table_schema='public' and table_name like 'inventory%' order by table_name")))
  console.log('== RPCs touching inventory (name + security definer + volatility) ==')
  const rpcs = ['update_inventory_status','get_inventory_requirements','list_recipes_with_inventory','deduct_inventory_for_order','restore_inventory_for_order','ensure_inventory_deducted_on_confirm','compute_addons_price']
  for (const r of rpcs) {
    try {
      const p = await q(`select oid::text oid, proname, prosecdef, provolatile, provolatile from (select oid::text, proname, prosecdef, provolatile from pg_proc where proname='${r}' order by oid) z`)
      console.log(r + ' :: ' + JSON.stringify(p))
    } catch (e) { console.log(r + ' :: ERR ' + String(e).slice(0, 90)) }
  }
})().catch((e) => { console.error('FATAL', String(e).slice(0, 250)); process.exit(1) })