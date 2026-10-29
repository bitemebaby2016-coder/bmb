// R21f — production schema probe (read-only): คอลัมน์ของ delivery_assignments/drivers/orders
// สำหรับเขียน RPC order_rider_position (m174) + parity check migrations = ledger
// Run: node e2e/r21fSchemaProbe.cjs
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
  const out = { at: new Date().toISOString() }
  out.assignmentCols = await q("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='delivery_assignments' ORDER BY ordinal_position")
  out.driverCols = await q("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='drivers' ORDER BY ordinal_position")
  out.ordersRef = await q("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name IN ('customer_ref','customer_id','delivery_method','status','dropoff_latitude','dropoff_longitude')")
  out.ledger = await q('SELECT version FROM supabase_migrations.schema_migrations ORDER BY version')
  out.bmbFunctions = await q("SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('is_admin','my_role','order_rider_position')")
  fs.writeFileSync(path.join(__dirname, 'r21fSchemaProbe.json'), JSON.stringify(out, null, 2))
  console.log('ASSIGN=' + out.assignmentCols.slice(0, 1200))
  console.log('DRIVER=' + out.driverCols.slice(0, 1200))
  console.log('ORDERS=' + out.ordersRef.slice(0, 700))
  console.log('LEDGER_LAST=' + out.ledger.slice(-300))
  console.log('FNS=' + out.bmbFunctions.slice(0, 300))
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 300)))
