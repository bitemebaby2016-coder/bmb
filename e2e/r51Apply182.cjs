// R51-2 — apply migration 182 (order_messages) ถ้ายังไม่ record ใน ledger (parity ตอนนี้ = 181)
// ออกแบบ re-run ปลอดภัย (IF NOT EXISTS / CREATE OR REPLACE / ON CONFLICT) → ยิงซ้ำได้
// evidence → e2e/r51Apply182-result.json
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

const V = '182'
const FILE = '182_order_messages.sql'
const strip = (f) => fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', f), 'utf8')
  .split('\n').filter((l) => !/^BEGIN;\s*$/i.test(l.trim()) && !/^COMMIT;\s*$/i.test(l.trim())).join('\n')

;(async () => {
  const out = { at: new Date().toISOString(), steps: [] }
  out.precheck = await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 3')
  const has = await q(`SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '${V}'`)
  if (String(has).includes('"1"') && !process.env.FORCE) {
    out.steps.push({ v: V, action: 'already_in_ledger' })
  } else {
    const res = await q(strip(FILE))
    const err = /error|"code"/i.test(res) && /"message"/i.test(res)
    if (err && !/already exists|does not exist|IF NOT EXISTS/i.test(res)) {
      out.steps.push({ v: V, action: 'apply_failed', detail: String(res).slice(0, 400) })
      out.ALL_PASS = false
      fs.writeFileSync(path.join(ROOT, 'e2e', 'r51Apply182-result.json'), JSON.stringify(out, null, 2))
      console.log(JSON.stringify({ ALL_PASS: false, failed: V }))
      process.exit(1)
    }
    const rec = await q(`INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('${V}', '${FILE}', '{}'::text[]) ON CONFLICT (version) DO NOTHING`)
    out.steps.push({ v: V, action: 'applied+recorded', apply: String(res).slice(0, 200), rec: String(rec).slice(0, 80) })
  }
  out.reload = await q("NOTIFY pgrst, 'reload schema'")
  out.verify = {
    ledgerTop: await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5'),
    table: await q("SELECT to_regclass('public.order_messages') AS t"),
    rpc: await q("SELECT proname FROM pg_proc WHERE proname = 'send_order_message'"),
    helpers: await q("SELECT proname FROM pg_proc WHERE proname IN ('owns_order_msg','drives_order_msg') ORDER BY proname"),
    rls: await q("SELECT relrowsecurity FROM pg_class WHERE oid = 'public.order_messages'::regclass"),
    rlsPolicies: await q("SELECT polname FROM pg_policy WHERE polrelid = 'public.order_messages'::regclass ORDER BY polname"),
    insertPolicy: await q("SELECT polname FROM pg_policy WHERE polrelid = 'public.order_messages'::regclass AND polcmd = 'w'"),
  }
  const ledger = String(out.verify.ledgerTop || '')
  out.checks = {
    ledger_182: ledger.includes('182'),
    table: String(out.verify.table || '').includes('order_messages'),
    rpc: String(out.verify.rpc || '').includes('send_order_message'),
    helpers: String(out.verify.helpers || '').includes('owns_order_msg') && String(out.verify.helpers || '').includes('drives_order_msg'),
    rls_enabled: String(out.verify.rls || '').includes('true'),
    select_policies: String(out.verify.rlsPolicies || '').includes('order_messages_select'),
    no_insert_policy: !String(out.verify.insertPolicy || '').includes('order_messages'),
  }
  out.ALL_PASS = Object.values(out.checks).every(Boolean)
  fs.writeFileSync(path.join(ROOT, 'e2e', 'r51Apply182-result.json'), JSON.stringify(out, null, 2))
  console.log(JSON.stringify({ ALL_PASS: out.ALL_PASS, checks: out.checks }))
  process.exit(out.ALL_PASS ? 0 : 1)
})().catch((e) => { console.error('APPLY_FAILED', String(e).slice(0, 300)); process.exit(1) })
