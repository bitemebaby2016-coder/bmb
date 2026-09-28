'use strict'
// STEP 3 read-only audit: production DB inventory (SELECT / information_schema / pg_class / pg_policies).
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || ''
const REF = 'ivkdfognyiwjcmrhcnwz'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fet = async (u, i) => { let last; for (let a = 0; a < 5; a++) { try { return await fetch(u, i) } catch (e) { last = e; if (a === 4) break; await sleep(1200 * (a + 1)) } } throw last }
async function q(sql) {
  const r = await fet(`https://api.supabase.com/v1/projects/${REF}/database/query`, { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: sql }) })
  const b = await r.text(); if (!r.ok) throw new Error('MGMT ' + r.status + ' ' + b.slice(0, 250)); return JSON.parse(b)
}
;(async () => {
  const queries = {
    tables_rls: "select c.relname, c.relrowsecurity as rls_enabled from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname='public' order by c.relname",
    policies: "select tablename, policyname, cmd, permissive, roles from pg_policies where schemaname='public' order by tablename, policyname",
    routines: "select routine_name from information_schema.routines where routine_schema='public' order by routine_name",
    enums: "select t.typname, (select array_agg(e.enumlabel order by e.enumsortorder) from pg_enum e where e.enumtypid=t.oid) labels from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typtype='e' order by t.typname",
  }
  for (const [k, sql] of Object.entries(queries)) {
    try { console.log(`== ${k} ==`); console.log(JSON.stringify(await q(sql))) }
    catch (e) { console.log(`== ${k} == ERR ${String(e).slice(0,120)}`) }
  }
  const tables = ['orders','payment_intents','products','product_categories','add_ons','inventory','ingredients','inventory_movements','promotions','promotion_codes','customers','delivery_rounds','delivery_assignments','delivery_zones','notifications','audit_logs','business_settings','media_assets','reviews','order_status_history','drivers','driver_assignments','weekly_menus']
  console.log('== ROW COUNTS ==')
  for (const t of tables) {
    try { const r = await q(`select count(*)::int c from public.${t}`); console.log(`${t}: ${r[0].c}`) }
    catch (e) { console.log(`${t}: ERR ${String(e).slice(0,50)}`) }
  }
})().catch((e) => { console.error('FATAL', String(e).slice(0, 300)); process.exit(1) })