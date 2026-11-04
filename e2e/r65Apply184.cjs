// R65 — apply migration 184 (pickup hours-not-rounds) บน production + record ledger + verify
// Pattern = r61Apply183 (Management API ต่อไฟล์ · ledger ON CONFLICT DO NOTHING · re-run ปลอดภัย)
// verify เข้ม: 3 fn bodies มี GUC marker · 2 triggers BEFORE INSERT · signature pin 12 args ·
//               GRANT authenticated · ledger top=184
// evidence → e2e/r65Apply184-result.json
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')) || [])[1]
if (!AT) { console.error('NO_SUPABASE_ACCESS_TOKEN'); process.exit(1) }

const V = '184'
const FILE = '184_pickup_hours_not_rounds.sql'

const q = async (query) => {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + AT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  return r.text()
}

;(async () => {
  const out = { at: new Date().toISOString(), file: FILE, steps: [] }
  out.precheck = await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 3')
  // pre-state: ต้องยังไม่มี GUC marker (พิสูจน์ว่า verify ด้านล่างวัดการเปลี่ยนแปลงจริง)
  out.pre_guc = await q("SELECT proname, (prosrc LIKE '%app.pickup_order%') AS has_guc FROM pg_proc WHERE proname IN ('create_pickup_order_i','enforce_shop_hours','enforce_operating_hours')")

  const sql = fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', FILE), 'utf8')
    .split('\n').filter((l) => !/^BEGIN;\s*$/i.test(l.trim()) && !/^COMMIT;\s*$/i.test(l.trim())).join('\n')

  const has = await q(`SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '${V}'`)
  if (String(has).includes('"1"') && !process.env.FORCE) {
    out.steps.push({ action: 'already_in_ledger' })
  } else {
    const res = await q(sql)
    const failed = /"message"/i.test(res) && /error/i.test(res) && !/IF NOT EXISTS/i.test(res)
    if (failed) {
      out.steps.push({ action: 'apply_failed', detail: String(res).slice(0, 400) })
      fs.writeFileSync(path.join(ROOT, 'e2e', 'r65Apply184-result.json'), JSON.stringify(out, null, 2))
      console.log('XMARK APPLY_FAILED ' + String(res).slice(0, 300))
      process.exit(1)
    }
    out.steps.push({ action: 'applied', detail: String(res).slice(0, 200) })
    const rec = await q(`INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('${V}', '${FILE}', '{}'::text[]) ON CONFLICT (version) DO NOTHING`)
    out.steps.push({ action: 'ledger_recorded', detail: String(rec).slice(0, 120) })
  }

  out.reload = await q("NOTIFY pgrst, 'reload schema'")
  out.verify = {
    fnGuc: await q("SELECT proname, (prosrc LIKE '%app.pickup_order%') AS has_guc, (prosrc LIKE '%ERR_ORDER_MODE_CLOSED%') AS mode_gate_still_there FROM pg_proc WHERE proname IN ('create_pickup_order_i','enforce_shop_hours','enforce_operating_hours')"),
    // tgtype bitmask: 2=BEFORE · 4=INSERT → (& 6)=6 คือ BEFORE INSERT
    triggers: await q("SELECT tgname, tgenabled, ((tgtype & 6) = 6) AS is_before_insert FROM pg_trigger WHERE NOT tgisinternal AND tgname IN ('trg_shop_hours','trg_operating_hours')"),
    signature: await q("SELECT (oid::regprocedure::text) AS rp FROM pg_proc WHERE proname = 'create_pickup_order_i'"),
    grant: await q("SELECT has_function_privilege('authenticated', 'public.create_pickup_order_i(jsonb,text,text,text,text,text,text,text,date,text,text,text)', 'EXECUTE') AS authenticated_can_call"),
    ledgerTop: await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 3'),
  }

  const gucRows = String(out.verify.fnGuc).match(/has_guc":true/g) || []
  const modeOk = (String(out.verify.fnGuc).match(/mode_gate_still_there":true/g) || []).length === 1 // enforce_operating_hours เท่านั้น
  const trgOk = (String(out.verify.triggers).match(/is_before_insert":true/g) || []).length === 2
  const sigOk = String(out.verify.signature).includes('(jsonb,text,text,text,text,text,text,text,date,text,text,text)')
  const grantOk = String(out.verify.grant).includes('authenticated_can_call":true')
  out.ALL_PASS = gucRows.length === 3 && modeOk && trgOk && sigOk && grantOk && String(out.verify.ledgerTop).includes('184')
  out.checks = { gucFns: gucRows.length, modeGateIntact: modeOk, triggersBeforeInsert: trgOk, signature12Args: sigOk, grantAuthenticated: grantOk, ledger184: String(out.verify.ledgerTop).includes('184') }
  fs.writeFileSync(path.join(ROOT, 'e2e', 'r65Apply184-result.json'), JSON.stringify(out, null, 2))
  console.log('R65_APPLY_184 ALL_PASS=' + out.ALL_PASS + ' ' + JSON.stringify(out.checks))
  process.exit(out.ALL_PASS ? 0 : 1)
})().catch((e) => { console.error('APPLY_FAILED ' + String(e).slice(0, 300)); process.exit(1) })