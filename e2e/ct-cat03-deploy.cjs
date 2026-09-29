'use strict'
// CAT-03: deploy migration 057 (bmb-images canonical storage policies)
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || ''
const REF = 'ivkdfognyiwjcmrhcnwz'
const fs = require('fs')
async function q(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: sql }) })
  const b = await r.text(); if (!r.ok) throw new Error('MGMT ' + r.status + ' ' + b.slice(0, 400)); return JSON.parse(b)
}
;(async () => {
  const sql = fs.readFileSync('supabase/migrations/057_bmb_images_canonical_policies.sql', 'utf8')
  console.log('DEPLOY 057...')
  console.log(JSON.stringify(await q(sql)))
  console.log('storage policies now:', JSON.stringify(await q("select policyname, cmd, roles from pg_policies where tablename = 'objects' and schemaname = 'storage' order by 1")))
  console.log('bucket intact:', JSON.stringify(await q("select id, public from storage.buckets where id = 'bmb-images'")))
  console.log('media_assets intact:', JSON.stringify(await q('select count(*)::int from media_assets')))
  console.log('products intact:', JSON.stringify(await q('select count(*)::int from products')))
  console.log('DEPLOY 057 COMPLETE')
})().catch((e) => { console.error('FATAL', String(e).slice(0, 400)); process.exit(1) })
