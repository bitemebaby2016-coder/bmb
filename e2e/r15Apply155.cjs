// R15 (2026-10-25) — production apply สำหรับ G&R STAGE 3: migration 155 (loyalty tiers + points ledger)
//   Owner directive 2026-10-25: "apply 155"
//   ทำแบบ staged precheck/apply/verify/contract/record — รูปแบบเดียวกับ r13Apply153 / r14Apply154
//   Local gates green FIRST (push 8714fa2: tsc 0 · lint 430 ไฟล์ · vitest 143 files/1500 tests ·
//   build PWA 142 · Docker replay 001–155 ALL_GREEN · contract 155 G1–G9 PASS (rc=0) +
//   contractRegr 154/153 PASS — evidence = e2e/g155-gates-evidence.txt)
// STAGES (รันตามลำดับ): precheck → apply155 → verify155 → contract155 → contractRegr → record
//   evidence = e2e/r15Apply155-<stage>.json (ทุก stage)
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
const save = () => fs.writeFileSync(`e2e/r15Apply155-${stage}.json`, JSON.stringify(results, null, 2))
const PROSRC = (fn) => `SELECT count(*) AS hits FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='${fn}'`
const LOYALTY_FNS = `'points_ledger_guard','loyalty_policy_state','loyalty_tier_of','loyalty_order_net','loyalty_net_sales','loyalty_sync_order','loyalty_order_hook','loyalty_payment_intent_hook','loyalty_my_status','loyalty_my_history','loyalty_admin_stats','loyalty_admin_adjust'`
const LOYALTY_TRGS = `'trg_points_ledger_append_only','trg_loyalty_order_sync','trg_loyalty_intent_sync'`
;(async () => {
  if (stage === 'precheck') {
    log('history', await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5'))
    log('backup-recency', await q("SELECT count(*) AS recent_backups FROM storage.objects WHERE bucket_id='db-backups' AND created_at > now() - interval '14 days'"))
    log('points-ledger-table-absent-yet', await q("SELECT count(*) AS has_table FROM information_schema.tables WHERE table_schema='public' AND table_name='points_ledger'"))
    log('loyalty-policy-absent-yet', await q("SELECT count(*) AS has_row FROM public.business_settings WHERE key='loyalty_policy'"))
    log('loyalty-fns-absent-yet', await q(`SELECT count(*) AS has_fns FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN (${LOYALTY_FNS})`))
    log('loyalty-triggers-absent-yet', await q(`SELECT count(*) AS has_trg FROM pg_trigger WHERE tgname IN (${LOYALTY_TRGS}) AND NOT tgisinternal`))
    log('order-fn-untouched', await q(`${PROSRC('create_order_with_items')} AND p.prosrc LIKE '%loyalty%'`))
    log('order-fn-is-current-shape', await q(`${PROSRC('create_order_with_items')} AND p.prosrc NOT LIKE '%loyalty%' AND p.prosrc NOT LIKE '%referral%'`))
    // กัน contract fixture ชนข้อมูลจริง (บทเรียน 153 G4 / 154 G4: ห้ามพึ่ง ambient data)
    log('fixture-phones-free', await q("SELECT count(*) AS clash FROM public.orders WHERE regexp_replace(COALESCE(customer_phone,''), '\\D', '', 'g') LIKE '099155000%'"))
    log('customers-rows-scale', await q('SELECT count(*) AS customers_rows FROM public.customers'))
    log('orders-intact', await q('SELECT count(*) AS orders_rows FROM public.orders'))
  } else if (stage === 'apply155') {
    const sql = fs.readFileSync('supabase/migrations/155_loyalty_tiers_points.sql', 'utf8')
    log('apply-155', await q(sql))
    log('apply-155-idempotent-rerun', await q(sql))
  } else if (stage === 'verify155') {
    log('points-ledger-table', await q("SELECT c.relname, c.relrowsecurity, (SELECT count(*) FROM public.points_ledger) AS rows FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='points_ledger'"))
    log('deny-policies', await q("SELECT count(*) AS policies FROM pg_policies WHERE schemaname='public' AND tablename='points_ledger'"))
    log('policy-seed', await q("SELECT key, value FROM public.business_settings WHERE key='loyalty_policy'"))
    log('fns-exist', await q(`SELECT count(*) AS fn_count FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN (${LOYALTY_FNS})`))
    log('triggers-exist', await q(`SELECT t.tgname, c.relname AS on_table FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE t.tgname IN (${LOYALTY_TRGS}) AND NOT t.tgisinternal AND n.nspname='public' ORDER BY t.tgname`))
    log('anon-privs', await q("SELECT p.proname, has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('loyalty_my_status','loyalty_my_history','loyalty_admin_stats','loyalty_admin_adjust') ORDER BY p.proname"))
    log('auth-exec-rpcs', await q("SELECT p.proname, has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_exec FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('loyalty_my_status','loyalty_my_history','loyalty_admin_stats','loyalty_admin_adjust') ORDER BY p.proname"))
    log('order-fn-still-untouched', await q(`${PROSRC('create_order_with_items')} AND p.prosrc LIKE '%loyalty%'`))
    log('ledger-empty-no-backfill', await q('SELECT count(*) AS ledger_rows FROM public.points_ledger'))
    log('promo-rows-intact', await q('SELECT count(*) AS promo_rows FROM public.promotions'))
    log('orders-untouched', await q('SELECT count(*) AS orders FROM public.orders'))
  } else if (stage === 'contract155') {
    // ROLLBACK ทั้งไฟล์ — fixture ใน txn (error อยู่ใน data · status ดูที่ 4xx)
    log('contract-155', await q(fs.readFileSync('e2e/contracts_155_loyalty_tiers.sql', 'utf8')))
  } else if (stage === 'contractRegr') {
    // regression: stage ก่อนหน้าต้องยังเขียว (154 มี trigger บน orders เดียวกับ 155 · 153 · 148 order spine)
    log('contract-154-regression', await q(fs.readFileSync('e2e/contracts_154_referral_program.sql', 'utf8')))
    log('contract-153-regression', await q(fs.readFileSync('e2e/contracts_153_promotion_campaign_controls.sql', 'utf8')))
    log('contract-148-regression', await q(fs.readFileSync('e2e/contracts_148_same_day_no_cutoff.sql', 'utf8')))
  } else if (stage === 'record') {
    log('record-155', await q("INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('155','155_loyalty_tiers_points','{}'::text[]) ON CONFLICT (version) DO NOTHING"))
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