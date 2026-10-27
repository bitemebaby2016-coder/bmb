// R11 apply 163 (Owner สั่ง 2026-10-27 รอบดึก): rider step-sync + driver_checkin_arrival + geofence close.
// Applies supabase/migrations/163_rider_step_sync_checkin.sql then verifies + records migration ledger.
// Pattern = w7Apply159 4 stage (precheck/apply/verify/record) + r10Apply161 Management API.
// record stage = 163 + backfill 161/162 (r10Apply161/162 ไม่ได้ record ledger — evidence r10Apply*-result.json).
// Evidence → e2e/r11Apply163-result.json. Run: node e2e/r11Apply163.cjs
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
const FN4 = "'driver_accept_assignment','claim_dispatch_offer','driver_checkin_arrival','driver_update_delivery_status'"
;(async () => {
  const out = { at: new Date().toISOString() }

  // ---- stage 1: precheck (read-only) ----
  out.precheck = {
    ledgerTop: await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5'),
    rows161to163: await q("SELECT version, name FROM supabase_migrations.schema_migrations WHERE version IN ('161','162','163') ORDER BY version"),
    fnsBefore: await q(
      'SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args FROM pg_proc p ' +
      'JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = ' + "'public'" + ' AND p.proname IN (' + FN4 + ') ORDER BY p.proname'),
  }

  // ---- stage 2: apply migration 163 (BEGIN..COMMIT ในไฟล์ · re-run ได้) ----
  const sql = fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', '163_rider_step_sync_checkin.sql'), 'utf8')
  out.apply = await q(sql)

  // ---- stage 3: verify (pg_proc 4 fn + arrived_at/checkin cols) ----
  out.verify = {
    counts: await q(
      'SELECT ' +
      '(SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = ' + "'public'" + ' AND p.proname IN (' + FN4 + ')) AS step_fns, ' +
      "(SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='delivery_assignments' AND column_name='arrived_at') AS arrived_at_col, " +
      "(SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='delivery_assignments' AND column_name='checkin_latitude') AS checkin_lat_col, " +
      "(SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='delivery_assignments' AND column_name='checkin_longitude') AS checkin_lng_col"),
    fnsAfter: await q(
      'SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args FROM pg_proc p ' +
      'JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = ' + "'public'" + ' AND p.proname IN (' + FN4 + ') ORDER BY p.proname'),
  }

  // ---- stage 4: record ledger (163 + backfill 161/162 — ON CONFLICT DO NOTHING) ----
  out.record = {
    ins161: await q("INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('161','161_order_notifications_address_photo','{}'::text[]) ON CONFLICT (version) DO NOTHING"),
    ins162: await q("INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('162','162_admin_reject_payment','{}'::text[]) ON CONFLICT (version) DO NOTHING"),
    ins163: await q("INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('163','163_rider_step_sync_checkin','{}'::text[]) ON CONFLICT (version) DO NOTHING"),
    ledgerTopAfter: await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5'),
  }

  fs.writeFileSync(path.join(__dirname, 'r11Apply163-result.json'), JSON.stringify(out, null, 2))
  console.log(JSON.stringify(out, null, 2))
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 300)))