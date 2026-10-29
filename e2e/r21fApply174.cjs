// R21f apply 174 (5 คำสั่ง Owner — แผนที่ตำแหน่งไรเดอร์หน้าลูกค้า):
// RPC order_rider_position (SECURITY DEFINER · เฉพาะเจ้าของออเดอร์/admin · anon = null)
// re-run ปลอดภัย (CREATE OR REPLACE) · evidence → e2e/r21fApply174-result.json
// Run: node e2e/r21fApply174.cjs   (รันหลัง CI เขียว — contract tests พิสูจน์แล้ว)
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
const FN = "SELECT p.proname, pg_get_function_result(p.oid) AS result, p.prosecdef AS security_definer, p.proconfig, l.lanname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace JOIN pg_language l ON l.oid = p.prolang WHERE n.nspname='public' AND p.proname='order_rider_position'"
const ACL = "SELECT grantee, privilege_type FROM information_schema.routine_privileges WHERE routine_schema='public' AND routine_name='order_rider_position' ORDER BY grantee"
;(async () => {
  const out = { at: new Date().toISOString() }
  out.precheck = {
    ledgerTop: await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 3'),
    fnBefore: await q(FN),
  }
  const sql = fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', '174_customer_rider_position.sql'), 'utf8')
  out.apply = await q(sql)
  out.verify = { fnAfter: await q(FN), acl: await q(ACL) }
  out.record = {
    ins174: await q("INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('174','174_customer_rider_position','{}'::text[]) ON CONFLICT (version) DO NOTHING"),
    ledgerTopAfter: await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5'),
  }
  // smoke: service_role ไม่มี auth.uid() → v_uid null + v_owner_ref ต้อง null path (คืน NULL ไม่ใช่ error)
  out.smoke = { anonView: await q("SELECT public.order_rider_position('BMB-20261029-356') AS r") }
  const parse = (t) => { try { return JSON.parse(t) } catch (e) { return null } }
  const fn = (parse(out.verify.fnAfter) || [])[0] || {}
  const acl = parse(out.verify.acl) || []
  const led = parse(out.record.ledgerTopAfter) || []
  const smoke = (parse(out.smoke.anonView) || [])[0] || {}
  out.assertions = {
    fnExists: !!fn.proname,
    returnsJsonb: fn.result === 'jsonb',
    securityDefiner: fn.security_definer === true,
    searchPathPinned: Array.isArray(fn.proconfig) && fn.proconfig.some((c) => String(c).includes('search_path')),
    noPublicGrant: !acl.some((g) => g.grantee === 'PUBLIC' && g.privilege_type === 'EXECUTE'),
    noAnonGrant: !acl.some((g) => g.grantee === 'anon' && g.privilege_type === 'EXECUTE'),
    authenticatedGrant: acl.some((g) => g.grantee === 'authenticated' && g.privilege_type === 'EXECUTE'),
    // service (ไม่มี auth.uid + ไม่ใช่ owner) → NULL เงียบ (ไม่ raise)
    callIsNullNotError: Object.prototype.hasOwnProperty.call(smoke, 'r'),
    ledgerTopIs174: led[0] && led[0].version === '174',
    has174: led.some((r) => r.version === '174'),
  }
  out.allPass = Object.entries(out.assertions).every(([k, v]) => v === true)
  fs.writeFileSync(path.join(__dirname, 'r21fApply174-result.json'), JSON.stringify(out, null, 2))
  console.log('ALL_PASS=' + out.allPass)
  console.log(JSON.stringify(out.assertions, null, 2))
  if (!out.allPass) console.log('DETAIL=' + JSON.stringify({ fn, acl, smoke, led: led[0] }).slice(0, 800))
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 500)))
