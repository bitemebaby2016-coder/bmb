// R13 apply 166 (Owner สั่ง 2026-10-28): จบลูปไรเดอร์ + ปิดวงจรอัตโนมัติ
// - POD path sanitize (drivers.id มี space/# → รูปไม่เคยเข้า bucket → delivered ไม่เคยถึง)
// - driver_checkin_arrival: assignment.status → 'arrived' (เครื่องไรเดอร์ห้ามค้าง "กำลังเดินทาง")
// - self-heal แถวค้าง (arrived_at มีแล้วแต่ status ยัง in_transit)
// Evidence → e2e/r13Apply166-result.json. Run: node e2e/r13Apply166.cjs
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

  // ---- stage 1: precheck (read-only) ----
  out.precheck = {
    ledgerTop: await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 3'),
    driverIdBefore: await q("SELECT id, encode(id::bytea, 'hex') AS id_hex, public.driver_path_folder(id) AS folder FROM public.drivers"),
    asgBefore: await q("SELECT order_number, status, arrived_at, proof_of_delivery_path FROM public.delivery_assignments ORDER BY updated_at DESC LIMIT 5"),
    checkinHasStatusCase: await q("SELECT count(*)::int AS n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'driver_path_folder'"),
  }

  // ---- stage 2: apply migration 166 ----
  const sql = fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', '166_r13_rider_pod_path_and_checkin.sql'), 'utf8')
  out.apply = await q(sql)

  // ---- stage 3: verify ----
  out.verify = {
    folderAfter: await q("SELECT id, public.driver_path_folder(id) AS folder, public.driver_path_folder(id) ~ '^[A-Za-z0-9_-]+$' AS folder_pathsafe FROM public.drivers"),
    selfHealAfter: await q("SELECT order_number, status, arrived_at FROM public.delivery_assignments ORDER BY updated_at DESC LIMIT 5"),
    policyUsesSanitize: await q("SELECT pg_get_functiondef(p.oid) LIKE '%driver_path_folder%' AS sanitized FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'pod_path_is_driver'"),
    checkinSetsArrived: await q("SELECT (position('ELSE status END' in pg_get_functiondef(p.oid)) > 0) AND (position('arrived' in pg_get_functiondef(p.oid)) > 0) AS sets_arrived FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'driver_checkin_arrival'"),
    statusCheck: await q("SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid = 'public.delivery_assignments'::regclass AND conname = 'delivery_assignments_status_check'"),
  }

  // ---- stage 4: record ledger 166 ----
  out.record = {
    ins166: await q("INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('166','166_r13_rider_pod_path_and_checkin','{}'::text[]) ON CONFLICT (version) DO NOTHING"),
    ledgerTopAfter: await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5'),
  }

  fs.writeFileSync(path.join(__dirname, 'r13Apply166-result.json'), JSON.stringify(out, null, 2))
  console.log(JSON.stringify(out, null, 2))
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 300)))