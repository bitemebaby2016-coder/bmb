// R13 read-only probe: facts of PO-20261028-942 (Owner retest 2026-10-28)
// — assignment/pod/timestamps + order status + driver status + audit trail
// → tells WHERE the delivered/auto-close chain stopped. node e2e/r13Probe942.cjs
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')) || [])[1]
const q = async (query) => {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST', headers: { Authorization: 'Bearer ' + AT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }) })
  return r.text()
}
;(async () => {
  const O = "'PO-20261028-942'"
  const out = { at: new Date().toISOString() }
  out.assignment = await q('SELECT order_number, status, driver_id, proof_of_delivery_path, assigned_at, accepted_at, picked_up_at, in_transit_at, arrived_at, delivered_at, checkin_latitude, checkin_longitude FROM public.delivery_assignments WHERE order_number = ' + O)
  out.order = await q('SELECT order_number, status, order_mode, payment_status, dropoff_latitude, dropoff_longitude FROM public.orders WHERE order_number = ' + O)
  out.drivers = await q('SELECT id, driver_name, status, current_latitude, current_longitude, last_seen_at FROM public.drivers ORDER BY driver_name')
  out.audit = await q("SELECT action, description, metadata, created_at FROM public.audit_log WHERE entity_id = 'PO-20261028-942' ORDER BY created_at DESC LIMIT 12")
  out.history = await q('SELECT to_status, created_at FROM public.order_status_history WHERE order_number = ' + O + ' ORDER BY created_at DESC LIMIT 8')
  fs.writeFileSync(path.join(__dirname, 'r13Probe942-result.json'), JSON.stringify(out, null, 2))
  console.log(JSON.stringify(out, null, 2))
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 300)))