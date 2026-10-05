// W-1.4b READ-ONLY audit #2 — ส่วนที่ output รอบ 1 ถูกตัด
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
  try { console.log(JSON.stringify(await q(sql), null, 1)) } catch (e) { console.log('ERROR: ' + e.message) }
}
async function main() {
  await section('orders counts by status/mode',
    `select status, order_mode, count(*)::int n from public.orders group by 1,2 order by 1,2`)
  await section('orders ACTIVE (not terminal)',
    `select order_number, customer_name, status, order_mode, created_at from public.orders
      where status not in ('cancelled','delivered','completed','refunded','failed') order by created_at desc limit 20`)
  await section('brands columns',
    `select column_name, data_type from information_schema.columns
      where table_schema='public' and table_name='brands' order by ordinal_position`)
  await section('brands rows',
    `select * from public.brands`)
  await section('tenants columns',
    `select column_name, data_type from information_schema.columns
      where table_schema='public' and table_name='tenants' order by ordinal_position`)
  await section('tenants rows',
    `select * from public.tenants`)
  await section('pre_orders pending row (full)',
    `select * from public.pre_orders where status = 'pending'`)
  await section('delivery_zones compact',
    `select id, name, min_distance_km, max_distance_km, fee, is_active, branch_id from public.delivery_zones order by min_distance_km`)
}
main().catch((e) => { console.error('ERROR ' + e.message); process.exit(1) })
