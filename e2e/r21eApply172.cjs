// R21e apply 172 (R21 P2 · Owner): cap ส่วนลดรวมต่อออเดอร์ 15% ของยอดรวมสินค้า
// promotion_apply_rules = จุดตัดสินส่วนลดที่เดียวของ create_order_with_items (153h)
// re-run ปลอดภัย (CREATE OR REPLACE) · evidence → e2e/r21eApply172-result.json
// Run: node e2e/r21eApply172.cjs
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
const FN = "SELECT (prosrc LIKE '%0.15%') AS has_cap, (prosrc LIKE '%4c%') AS has_marker FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname='public' AND p.proname='promotion_apply_rules'"
const ACL = "SELECT grantee, privilege_type FROM information_schema.routine_privileges WHERE routine_schema='public' AND routine_name='promotion_apply_rules' ORDER BY grantee"
;(async () => {
  const out = { at: new Date().toISOString() }
  out.precheck = {
    ledgerTop: await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 3'),
    fnBefore: await q(FN),
  }
  const sql = fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', '172_discount_cap_15pct.sql'), 'utf8')
  out.apply = await q(sql)
  out.verify = { fnAfter: await q(FN), acl: await q(ACL) }
  out.record = {
    ins172: await q("INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('172','172_discount_cap_15pct','{}'::text[]) ON CONFLICT (version) DO NOTHING"),
    ledgerTopAfter: await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5'),
  }
  const parse = (t) => { try { return JSON.parse(t) } catch (e) { return null } }
  const before = (parse(out.precheck.fnBefore) || [])[0] || {}
  const after = (parse(out.verify.fnAfter) || [])[0] || {}
  const acl = parse(out.verify.acl) || []
  const led = parse(out.record.ledgerTopAfter) || []
  out.assertions = {
    hadNoCapBefore: before.has_cap === false,
    hasCapAfter: after.has_cap === true,
    markerAfter: after.has_marker === true,
    authenticatedGrant: acl.some((g) => g.grantee === 'authenticated' && g.privilege_type === 'EXECUTE'),
    noPublicGrant: !acl.some((g) => g.grantee === 'PUBLIC' && g.privilege_type === 'EXECUTE'),
    ledgerTopIs172: led[0] && led[0].version === '172',
    has172: led.some((r) => r.version === '172'),
  }
  out.allPass = Object.entries(out.assertions).every(([k, v]) => v === true)
  fs.writeFileSync(path.join(__dirname, 'r21eApply172-result.json'), JSON.stringify(out, null, 2))
  console.log('ALL_PASS=' + out.allPass)
  console.log(JSON.stringify(out.assertions, null, 2))
  if (!out.allPass) console.log('DETAIL=' + JSON.stringify({ before, after, led: led[0] }).slice(0, 800))
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 500)))
