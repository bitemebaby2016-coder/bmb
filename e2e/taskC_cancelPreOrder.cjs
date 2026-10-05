// TASK C — inspect canonical cancel_pre_order (read-only) + cancel legacy pending test row
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const env = {}
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^(\w+)=(.*)$/)
  if (m) env[m[1]] = m[2]
}
async function q(sql) {
  const res = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const json = await res.json()
  if (!res.ok || json.message) throw new Error('SQL failed: ' + (json.message || res.statusText))
  return json
}
async function main() {
  const mode = process.argv[2] || 'inspect'
  if (mode === 'inspect') {
    const rows = await q(`select pg_get_function_identity_arguments(p.oid) args, pg_get_functiondef(p.oid) def
                            from pg_proc p where p.proname = 'cancel_pre_order'
                             and p.pronamespace = 'public'::regnamespace`)
    console.log('ARGS: ' + rows[0].args)
    console.log(rows[0].def)
    return
  }
  if (mode === 'check') {
    const byId = await q(`select id, order_number, status, order_mode, customer_name from public.orders where id = 'ord-mig-20260919-430'`)
    console.log('ORDERS_BY_MIGRATED_ID=' + JSON.stringify(byId))
    const byNum = await q(`select id, order_number, status, customer_name from public.orders where order_number = 'PO-20260919-430'`)
    console.log('ORDERS_BY_PO_NUMBER=' + JSON.stringify(byNum))
    const pending = await q(`select id, order_number, status, migrated_order_id from public.pre_orders where status = 'pending'`)
    console.log('LEGACY_PENDING=' + JSON.stringify(pending))
    return
  }
  // mode === 'cancel' : เรียก canonical RPC เท่านั้น (ไม่ direct update)
  const rows = await q(`select public.cancel_pre_order('PO-20260919-430', 'W-1.2/C test-order cancellation (Owner D-02) — legacy migrated test row') as result`)
  console.log('CANCEL_RESULT=' + JSON.stringify(rows[0].result))
  const after = await q(`select status from public.pre_orders where id = 'po-1789812174917'`)
  console.log('STATUS_AFTER=' + JSON.stringify(after[0]))
}
main().catch((e) => { console.error('ERROR ' + e.message); process.exit(1) })
