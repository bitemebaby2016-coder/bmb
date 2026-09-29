'use strict'
// CAT-02: deploy migration 056 (menu_schedule anon published-read policy)
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || ''
const REF = 'ivkdfognyiwjcmrhcnwz'
const fs = require('fs')
async function q(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: sql }) })
  const b = await r.text(); if (!r.ok) throw new Error('MGMT ' + r.status + ' ' + b.slice(0, 300)); return JSON.parse(b)
}
;(async () => {
  const sql = fs.readFileSync('supabase/migrations/056_menu_schedule_anon_read.sql', 'utf8')
  console.log('DEPLOY 056...')
  console.log(JSON.stringify(await q(sql)))
  console.log('policy:', JSON.stringify(await q("select policyname, cmd, roles from pg_policies where tablename = 'menu_schedule' order by 1")))
  console.log('schedule rows (must be 0 — no owner data created):', JSON.stringify(await q('select count(*)::int from menu_schedule')))
  console.log('operating_hours intact:', JSON.stringify(await q("select value from business_settings where key = 'operating_hours'")))
  console.log('order triggers intact:', JSON.stringify(await q("select count(*)::int from pg_trigger where tgrelid in ('public.orders'::regclass,'public.order_items'::regclass) and not tgisinternal")))
  console.log('DEPLOY 056 COMPLETE')
})().catch((e) => { console.error('FATAL', String(e).slice(0, 300)); process.exit(1) })
