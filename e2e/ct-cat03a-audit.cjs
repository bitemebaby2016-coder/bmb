'use strict'
// CAT-03A + REVIEW AUDIT — READ-ONLY production inspection (no mutations)
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || ''
const REF = 'ivkdfognyiwjcmrhcnwz'
async function q(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: sql }) })
  const b = await r.text(); if (!r.ok) throw new Error('MGMT ' + r.status + ' ' + b.slice(0, 400)); return JSON.parse(b)
}
;(async () => {
  console.log('products columns:', JSON.stringify(await q("select column_name from information_schema.columns where table_name='products' and table_schema='public' order by ordinal_position")))
  // A1: Base64 inventory (no full data exfil — prefix + size only)
  console.log('A1 base64 products:', JSON.stringify(await q("select id, name, category_id, sort_order, price, length(image_url) as b64_len, left(image_url, 30) as mime_prefix from products where image_url like 'data:image%' order by id")))
  console.log('A1 non-base64 products:', JSON.stringify(await q("select id, name, left(image_url, 40) as url_prefix from products where image_url is not null and image_url not like 'data:image%'")))
  console.log('A1 products w/o image:', JSON.stringify(await q("select count(*)::int from products where image_url is null or image_url = ''")))
  // A3: collision — storage objects & media_assets
  console.log('A3 media_assets rows:', JSON.stringify(await q('select count(*)::int from media_assets')))
  // B: all tables matching section/review/rating/vote/feedback
  console.log('B tables:', JSON.stringify(await q("select table_name from information_schema.tables where table_schema='public' and (table_name ~* 'section|review|rating|vote|feedback|comment') order by 1")))
  console.log('B columns of those:', JSON.stringify(await q("select table_name, column_name, data_type from information_schema.columns where table_schema='public' and table_name in (select table_name from information_schema.tables where table_schema='public' and (table_name ~* 'section|review|rating|vote|feedback|comment')) order by table_name, ordinal_position")))
  console.log('B RLS policies on those:', JSON.stringify(await q("select tablename, policyname, cmd, roles from pg_policies where tablename in (select table_name from information_schema.tables where table_schema='public' and (table_name ~* 'review|rating|vote|feedback|comment')) order by tablename")))
  console.log('B row counts:', JSON.stringify(await q("select 'reviews' t, count(*)::int from reviews union all select 'preorder_votes', count(*)::int from preorder_votes union all select 'menu_sections', count(*)::int from menu_sections union all select 'media_assets', count(*)::int from media_assets")))
  // C: cross-impact — FKs
  console.log('C reviews FK:', JSON.stringify(await q("select conname, pg_get_constraintdef(oid) def from pg_constraint where conrelid = 'public.reviews'::regclass and contype='f'")))
  console.log('C preorder_votes FK:', JSON.stringify(await q("select conname, pg_get_constraintdef(oid) def from pg_constraint where conrelid = 'public.preorder_votes'::regclass and contype='f'")))
  console.log('C archived products with reviews/votes:', JSON.stringify(await q("select (select count(*)::int from reviews r join products p on p.id=r.product_id where p.archived) arch_reviews, (select count(*)::int from preorder_votes v join products p on p.id=v.product_id where p.archived) arch_votes")))
  console.log('B rating agg columns:', JSON.stringify(await q("select id, rating, review_count from products where review_count > 0 limit 5")))
  console.log('B policy quals:', JSON.stringify(await q("select tablename, policyname, cmd, qual from pg_policies where tablename in ('reviews','preorder_votes')")))
})().catch((e) => { console.error('FATAL', String(e).slice(0, 400)); process.exit(1) })
