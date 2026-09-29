'use strict'
// STEP 3B-2E — payment exceptions probe. READ-ONLY: pure SELECTs only.
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || ''
const REF = 'ivkdfognyiwjcmrhcnwz'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fet = async (u, i) => { let last; for (let a = 0; a < 5; a++) { try { return await fetch(u, i) } catch (e) { last = e; if (a === 4) break; await sleep(1200 * (a + 1)) } } throw last }
async function q(sql) {
  const r = await fet(`https://api.supabase.com/v1/projects/${REF}/database/query`, { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: sql }) })
  const b = await r.text(); if (!r.ok) throw new Error('MGMT ' + r.status + ' ' + b.slice(0, 220)); return JSON.parse(b)
}
;(async () => {
  console.log('== orders.payment_status × payment_method distribution (non-terminal) ==')
  console.log(JSON.stringify(await q("select payment_status, payment_method, count(*)::int from public.orders group by 1,2 order by 1,2")))
  console.log('== payment_intents status × method ==')
  console.log(JSON.stringify(await q("select status, method, provider, count(*)::int from public.payment_intents group by 1,2,3 order by 1")))
  console.log('== WEBHOOK INCONSISTENCY: order pending/processing but intent terminal-completed ==')
  console.log(JSON.stringify(await q("select o.order_number, o.status, o.payment_status o_ps, pi.status intent_status, pi.payment_intent_id from public.orders o join public.payment_intents pi on pi.order_number = o.order_number where o.payment_status = 'pending' and pi.status in ('completed','failed') order by o.created_at desc limit 15")))
  console.log('== refund states on orders ==')
  console.log(JSON.stringify(await q("select order_number, status, payment_status, total_amount, updated_at from public.orders where payment_status = 'refund' order by updated_at desc limit 10")))
  console.log('== stale pending (created > 24h, still unpaid, non-COD) ==')
  console.log(JSON.stringify(await q("select order_number, payment_method, status, created_at from public.orders where payment_status = 'pending' and payment_method <> 'cash_on_delivery' and created_at < now() - interval '24 hours' and status not in ('cancelled','failed','delivered') order by created_at desc limit 15")))
  console.log('== RLS on payment tables ==')
  console.log(JSON.stringify(await q("select tablename, policyname, cmd, roles from pg_policies where tablename in ('payment_intents','orders') order by tablename, policyname")))
  console.log('== orders RLS enabled / intents RLS ==')
  console.log(JSON.stringify(await q("select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname='public' and c.relname in ('orders','payment_intents')")))
  console.log('== payment RPCs live ==')
  console.log(JSON.stringify(await q("select proname from pg_proc where pronamespace='public'::regnamespace and proname in ('record_payment_result','confirm_offline_payment','create_payment_intent_record','create_order_with_items','transition_order_status') order by proname")))
  console.log('3B-2E PROD PROBE: READ-ONLY COMPLETE')
})().catch((e) => { console.error('FATAL', String(e).slice(0, 250)); process.exit(1) })
