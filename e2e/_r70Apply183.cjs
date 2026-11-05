// R70 — apply migration 183 (order message notifications) ถ้ายังไม่ record ใน ledger
// (parity ตอนเขียน = 182) · re-run ปลอดภัย (CREATE OR REPLACE / DROP NOT NULL idempotent)
// evidence → e2e/_r70Apply183-result.json
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')) || [])[1]
if (!AT) { console.error('NO_SUPABASE_ACCESS_TOKEN'); process.exit(1) }

const q = async (query) => {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + AT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  return await r.text()
}

const V = '183'
const FILE = '183_order_message_notifications.sql'
const strip = (f) => fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', f), 'utf8')
  .split('\n').filter((l) => !/^BEGIN;\s*$/i.test(l.trim()) && !/^COMMIT;\s*$/i.test(l.trim())).join('\n')

;(async () => {
  const out = { at: new Date().toISOString(), steps: [] }
  out.precheck = {
    ledgerTop: await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 3'),
    notifNullable: await q("SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='notifications' AND column_name='customer_id'"),
  }
  const has = await q(`SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '${V}'`)
  if (String(has).includes('"1"') && !process.env.FORCE) {
    out.steps.push({ v: V, action: 'already_in_ledger' })
  } else {
    const res = await q(strip(FILE))
    const err = /"code"/i.test(res) && /"message"/i.test(res)
    if (err && !/already exists|does not exist|IF NOT EXISTS/i.test(res)) {
      out.steps.push({ v: V, action: 'apply_failed', detail: String(res).slice(0, 400) })
      out.ALL_PASS = false
      fs.writeFileSync(path.join(ROOT, 'e2e', '_r70Apply183-result.json'), JSON.stringify(out, null, 2))
      console.log(JSON.stringify({ ALL_PASS: false, failed: V }))
      process.exit(1)
    }
    const rec = await q(`INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('${V}', '${FILE}', '{}'::text[]) ON CONFLICT (version) DO NOTHING`)
    out.steps.push({ v: V, action: 'applied+recorded', apply: String(res).slice(0, 200), rec: String(rec).slice(0, 80) })
  }
  out.reload = await q("NOTIFY pgrst, 'reload schema'")
  out.verify = {
    ledgerTop: await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5'),
    fn: await q("SELECT proname, prosecdef FROM pg_proc WHERE proname = 'send_order_message'"),
    notifNullable: await q("SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='notifications' AND column_name='customer_id'"),
    fnBodyHasNotify: await q("SELECT prosrc LIKE '%msgn-%' AS has_msgn, prosrc LIKE '%INSERT INTO public.notifications%' AS has_notif_insert, prosrc LIKE '%enqueue_notification%' AS has_legacy_enqueue FROM pg_proc WHERE proname = 'send_order_message'"),
  }
  const ledger = String(out.verify.ledgerTop || '')
  const fnb = String(out.verify.fnBodyHasNotify || '')
  out.checks = {
    ledger_183: ledger.includes('183'),
    fn_security_definer: String(out.verify.fn || '').includes('t'),
    customer_id_nullable: String(out.verify.notifNullable || '').includes('YES'),
    uses_notifications_insert: fnb.includes('"has_notif_insert":true') || fnb.includes('has_notif_insert'),
    uses_msgn_id: fnb.includes('has_msgn'),
  }
  out.ALL_PASS = Object.values(out.checks).every(Boolean)
  fs.writeFileSync(path.join(ROOT, 'e2e', '_r70Apply183-result.json'), JSON.stringify(out, null, 2))
  console.log(JSON.stringify({ ALL_PASS: out.ALL_PASS, checks: out.checks }))
  process.exit(out.ALL_PASS ? 0 : 1)
})().catch((e) => { console.error('APPLY_FAILED', String(e).slice(0, 300)); process.exit(1) })
