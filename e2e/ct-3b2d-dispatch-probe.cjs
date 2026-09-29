'use strict'
// STEP 3B-2D — dispatch/driver production probe. READ-ONLY: pure SELECTs only.
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || ''
const REF = 'ivkdfognyiwjcmrhcnwz'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fet = async (u, i) => { let last; for (let a = 0; a < 5; a++) { try { return await fetch(u, i) } catch (e) { last = e; if (a === 4) break; await sleep(1200 * (a + 1)) } } throw last }
async function q(sql) {
  const r = await fet(`https://api.supabase.com/v1/projects/${REF}/database/query`, { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: sql }) })
  const b = await r.text(); if (!r.ok) throw new Error('MGMT ' + r.status + ' ' + b.slice(0, 220)); return JSON.parse(b)
}
;(async () => {
  console.log('== driver/delivery/tracking RPCs live (arg signatures) ==')
  console.log(JSON.stringify(await q("select proname, pg_get_function_arguments(oid) args from pg_proc where pronamespace='public'::regnamespace and proname in ('assign_driver','driver_login','driver_accept_assignment','driver_update_delivery_status','my_deliveries','list_drivers','link_driver_user','upsert_driver','transition_order_status','order_ready_to_make') order by proname")))
  console.log('== drivers table (records; no secrets — id/name/phone/status) ==')
  console.log(JSON.stringify(await q('select id, name, phone, status, user_id is not null as jwt_linked from public.drivers order by created_at')))
  console.log('== delivery_assignments distribution ==')
  console.log(JSON.stringify(await q('select status, count(*)::int from public.delivery_assignments group by status')))
  console.log('== assignment↔order linkage (orphan/consistency) ==')
  console.log(JSON.stringify(await q("select da.order_number, da.status a_status, o.status o_status from public.delivery_assignments da left join public.orders o on o.order_number = da.order_number order by da.assigned_at desc limit 20")))
  console.log('== READY_FOR_DISPATCH queue (current dispatch work) ==')
  console.log(JSON.stringify(await q("select o.order_number, o.order_mode, o.payment_status, o.payment_method, (da.status) assignment, (select count(*)::int from order_items oi where oi.order_id = o.id) items from orders o left join delivery_assignments da on da.order_number = o.order_number where o.status = 'ready_for_dispatch' order by o.updated_at desc")))
  console.log('== RLS on drivers/delivery_assignments/order_status_history ==')
  console.log(JSON.stringify(await q("select tablename, policyname, cmd, roles from pg_policies where schemaname='public' and tablename in ('drivers','delivery_assignments','order_status_history') order by tablename, policyname")))
  console.log('== track_attempts / tracking tables existence ==')
  console.log(JSON.stringify(await q("select table_name from information_schema.tables where table_schema='public' and (table_name ilike '%track%' or table_name like '%tracking%')")))
  console.log('== RLS enabled? ==')
  console.log(JSON.stringify(await q("select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname='public' and c.relname in ('drivers','delivery_assignments','order_status_history')")))
  console.log('3B-2D PROD PROBE: READ-ONLY COMPLETE')
})().catch((e) => { console.error('FATAL', String(e).slice(0, 250)); process.exit(1) })
