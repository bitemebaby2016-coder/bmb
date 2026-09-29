'use strict'
// STEP 3B-2C â€” deploy migration 054 (DDL only) + READ-ONLY gate verification.
// The gate SQL replicated here runs as pure SELECTs â€” zero data mutation.
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || ''
const REF = 'ivkdfognyiwjcmrhcnwz'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fet = async (u, i) => { let last; for (let a = 0; a < 5; a++) { try { return await fetch(u, i) } catch (e) { last = e; if (a === 4) break; await sleep(1200 * (a + 1)) } } throw last }
async function q(sql) {
  const r = await fet(`https://api.supabase.com/v1/projects/${REF}/database/query`, { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: sql }) })
  const b = await r.text(); if (!r.ok) throw new Error('MGMT ' + r.status + ' ' + b.slice(0, 220)); return JSON.parse(b)
}
async function fs(path) { return (await import('fs')).readFileSync(path, 'utf8') }

;(async () => {
  const path = 'supabase/migrations/054_kitchen_ready_to_make_gate.sql'
  const body = await fs(path)
  console.log('== deploy 054 (BEGIN/COMMIT inside file) ==')
  const res = await q(body)
  console.log(JSON.stringify(res))
  console.log('== verify function exists + grants ==')
  console.log(JSON.stringify(await q("select p.proname, p.prosecdef, coalesce(array_agg(g.privilege_type) filter (where g.grantee not in ('PUBLIC','postgres')), '{}') non_owner_grants from pg_proc p left join information_schema.routine_privileges g on g.specific_name = p.proname and g.specific_schema = 'public' where p.proname = 'order_ready_to_make' group by 1,2")))
  console.log('== READ-ONLY gate evaluation on live pipeline (replicates 054 rules via SELECT only) ==')
  console.log(JSON.stringify(await q(`select o.order_number, o.status, o.order_mode, o.payment_status, o.payment_method,
    CASE
      WHEN o.status in ('cancelled','failed','delivered') THEN 'TERMINAL_STATE'
      WHEN o.status not in ('confirmed','preparing') THEN 'INVALID_ORDER_STATE'
      WHEN o.payment_status = 'refund' THEN 'PAYMENT_REFUNDED'
      WHEN o.payment_method = 'cash_on_delivery' AND o.payment_status in ('pending','paid') THEN 'READY'
      WHEN o.payment_method <> 'cash_on_delivery' AND o.payment_status = 'paid' THEN 'READY'
      ELSE 'PAYMENT_NOT_PAID'
    END gate
    from orders o where o.status in ('confirmed','preparing','ready_for_dispatch') order by o.order_number`)))
  console.log('== empty-order check on live pipeline ==')
  console.log(JSON.stringify(await q("select o.order_number, (select count(*) from order_items oi where oi.order_id = o.id) items from orders o where o.status in ('confirmed','preparing')")))
  console.log('3B-2C PHASE E: DEPLOY + READ-ONLY VERIFICATION COMPLETE')
})().catch((e) => { console.error('FATAL', String(e).slice(0, 250)); process.exit(1) })
