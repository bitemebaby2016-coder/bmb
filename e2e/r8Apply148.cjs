// R8 (2026-10-24) — production apply for ROUND-14: migration 148 (SAME_DAY no cutoff)
//   + 149 (round archive/cleanup · P0-2 "ลบไม่ได้")
//   Owner directive 2026-10-24: SAME_DAY เปิด–ปิดไม่มีคัทออฟ · คัทออฟมีเฉพาะ PRE_ORDER ·
//   รอบค้างที่ลบไม่ได้ = archive+cleanup (root cause: orders→delivery_rounds FK NO ACTION,
//   พิสูจน์แล้วด้วย e2e/p14ProbeRounds.cjs → e2e/p14ProbeRounds.json)
//   Local gates green FIRST: vitest + tsc + lint + build + Docker replay 001→149 ALL_GREEN
//   + contracts 140/143/144/146/147/148/149 PASS บน ephemeral PG
//
// STAGES (run in order): precheck → apply148 → verify148 → apply149 → verify149
//   → contract148 → contract149 → contractRegr → record
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
// log(label, await q(sql)) — รับผลลัพธ์โดยตรง (รูปแบบเดียวกับ r6Apply145)
const log = (label, r) => {
  const parsed = (() => { try { return JSON.parse(r.body) } catch { return String(r.body).slice(0, 800) } })()
  results.push({ label, status: r.status, data: parsed })
  console.log(`[${label}] status=${r.status} ${JSON.stringify(parsed).slice(0, 400)}`)
}
const save = () => fs.writeFileSync(`e2e/r8Apply148-${stage}.json`, JSON.stringify(results, null, 2))
const PROSRC = (fn) => `SELECT count(*) AS hits FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='${fn}'`
;(async () => {
  if (stage === 'precheck') {
    log('history', await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 4'))
    log('same-day-col-still-there', await q("SELECT count(*) AS has_col FROM information_schema.columns WHERE table_schema='public' AND table_name='delivery_rounds' AND column_name='same_day_cutoff'"))
    log('archived-col-absent-yet', await q("SELECT count(*) AS has_col FROM information_schema.columns WHERE table_schema='public' AND table_name='delivery_rounds' AND column_name='archived'"))
    log('body-not-148-yet', await q(`${PROSRC('create_order_with_items')} AND p.prosrc LIKE '%COALESCE(v_same_day_cutoff%'`))
    log('backup-recency', await q("SELECT count(*) AS recent_backups FROM storage.objects WHERE bucket_id='db-backups' AND created_at > now() - interval '14 days'"))
    log('round-inventory', await q("SELECT count(*) AS rounds, count(*) FILTER (WHERE scheduled_date < (now() at time zone 'Asia/Bangkok')::date) AS past FROM public.delivery_rounds"))
  } else if (stage === 'apply148') {
    log('apply-148', await q(fs.readFileSync('supabase/migrations/148_same_day_no_cutoff.sql', 'utf8')))
  } else if (stage === 'verify148') {
    log('same-day-col-gone', await q("SELECT count(*) AS has_col FROM information_schema.columns WHERE table_schema='public' AND table_name='delivery_rounds' AND column_name='same_day_cutoff'"))
    log('pattern-key-gone', await q("SELECT count(*) AS keys FROM public.business_settings bs, jsonb_array_elements(bs.value->'rounds') AS r(elem) WHERE bs.key='order_pattern' AND r.elem ? 'same_day_cutoff'"))
    log('gate-rewritten', await q(`${PROSRC('create_order_with_items')} AND p.prosrc LIKE '%v_pre_order_cutoff%' AND p.prosrc NOT LIKE '%COALESCE(v_same_day_cutoff%'`))
    log('auto-close-date-only', await q(`${PROSRC('auto_close_expired_rounds')} AND p.prosrc LIKE '%scheduled_date < v_today%' AND p.prosrc NOT LIKE '%v_now_sec%'`))
    log('fn-code-refs-to-dropped-col', await q("SELECT count(*) AS refs FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prosrc LIKE '%v_same_day_cutoff%'"))
    log('today-rounds-still-active', await q("SELECT count(*) AS active_today FROM public.delivery_rounds WHERE scheduled_date = (now() at time zone 'Asia/Bangkok')::date AND status='active'"))
  } else if (stage === 'apply149') {
    log('apply-149', await q(fs.readFileSync('supabase/migrations/149_round_archive_cleanup.sql', 'utf8')))
  } else if (stage === 'verify149') {
    log('archived-col', await q("SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='delivery_rounds' AND column_name='archived'"))
    log('archived-rows', await q("SELECT id, scheduled_date, status, archived FROM public.delivery_rounds WHERE archived ORDER BY scheduled_date"))
    log('audit-rows-149', await q("SELECT count(*) AS n FROM public.audit_logs WHERE entity_type='delivery_round' AND description LIKE 'archive%'"))
  } else if (stage === 'contract148') {
    log('contract-148', await q(fs.readFileSync('e2e/contracts_148_same_day_no_cutoff.sql', 'utf8')))
  } else if (stage === 'contract149') {
    log('contract-149', await q(fs.readFileSync('e2e/contracts_149_round_archive.sql', 'utf8')))
  } else if (stage === 'contractRegr') {
    log('contract-140-regression', await q(fs.readFileSync('e2e/contracts_140.sql', 'utf8')))
    log('contract-143-regression', await q(fs.readFileSync('e2e/contracts_143.sql', 'utf8')))
    log('contract-144-regression', await q(fs.readFileSync('e2e/contracts_144.sql', 'utf8')))
  } else if (stage === 'record') {
    log('record-148', await q("INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('148','148_same_day_no_cutoff','{}'::text[]) ON CONFLICT (version) DO NOTHING"))
    log('record-149', await q("INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('149','149_round_archive_cleanup','{}'::text[]) ON CONFLICT (version) DO NOTHING"))
    log('history-after', await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 4'))
  } else {
    console.log('unknown stage'); process.exit(1)
  }
  save()
  const bad = results.filter((r) => r.status >= 400)
  if (bad.length) { console.log('STAGE_FAIL', stage, bad.map((b) => b.label).join(',')); process.exitCode = 1; return }
  console.log('STAGE_OK', stage)
})()