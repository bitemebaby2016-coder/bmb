// R21 apply 171 (เฟส 1 A7): RPC `my_role()` คืน "ชื่อบทบาทจริง" จาก profiles.role
// = แก้ is_admin boolean ที่ map true → 'admin' จน owner/manager ถูกแปลงบทบาท
// re-run ปลอดภัย (CREATE OR REPLACE) · evidence → e2e/r21cApply171-result.json
// Run: node e2e/r21cApply171.cjs
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

const FN =
  "SELECT p.proname, pg_get_function_result(p.oid) AS result, p.prosecdef AS security_definer, " +
  "p.proconfig, l.lanname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace " +
  "JOIN pg_language l ON l.oid = p.prolang WHERE n.nspname='public' AND p.proname='my_role'"
const ACL =
  "SELECT grantee, privilege_type FROM information_schema.routine_privileges " +
  "WHERE routine_schema='public' AND routine_name='my_role' ORDER BY grantee"

;(async () => {
  const out = { at: new Date().toISOString() }
  out.precheck = {
    ledgerTop: await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 3'),
    fnBefore: await q(FN),
  }
  const sql = fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', '171_my_role_rpc.sql'), 'utf8')
  out.apply = await q(sql)
  out.verify = {
    fnAfter: await q(FN),
    acl: await q(ACL),
    // smoke: เรียกจริงด้วย token ปลอมไม่ได้ (function ใช้ auth.uid()) — ตรวจ definition + ผลรวมได้
    callAsService: await q("SELECT public.my_role() AS r"), // service_role ไม่มี auth.uid() → ต้องได้ NULL (ไม่ใช่ error)
  }
  out.record = {
    ins171: await q("INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('171','171_my_role_rpc','{}'::text[]) ON CONFLICT (version) DO NOTHING"),
    ledgerTopAfter: await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5'),
  }

  const parse = (t) => { try { return JSON.parse(t) } catch (e) { return null } }
  const fn = (parse(out.verify.fnAfter) || [])[0] || {}
  const acl = parse(out.verify.acl) || []
  const call = (parse(out.verify.callAsService) || [])[0] || {}
  const led = parse(out.record.ledgerTopAfter) || []
  out.assertions = {
    fnExists: !!fn.proname,
    returnsText: fn.result === 'text',
    securityDefiner: fn.security_definer === true,
    searchPathPinned: Array.isArray(fn.proconfig) && fn.proconfig.some((c) => String(c).includes('search_path')),
    anonNoGrant: !acl.some((g) => (g.grantee === 'anon' || g.grantee === 'PUBLIC') && g.privilege_type === 'EXECUTE'),
    authenticatedGrant: acl.some((g) => g.grantee === 'authenticated' && g.privilege_type === 'EXECUTE'),
    callIsNullNotError: Object.prototype.hasOwnProperty.call(call, 'r') && (call.r === null),
    ledgerTopIs171: led[0] && led[0].version === '171',
    has171: led.some((r) => r.version === '171'),
  }
  out.allPass = Object.entries(out.assertions).every(([k, v]) => v === true)
  fs.writeFileSync(path.join(__dirname, 'r21cApply171-result.json'), JSON.stringify(out, null, 2))
  console.log('ALL_PASS=' + out.allPass)
  console.log(JSON.stringify(out.assertions, null, 2))
  if (!out.allPass) console.log('DETAIL=' + JSON.stringify({ fn, acl, call, led: led[0] }).slice(0, 800))
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 500)))
