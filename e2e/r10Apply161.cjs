// R10 apply 161 (Owner 2026-10-27): order lifecycle notifications + address photo.
// Applies supabase/migrations/161_order_notifications_address_photo.sql then verifies.
// Evidence → e2e/r10Apply161-result.json. Run: node e2e/r10Apply161.cjs
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
  const sql = fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', '161_order_notifications_address_photo.sql'), 'utf8')
  const apply = await q(sql)
  const verify = await q(
    "SELECT (SELECT count(*) FROM pg_trigger WHERE tgname LIKE 'trg_orders_notify%') AS notify_triggers, " +
    "(SELECT count(*) FROM information_schema.columns WHERE table_name='orders' AND column_name='address_photo_url') AS photo_col, " +
    "(SELECT count(*) FROM pg_proc WHERE proname='attach_address_photo') AS attach_fn, " +
    "(SELECT count(*) FROM storage.buckets WHERE id='address-photos') AS bucket",
  )
  const out = { at: new Date().toISOString(), apply, verify }
  fs.writeFileSync(path.join(__dirname, 'r10Apply161-result.json'), JSON.stringify(out, null, 2))
  console.log(JSON.stringify(out, null, 2))
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 300)))
