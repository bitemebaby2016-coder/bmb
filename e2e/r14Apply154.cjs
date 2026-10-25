// R14 (2026-10-25) — production apply สำหรับ G&R STAGE 2: migration 154 (referral program)
//   Owner directive 2026-10-25: "apply 154"
//   ทำแบบ staged precheck/apply/verify/contract/record — รูปแบบเดียวกับ r13Apply153 / r8Apply148
//   Local gates green FIRST (push 4b6528e: CI #558 SUCCESS + Contract Tests #132 SUCCESS ·
//   contract 154 G1–G9 PASS · Docker replay 001–154 MIGRATIONS_OK · contracts 20/20 —
//   evidence = e2e/g154-gates-evidence.txt)
// STAGES (รันตามลำดับ): precheck → apply154 → verify154 → contract154 → contractRegr → record
//   evidence = e2e/r14Apply154-<stage>.json (ทุก stage)
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
const save = () => fs.writeFileSync(`e2e/r14Apply154-${stage}.json`, JSON.stringify(results, null, 2))
const PROSRC = (fn) => `SELECT count(*) AS hits FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='${fn}'`
const REFERRAL_FNS = `'referral_enabled','referral_policy_state','referral_normalize_code','referral_normalize_phone','referral_my_code','referral_preview','referral_issue_rewards','referral_reverse_rewards','referral_order_status_hook','referral_claim','referral_my_status','referral_admin_stats','referral_resolve_attribution'`
;(async () => {
  if (stage === 'precheck') {
    log('history', await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5'))
    log('backup-recency', await q("SELECT count(*) AS recent_backups FROM storage.objects WHERE bucket_id='db-backups' AND created_at > now() - interval '14 days'"))
    log('customers-referral-cols-absent-yet', await q("SELECT count(*) AS new_cols FROM information_schema.columns WHERE table_schema='public' AND table_name='customers' AND column_name IN ('referral_code','referred_by')"))
    log('attributions-table-absent-yet', await q("SELECT count(*) AS has_table FROM information_schema.tables WHERE table_schema='public' AND table_name='referral_attributions'"))
    log('rewards-table-absent-yet', await q("SELECT count(*) AS has_table FROM information_schema.tables WHERE table_schema='public' AND table_name='referral_rewards'"))
    log('referral-policy-absent-yet', await q("SELECT count(*) AS has_row FROM public.business_settings WHERE key='referral_policy'"))
    log('referral-fns-absent-yet', await q(`SELECT count(*) AS has_fns FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN (${REFERRAL_FNS})`))
    log('trigger-absent-yet', await q("SELECT count(*) AS has_trg FROM pg_trigger WHERE tgname='trg_referral_order_status' AND NOT tgisinternal"))
    log('order-fn-untouched', await q(`${PROSRC('create_order_with_items')} AND p.prosrc LIKE '%referral%'`))
    log('order-fn-is-148-shape', await q(`${PROSRC('create_order_with_items')} AND p.prosrc LIKE '%v_pre_order_cutoff%'`))
    // กัน contract fixture ชนข้อมูลจริง (บทเรียน 153 G4 / 154 G4: ห้ามพึ่ง ambient data)
    log('fixture-phones-free', await q("SELECT count(*) AS clash FROM public.orders WHERE regexp_replace(COALESCE(customer_phone,''), '\\D', '', 'g') LIKE '099154000%'"))
    log('customers-rows-backfill-scale', await q('SELECT count(*) AS customers_rows FROM public.customers'))
  } else if (stage === 'apply154') {
    const sql = fs.readFileSync('supabase/migrations/154_referral_program.sql', 'utf8')
    log('apply-154', await q(sql))
    log('apply-154-idempotent-rerun', await q(sql))
  }
  else if (stage === 'verify154') {
    log('customers-cols', await q("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='customers' AND column_name IN ('referral_code','referred_by') ORDER BY column_name"))
    log('attributions-table', await q("SELECT c.relname, c.relrowsecurity, (SELECT count(*) FROM public.referral_attributions) AS rows FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='referral_attributions'"))
    log('rewards-table', await q("SELECT c.relname, c.relrowsecurity, (SELECT count(*) FROM public.referral_rewards) AS rows FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='referral_rewards'"))
    log('deny-policies', await q("SELECT count(*) AS policies FROM pg_policies WHERE schemaname='public' AND tablename IN ('referral_attributions','referral_rewards')"))
    log('policy-seed', await q("SELECT key, value FROM public.business_settings WHERE key='referral_policy'"))
    log('fns-exist', await q(`SELECT count(*) AS fn_count FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN (${REFERRAL_FNS})`))
    log('trigger-exists', await q("SELECT t.tgname, c.relname AS on_table FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE t.tgname='trg_referral_order_status' AND NOT t.tgisinternal AND n.nspname='public'"))
    log('normalizers', await q("SELECT public.referral_normalize_phone('+66 81 234 5678') AS intl_to_local, public.referral_normalize_phone('081-234-5678') AS local_fmt, public.referral_normalize_code('  bmb-abc1234 ') AS code_norm"))
    log('anon-privs', await q("SELECT p.proname, has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('referral_my_code','referral_claim','referral_admin_stats','referral_preview') ORDER BY p.proname"))
    log('order-fn-still-untouched', await q(`${PROSRC('create_order_with_items')} AND p.prosrc LIKE '%referral%'`))
    log('backfill-complete', await q("SELECT count(*) AS missing_codes FROM public.customers WHERE referral_code IS NULL"))
    log('promo-rows-intact', await q('SELECT count(*) AS promo_rows FROM public.promotions'))
    log('orders-untouched', await q('SELECT count(*) AS orders FROM public.orders'))
  } else if (stage === 'contract154') {
    // ROLLBACK ทั้งไฟล์ — fixture ใน txn (error อยู่ใน data · status ดูที่ 4xx)
    log('contract-154', await q(fs.readFileSync('e2e/contracts_154_referral_program.sql', 'utf8')))
  } else if (stage === 'contractRegr') {
    // regression: stage ก่อนหน้า (153 promotions) + order spine (148) ต้องยังเขียว
    log('contract-153-regression', await q(fs.readFileSync('e2e/contracts_153_promotion_campaign_controls.sql', 'utf8')))
    log('contract-148-regression', await q(fs.readFileSync('e2e/contracts_148_same_day_no_cutoff.sql', 'utf8')))
  } else if (stage === 'record') {
    log('record-154', await q("INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('154','154_referral_program','{}'::text[]) ON CONFLICT (version) DO NOTHING"))
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