// P14 (ROUND-14 / P0-2) — READ-ONLY production probe: why admin rounds "ลบไม่ได้"
//   Owner 2026-10-24: "บางอันลบไม่ได้ ที่ค้างทั้งหมดเป็นพวกลบไม่ได้"
//   Rules: no INSERT/UPDATE/DELETE — SELECT against Management API only.
//
//   node e2e/p14ProbeRounds.cjs           -> runs every probe, writes e2e/p14ProbeRounds.json
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
const results = []
const log = async (label, query) => {
  const r = await q(query)
  const parsed = (() => { try { return JSON.parse(r.body) } catch { return r.body.slice(0, 800) } })()
  results.push({ label, status: r.status, data: parsed })
  console.log(`[${label}] status=${r.status} ${JSON.stringify(parsed).slice(0, 500)}`)
}
;(async () => {
  // 1) FK constraints referencing delivery_rounds (delete_rule = why DELETE fails)
  await log('fk-ref-delivery_rounds', `
    SELECT tc.table_name AS child, kcu.column_name, tc.constraint_name, rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name
      JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
      JOIN information_schema.referential_constraints rc ON rc.constraint_name = tc.constraint_name
     WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
       AND ccu.table_name = 'delivery_rounds'
     ORDER BY tc.table_name`)

  // 2) round inventory: how many rows exist, by status / by age
  await log('round-inventory', `
    SELECT status,
           count(*) AS rows,
           count(*) FILTER (WHERE scheduled_date < (now() at time zone 'Asia/Bangkok')::date) AS past,
           count(*) FILTER (WHERE scheduled_date = (now() at time zone 'Asia/Bangkok')::date) AS today,
           count(*) FILTER (WHERE scheduled_date > (now() at time zone 'Asia/Bangkok')::date) AS future
      FROM public.delivery_rounds GROUP BY status ORDER BY status`)

  // 3) rounds that CANNOT be deleted = referenced by orders (NO ACTION FK)
  await log('rounds-with-orders', `
    SELECT r.status, count(DISTINCT r.id) AS rounds, count(o.id) AS orders
      FROM public.delivery_rounds r
      JOIN public.orders o ON o.delivery_round_id = r.id
     GROUP BY r.status ORDER BY r.status`)

  // 4) stuck candidates: past rounds (the "ค้าง" pile) with/without orders
  await log('stuck-past-rounds', `
    SELECT count(*) FILTER (WHERE r.scheduled_date < (now() at time zone 'Asia/Bangkok')::date) AS past_total,
           count(*) FILTER (WHERE r.scheduled_date < (now() at time zone 'Asia/Bangkok')::date
                              AND NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.delivery_round_id = r.id)) AS past_order_free,
           count(*) FILTER (WHERE r.scheduled_date < (now() at time zone 'Asia/Bangkok')::date
                              AND EXISTS (SELECT 1 FROM public.orders o WHERE o.delivery_round_id = r.id)) AS past_with_orders,
           count(*) FILTER (WHERE r.scheduled_date > (now() at time zone 'Asia/Bangkok')::date
                              AND r.status = 'active' AND r.current_count = 0) AS future_empty_active
      FROM public.delivery_rounds r`)

  // 5) other referencing tables that block hard delete (products / pre_orders ...)
  await log('child-row-counts', `
    SELECT (SELECT count(*) FROM public.orders WHERE delivery_round_id IS NOT NULL) AS orders_linked,
           (SELECT count(*) FROM public.products WHERE delivery_round_id IS NOT NULL) AS products_linked,
           (SELECT count(*) FROM public.pre_orders WHERE delivery_round_id IS NOT NULL) AS pre_orders_linked,
           (SELECT count(*) FROM public.production_batches WHERE delivery_round_id IS NOT NULL) AS batches_linked`)

  // 6) RLS gate for the admin doing the delete (is_branch_admin / is_admin definitions + admins)
  await log('admin-rls-gates', `
    SELECT p.proname, left(p.prosrc, 600) AS src
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname='public' AND p.proname IN ('is_branch_admin','is_admin','is_tenant_admin')`)

  await log('admin-profiles', `
    SELECT pr.role, pr.branch_id IS NOT NULL AS has_branch, count(*)
      FROM public.profiles pr GROUP BY 1,2 ORDER BY 1,2`)

  // 7) RLS policies actually in force on delivery_rounds (can the admin DELETE at all?)
  await log('rounds-policies', `
    SELECT policyname, cmd, roles::text AS roles, qual, with_check
      FROM pg_policies WHERE schemaname='public' AND tablename='delivery_rounds'
     ORDER BY policyname`)

  // 8) same_day_cutoff column still present? (P0-1 precheck)
  await log('same-day-column', `
    SELECT count(*) AS same_day_col
      FROM information_schema.columns
     WHERE table_schema='public' AND table_name='delivery_rounds' AND column_name='same_day_cutoff'`)

  fs.writeFileSync('e2e/p14ProbeRounds.json', JSON.stringify(results, null, 2))
  console.log('saved e2e/p14ProbeRounds.json')
  const bad = results.filter((r) => r.status >= 400)
  process.exit(bad.length ? 1 : 0)
})()