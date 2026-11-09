// R88 PROBE รอบ 4 — READ-ONLY: เช็ก schema ที่ต้องใช้ใน migration 199
// (orders.items type · คอลัมน์ชื่อเมนู · history 093/099 · ตาราง products)
'use strict'
const fs = require('fs')
const REF = 'ivkdfognyiwjcmrhcnwz'
let tok = ''
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*SUPABASE_ACCESS_TOKEN\s*=\s*(.*)\s*$/)
  if (m) tok = m[1]
}
if (!tok) { console.error('STOP: no SUPABASE_ACCESS_TOKEN'); process.exit(2) }
async function sql(query) {
  const r = await fetch('https://api.supabase.com/v1/projects/' + REF + '/database/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  return { status: r.status, text: await r.text() }
}
async function q(label, query) {
  const r = await sql(query)
  console.log('== ' + label + ' [' + r.status + ']')
  console.log(r.status === 200 ? r.text : r.text.slice(0, 400))
}
async function main() {
  await q('ORDERS_ITEMS_TYPE', "SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='items'")
  await q('PRODUCTS_NAME_COLS', "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name LIKE '%name%'")
  await q('HIST_093_099', "SELECT version FROM supabase_migrations.schema_migrations WHERE version IN ('093','93','099','99','094','94') ORDER BY version")
  await q('IS_ADMIN_FN', "SELECT count(*)::int AS n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='is_admin'")
  await q('REVIEWS_GRANT_DETAIL', "SELECT grantee, privilege_type FROM information_schema.table_privileges WHERE table_name='reviews' AND privilege_type IN ('SELECT','INSERT','UPDATE','DELETE') ORDER BY grantee, privilege_type")
  console.log('PROBE4_DONE_READONLY')
}
main().catch(e => { console.error('ERR', String(e).slice(0, 400)); process.exit(1) })
