'use strict'
// adminDbDiag2 — read-only DB inspection (policies/functions เต็ม) สำหรับงานแอดมิน
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
  out.storage_policies = await q("select policyname, cmd, roles::text as roles, qual, with_check from pg_policies where schemaname='storage' and tablename='objects' order by policyname")
  out.funcs = await q("select p.proname, pg_get_function_identity_arguments(p.oid) as args from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('is_platform_admin','is_tenant_admin_of','is_tenant_admin') order by p.proname")
  out.is_platform_admin_def = await q("select pg_get_functiondef(oid) as def from pg_proc where proname='is_platform_admin' limit 1")
  out.media_assets_sample = await q("select id, asset_key, category, tenant_id, is_active, is_mock from media_assets order by sort_order limit 12")
  out.products_sample = await q("select id, name, (image_url is not null) as has_image from products order by created_at desc limit 5")
  out.products_cols = await q("select column_name, data_type, is_nullable from information_schema.columns where table_name='products' order by ordinal_position")
  console.log(JSON.stringify(out, null, 1))
})().catch((e) => { console.error('DBDIAG2_ERR', String(e.message || e).slice(0, 400)); process.exit(1) })
