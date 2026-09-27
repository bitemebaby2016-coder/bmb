// Phase 2 READ-ONLY production audit (SELECT probes only, no writes)
'use strict'
const fs = require('fs')
const path = require('path')
const PROJ = 'D:/A PROJECT/Bite Me Baby'
const REF = process.env.SUPABASE_PROJECT_REF || 'ivkdfognyiwjcmrhcnwz'
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || ''
const OUT = path.join(PROJ, 'e2e', 'prod-phase2-audit.json')

async function sql(q) {
  const r = await fetch('https://api.supabase.com/v1/projects/' + REF + '/database/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q }),
  })
  const body = await r.text()
  if (!r.ok) return { error: r.status + ' ' + body.slice(0, 300) }
  try { return JSON.parse(body) } catch { return body }
}

const QUERIES = {
  migration_history: `select version, name from supabase_migrations.schema_migrations order by version`,
  tables: `select c.relname as name, c.relkind as kind from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p','v','m') order by 1`,
  columns_orders: `select table_name, column_name, data_type, is_nullable, column_default from information_schema.columns where table_schema='public' and table_name in ('orders','order_items','payments','payment_intents') order by table_name, ordinal_position`,
  columns_products_rounds: `select table_name, column_name, data_type, column_default from information_schema.columns where table_schema='public' and table_name in ('products','delivery_rounds','business_settings','promotions') order by table_name, ordinal_position`,
  all_tables_cols: `select table_name, string_agg(column_name || ':' || data_type, ', ' order by ordinal_position) as cols from information_schema.columns where table_schema='public' and table_name not like 'pg_%' group by 1 order by 1`,
  functions: `select p.proname as name, pg_get_function_identity_arguments(p.oid) as args, p.prosecdef as security_definer, pg_get_userbyid(p.proowner) as owner from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by 1`,
  rpc_grants: `select p.proname, coalesce(array_agg(d.grantee::text order by d.grantee) filter (where d.privilege_type='EXECUTE'), '{}') as exec_to from pg_proc p join pg_namespace n on n.oid=p.pronamespace left join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) d on true where n.nspname='public' group by p.proname order by 1`,
  orders_cols: `select column_name, data_type, is_nullable, column_default from information_schema.columns where table_schema='public' and table_name='orders' order by ordinal_position`,
  order_items_cols: `select column_name, data_type from information_schema.columns where table_schema='public' and table_name='order_items' order by ordinal_position`,
  triggers: `select tgrelid::regclass as tbl, tgname, tgenabled from pg_trigger where not tgisinternal order by 1,2`,
  constraints: `select conrelid::regclass as tbl, conname, contype from pg_constraint where connamespace='public'::regnamespace order by 1`,
  rls: `select c.relname as tbl, c.relrowsecurity as rls_on, c.relforcerowsecurity as force_rls from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') order by 1`,
  policies: `select schemaname, tablename, policyname, roles::text, cmd from pg_policies where schemaname='public' order by tablename, policyname`,
  table_grants: `select table_name, string_agg(grantee || ':' || privilege_type, ', ' order by grantee) as grants from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated','service_role') group by 1 order by 1`,
  data_sanity_orders: `select payment_status, status, order_mode, count(*) as cnt from public.orders group by 1,2,3 order by 4 desc limit 40`,
  order_counts: `select (select count(*) from public.orders) as orders, (select count(*) from public.order_items) as order_items, (select count(*) from public.products) as products, (select count(*) from public.delivery_rounds) as delivery_rounds, (select count(*) from public.payment_intents) as payment_intents, (select count(*) from public.profiles) as profiles`,
  orphan_items: `select count(*) as orphan_items from public.order_items oi left join public.orders o on o.id = oi.order_id where o.id is null`,
  paid_no_pi: `select count(*) as paid_orders_no_completed_pi from public.orders o where o.payment_status='paid' and not exists (select 1 from public.payment_intents pi where pi.order_number=o.order_number and pi.status='completed')`,
  invalid_mode: `select order_mode::text as om, count(*) from public.orders group by 1 order by 2 desc`,
  rounds_sample: `select id, round_key, display_name, status, cutoff_time, delivery_start, delivery_end, max_capacity, current_count, date, scheduled_date from public.delivery_rounds order by date desc limit 15`,
  business_settings: `select key, value from public.business_settings order by key`,
  products_sample: `select id, name, price, is_available, stock, is_featured, is_preorder, available_same_day, available_preorder, delivery_round_id, scheduled_date from public.products order by name limit 25`,
  payment_intents_sample: `select status, method, count(*) from public.payment_intents group by 1,2`,
  extensions: `select extname from pg_extension order by 1`,
  views_defs: `select table_name from information_schema.views where table_schema='public' order by 1`,
  pre_orders_count: `select count(*) as pre_orders, coalesce(min(scheduled_date)::text,'-'), coalesce(max(status::text),'-') as any_status from public.pre_orders`,
  misc_counts: `select (select count(*) from public.reviews) as reviews, (select count(*) from public.promotions) as promotions, (select count(*) from public.inventory) as inventory, (select count(*) from public.audit_logs) as audit_logs, (select count(*) from public.delivery_assignments) as delivery_assignments, (select count(*) from public.drivers) as drivers, (select count(*) from public.recipes) as recipes, (select count(*) from public.content_approvals) as content_approvals, (select count(*) from public.system_errors) as system_errors`,
  orders_round_join: `select count(*) as orders_with_round from public.orders o join public.delivery_rounds r on r.id = o.delivery_round_id`,
  drivers_assignments: `select status, count(*) from public.delivery_assignments group by 1`,
  enum_values: `select t.typname, string_agg(e.enumlabel, ',' order by e.enumsortorder) as values from pg_type t join pg_enum e on e.enumtypid=t.oid group by 1 order by 1`,
  indexes: `select tablename, indexname, indexdef from pg_indexes where schemaname='public' order by tablename`,
  policy_exprs: `select c.relname as tablename, p.polname as policyname, p.polcmd as cmd, coalesce(pg_get_expr(p.polqual, p.polrelid),'<none>') as using_expr, coalesce(pg_get_expr(p.polwithcheck, p.polrelid),'<none>') as with_check from pg_policy p join pg_class c on c.oid = p.polrelid where c.relnamespace='public'::regnamespace and c.relname in ('orders','payment_intents','business_settings','customers','recipes','products','delivery_rounds','drivers')`,
  anon_orders_read: `select count(*) as anon_visible_orders_estimate from public.orders`,
  recent_orders_nonpii: `select order_number, status::text, payment_status::text, order_mode::text, scheduled_date, delivery_round_id, delivery_fee, total_amount, created_at::date from public.orders order by created_at desc limit 20`,
  functions_preorder: `select p.proname, pg_get_function_identity_arguments(p.oid) as args from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like '%pre%' or p.proname like '%round%' or p.proname like '%cutoff%' or p.proname like '%menu%' or p.proname like '%capacity%') order by 1`,
  function_sources_key: `select p.proname, length(pg_get_functiondef(p.oid)) as def_len, position('create_order_with_items' in pg_get_functiondef(p.oid)) > 0 as refs_create, position('cutoff' in pg_get_functiondef(p.oid)) > 0 as refs_cutoff, position('max_capacity' in pg_get_functiondef(p.oid)) > 0 as refs_capacity from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('create_order_with_items','ensure_rounds_for_date','enforce_menu_gate','enforce_operating_hours','enforce_pre_order_window','transition_order_status','confirm_offline_payment','record_payment_result','driver_login','driver_accept_assignment','assign_driver') order by 1`,
}

async function run() {
  if (!TOKEN) { console.log('FATAL no SUPABASE_ACCESS_TOKEN'); process.exit(1) }
  const evidence = { timestamp: new Date().toISOString(), ref: REF, data: {}, errors: {} }
  // Edge Functions deployed list (Management API, read-only GET)
  try {
    const fr = await fetch('https://api.supabase.com/v1/projects/' + REF + '/functions', {
      headers: { Authorization: 'Bearer ' + TOKEN },
    })
    evidence.data.edge_functions = await fr.json()
  } catch (e) { evidence.errors.edge_functions = String(e).slice(0, 200) }
  for (const [k, q] of Object.entries(QUERIES)) {
    const res = await sql(q)
    if (res && res.error) evidence.errors[k] = res.error
    else evidence.data[k] = res
  }
  fs.writeFileSync(OUT, JSON.stringify(evidence, null, 2), 'utf8')
  const okCount = Object.keys(evidence.data).length
  const errCount = Object.keys(evidence.errors).length
  console.log('PHASE2 AUDIT part1: queries_ok=' + okCount + ' errors=' + errCount + ' → ' + OUT)
  if (errCount) console.log(JSON.stringify(evidence.errors, null, 2).slice(0, 1500))
}
run().catch((e) => { console.log('FATAL ' + String(e).slice(0, 300)); process.exit(1) })