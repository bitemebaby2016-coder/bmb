// ============================================================
// W-1.4b READ-ONLY AUDIT — canonical sources inventory (production)
// ไม่มี mutation ทุก query เป็น SELECT/information_schema
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
  try {
    const rows = await q(sql)
    console.log(JSON.stringify(rows, null, 1))
  } catch (e) {
    console.log('ERROR: ' + e.message)
  }
}
async function main() {
  await section('business_settings keys+values',
    `select key, value from public.business_settings order by key`)
  await section('branches columns',
    `select column_name, data_type, is_nullable from information_schema.columns
      where table_schema='public' and table_name='branches' order by ordinal_position`)
  await section('branches rows (delivery-related cols)',
    `select * from public.branches`)
  await section('tenant/brand-ish tables',
    `select table_name from information_schema.tables
      where table_schema='public' and (table_name ~ 'tenant|brand|white|label|theme|mascot|config|setting')
      order by table_name`)
  await section('delivery_zones',
    `select * from public.delivery_zones order by min_distance_km`)
  await section('orders counts by status/mode',
    `select status, order_mode, count(*)::int as n from public.orders group by status, order_mode order by status, order_mode`)
  await section('orders recent (id, code, name, created_at)',
    `select id, order_number, customer_name, status, order_mode, created_at
       from public.orders order by created_at desc limit 15`)
  await section('pre_orders counts',
    `select status, count(*)::int as n from public.pre_orders group by status`)
  await section('delivery_rounds today+tomorrow',
    `select id, round_key, scheduled_date, cutoff_time, max_capacity, branch_id, status
       from public.delivery_rounds where scheduled_date >= (now() at time zone 'Asia/Bangkok')::date
       order by scheduled_date, delivery_start`)
}
main().catch((e) => { console.error('ERROR ' + e.message); process.exit(1) })
