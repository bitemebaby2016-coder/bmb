'use strict'
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || ''
async function q(sql) {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: sql }) })
  return JSON.parse(await r.text())
}
;(async () => {
  console.log('addon JSON keys:', JSON.stringify(await q("select distinct k from (select jsonb_object_keys(e) k from products p, jsonb_array_elements(p.addons) e) x")))
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/storage/buckets', { headers: { Authorization: 'Bearer ' + TOKEN } })
  const b = await r.json()
  console.log('buckets:', r.status, JSON.stringify(Array.isArray(b) ? b.map((x) => x.name) : b))
})().catch((e) => { console.error('FATAL', String(e)); process.exit(1) })
