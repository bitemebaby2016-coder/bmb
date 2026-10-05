// ============================================================
// FINAL CONFIG AUDIT (PART 1/3/4/5) — READ-ONLY ทุก query = SELECT/catalog
// ตรวจ: business_settings columns+RLS · RPC × delivery_policy/radius ผ่าน path ไหน
// · functions แตะ business_settings (admin write path?) · legacy radius_km consumer
// · branch operating_hours usage · legacy pre_orders row
// ============================================================
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const env = {}
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^(\w+)=(.*)$/)
  if (m) env[m[1]] = m[2]
}
const API = 'https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query'
async function q(sql) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const json = await res.json()
  if (!res.ok || json.message) throw new Error('SQL failed: ' + (json.message || res.statusText))
  return json
}
async function section(title, sql) {
  console.log('\n=== ' + title + ' ===')
  try { console.log(JSON.stringify(await q(sql))) } catch (e) { console.log('ERROR: ' + e.message) }
}
async function main() {
  await section('business_settings columns',
    `select column_name, data_type, is_nullable from information_schema.columns
      where table_schema='public' and table_name='business_settings' order by ordinal_position`)
  await section('RLS policies (settings/tenants/brands/branches/zones/pre_orders)',
    `select tablename, policyname, cmd, qual, with_check from pg_policies
      where schemaname='public' and tablename in
      ('business_settings','tenants','brands','branches','delivery_zones','pre_orders')
      order by tablename, policyname`)
  await section('RLS enabled?',
    `select relname, relrowsecurity from pg_class
      where relnamespace='public'::regnamespace and relname in
      ('business_settings','tenants','brands','branches','delivery_zones','pre_orders')`)
  await section('functions referencing delivery_policy (name + matched lines)',
    `select distinct p.proname, m[1] as line from pg_proc p
      cross join lateral regexp_matches(pg_get_functiondef(p.oid), '.*delivery_policy.*', 'g') m
      where p.pronamespace='public'::regnamespace`)
  await section('functions referencing bite_drive_radius_km',
    `select distinct p.proname, m[1] as line from pg_proc p
      cross join lateral regexp_matches(pg_get_functiondef(p.oid), '.*bite_drive_radius_km.*', 'g') m
      where p.pronamespace='public'::regnamespace`)
  await section('functions referencing bare radius_km (legacy, ไม่รวม bite_drive_)',
    `select distinct p.proname, m[1] as line from pg_proc p
      cross join lateral regexp_matches(pg_get_functiondef(p.oid), '.*[^_]radius_km.*', 'g') m
      where p.pronamespace='public'::regnamespace
        and pg_get_functiondef(p.oid) ~ '[^_]radius_km'
        and pg_get_functiondef(p.oid) !~ 'bite_drive_radius_km'`)
  await section('functions touching business_settings (write/read path)',
    `select distinct p.proname, p.prosecdef, m[1] as line from pg_proc p
      cross join lateral regexp_matches(pg_get_functiondef(p.oid), '.*business_settings.*', 'g') m
      where p.pronamespace='public'::regnamespace`)
  await section('functions touching operating_hours / same_day_open',
    `select distinct p.proname, m[1] as line from pg_proc p
      cross join lateral regexp_matches(pg_get_functiondef(p.oid), '.*(operating_hours|same_day_open).*', 'g') m
      where p.pronamespace='public'::regnamespace`)
  await section('RPC grants on key functions',
    `select p.proname,pg_get_function_identity_arguments(p.oid) args,
            array_agg(distinct g.grantee::regrole::text) grantees,
            array_agg(distinct g.privilege_type) privs
       from pg_proc p left join LATERAL aclexplode(p.proacl) g on true
      where p.pronamespace='public'::regnamespace
        and p.proname in ('create_order_with_items','compute_delivery_fee','compute_delivery_fee_rpc',
                          'ensure_rounds_for_date','cancel_order','cancel_pre_order','update_business_settings','upsert_business_settings')
      group by 1,2 order by 1`)
  await section('pre_orders legacy row + canonical order status',
    `select p.order_number, p.status as legacy_status, p.migrated_order_id,
            o.status as canonical_status, o.order_mode, o.customer_name
       from public.pre_orders p left join public.orders o on o.id = p.migrated_order_id
      where p.order_number='PO-20260919-430'`)
  await section('delivery_policy current value',
    `select value from public.business_settings where key='delivery_policy'`)
  await section('order_policy current value',
    `select value from public.business_settings where key='order_policy'`)
}
main().catch((e) => { console.error('ERROR ' + e.message); process.exit(1) })