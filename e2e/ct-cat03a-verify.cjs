'use strict'
// CAT-03A post-migration invariants (read-only)
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || ''
const REF = 'ivkdfognyiwjcmrhcnwz'
async function q(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: sql }) })
  const b = await r.text(); if (!r.ok) throw new Error('MGMT ' + r.status + ' ' + b.slice(0, 400)); return JSON.parse(b)
}
;(async () => {
  console.log('products:', JSON.stringify(await q("select count(*)::int c, count(*) filter (where image_url like '%/object/public/bmb-images/products/%/image.webp')::int migrated from products")))
  console.log('orders/order_items:', JSON.stringify(await q("select (select count(*)::int from orders) o, (select count(*)::int from order_items) oi")))
  console.log('reviews/votes/schedule:', JSON.stringify(await q("select (select count(*)::int from reviews) r, (select count(*)::int from preorder_votes) v, (select count(*)::int from menu_schedule) s")))
  console.log('media_assets:', JSON.stringify(await q("select id, kind, alt from media_assets order by id")))
  console.log('storage INSERT policies:', JSON.stringify(await q("select policyname, roles from pg_policies where schemaname='storage' and tablename='objects' and cmd='INSERT'")))
})().catch((e) => { console.error('FATAL', String(e).slice(0, 400)); process.exit(1) })
