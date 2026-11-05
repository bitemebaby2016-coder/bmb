// R71 — apply migration 187 (order message v3: fix rider-send crash + notify rider)
// re-run ปลอดภัย (CREATE OR REPLACE / DROP NOT NULL idempotent)
// evidence → e2e/_r71Apply187-result.json
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

const V = '187'
const FILE = '187_order_message_rider_notifications.sql'
const strip = (f) => fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', f), 'utf8')
  .split('\n').filter((l) => !/^BEGIN;\s*$/i.test(l.trim()) && !/^COMMIT;\s*$/i.test(l.trim())).join('\n')

;(async () => {
  const out = { at: new Date().toISOString(), steps: [] }
  out.precheck = {
    ledgerTop: await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 3'),
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
      fs.writeFileSync(path.join(ROOT, 'e2e', '_r71Apply187-result.json'), JSON.stringify(out, null, 2))
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
    fnBody: await q("SELECT prosrc LIKE '%-c%' AS has_c, prosrc LIKE '%-r%' AS has_r, prosrc LIKE '%v_rider_uid%' AS has_rider_uid, prosrc LIKE '%INSERT INTO public.notifications%' AS has_notif_insert, prosrc LIKE '%v_id || ''-a''%' AS has_a_suffix FROM pg_proc WHERE proname = 'send_order_message'"),
  }
  const ledger = String(out.verify.ledgerTop || '')
  const fnb = String(out.verify.fnBody || '')
  out.checks = {
    ledger_187: ledger.includes('187'),
    fn_security_definer: String(out.verify.fn || '').includes('t'),
    has_rider_uid: fnb.includes('has_rider_uid'),
    has_a_suffix: fnb.includes('has_a_suffix'),
    uses_notifications_insert: fnb.includes('has_notif_insert'),
  }
  out.ALL_PASS = Object.values(out.checks).every(Boolean)
  fs.writeFileSync(path.join(ROOT, 'e2e', '_r71Apply187-result.json'), JSON.stringify(out, null, 2))
  console.log(JSON.stringify({ ALL_PASS: out.ALL_PASS, checks: out.checks }))
  process.exit(out.ALL_PASS ? 0 : 1)
})().catch((e) => { console.error('APPLY_FAILED', String(e).slice(0, 300)); process.exit(1) })