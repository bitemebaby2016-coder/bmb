// R5c (2026-10-24) — production apply for migrations 143 + 144
//   143: pre-order cutoff = order_policy.cutoff_hours ก่อนส่ง + พรีออเดอร์วันนี้ได้
//        + order_setting hardening + order_policy data repair
//   144: แพทเทิร์นรอบ 3 รอบ/วัน (order_pattern + ensure_rounds_for_date) + repair รอบ
// Local gates green first: vitest + tsc + lint + secret scan.
//
// STAGES (run in order):
//   node e2e/r5cApply143.cjs precheck    // RO: history + 142 shape + backups
//   node e2e/r5cApply143.cjs apply143    // apply 143
//   node e2e/r5cApply143.cjs verify143   // RO: gate shape + order_setting hardened + sanitize
//   node e2e/r5cApply143.cjs contract143 // e2e/contracts_143.sql (BEGIN...ROLLBACK)
//   node e2e/r5cApply143.cjs apply144    // apply 144
//   node e2e/r5cApply143.cjs verify144   // RO: order_pattern + ensure template + repair
//   node e2e/r5cApply143.cjs contract144 // e2e/contracts_144.sql (BEGIN...ROLLBACK)
//   node e2e/r5cApply143.cjs record      // ledger schema_migrations 143 + 144
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
const save = () => fs.writeFileSync(`e2e/r5cApply143-${stage}.json`, JSON.stringify(results, null, 2))
const PROSRC = (fn) => `SELECT count(*) AS hits FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='${fn}'`
;(async () => {
  if (stage === 'precheck') {
    log('history', await q("SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 4"))
    log('body-is-142-shape', await q(`${PROSRC('create_order_with_items')} AND p.prosrc LIKE '%ERR_LEAD_TIME%'`))
    log('order-setting-still-sql', await q("SELECT l.lanname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang WHERE n.nspname='public' AND p.proname='order_setting'"))
    log('backup-recency', await q("SELECT count(*) AS recent_backups FROM storage.objects WHERE bucket_id='db-backups' AND created_at > now() - interval '14 days'"))
  } else if (stage === 'apply143') {
    log('apply-143', await q(fs.readFileSync('supabase/migrations/143_pre_order_cutoff_settings.sql', 'utf8')))
  } else if (stage === 'verify143') {
    log('lead-time-gone', await q(`${PROSRC('create_order_with_items')} AND p.prosrc LIKE '%ERR_LEAD_TIME%'`))
    log('cutoff-gate-present', await q(`${PROSRC('create_order_with_items')} AND p.prosrc LIKE '%ERR_PRE_ORDER_CUTOFF_UNKNOWN%'`))
    log('order-setting-hardened', await q("SELECT l.lanname AS lang, p.prosrc LIKE '%invalid_text_representation%' AS hardened FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang WHERE n.nspname='public' AND p.proname='order_setting'"))
    log('pre-order-window-today-ok', await q(`${PROSRC('enforce_pre_order_window')} AND p.prosrc LIKE '%NEW.scheduled_date < v_today%'`))
    log('order-policy-sanitized', await q("SELECT value->>'pre_order_lead_days' AS lead_days, value->>'cutoff_hours' AS cutoff_hours FROM business_settings WHERE key='order_policy'"))
  } else if (stage === 'contract143') {
    log('contract-143', await q(fs.readFileSync('e2e/contracts_143.sql', 'utf8')))
  } else if (stage === 'apply144') {
    log('apply-144', await q(fs.readFileSync('supabase/migrations/144_round_pattern.sql', 'utf8')))
  } else if (stage === 'verify144') {
    log('order-pattern-seeded', await q("SELECT jsonb_array_length(value->'rounds') AS rounds FROM business_settings WHERE key='order_pattern'"))
    log('ensure-uses-pattern', await q(`${PROSRC('ensure_rounds_for_date')} AND p.prosrc LIKE '%order_pattern%'`))
    log('future-rounds-repaired', await q("SELECT count(*) AS still_closed FROM delivery_rounds WHERE scheduled_date > (now() AT TIME ZONE 'Asia/Bangkok')::date AND id ~ '^round-[0-9]{8}-(morning|midday|evening)$' AND current_count = 0 AND status = 'closed'"))
  } else if (stage === 'contract144') {
    log('contract-144', await q(fs.readFileSync('e2e/contracts_144.sql', 'utf8')))
  } else if (stage === 'record') {
    log('record-143', await q("INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('143','143_pre_order_cutoff_settings','{}'::text[]) ON CONFLICT (version) DO NOTHING"))
    log('record-144', await q("INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('144','144_round_pattern','{}'::text[]) ON CONFLICT (version) DO NOTHING"))
    log('history-after', await q("SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 3"))
  } else {
    console.log('unknown stage'); process.exit(1)
  }
  save()
  const bad = results.filter((r) => r.status >= 400)
  console.log(bad.length ? 'STAGE_FAILED' : 'STAGE_OK', JSON.stringify(results, null, 2).slice(0, 1500))
  process.exit(bad.length ? 1 : 0)
})()