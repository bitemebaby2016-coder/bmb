'use strict'
// adminDbDiag — read-only DB inspection (management API) สำหรับวินิจฉัยงานแอดมิน
//   ดู: storage buckets · RLS · policies ของ media_assets / storage.objects / products
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const tokens = []
for (const l of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !l.trim().startsWith('#') && m[2] && m[1] === 'SUPABASE_ACCESS_TOKEN') tokens.push(m[2])
}
const REF = 'ivkdfognyiwjcmrhcnwz'
async function q(sql) {
  let last = ''
  for (const tok of [...tokens].reverse()) {
    const r = await fetch('https://api.supabase.com/v1/projects/' + REF + '/database/query', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: sql }),
    })
    const j = await r.json().catch(() => ({}))
    if (r.ok) return j
    if (r.status === 401 || r.status === 403) { last = 'HTTP ' + r.status; continue }
    throw new Error('HTTP ' + r.status + ' ' + JSON.stringify(j).slice(0, 300))
  }
  throw new Error(last || 'no working token')
}
;(async () => {
  const out = {}
  out.buckets = await q("select id, name, public from storage.buckets order by id")
  out.tables_rls = await q("select relname, relrowsecurity from pg_class where relname in ('media_assets','products','profiles') order by relname")
  out.media_assets_cols = await q("select column_name, data_type, is_nullable from information_schema.columns where table_name='media_assets' order by ordinal_position")
  out.media_assets_policies = await q("select policyname, cmd, roles::text as roles, qual, with_check from pg_policies where tablename='media_assets' order by policyname")
  out.storage_obj_policies = await q("select policyname, cmd from pg_policies where schemaname='storage' and tablename='objects' order by policyname")
  out.counts = await q("select (select count(*) from media_assets) as media_assets, (select count(*) from products) as products")
  console.log(JSON.stringify(out, null, 1))
})().catch((e) => { console.error('DBDIAG_ERR', String(e.message || e).slice(0, 400)); process.exit(1) })
