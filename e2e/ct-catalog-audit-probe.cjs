'use strict'
// ADMIN MENU/CATALOG AUDIT probe. READ-ONLY: pure SELECTs only (no mutations).
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || ''
const REF = 'ivkdfognyiwjcmrhcnwz'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fet = async (u, i) => { let last; for (let a = 0; a < 5; a++) { try { return await fetch(u, i) } catch (e) { last = e; if (a === 4) break; await sleep(1200 * (a + 1)) } } throw last }
async function q(sql) {
  const r = await fet(`https://api.supabase.com/v1/projects/${REF}/database/query`, { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: sql }) })
  const b = await r.text(); if (!r.ok) throw new Error('MGMT ' + r.status + ' ' + b.slice(0, 220)); return JSON.parse(b)
}
;(async () => {
  console.log('== products schema (columns/constraints) ==')
  console.log(JSON.stringify(await q("select column_name, data_type, is_nullable, column_default from information_schema.columns where table_schema='public' and table_name='products' order by ordinal_position")))
  console.log('== product_categories schema ==')
  console.log(JSON.stringify(await q("select column_name, data_type, is_nullable from information_schema.columns where table_schema='public' and table_name='product_categories' order by ordinal_position")))
  console.log('== menu/section/addon-group/variant tables existence ==')
  console.log(JSON.stringify(await q("select table_name from information_schema.tables where table_schema='public' and (table_name ilike '%menu%' or table_name ilike '%addon%' or table_name ilike '%add_on%' or table_name ilike '%variant%' or table_name ilike '%section%' or table_name ilike '%product_%') order by 1")))
  console.log('== live catalog counts ==')
  console.log(JSON.stringify(await q("select (select count(*)::int from products) products, (select count(*)::int from product_categories) categories, (select count(*)::int from products where is_available) avail, (select count(*)::int from products where not is_available) sold_out, (select count(*)::int from products where available_same_day) same_day, (select count(*)::int from products where available_preorder) preorder, (select count(*)::int from products where coalesce(addons,'[]'::jsonb) <> '[]'::jsonb) with_addons, (select count(*)::int from media_assets) media")))
  console.log('== orphan products → category ==')
  console.log(JSON.stringify(await q('select count(*)::int orphan_products from products p left join product_categories c on c.id = p.category_id where c.id is null')))
  console.log('== price/availability authority columns sample (no writes) ==')
  console.log(JSON.stringify(await q("select id, name, price, category_id, is_available, is_featured, is_preorder, available_same_day, available_preorder, sort_order, jsonb_array_length(coalesce(addons,'[]'::jsonb)) addon_count, image_url <> '' has_image from products order by sort_order limit 12")))
  console.log('== addons JSON shape sample ==')
  console.log(JSON.stringify(await q("select id, addons from products where coalesce(addons,'[]'::jsonb) <> '[]'::jsonb limit 2")))
  console.log('== compute_addons_price / catalog RPCs ==')
  console.log(JSON.stringify(await q("select proname from pg_proc where pronamespace='public'::regnamespace and (proname like '%addon%' or proname like '%product%' or proname like '%categor%' or proname like '%menu%') order by proname")))
  console.log('== RLS policies products/product_categories/media_assets ==')
  console.log(JSON.stringify(await q("select tablename, policyname, cmd, roles from pg_policies where tablename in ('products','product_categories','media_assets') order by tablename, policyname")))
  console.log('== RLS enabled? ==')
  console.log(JSON.stringify(await q("select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('products','product_categories','media_assets')")))
  console.log('== order snapshot integrity columns (order_items) ==')
  console.log(JSON.stringify(await q("select column_name from information_schema.columns where table_schema='public' and table_name='order_items' and column_name in ('product_id','product_name','quantity','unit_price','item_total','customizations')")))
  console.log('CATALOG AUDIT PROBE: READ-ONLY COMPLETE')
})().catch((e) => { console.error('FATAL', String(e).slice(0, 250)); process.exit(1) })
