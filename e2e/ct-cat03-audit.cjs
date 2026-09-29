'use strict'
// CAT-03 AUDIT — read-only production inspection
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || ''
const REF = 'ivkdfognyiwjcmrhcnwz'
const fs = require('fs')
async function q(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: sql }) })
  const b = await r.text(); if (!r.ok) throw new Error('MGMT ' + r.status + ' ' + b.slice(0, 400)); return JSON.parse(b)
}
;(async () => {
  console.log('media_assets table:', JSON.stringify(await q("select column_name, data_type from information_schema.columns where table_name = 'media_assets' and table_schema = 'public' order by ordinal_position")))
  console.log('media_assets RLS:', JSON.stringify(await q("select policyname, cmd, roles, qual from pg_policies where tablename = 'media_assets'")))
  console.log('media_assets rows:', JSON.stringify(await q('select count(*)::int from media_assets')))
  console.log('buckets:', JSON.stringify(await q("select id, name, public, file_size_limit, allowed_mime_types from storage.buckets")))
  console.log('storage policies:', JSON.stringify(await q("select policyname, tablename, cmd, roles from pg_policies where tablename in ('objects','buckets') and schemaname = 'storage' order by tablename, policyname")))
  console.log('products image stats:', JSON.stringify(await q("select count(*)::int total, count(*) filter (where image_url like 'data:image%')::int base64, count(*) filter (where image_url like 'http%')::int http, count(*) filter (where image_url like '/object%')::int storage from products")))
  console.log('mascot_overrides columns:', JSON.stringify(await q("select column_name from information_schema.columns where table_name = 'mascot_overrides' order by ordinal_position")))
})().catch((e) => { console.error('FATAL', String(e).slice(0, 400)); process.exit(1) })
