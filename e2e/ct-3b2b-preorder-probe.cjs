'use strict'
// STEP 3B-2B — pre-order queue production probe (READ-ONLY). No writes.
// Verifies the pre-order operational source of truth the Admin queue view reads:
//   - delivery_rounds columns + live rows (capacity/cutoff/scheduled_date)
//   - RLS on delivery_rounds (who may read)
//   - PRE_ORDER orders joined to rounds (queue grouping reality)
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || ''
const REF = 'ivkdfognyiwjcmrhcnwz'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fet = async (u, i) => { let last; for (let a = 0; a < 5; a++) { try { return await fetch(u, i) } catch (e) { last = e; if (a === 4) break; await sleep(1200 * (a + 1)) } } throw last }
async function q(sql) {
  const r = await fet(`https://api.supabase.com/v1/projects/${REF}/database/query`, { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: sql }) })
  const b = await r.text(); if (!r.ok) throw new Error('MGMT ' + r.status + ' ' + b.slice(0, 220)); return JSON.parse(b)
}
;(async () => {
  console.log('== delivery_rounds columns ==')
  console.log(JSON.stringify(await q("select column_name, data_type from information_schema.columns where table_schema='public' and table_name='delivery_rounds' order by ordinal_position")))
  console.log('== delivery_rounds RLS policies ==')
  console.log(JSON.stringify(await q("select policyname, cmd, roles::text from pg_policies where schemaname='public' and tablename='delivery_rounds' order by policyname")))
  console.log('== live rounds (next 40) ==')
  console.log(JSON.stringify(await q("select id, scheduled_date, status, cutoff_time, delivery_start, delivery_end, max_capacity, current_count from public.delivery_rounds order by scheduled_date desc, id limit 40")))
  console.log('== PRE_ORDER orders grouped by scheduled_date + round (queue reality) ==')
  console.log(JSON.stringify(await q("select o.scheduled_date, o.delivery_round_id, o.status, o.payment_status, count(*)::int c from public.orders o where o.order_mode='PRE_ORDER' group by o.scheduled_date, o.delivery_round_id, o.status, o.payment_status order by o.scheduled_date desc limit 40")))
  console.log('== PRE_ORDER orders without a live round (orphan check) ==')
  console.log(JSON.stringify(await q("select count(*)::int orphans from public.orders o where o.order_mode='PRE_ORDER' and not exists (select 1 from public.delivery_rounds r where r.id = o.delivery_round_id)")))
  console.log('== SAME_DAY sanity: same spine, different mode ==')
  console.log(JSON.stringify(await q("select count(*)::int same_day_total, count(*) filter (where scheduled_date is not null)::int with_sched from public.orders where order_mode='SAME_DAY'")))
  console.log('3B-2B PROD PROBE: READ-ONLY COMPLETE')
})().catch((e) => { console.error('FATAL', String(e).slice(0, 250)); process.exit(1) })
