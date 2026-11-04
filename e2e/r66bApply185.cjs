// R66-B — apply migration 185 (admin switches: master store + per-category mode) บน production
// Pattern = r65Apply184 (Management API · ledger ON CONFLICT DO NOTHING · re-run ปลอดภัย)
// verify: seed row · 2 columns NOT NULL default true · 3 fns (SECURITY DEFINER ทั้ง 3 ตาม
//         design — reader+2 trigger fns ต้องอ่านข้าม role ได้) · 2 BEFORE INSERT triggers · GRANT
//         · ledger top=185
// evidence → e2e/r66bApply185-result.json
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')) || [])[1]
if (!AT) { console.error('NO_SUPABASE_ACCESS_TOKEN'); process.exit(1) }

const V = '185'
const FILE = '185_admin_switches_master_category.sql'

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
  out.pre_trg = await q("SELECT count(*) AS n FROM pg_trigger WHERE NOT tgisinternal AND tgname IN ('trg_orders_master_gate','trg_order_items_category_mode')")

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
      fs.writeFileSync(path.join(ROOT, 'e2e', 'r66bApply185-result.json'), JSON.stringify(out, null, 2))
      console.log('XMARK APPLY_FAILED ' + String(res).slice(0, 300))
      process.exit(1)
    }
    out.steps.push({ action: 'applied', detail: String(res).slice(0, 200) })
    const rec = await q(`INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('${V}', '${FILE}', '{}'::text[]) ON CONFLICT (version) DO NOTHING`)
    out.steps.push({ action: 'ledger_recorded', detail: String(rec).slice(0, 120) })
  }

  out.reload = await q("NOTIFY pgrst, 'reload schema'")
  out.verify = {
    seed: await q("SELECT value FROM public.business_settings WHERE key = 'store_master_open'"),
    columns: await q("SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='product_categories' AND column_name IN ('allow_same_day','allow_pre_order')"),
    fns: await q("SELECT proname, prosecdef, (prosrc LIKE '%store_master_open%') AS reads_key, (prosrc LIKE '%ERR_STORE_CLOSED%') AS master_msg, (prosrc LIKE '%ERR_CATEGORY_MODE_NOT_ALLOWED%') AS cat_msg FROM pg_proc WHERE proname IN ('store_master_is_open','trg_orders_master_gate','trg_order_items_category_mode')"),
    // tgtype bitmask: 2=BEFORE · 4=INSERT → (& 6)=6 คือ BEFORE INSERT
    triggers: await q("SELECT c.relname AS tbl, t.tgname, ((t.tgtype & 6) = 6) AS is_before_insert FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid WHERE NOT t.tgisinternal AND t.tgname IN ('trg_orders_master_gate','trg_order_items_category_mode')"),
    grant: await q("SELECT has_function_privilege('anon', 'public.store_master_is_open()', 'EXECUTE') AS anon_can_call, has_function_privilege('authenticated', 'public.store_master_is_open()', 'EXECUTE') AS auth_can_call"),
    ledgerTop: await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 3'),
  }

  const seedOk = String(out.verify.seed).includes('"open"') && String(out.verify.seed).includes('true')
  const colRows = (String(out.verify.columns).match(/allow_/g) || []).length
  const colOk = colRows === 2 && !String(out.verify.columns).includes('"YES"') // is_nullable = NO
  const fnRows = (String(out.verify.fns).match(/"proname"/g) || []).length
  const definerOk = (String(out.verify.fns).match(/"prosecdef":true/g) || []).length === 3 // reader + 2 trigger fns = SECURITY DEFINER ทั้งคู่ตาม design
  const markerOk = String(out.verify.fns).includes('"master_msg":true') && String(out.verify.fns).includes('"cat_msg":true') && String(out.verify.fns).includes('"reads_key":true')
  const trgOk = (String(out.verify.triggers).match(/"is_before_insert":true/g) || []).length === 2
  const trgTblOk = String(out.verify.triggers).includes('orders') && String(out.verify.triggers).includes('order_items')
  const grantOk = String(out.verify.grant).includes('"anon_can_call":true') && String(out.verify.grant).includes('"auth_can_call":true')
  const ledgerOk = String(out.verify.ledgerTop).includes('185')
  out.ALL_PASS = seedOk && colOk && fnRows === 3 && definerOk && markerOk && trgOk && trgTblOk && grantOk && ledgerOk
  out.checks = { seedOpenTrue: seedOk, columns2: colOk, fns3: fnRows === 3, definer3: definerOk, markers: markerOk, triggersBEFOREInsert: trgOk, trgTables: trgTblOk, grantExec: grantOk, ledger185: ledgerOk }
  fs.writeFileSync(path.join(ROOT, 'e2e', 'r66bApply185-result.json'), JSON.stringify(out, null, 2))
  console.log('R66B_APPLY_185 ALL_PASS=' + out.ALL_PASS + ' ' + JSON.stringify(out.checks))
  process.exit(out.ALL_PASS ? 0 : 1)
})().catch((e) => { console.error('APPLY_FAILED ' + String(e).slice(0, 300)); process.exit(1) })