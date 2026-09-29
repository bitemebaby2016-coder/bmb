'use strict'
// TEN-02 pre-migration: Inspect production profiles + drivers + auth structure
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
  // 1. Profiles breakdown by role with key columns
  console.log('== PROFILES BREAKDOWN ==')
  console.log(JSON.stringify(await q("select role, count(*)::int c from public.profiles group by role order by c desc"), null, 2))
  
  // 2. Full admin profile details (is_owner, is_active flags)
  console.log('== ADMIN PROFILES (full detail) ==')
  console.log(JSON.stringify(await q("select id, role, is_active, is_owner, created_at from public.profiles where role='admin' order by id"), null, 2))
  
  // 3. All profiles with is_owner flag (platform owners only)
  console.log('== PROFILES WITH IS_OWNER FLAG ==')
  console.log(JSON.stringify(await q("select id, role, is_active, is_owner, created_at from public.profiles where is_owner = true or role = 'admin' order by is_owner desc, created_at"), null, 2))
  
  // 4. Drivers table structure and data (profile uses profiles.id which maps to auth.users.id)
  console.log('== DRIVERS TABLE INFO ==')
  console.log(JSON.stringify(await q("select column_name, data_type, is_nullable from information_schema.columns where table_name='drivers' order by ordinal_position"), null, 2))
  console.log('== DRIVER ROWS ==')
  console.log(JSON.stringify(await q("select id, name, phone, status, user_id, created_at from public.drivers order by id"), null, 2))
  
  // 5. Auth users count for reference
  console.log('== AUTH.USERS COUNT ==')
  console.log(JSON.stringify(await q("select count(*)::int as total from auth.users"), null, 2))
})().catch(e => { console.error('FATAL:', e.message.slice(0, 300)); process.exit(1) })
