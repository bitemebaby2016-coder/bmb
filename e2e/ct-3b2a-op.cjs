'use strict'
// STEP 3B-2A — production verification (READ-ONLY). No writes, no mutations.
// Verifies the RLS/policy reality the 3B-2A read-model depends on:
//   - order_status_history → admin-only SELECT (migration 040)
//   - delivery_assignments → admin/driver-scoped SELECT (migration 020)
//   - orders display columns (order_mode/scheduled_date/source_channel/external_ref_id)
//   - audit_logs admin SELECT (migration 018)
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || ''
const REF = 'ivkdfognyiwjcmrhcnwz'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fet = async (u, i) => { let last; for (let a = 0; a < 5; a++) { try { return await fetch(u, i) } catch (e) { last = e; if (a === 4) break; await sleep(1200 * (a + 1)) } } throw last }
async function q(sql) {
  const r = await fet(`https://api.supabase.com/v1/projects/${REF}/database/query`, { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: sql }) })
  const b = await r.text(); if (!r.ok) throw new Error('MGMT ' + r.status + ' ' + b.slice(0, 220)); return JSON.parse(b)
}
;(async () => {
  console.log('== 3B-2A: RLS policies (order_status_history / delivery_assignments / audit_logs) ==')
  console.log(JSON.stringify(await q("select tablename, policyname, cmd, roles::text, qual is not null as has_qual from pg_policies where schemaname='public' and tablename in ('order_status_history','delivery_assignments','audit_logs') order by tablename, policyname")))
  console.log('== orders display columns present ==')
  console.log(JSON.stringify(await q("select column_name from information_schema.columns where table_schema='public' and table_name='orders' and column_name in ('order_mode','scheduled_date','source_channel','external_ref_id','delivery_round_id','payment_status','payment_method') order by column_name")))
  console.log('== order_status_history columns ==')
  console.log(JSON.stringify(await q("select column_name from information_schema.columns where table_schema='public' and table_name='order_status_history' order by ordinal_position")))
  console.log('== delivery_assignments lifecycle columns ==')
  console.log(JSON.stringify(await q("select column_name from information_schema.columns where table_schema='public' and table_name='delivery_assignments' and column_name in ('order_number','driver_id','status','assigned_at','accepted_at','picked_up_at','in_transit_at','delivered_at','cancelled_at') order by ordinal_position")))
  console.log('== state machine integrity (no force paths): transition RPC + guard trigger live ==')
  console.log(JSON.stringify(await q("select p.proname from pg_proc p where p.proname in ('transition_order_status','order_transition_allowed','guard_order_status_transition','cancel_order') order by proname")))
  console.log('== read-only distribution (TEST/QA data only) ==')
  console.log(JSON.stringify(await q("select order_mode, count(*)::int c from public.orders group by order_mode order by order_mode")))
  console.log(JSON.stringify(await q("select payment_status, count(*)::int c from public.orders group by payment_status order by payment_status")))
  console.log(JSON.stringify(await q("select status, count(*)::int c from public.delivery_assignments group by status order by status")))
  console.log('3B-2A PROD PROBE: READ-ONLY COMPLETE')
})().catch((e) => { console.error('FATAL', String(e).slice(0, 250)); process.exit(1) })
