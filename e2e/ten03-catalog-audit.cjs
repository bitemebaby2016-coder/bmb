'use strict'
// TEN-03 Audit: Production catalog table inventory (read-only)
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || ''
const REF = 'ivkdfognyiwjcmrhcnwz'
async function q(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql })
  })
  const b = await r.text()
  if (!r.ok) throw new Error('MGMT ' + r.status + ' ' + b.slice(0, 400))
  return JSON.parse(b)
}

;(async () => {
  // Row counts for all catalog-related tables
  console.log('== ROW COUNTS ==')
  console.log(JSON.stringify(await q("select relname as table_name, n_live_tup as rows from pg_stat_user_tables where schemaname='public' and relname in ('products','product_categories','menu_sections','addon_groups','addons','product_addon_groups','menu_schedule','media_assets','categories') order by relname"), null, 2))

  // products columns + structure
  console.log('== PRODUCTS COLUMNS ==')
  console.log(JSON.stringify(await q("select column_name, data_type, is_nullable, character_maximum_length from information_schema.columns where table_name='products' and table_schema='public' order by ordinal_position"), null, 2))

  // product_categories columns
  console.log('== PRODUCT_CATEGORIES COLUMNS ==')
  console.log(JSON.stringify(await q("select column_name, data_type, is_nullable, character_maximum_length from information_schema.columns where table_name='product_categories' and table_schema='public' order by ordinal_position"), null, 2))

  // menu_sections columns
  console.log('== MENU_SECTIONS COLUMNS ==')
  console.log(JSON.stringify(await q("select column_name, data_type, is_nullable, character_maximum_length from information_schema.columns where table_name='menu_sections' and table_schema='public' order by ordinal_position"), null, 2))

  // addon_groups columns
  console.log('== ADDON_GROUPS COLUMNS ==')
  console.log(JSON.stringify(await q("select column_name, data_type, is_nullable, character_maximum_length from information_schema.columns where table_name='addon_groups' and table_schema='public' order by ordinal_position"), null, 2))

  // addons columns
  console.log('== ADDONS COLUMNS ==')
  console.log(JSON.stringify(await q("select column_name, data_type, is_nullable, character_maximum_length from information_schema.columns where table_name='addons' and table_schema='public' order by ordinal_position"), null, 2))

  // product_addon_groups columns
  console.log('== PRODUCT_ADDON_GROUPS COLUMNS ==')
  console.log(JSON.stringify(await q("select column_name, data_type, is_nullable, character_maximum_length from information_schema.columns where table_name='product_addon_groups' and table_schema='public' order by ordinal_position"), null, 2))

  // menu_schedule columns
  console.log('== MENU_SCHEDULE COLUMNS ==')
  console.log(JSON.stringify(await q("select column_name, data_type, is_nullable, character_maximum_length from information_schema.columns where table_name='menu_schedule' and table_schema='public' order by ordinal_position"), null, 2))

  // media_assets columns (verify CAT-03A canonical state)
  console.log('== MEDIA_ASSETS COLUMNS ==')
  console.log(JSON.stringify(await q("select column_name, data_type, is_nullable, character_maximum_length from information_schema.columns where table_name='media_assets' and table_schema='public' order by ordinal_position"), null, 2))

  // All FKs for catalog tables
  console.log('== CATALOG FK GRAPH ==')
  console.log(JSON.stringify(await q("select c.conname, c.conrelid::regclass tbl, c.confrelid::regclass refs, pg_get_constraintdef(c.oid) def from pg_constraint c join pg_class r on r.oid=c.conrelid join pg_namespace n on n.oid=r.relnamespace where n.nspname='public' and c.contype='f' and c.conrelid::regclass::text in ('products','product_categories','menu_sections','addon_groups','addons','product_addon_groups','menu_schedule','media_assets','orders','order_items') order by c.conrelid::regclass::text, c.conname"), null, 2))

  // Catalog table RLS policies
  console.log('== CATALOG RLS POLICIES ==')
  console.log(JSON.stringify(await q("select tablename, policyname, cmd, roles, qual, with_check from pg_policies where schemaname='public' and tablename in ('products','product_categories','menu_sections','addon_groups','addons','product_addon_groups','menu_schedule','media_assets') order by tablename, policyname"), null, 2))

})().catch(e => { console.error('FATAL:', e.message.slice(0, 300)); process.exit(1) })
