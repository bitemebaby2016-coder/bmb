// R82h probe — READ-ONLY: เช็ครูปแบบ order_number จริงใน DB + หา 4 ใบจากภาพ /admin/orders
// (dry-run ของ _r82h_cleanOrders ตอบ 0/4 → ต้องดูคอลัมน์/รูปเลขจริงก่อนแก้เป้า)
'use strict'
const fs = require('fs')
const path = require('path')
const REF = 'ivkdfognyiwjcmrhcnwz'
const out = { probed_at: new Date().toISOString(), note: 'READ-ONLY R82h' }
const MGMT_TOKENS = []
for (const l of fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*(bmb_PAT_SUPABASE_ACCESS_TOKEN|SUPABASE_ACCESS_TOKEN)\s*=\s*(.*)\s*$/)
  if (m && !l.trim().startsWith('#') && m[2]) MGMT_TOKENS.push(m[2])
}
async function q(sql) {
  for (const tok of [...MGMT_TOKENS].reverse()) {
    const r = await fetch('https://api.supabase.com/v1/projects/' + REF + '/database/query', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: sql }),
    })
    const j = await r.json().catch(() => ({}))
    if (r.ok) return j
  }
  return null
}
;(async () => {
  out.orders_columns = await q("select column_name from information_schema.columns where table_schema='public' and table_name='orders' order by ordinal_position")
  out.orders_latest10 = await q('select id, order_number, customer_ref, status, order_mode, total_amount, created_at from orders order by created_at desc limit 10')
  out.match_by_tail = await q("select id, order_number, customer_ref, status, total_amount, created_at from orders where order_number::text like '%-484' or order_number::text like '%-850' or order_number::text like '%-613' or order_number::text like '%-767' order by created_at desc")
  out.match_test_cust = await q("select o.id, o.order_number, o.status, o.total_amount, o.created_at, c.full_name, c.phone from orders o left join customers c on c.id = o.customer_ref where c.full_name ilike '%R74 Test%' or c.full_name ilike '%Social customer%' or c.phone in ('099000075','099000074') order by o.created_at desc limit 20")
  fs.writeFileSync(path.join(__dirname, '_r82h_evidence.json'), JSON.stringify(out, null, 2))
  console.log('R82H_PROBE_DONE → e2e/_r82h_evidence.json')
  console.log('columns: ' + ((out.orders_columns || []).map((r) => r.column_name).join(',')))
  console.log('latest rows: ' + ((out.orders_latest10 || []).length) + ' · tail-match: ' + ((out.match_by_tail || []).length) + ' · test-cust match: ' + ((out.match_test_cust || []).length))
  for (const r of (out.match_by_tail || [])) console.log('  TAIL ' + r.order_number + ' · ' + r.status + ' · ฿' + r.total_amount + ' · ' + r.created_at)
  for (const r of (out.match_test_cust || [])) console.log('  CUST ' + r.order_number + ' · ' + (r.full_name || '?') + ' · ' + (r.phone || '') + ' · ฿' + r.total_amount + ' · ' + r.created_at)
})().catch((e) => { console.error('FATAL ' + String((e && e.stack) || e).slice(0, 600)); process.exit(1) })