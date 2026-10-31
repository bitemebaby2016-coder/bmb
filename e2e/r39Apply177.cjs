// R39 apply 177 — marketing_publish_due + marketing_feed_posts (Owner รายงาน "ตั้งเวลาโพสไม่ขึ้น")
// re-run ปลอดภัย (CREATE OR REPLACE + ON CONFLICT) · strip BEGIN/COMMIT ให้ Management API
// evidence → e2e/r39Apply177-result.json · หลัง apply = promote แถวค้างจริง + feed probe 200
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')) || [])[1]
const q = async (query) => {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST', headers: { Authorization: 'Bearer ' + AT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  return r.text()
}
const FN = "SELECT p.proname, p.prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname='public' AND p.proname IN ('marketing_publish_due','marketing_feed_posts') ORDER BY 1"
const GRANT = "SELECT proname, proacl FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname='public' AND p.proname IN ('marketing_publish_due','marketing_feed_posts')"
;(async () => {
  const out = { at: new Date().toISOString() }
  out.precheck = {
    ledgerTop: await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 3'),
    fnBefore: await q(FN),
    dueBefore: await q("SELECT id, status, scheduled_for::text AS sched, publish_attempts AS att FROM public.marketing_posts WHERE status='scheduled' AND scheduled_for <= now() ORDER BY scheduled_for"),
  }
  const sql = fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', '177_marketing_publish_due.sql'), 'utf8')
    .split('\n').filter((l) => !/^BEGIN;\s*$/i.test(l.trim()) && !/^COMMIT;\s*$/i.test(l.trim())).join('\n')
  out.apply = await q(sql)
  out.reload = await q("NOTIFY pgrst, 'reload schema'") // PostgREST cache หลัง GRANT/DDL (case m176)
  out.verify = { fnAfter: await q(FN), acl: await q(GRANT), cronJob: await q("SELECT jobname, schedule FROM cron.job WHERE jobname='bmb-marketing-publish-due'") }
  // promote แถวที่ค้างจริง (นี่คือการ "แก้ bug" ให้ Owner เห็นทันที — 09:50 ICT ที่ค้าง)
  out.promote = await q('SELECT public.marketing_publish_due() AS promoted')
  out.dueAfter = await q("SELECT id, status, scheduled_for::text AS sched, publish_attempts AS att, published_at::text AS pub FROM public.marketing_posts WHERE scheduled_for >= now() - interval '1 day' ORDER BY scheduled_for DESC LIMIT 6")
  out.record = {
    ins177: await q("INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('177','177_marketing_publish_due','{}'::text[]) ON CONFLICT (version) DO NOTHING"),
    ledgerTopAfter: await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5'),
  }
  const parse = (t) => { try { return JSON.parse(t) } catch (e) { return null } }
  const fns = parse(out.verify.fnAfter) || []
  const led = parse(out.record.ledgerTopAfter) || []
  const dueBefore = parse(out.precheck.dueBefore) || []
  const dueAfter = parse(out.dueAfter) || []
  const promoted = (parse(out.promote) || [])[0] || {}
  out.assertions = {
    bothFnsExist: fns.length === 2 && fns.every((f) => f.prosecdef === true),
    dueExistedBefore: dueBefore.length >= 1, // อย่างน้อยแถว 09:50 ICT ที่ Owner รายงาน
    promoteRan: Number.isFinite(Number(promoted.promoted)),
    noDueLeft: dueAfter.filter((r) => r.status === 'scheduled' && r.att === 0).length === 0, // att ต้อง >0 หรือ published แล้ว
    ledgerTopIs177: led[0] && led[0].version === '177',
    has177: led.some((r) => r.version === '177'),
  }
  out.allPass = Object.entries(out.assertions).every(([k, v]) => v === true)
  fs.writeFileSync(path.join(__dirname, 'r39Apply177-result.json'), JSON.stringify(out, null, 2))
  console.log('ALL_PASS=' + out.allPass)
  console.log(JSON.stringify(out.assertions, null, 2))
  console.log('PROMOTED=' + JSON.stringify(promoted) + ' DUE_AFTER=' + JSON.stringify(dueAfter))
  if (!out.allPass) console.log('DETAIL=' + JSON.stringify({ fns, dueBefore, led: led[0] }).slice(0, 800))
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 500)))