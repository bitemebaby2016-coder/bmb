// R21e apply 173 (R21e cosmetic · Owner "รวม to_char ids"): แก้ id จาก to_char overflow/padding
// = bigint::text (pattern R14/167 พิสูจน์แล้ว) ใน 3 function ที่ LIVE จริง:
//   create_order_with_items · orders_notify_hook · write_order_status_history
// body = VERBATIM จาก 153/161/040 (extract โดย e2e/r21eGen173.cjs) — เปลี่ยนเฉพาะ 3 บรรทัด id
// หลักฐานก่อนแก้ = e2e/r21eProdIdProbe.json ('ord- ###########-a04759' · 'osh-  1793…')
// re-run ปลอดภัย (CREATE OR REPLACE) · evidence → e2e/r21eApply173-result.json
// Run: node e2e/r21eApply173.cjs
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
const FNS = "SELECT proname, (prosrc LIKE '%::bigint%') AS has_bigint, (prosrc LIKE '%99999999999%' OR prosrc LIKE '%99999999999999%') AS has_old_mask FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname='public' AND p.proname IN ('create_order_with_items','orders_notify_hook','write_order_status_history') ORDER BY proname"
;(async () => {
  const out = { at: new Date().toISOString() }
  out.precheck = {
    ledgerTop: await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 3'),
    fnBefore: await q(FNS),
  }
  const sql = fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', '173_order_id_bigint_fix.sql'), 'utf8')
  out.apply = await q(sql)
  out.verify = { fnAfter: await q(FNS) }
  out.record = {
    ins173: await q("INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('173','173_order_id_bigint_fix','{}'::text[]) ON CONFLICT (version) DO NOTHING"),
    ledgerTopAfter: await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5'),
  }
  const parse = (t) => { try { return JSON.parse(t) } catch (e) { return null } }
  const before = parse(out.precheck.fnBefore) || []
  const after = parse(out.verify.fnAfter) || []
  const led = parse(out.record.ledgerTopAfter) || []
  const byName = (rows) => Object.fromEntries(rows.map((r) => [r.proname, r]))
  const A = byName(after)
  out.assertions = {
    threeFnsExist: after.length === 3,
    orderFnBigint: A.create_order_with_items && A.create_order_with_items.has_bigint === true,
    notifyFnBigint: A.orders_notify_hook && A.orders_notify_hook.has_bigint === true,
    oshFnBigint: A.write_order_status_history && A.write_order_status_history.has_bigint === true,
    noOldMaskLeft: after.every((r) => r.has_old_mask === false),
    orderFnChanged: (byName(before).create_order_with_items || {}).has_bigint === false,
    ledgerTopIs173: led[0] && led[0].version === '173',
    has173: led.some((r) => r.version === '173'),
  }
  out.allPass = Object.entries(out.assertions).every(([k, v]) => v === true)
  fs.writeFileSync(path.join(__dirname, 'r21eApply173-result.json'), JSON.stringify(out, null, 2))
  console.log('ALL_PASS=' + out.allPass)
  console.log(JSON.stringify(out.assertions, null, 2))
  if (!out.allPass) console.log('DETAIL=' + JSON.stringify({ before, after, led: led[0] }).slice(0, 1000))
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 500)))
