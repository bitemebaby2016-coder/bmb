'use strict'
// TEN-01 audit — production inventory (READ-ONLY, no mutations)
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || ''
const REF = 'ivkdfognyiwjcmrhcnwz'
async function q(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: sql }) })
  const b = await r.text(); if (!r.ok) throw new Error('MGMT ' + r.status + ' ' + b.slice(0, 400)); return JSON.parse(b)
}
;(async () => {
  console.log('== KEY POLICY QUALS (orders/products/drivers/settings/audit) ==')
  console.log(JSON.stringify(await q("select tablename, policyname, cmd, roles, qual, with_check from pg_policies where schemaname='public' and tablename in ('orders','products','drivers','delivery_assignments','business_settings','audit_logs','media_assets','menu_sections','reviews','mascot_overrides','customers','product_categories','menu_schedule') order by tablename, policyname")))
  console.log('== ANON ALL policies count ==')
  console.log(JSON.stringify(await q("select count(*)::int from pg_policies where schemaname='public' and 'anon' = any(roles) and cmd='ALL'")))
  console.log('== is_admin definition ==')
  console.log(JSON.stringify(await q("select prosrc from pg_proc where proname='is_admin'")))
})().catch((e) => { console.error('FATAL', String(e).slice(0, 400)); process.exit(1) })

;(async () => {
  console.log('== suspicious anon quals ==')
  console.log(JSON.stringify(await q("select tablename, policyname, cmd, qual, with_check from pg_policies where schemaname='public' and tablename in ('business_settings','audit_logs','content_approvals','ai_conversations','ai_recommendations') and 'anon' = any(roles)")))
  console.log('== order_number samples ==')
  console.log(JSON.stringify(await q('select order_number, created_at from orders order by created_at desc limit 3')))
  console.log('== driver/order assignment fns ==')
  console.log(JSON.stringify(await q("select proname from pg_proc where pronamespace='public'::regnamespace and (prosrc ilike '%driver%' or proname ilike '%assign%')")))
  console.log('== profiles roles distribution ==')
  console.log(JSON.stringify(await q('select role, count(*)::int c from profiles group by role')))
})().catch((e) => { console.error('FATAL', String(e).slice(0, 400)); process.exit(1) })

;(async () => {
  console.log(JSON.stringify(await q("select schemaname, relname, n_live_tup::int from pg_stat_user_tables where schemaname='public' order by relname")))
  console.log('== FK GRAPH (public) ==')
  console.log(JSON.stringify(await q("select c.conname, c.conrelid::regclass tbl, c.confrelid::regclass refs, pg_get_constraintdef(c.oid) def from pg_constraint c join pg_class r on r.oid=c.conrelid join pg_namespace n on n.oid=r.relnamespace where n.nspname='public' and c.contype='f' order by 2,1")))
  console.log('== RLS POLICY SUMMARY ==')
  console.log(JSON.stringify(await q("select tablename, policyname, cmd, roles from pg_policies where schemaname='public' order by tablename, policyname")))
  console.log('== FOR ALL policies ==')
  console.log(JSON.stringify(await q("select tablename, policyname, qual, with_check from pg_policies where schemaname='public' and cmd='ALL'")))
  console.log('== is_admin policies ==')
  console.log(JSON.stringify(await q("select tablename, policyname, qual, with_check from pg_policies where schemaname='public' and (qual like '%is_admin%' or with_check like '%is_admin%')")))
  console.log('== functions (security definer, public) ==')
  console.log(JSON.stringify(await q("select p.proname, p.prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by 1")))
  console.log('== business_settings keys ==')
  console.log(JSON.stringify(await q('select key, value from business_settings order by key')))
  console.log('== drivers ==')
  console.log(JSON.stringify(await q("select column_name, data_type from information_schema.columns where table_name='drivers' order by ordinal_position")))
  console.log('== payment_intents columns ==')
  console.log(JSON.stringify(await q("select column_name from information_schema.columns where table_name='payment_intents' order by ordinal_position")))
})().catch((e) => { console.error('FATAL', String(e).slice(0, 400)); process.exit(1) })
