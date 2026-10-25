// R13 (2026-10-25) — production apply สำหรับ G&R STAGE 1: migration 153 (promotion campaign controls)
//   Owner directive 2026-10-25: "อนุมัติ migration apply 153"
//   ทำแบบ staged precheck/apply/verify/contract/record — รูปแบบเดียวกับ r8Apply148 / r12Apply150_152
//   Local gates green FIRST (CI #129/#130 + CI #556 ALL_GREEN · contract 153 G1–G8 PASS · replay 001–153 OK)
// STAGES (รันตามลำดับ): precheck → apply153 → verify153 → contract153 → contractRegr → record
//   evidence = e2e/r13Apply153-<stage>.json (ทุก stage)
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
const save = () => fs.writeFileSync(`e2e/r13Apply153-${stage}.json`, JSON.stringify(results, null, 2))
const PROSRC = (fn) => `SELECT count(*) AS hits FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='${fn}'`
;(async () => {
  if (stage === 'precheck') {
    log('history', await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5'))
    log('backup-recency', await q("SELECT count(*) AS recent_backups FROM storage.objects WHERE bucket_id='db-backups' AND created_at > now() - interval '14 days'"))
    log('153-new-cols-absent-yet', await q("SELECT count(*) AS new_cols FROM information_schema.columns WHERE table_schema='public' AND table_name='promotions' AND column_name IN ('stackable','applies_to','max_discount_amount','usage_limit','usage_count')"))
    log('promotion-products-absent-yet', await q("SELECT count(*) AS has_table FROM information_schema.tables WHERE table_schema='public' AND table_name='promotion_products'"))
    log('promotion-policy-absent-yet', await q("SELECT count(*) AS has_row FROM public.business_settings WHERE key='promotion_policy'"))
    log('apply-rules-fn-absent-yet', await q(`${PROSRC('promotion_apply_rules')}`))
    log('order-fn-not-rewritten-yet', await q(`${PROSRC('create_order_with_items')} AND p.prosrc LIKE '%promotion_apply_rules%'`))
    log('order-fn-is-148-shape', await q(`${PROSRC('create_order_with_items')} AND p.prosrc LIKE '%v_pre_order_cutoff%'`))
    log('current-promotions', await q('SELECT count(*) AS promo_rows FROM public.promotions'))
  } else if (stage === 'apply153') {
    const sql = fs.readFileSync('supabase/migrations/153_promotion_campaign_controls.sql', 'utf8')
    log('apply-153', await q(sql))
    log('apply-153-idempotent-rerun', await q(sql))
  } else if (stage === 'verify153') {
    log('new-cols', await q("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='promotions' AND column_name IN ('stackable','applies_to','max_discount_amount','usage_limit','usage_count') ORDER BY column_name"))
    log('promotion-products-table', await q("SELECT c.relname, c.relrowsecurity, (SELECT count(*) FROM public.promotion_products) AS rows FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='promotion_products'"))
    log('promotion-products-policies', await q("SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='promotion_products' ORDER BY policyname"))
    log('policy-seed', await q("SELECT key, value FROM public.business_settings WHERE key='promotion_policy'"))
    log('fns-exist', await q("SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('promotions_enabled','promotion_budget_state','promotion_budget_ok','promotion_budget_status','promotion_apply_rules') ORDER BY p.proname"))
    log('order-fn-rewritten', await q(`${PROSRC('create_order_with_items')} AND p.prosrc LIKE '%promotion_apply_rules%'`))
    log('order-fn-still-148-base', await q(`${PROSRC('create_order_with_items')} AND p.prosrc LIKE '%v_pre_order_cutoff%'`))
    log('privs-after', await q("SELECT p.proname, has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('create_order_with_items','promotion_budget_status','promotion_apply_rules') ORDER BY p.proname"))
    log('promo-rows-intact', await q('SELECT count(*) AS promo_rows FROM public.promotions'))
    log('orders-untouched', await q('SELECT count(*) AS orders FROM public.orders'))
  } else if (stage === 'contract153') {
    // ROLLBACK ทั้งไฟล์ — fixture ใน txn (evidence; error อยู่ใน data)
    log('contract-153', await q(fs.readFileSync('e2e/contracts_153_promotion_campaign_controls.sql', 'utf8')))
  } else if (stage === 'contractRegr') {
    log('contract-148-regression', await q(fs.readFileSync('e2e/contracts_148_same_day_no_cutoff.sql', 'utf8')))
  } else if (stage === 'record') {
    log('record-153', await q("INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('153','153_promotion_campaign_controls','{}'::text[]) ON CONFLICT (version) DO NOTHING"))
    log('history-after', await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5'))
  } else {
    console.log('unknown stage'); process.exit(1)
  }
  save()
  const bad = results.filter((r) => r.status >= 400)
  if (bad.length) { console.log('STAGE_FAIL', stage, bad.map((b) => b.label).join(',')); process.exitCode = 1; return }
  console.log('STAGE_OK', stage)
})().catch((e) => { console.error(e); process.exit(1) })