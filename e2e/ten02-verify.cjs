'use strict'
// TEN-02 Post-deployment verification
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || ''
const REF = 'ivkdfognyiwjcmrhcnwz'
async function q(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql })
  })
  return JSON.parse(await r.text())
}

;(async () => {
  console.log('=== TEN-02 POST-DEPLOY VERIFY ===')
  
  // 1. Tenants table
  console.log('TENANTS:', JSON.stringify(await q("select id, name, slug, status, count(*) from (select * from public.tenants group by id, name, slug, status) t group by id, name, slug, status"), null, 2))
  
  // 2. Operations tenant distribution
  console.log('DRIVERS_TENANT:', JSON.stringify(await q("select tenant_id, count(*) as cnt from public.drivers group by tenant_id"), null, 2))
  console.log('ROUNDS_TENANT:', JSON.stringify(await q("select tenant_id, count(*) as cnt from public.delivery_rounds group by tenant_id"), null, 2))
  console.log('ZONES_TENANT:', JSON.stringify(await q("select tenant_id, count(*) as cnt from public.delivery_zones group by tenant_id"), null, 2))
  console.log('ASSIGNMENTS_TENANT:', JSON.stringify(await q("select tenant_id, count(*) as cnt from public.delivery_assignments group by tenant_id"), null, 2))
  
  // 3. Profiles ownership
  console.log('PROFILES_TENANT:', JSON.stringify(await q("select tenant_id, count(*) as cnt from public.profiles group by tenant_id"), null, 2))
  console.log('IS_PLATFORM:', JSON.stringify(await q("select is_platform, count(*) as cnt from public.profiles group by is_platform"), null, 2))
  
  // 4. New tables exist
  console.log('NEW_TABLES:', JSON.stringify(await q("select tablename from pg_tables where schemaname='public' and tablename in ('tenants','brands') order by tablename"), null, 2))
  
  // 5. Drivers RLS policies
  console.log('DRIVERS_POLICIES:', JSON.stringify(await q("select policyname, cmd, roles from pg_policies where tablename='drivers' and schemaname='public' order by policyname"), null, 2))
  
  // 6. delivery_rounds RLS
  console.log('ROUNDS_POLICIES:', JSON.stringify(await q("select policyname, cmd, roles from pg_policies where tablename='delivery_rounds' and schemaname='public' order by policyname"), null, 2))
  
  // 7. delivery_assignments RLS
  console.log('ASSIGNMENTS_POLICIES:', JSON.stringify(await q("select policyname, cmd, roles from pg_policies where tablename='delivery_assignments' and schemaname='public' order by policyname"), null, 2))
  
  // 8. Existing data integrity check
  console.log('ORDER_COUNT:', JSON.stringify(await q("select count(*) as orders, (select count(*) from order_items) as items, (select count(*) from payment_intents) as payments"), null, 2))
  
  // 9. Drivers table structure check (tenant_id NOT NULL exists?)
  console.log('DRIVERS_COLUMNS:', JSON.stringify(await q("select column_name, is_nullable from information_schema.columns where table_name='drivers' and column_name='tenant_id'"), null, 2))
  
})().catch(e => { console.error('FATAL:', e.message.slice(0, 300)); process.exit(1) })
