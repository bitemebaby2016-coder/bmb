// fcDump — เขียน def ของ function ที่ต้องแก้ลงไฟล์อ่านทีละไฟล์ (避免 output truncation)
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const env = {}
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^(\w+)=(.*)$/)
  if (m) env[m[1]] = m[2]
}
async function q(sql) {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const j = await r.json()
  if (j.message) throw new Error(j.message)
  return j
}
async function main() {
  const names = ['create_order_with_items', 'compute_delivery_fee', 'compute_delivery_fee_rpc',
    'enforce_pre_order_window', 'enforce_pre_order_cancel_window', 'is_admin', 'is_tenant_admin', 'is_branch_admin']
  for (const n of names) {
    try {
      const rows = await q(`select pg_get_functiondef(p.oid) def from pg_proc p
        where p.pronamespace='public'::regnamespace and p.proname='${n}'`)
      if (!rows.length) { console.log(`${n}: NOT FOUND`); continue }
      fs.writeFileSync(path.join(ROOT, 'e2e', `fc_def_${n}.sql`), rows.map((r) => r.def).join('\n----\n'))
      console.log(`${n}: ${rows.length} variant(s) -> e2e/fc_def_${n}.sql`)
    } catch (e) { console.log(`${n}: ERR ${e.message}`) }
  }
  // สรุป RLS ที่เหลือ + settings rows scope + admin profile
  console.log(JSON.stringify(await q(
    `select tablename, policyname, cmd from pg_policies
      where schemaname='public' and tablename in ('tenants','pre_orders','delivery_zones') order by 1,2`)))
  console.log(JSON.stringify(await q(
    `select key, tenant_id, branch_id from public.business_settings order by key`)))
  console.log(JSON.stringify(await q(
    `select id, role, tenant_id, branch_id, is_platform from public.profiles where role in ('admin','tenant_admin') or is_platform limit 5`)))
}
main().catch((e) => { console.error('ERROR ' + e.message); process.exit(1) })