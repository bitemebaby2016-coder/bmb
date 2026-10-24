// R6 (2026-10-24) — production apply for migration 145 (two independent cutoffs)
//   Owner approval 2026-10-24: "อนุมัติทั้ง schema 2-คัทออฟ + บังคับกฎ >=2"
//   Local gates green FIRST: vitest 133/1375 exit0 + tsc + lint + build + Docker
//   replay ALL_GREEN (migrations 001-145 + contracts 123..145 PASS).
//
// STAGES (run in order):
//   node e2e/r6Apply145.cjs precheck      // RO: history + columns absent + backups
//   node e2e/r6Apply145.cjs apply145      // apply 145 (BEGIN...COMMIT)
//   node e2e/r6Apply145.cjs verify145     // RO: columns + backfill + fn bodies + pattern
//   node e2e/r6Apply145.cjs contract145   // e2e/contracts_145.sql (BEGIN...ROLLBACK)
//   node e2e/r6Apply145.cjs contractRegr  // contracts_143 + 144 (regression, ROLLBACK)
//   node e2e/r6Apply145.cjs record        // ledger schema_migrations 145
const fs = require('fs')
const token = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync('.env.local', 'utf8')) || [])[1]
if (!token) { console.log('NO_ACCESS_TOKEN'); process.exit(1) }
const REF = 'ivkdfognyiwjcmrhcnwz'
const q = async (query) => {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  return { status: r.status, body: await r.text() }
}
const stage = process.argv[2] || 'precheck'
const results = []
const log = (label, r) => {
  results.push({ label, status: r.status, body: (() => { try { return JSON.parse(r.body) } catch { return r.body.slice(0, 800) } })() })
  console.log(`[${label}] status=${r.status}`)
}
const save = () => fs.writeFileSync(`e2e/r6Apply145-${stage}.json`, JSON.stringify(results, null, 2))
const PROSRC = (fn) => `SELECT count(*) AS hits FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='${fn}'`
;(async () => {
  if (stage === 'precheck') {
    log('history', await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 4'))
    log('columns-absent-yet', await q("SELECT count(*) AS has_cols FROM information_schema.columns WHERE table_name='delivery_rounds' AND column_name IN ('same_day_cutoff','pre_order_cutoff')"))
    log('body-not-145-yet', await q(`${PROSRC('create_order_with_items')} AND p.prosrc LIKE '%v_pre_order_cutoff%'`))
    log('backup-recency', await q("SELECT count(*) AS recent_backups FROM storage.objects WHERE bucket_id='db-backups' AND created_at > now() - interval '14 days'"))
  } else if (stage === 'apply145') {
    log('apply-145', await q(fs.readFileSync('supabase/migrations/145_two_cutoffs.sql', 'utf8')))
  } else if (stage === 'verify145') {
    log('columns-present', await q("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='delivery_rounds' AND column_name IN ('same_day_cutoff','pre_order_cutoff') ORDER BY column_name"))
    log('backfill-complete', await q('SELECT count(*) AS missing_same_day FROM delivery_rounds WHERE same_day_cutoff IS NULL AND cutoff_time IS NOT NULL'))
    log('body-has-145-gates', await q(`${PROSRC('create_order_with_items')} AND p.prosrc LIKE '%v_pre_order_cutoff%' AND p.prosrc LIKE '%COALESCE(v_same_day_cutoff, v_round_cutoff)%'`))
    log('trigger-has-override', await q(`${PROSRC('enforce_pre_order_window')} AND p.prosrc LIKE '%v_pre_cutoff%'`))
    log('ensure-uses-pattern-cutoffs', await q(`${PROSRC('ensure_rounds_for_date')} AND p.prosrc LIKE '%pre_order_cutoff%'`))
    log('pattern-has-new-keys', await q("SELECT value->'rounds'->0->>'same_day_cutoff' AS sd, value->'rounds'->0 ? 'pre_order_cutoff' AS has_pre FROM business_settings WHERE key='order_pattern'"))
  } else if (stage === 'contract145') {
    // 148 (P0-1) รื้อสองคัทออฟตามคำสั่ง Owner 2026-10-24 → contracts_145.sql ถูกลบ
    // และถูกแทนที่ด้วย e2e/contracts_148_same_day_no_cutoff.sql (รันผ่าน CI + replay)
    console.log('SUPERSEDED: contracts_145.sql ถูกถอดออกโดย migration 148 — ใช้ contracts_148_same_day_no_cutoff.sql แทน')
    process.exit(0)
  } else if (stage === 'contractRegr') {
    log('contract-143-regression', await q(fs.readFileSync('e2e/contracts_143.sql', 'utf8')))
    log('contract-144-regression', await q(fs.readFileSync('e2e/contracts_144.sql', 'utf8')))
  } else if (stage === 'record') {
    log('record-145', await q("INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('145','145_two_cutoffs','{}'::text[]) ON CONFLICT (version) DO NOTHING"))
    log('history-after', await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 3'))
  } else {
    console.log('unknown stage'); process.exit(1)
  }
  save()
  const bad = results.filter((r) => r.status >= 400)
  console.log(bad.length ? 'STAGE_FAILED' : 'STAGE_OK', JSON.stringify(results, null, 2).slice(0, 1500))
  process.exit(bad.length ? 1 : 0)
})()