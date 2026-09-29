'use strict'
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || ''
async function q(sql) {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: sql }) })
  return JSON.parse(await r.text())
}
;(async () => {
  console.log('business_settings keys:', JSON.stringify(await q('select key, left(value::text,90) v from public.business_settings order by key')))
  console.log('mascot_overrides:', JSON.stringify(await q('select count(*)::int rows, coalesce(string_agg(role_name, chr(44)), chr(45)) roles from public.mascot_overrides')))
  console.log('mascot_overrides schema:', JSON.stringify(await q("select column_name, data_type from information_schema.columns where table_schema='public' and table_name='mascot_overrides' order by ordinal_position")))
  console.log('tenant-like columns across tables:', JSON.stringify(await q("select table_name, column_name from information_schema.columns where table_schema='public' and column_name in ('tenant_id','store_id','business_id','organization_id','brand_id') order by table_name limit 40")))
  console.log('mascot RLS:', JSON.stringify(await q("select policyname, cmd, roles, qual from pg_policies where tablename='mascot_overrides'")))
  console.log('settings RLS:', JSON.stringify(await q("select policyname, cmd, roles from pg_policies where tablename='business_settings'")))
  console.log('all public tables (inventory):', JSON.stringify(await q("select string_agg(table_name, chr(44) order by table_name) t from information_schema.tables where table_schema='public' and table_type='BASE TABLE'")))
})().catch((e) => { console.error('FATAL', String(e)); process.exit(1) })
