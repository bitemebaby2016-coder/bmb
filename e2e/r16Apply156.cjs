// R16 (2026-10-26) — production apply สำหรับ migration 156 (G&R STAGE 4: Engagement & Play)
//   Owner directive 2026-10-26: "apply 156"
//   ทำแบบ staged precheck/apply/verify/contract/contractRegr/record — รูปแบบเดียวกับ r15Apply155
//   Local gates green (push 4cf837e): tsc 0 · lint 432 ไฟล์ · vitest 144 files/1517 tests 0 fail ·
//   build PWA 142 · Docker replay 001–156 ALL_GREEN · contract 156 G1–G9 PASS (rc=0) +
//   contractRegr 155/154/153/148 PASS — evidence = e2e/g156-gates-evidence.txt
// STAGES (รันตามลำดับ): precheck → apply156 → verify156 → contract156 → contractRegr → record
//   evidence = e2e/r16Apply156-<stage>.json (ทุก stage)
// หมายเหตุ: contract stage เพิ่มสแกน 'ERROR:' ใน body (นอกเหนือจาก status>=400) — fail closed
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
  const parsed = (() => { try { return JSON.parse(r.body) } catch { return String(r.body).slice(0, 800) } })()
  results.push({ label, status: r.status, data: parsed })
  console.log(`[${label}] status=${r.status} ${JSON.stringify(parsed).slice(0, 1600)}`)
}
const save = () => fs.writeFileSync(`e2e/r16Apply156-${stage}.json`, JSON.stringify(results, null, 2))
const PROSRC = (fn) => `SELECT count(*) AS hits FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='${fn}'`
// 16 functions ของ 156 (ตาม contract G1)
const E156_FNS = `'spin_policy_state','spin_status','spin_reward','affiliate_policy_state',` +
  `'affiliate_normalize_code','affiliate_my_code','affiliate_claim','affiliate_sync_order',` +
  `'affiliate_order_hook','affiliate_intent_hook','rewards_catalog_list',` +
  `'rewards_admin_list','rewards_admin_save','rewards_admin_remove','spin_admin_stats','affiliate_admin_stats'`
const E156_TRGS = `'trg_affiliate_order_sync','trg_affiliate_intent_sync'`
const E156_TABLES = `'rewards_catalog','affiliate_codes','affiliate_attributions'`
;(async () => {
  if (stage === 'precheck') {
    log('history', await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5'))
    log('backup-recency', await q("SELECT count(*) AS recent_backups FROM storage.objects WHERE bucket_id='db-backups' AND created_at > now() - interval '14 days'"))
    log('new-tables-absent-yet', await q(`SELECT count(*) AS has_tables FROM information_schema.tables WHERE table_schema='public' AND table_name IN (${E156_TABLES})`))
    log('policy-rows-absent-yet', await q("SELECT count(*) AS has_rows FROM public.business_settings WHERE key IN ('spin_policy','affiliate_policy')"))
    log('e156-fns-absent-yet', await q(`SELECT count(*) AS has_fns FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN (${E156_FNS})`))
    log('e156-triggers-absent-yet', await q(`SELECT count(*) AS has_trg FROM pg_trigger WHERE tgname IN (${E156_TRGS}) AND NOT tgisinternal`))
    log('points-ledger-present-from-155', await q("SELECT count(*) AS has_table FROM information_schema.tables WHERE table_schema='public' AND table_name='points_ledger'"))
    log('ledger-constraint-not-yet-extended', await q("SELECT count(*) AS spin_in_check FROM pg_constraint WHERE conname='points_ledger_entry_type_check' AND pg_get_constraintdef(oid) LIKE '%spin%'"))
    log('order-fn-untouched', await q(`${PROSRC('create_order_with_items')} AND p.prosrc ~ '(affiliate|spin|loyalty|referral)'`))
    log('order-fn-is-current-shape', await q(`${PROSRC('create_order_with_items')} AND p.prosrc !~ '(affiliate|spin|loyalty|referral)'`))
    // กัน contract fixture ชนข้อมูลจริง (บทเรียน 153/154/155 G4: ห้ามพึ่ง ambient data)
    log('fixture-phones-free', await q("SELECT (SELECT count(*) FROM public.orders WHERE COALESCE(customer_phone,'') LIKE '099156%') AS order_clash, (SELECT count(*) FROM auth.users WHERE COALESCE(phone,'') LIKE '099156%') AS user_clash"))
  } else if (stage === 'apply156') {
    const sql = fs.readFileSync('supabase/migrations/156_engagement_play.sql', 'utf8')
    log('apply-156', await q(sql))
    log('apply-156-idempotent-rerun', await q(sql))
  } else if (stage === 'verify156') {
    log('new-tables', await q(`SELECT c.relname, c.relrowsecurity, (SELECT count(*) FROM public.rewards_catalog) AS catalog_rows, (SELECT count(*) FROM public.affiliate_codes) AS code_rows, (SELECT count(*) FROM public.affiliate_attributions) AS att_rows FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN (${E156_TABLES}) ORDER BY c.relname`))
    log('anon-table-privs', await q("SELECT has_table_privilege('anon','public.rewards_catalog','SELECT') AS anon_catalog, has_table_privilege('anon','public.affiliate_codes','SELECT') AS anon_codes, has_table_privilege('anon','public.affiliate_attributions','SELECT') AS anon_att, has_table_privilege('authenticated','public.rewards_catalog','SELECT') AS auth_catalog"))
    log('policy-seeds', await q("SELECT key, value FROM public.business_settings WHERE key IN ('spin_policy','affiliate_policy') ORDER BY key"))
    log('catalog-seed', await q('SELECT id, name, points_cost, is_active, sort_order FROM public.rewards_catalog ORDER BY sort_order'))
    log('e156-fns-exist', await q(`SELECT count(*) AS fn_count FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN (${E156_FNS})`))
    log('e156-triggers-exist', await q(`SELECT t.tgname, c.relname AS on_table FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE t.tgname IN (${E156_TRGS}) AND NOT t.tgisinternal AND n.nspname='public' ORDER BY t.tgname`))
    log('anon-privs', await q("SELECT p.proname, has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('spin_status','spin_reward','affiliate_my_code','affiliate_claim','rewards_catalog_list','spin_admin_stats','affiliate_admin_stats') ORDER BY p.proname"))
    log('auth-exec-rpcs', await q("SELECT p.proname, has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_exec FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('spin_status','spin_reward','affiliate_my_code','affiliate_claim','rewards_catalog_list','spin_admin_stats','affiliate_admin_stats') ORDER BY p.proname"))
    log('ledger-constraint-extended', await q("SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname='points_ledger_entry_type_check'"))
    log('ledger-indexes', await q("SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname IN ('idx_points_ledger_spin_daily','idx_points_ledger_affiliate','idx_points_ledger_affiliate_order','idx_points_ledger_affiliate_earn','idx_affiliate_att_owner') ORDER BY indexname"))
    log('order-fn-still-untouched', await q(`${PROSRC('create_order_with_items')} AND p.prosrc ~ '(affiliate|spin|loyalty|referral)'`))
    log('ledger-empty-no-backfill', await q('SELECT count(*) AS ledger_rows FROM public.points_ledger'))
    log('orders-intact', await q('SELECT count(*) AS orders FROM public.orders'))
  } else if (stage === 'contract156') {
    // ROLLBACK ทั้งไฟล์ — fixture ใน txn (error อยู่ใน data · status ดูที่ 4xx)
    log('contract-156', await q(fs.readFileSync('e2e/contracts_156_engagement_play.sql', 'utf8')))
  } else if (stage === 'contractRegr') {
    // regression: stage ก่อนหน้าต้องยังเขียว (156 เพิ่ม trigger บน orders/payment_intents เหมือน 155/154 · 153 · 148 order spine)
    log('contract-155-regression', await q(fs.readFileSync('e2e/contracts_155_loyalty_tiers.sql', 'utf8')))
    log('contract-154-regression', await q(fs.readFileSync('e2e/contracts_154_referral_program.sql', 'utf8')))
    log('contract-153-regression', await q(fs.readFileSync('e2e/contracts_153_promotion_campaign_controls.sql', 'utf8')))
    log('contract-148-regression', await q(fs.readFileSync('e2e/contracts_148_same_day_no_cutoff.sql', 'utf8')))
  } else if (stage === 'record') {
    log('record-156', await q("INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('156','156_engagement_play','{}'::text[]) ON CONFLICT (version) DO NOTHING"))
    log('history-after', await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5'))
  } else {
    console.log('unknown stage'); process.exit(1)
  }
  save()
  const bad = results.filter((r) => r.status >= 400)
  const bodyErr = results.filter((r) => r.label.startsWith('contract') && JSON.stringify(r.data).includes('ERROR:'))
  if (bad.length || bodyErr.length) {
    console.log('STAGE_FAIL', stage, [...bad, ...bodyErr].map((b) => b.label).join(','))
    process.exitCode = 1
    return
  }
  console.log('STAGE_OK', stage)
})().catch((e) => { console.error(e); process.exit(1) })