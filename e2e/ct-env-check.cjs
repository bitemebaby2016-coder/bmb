'use strict'
// Read-only: current delivery rounds + available products + QA driver identities (for CT harness prep)
const fs = require('fs')
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || ''
const REF = 'ivkdfognyiwjcmrhcnwz'
async function q(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: sql }),
  })
  const b = await r.text(); if (!r.ok) throw new Error(r.status + ' ' + b.slice(0, 200)); return JSON.parse(b)
}
(async () => {
  console.log('ROUNDS:', JSON.stringify(await q("select id,status from public.delivery_rounds order by id desc limit 8")))
  console.log('PRODUCTS:', JSON.stringify(await q("select id,is_available,price from public.products order by id desc limit 8")))
  console.log('DRIVERS:', JSON.stringify(await q("select id,name,phone,status,user_id from public.drivers where name like 'QA%' order by name")))
  console.log('QA_PROFILES:', JSON.stringify(await q("select id,name,role,phone from public.profiles where phone like '09%' or name like 'QA%' order by name limit 10")))
})().catch(e => { console.error('ERR', String(e).slice(0, 300)); process.exit(1) })