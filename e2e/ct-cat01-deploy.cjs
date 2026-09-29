'use strict'
// CAT-01: deploy migration 055 (menu_sections + archived + catalog visibility gate)
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || ''
const REF = 'ivkdfognyiwjcmrhcnwz'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fet = async (u, i) => { let last; for (let a = 0; a < 5; a++) { try { return await fetch(u, i) } catch (e) { last = e; if (a === 4) break; await sleep(1200 * (a + 1)) } } throw last }
async function q(sql) {
  const r = await fet(`https://api.supabase.com/v1/projects/${REF}/database/query`, { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: sql }) })
  const b = await r.text(); if (!r.ok) throw new Error('MGMT ' + r.status + ' ' + b.slice(0, 300)); return b
}
const fs = require('fs')
;(async () => {
  const sql = fs.readFileSync('supabase/migrations/055_catalog_menu_sections_archive.sql', 'utf8')
  console.log('DEPLOY 055...')
  console.log(await q(sql))
  console.log('VERIFY:')
  console.log(await q("select column_name from information_schema.columns where table_name in ('products','product_categories') and column_name in ('archived','menu_section_id') order by 1"))
  console.log(await q("select count(*)::int from pg_policies where tablename='menu_sections'"))
  console.log(await q("select tgname from pg_trigger where tgrelid = 'public.order_items'::regclass and not tgisinternal"))
  console.log('DEPLOY 055 COMPLETE')
})().catch((e) => { console.error('FATAL', String(e).slice(0, 300)); process.exit(1) })
