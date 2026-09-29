'use strict'
// RE-D1 deploy + storage/media diag probes
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || ''
const REF = 'ivkdfognyiwjcmrhcnwz'
const SUPABASE_URL = `https://${REF}.supabase.co`
const fs = require('fs')
async function q(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: sql }) })
  const b = await r.text(); if (!r.ok) throw new Error('MGMT ' + r.status + ' ' + b.slice(0, 400)); return JSON.parse(b)
}
function adminToken() {
  const c = fs.readFileSync('supabase/secrets.local.env', 'utf8')
  const email = c.match(/BMB_TEST_ADMIN_EMAIL=(\S+)/)[1], password = c.match(/BMB_TEST_ADMIN_PASSWORD=(\S+)/)[1]
  const anon = fs.readFileSync('.env', 'utf8').match(/VITE_SUPABASE_ANON_KEY=(\S+)/)[1]
  return fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: anon }, body: JSON.stringify({ email, password }) }).then(async r => { const b = await r.text(); if (!r.ok) throw new Error('AUTH ' + r.status + ' ' + b.slice(0, 150)); return JSON.parse(b).access_token })
}

;(async () => {
  // pre-check: any RPC referencing preorder_votes?
  console.log('RPCs referencing preorder_votes:', JSON.stringify(await q("select proname from pg_proc where prosrc like '%preorder_votes%'")))
  console.log('rows before:', JSON.stringify(await q('select count(*)::int from preorder_votes')))
  console.log('DEPLOY 058...', JSON.stringify(await q(fs.readFileSync('supabase/migrations/058_preorder_votes_close_anon_insert.sql', 'utf8'))))
;(async () => {
  console.log('INVARIANTS post-migration (products unchanged except image_url):', JSON.stringify(await q("select count(*)::int c, count(*) filter (where image_url like '%/object/public/bmb-images/products/%/image.webp')::int migrated from products")))
  console.log('orders intact:', JSON.stringify(await q("select count(*)::int from orders")))
  console.log('order_items intact:', JSON.stringify(await q("select count(*)::int from order_items")))
  console.log('reviews/votes intact (0):', JSON.stringify(await q("select (select count(*)::int from reviews) r, (select count(*)::int from preorder_votes) v, (select count(*)::int from menu_schedule) s")))
  console.log('media_assets rows:', JSON.stringify(await q("select id, kind, alt from media_assets order by id")))
  console.log('anon storage write still denied:', JSON.stringify(await q("select policyname from pg_policies where schemaname='storage' and tablename='objects' and cmd='INSERT'")))
})().catch((e) => { console.error('FATAL', String(e).slice(0, 400)); process.exit(1) })

  const mk = async (label, headers) => { const r = await fetch(`${SUPABASE_URL}/storage/v1/object/bmb-images/diag-cat03a/probe.txt`, { method: 'POST', headers: { ...headers, 'Content-Type': 'text/plain' }, body: 'probe' }); console.log(label, r.status, (await r.text()).slice(0, 120)); return r.ok }
  const a = await mk('A: svc apikey+svc Bearer:', { apikey: svc, Authorization: 'Bearer ' + svc })
  const b = await mk('B: user Bearer only (no apikey):', { Authorization: 'Bearer ' + jwt })
  const c = await mk('C: svc apikey + user Bearer:', { apikey: svc, Authorization: 'Bearer ' + jwt })
  const r3 = await fetch(`${SUPABASE_URL}/storage/v1/object/public/bmb-images/diag-cat03a/probe.txt`)
  console.log('storage public read:', r3.status)
  const hdrs = { apikey: legacyAnon, Authorization: 'Bearer ' + jwt }
  const d2 = await fetch(`${SUPABASE_URL}/storage/v1/object/bmb-images/diag-cat03a/probe.txt`, { method: 'DELETE', headers: hdrs }); console.log('cleanup probe object:', d2.status)
})().catch((e) => { console.error('FATAL', String(e).slice(0, 400)); process.exit(1) })



  console.log('policies now:', JSON.stringify(await q("select policyname, cmd, roles, qual from pg_policies where tablename = 'preorder_votes' order by 1")))
  console.log('rows after (intact):', JSON.stringify(await q('select count(*)::int from preorder_votes')))
  console.log('DEPLOY 058 COMPLETE')
})().catch((e) => { console.error('FATAL', String(e).slice(0, 400)); process.exit(1) })
