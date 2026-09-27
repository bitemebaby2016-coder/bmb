// Phase 5 READ-ONLY operational probe (SELECT only)
'use strict'
const fs = require('fs')
const path = require('path')
const PROJ = 'D:/A PROJECT/Bite Me Baby'
const REF = 'ivkdfognyiwjcmrhcnwz'
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || ''
const OUT = path.join(PROJ, 'e2e', 'prod-phase5-operational.json')

async function sql(q) {
  const r = await fetch('https://api.supabase.com/v1/projects/' + REF + '/database/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q }),
  })
  const body = await r.text()
  if (!r.ok) return { error: r.status + ' ' + body.slice(0, 200) }
  try { return JSON.parse(body) } catch { return body }
}

const QUERIES = {
  fn_order_transition_allowed: `select pg_get_functiondef(oid) as def from pg_proc where proname='order_transition_allowed'`,
  fn_enforce_operating_hours: `select pg_get_functiondef(oid) as def from pg_proc where proname='enforce_operating_hours'`,
  fn_enforce_pre_order_window: `select pg_get_functiondef(oid) as def from pg_proc where proname='enforce_pre_order_window'`,
  fn_driver_login: `select pg_get_functiondef(oid) as def from pg_proc where proname='driver_login'`,
  fn_driver_accept: `select pg_get_functiondef(oid) as def from pg_proc where proname='driver_accept_assignment'`,
  fn_confirm_offline: `select pg_get_functiondef(oid) as def from pg_proc where proname='confirm_offline_payment'`,
  fn_record_payment: `select pg_get_functiondef(oid) as def from pg_proc where proname='record_payment_result'`,
  fn_create_order_head: `select substring(pg_get_functiondef(oid) from 1 for 6000) as def from pg_proc where proname='create_order_with_items'`,
  consistency_states: `select status::text as st, payment_status::text as pst, count(*) from public.orders group by 1,2 order by 3 desc`,
  delivered_no_paid: `select count(*) as delivered_not_paid from public.orders where status='delivered' and payment_status not in ('paid','refund')`,
  cancelled_paid: `select count(*) as cancelled_paid from public.orders where status='cancelled' and payment_status='paid'`,
  payment_no_order: `select count(*) as pi_no_order from public.payment_intents pi left join public.orders o on o.order_number=pi.order_number where o.order_number is null`,
  duplicate_pi: `select count(*) as dup_pi from (select order_number, count(*) c from public.payment_intents group by 1 having count(*)>1) t`,
  audit_by_action: `select action, count(*) from public.audit_logs group by 1 order by 2 desc`,
  audit_order_events: `select action, entity_id, created_at::date from public.audit_logs where entity_type='order' order by created_at desc limit 10`,
  history_tables: `select table_name from information_schema.tables where table_schema='public' and (table_name ilike '%history%' or table_name ilike '%event%' or table_name ilike '%timeline%')`,
  assignment_models: `select column_name, data_type from information_schema.columns where table_schema='public' and table_name='delivery_assignments' order by ordinal_position`,
  provider_orders_state: `select count(*) as provider_orders_rows from public.provider_orders`,
  production_batches_state: `select count(*) as batches, (select count(*) from public.production_batch_items) as items from public.production_batches`,
  trigger_list: `select tgrelid::regclass as tbl, tgname from pg_trigger where not tgisinternal order by 1,2`,
  fn_transition_status_rpc: `select pg_get_function_identity_arguments(oid) as args from pg_proc where proname='transition_order_status'`,
  fn_capacity_check_in_create: `select position('max_capacity' in pg_get_functiondef(oid)) as cap_pos, position('cutoff_time' in pg_get_functiondef(oid)) as cutoff_pos, position('current_count' in pg_get_functiondef(oid)) as cnt_pos, position('FOR UPDATE' in pg_get_functiondef(oid)) as lock_pos, position('delivery_rounds' in pg_get_functiondef(oid)) as rounds_pos from pg_proc where proname='create_order_with_items'`,
}

async function run() {
  if (!TOKEN) { console.log('FATAL no SUPABASE_ACCESS_TOKEN'); process.exit(1) }
  const ev = { timestamp: new Date().toISOString(), data: {}, errors: {} }
  for (const [k, q] of Object.entries(QUERIES)) {
    const res = await sql(q)
    if (res && res.error) ev.errors[k] = res.error
    else ev.data[k] = res
  }
  fs.writeFileSync(OUT, JSON.stringify(ev, null, 2), 'utf8')
  console.log('PHASE5 done ok=' + Object.keys(ev.data).length + ' errors=' + Object.keys(ev.errors).length)
  if (Object.keys(ev.errors).length) console.log(JSON.stringify(ev.errors).slice(0, 800))
}
run().catch((e) => { console.error('FATAL ' + String(e).slice(0, 300)); process.exit(1) })