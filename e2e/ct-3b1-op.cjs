'use strict'
// STEP 3B-1 — OPERATIONAL CORE audit evidence (READ-ONLY). No writes.
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || ''
const REF = 'ivkdfognyiwjcmrhcnwz'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fet = async (u, i) => { let last; for (let a = 0; a < 5; a++) { try { return await fetch(u, i) } catch (e) { last = e; if (a === 4) break; await sleep(1200 * (a + 1)) } } throw last }
async function q(sql) {
  const r = await fet(`https://api.supabase.com/v1/projects/${REF}/database/query`, { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: sql }) })
  const b = await r.text(); if (!r.ok) throw new Error('MGMT ' + r.status + ' ' + b.slice(0, 220)); return JSON.parse(b)
}
;(async () => {
  console.log('== OPERATIONAL RPC PRESENCE ==')
  const rpcs = ['create_order_with_items','transition_order_status','confirm_offline_payment','record_payment_result','mark_payment_failed','quote_pre_order','create_pre_order_with_items','cancel_pre_order','validate_pre_order_delivery','ensure_rounds_for_date','increment_delivery_round_count','decrement_delivery_round_count','release_round_capacity_on_terminal','order_setting','track_order','create_production_batch','kitchen_queue','get_kitchen_summary','restore_inventory_for_order','deduct_inventory_for_order','driver_login','driver_accept_assignment','driver_update_delivery_status','my_deliveries','assign_driver','upsert_driver','link_driver_user','create_notification','append_audit_log','compute_delivery_fee_rpc','is_admin','write_order_status_history','guard_order_status_transition','update_inventory_status','create_payment_intent_record','submit_offline_payment_reference']
  const inList = rpcs.map((r) => `'${r}'`).join(',')
  const rows = await q(`select routine_name from information_schema.routines where routine_schema='public' and routine_name in (${inList})`)
  const present = new Set(rows.map((r) => r.routine_name))
  for (const r of rpcs) console.log(`${r}: ${present.has(r) ? 'PRESENT' : 'ABSENT'}`)
  console.log('== ORDERS: status distribution (production) ==')
  console.log(JSON.stringify(await q("select status, payment_status, order_mode, count(*) c from public.orders group by status, payment_status, order_mode order by status")))
  console.log('== PAYMENT_INTENTS: status distribution ==')
  console.log(JSON.stringify(await q("select method, status, count(*) c from public.payment_intents group by method, status order by method")))
  console.log('== DELIVERY_ASSIGNMENTS columns + distribution ==')
  console.log(JSON.stringify(await q("select column_name from information_schema.columns where table_schema='public' and table_name='delivery_assignments' order by ordinal_position")))
  console.log(JSON.stringify(await q("select status, count(*) c from public.delivery_assignments group by status order by status")))
  console.log('== ORDER_STATUS_HISTORY sample columns ==')
  console.log(JSON.stringify(await q("select column_name from information_schema.columns where table_schema='public' and table_name='order_status_history' order by ordinal_position")))
  console.log('== DRIVERS + TRACKING ==')
  console.log(JSON.stringify(await q("select count(*)::int drivers from public.drivers")))
  console.log(JSON.stringify(await q("select count(*)::int track_attempts from public.track_order_attempts")))
  console.log('== NOTIFICATIONS: category usage ==')
  console.log(JSON.stringify(await q("select category, count(*) c from public.notifications group by category limit 20")))
})().catch((e) => { console.error('FATAL', String(e).slice(0, 250)); process.exit(1) })