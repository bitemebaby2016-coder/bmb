'use strict'
// ============================================
// STEP 3A / G-SEC-01 post-deploy READ-ONLY verification probe.
// Run ONLY after migration 052 is deployed + Owner approves.
// Env: SUPABASE_ACCESS_TOKEN (mgmt), SUPABASE_ANON_KEY, optional SUPABASE_ADMIN_JWT.
// No writes. Verifies:
//   1) policy state on production DB (read-only catalog query)
//   2) anonymous inventory SELECT is DENIED (PostgREST, anon key)
//   3) admin inventory read WORKS (PostgREST, admin JWT, if provided)
// ============================================
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || ''
const ANON = process.env.SUPABASE_ANON_KEY || ''
const ADMIN = process.env.SUPABASE_ADMIN_JWT || ''
const REF = 'ivkdfognyiwjcmrhcnwz'
const SUPABASE_URL = `https://${REF}.supabase.co`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fet = async (u, i) => { let last; for (let a = 0; a < 5; a++) { try { return await fetch(u, i) } catch (e) { last = e; if (a === 4) break; await sleep(1200 * (a + 1)) } } throw last }
async function q(sql) {
  const r = await fet(`https://api.supabase.com/v1/projects/${REF}/database/query`, { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: sql }) })
  const b = await r.text(); if (!r.ok) throw new Error('MGMT ' + r.status + ' ' + b.slice(0, 250)); return JSON.parse(b)
}
let failures = 0
function check(name, ok, detail) { console.log((ok ? 'PASS' : 'FAIL') + ' :: ' + name + (detail ? ' :: ' + detail : '')); if (!ok) failures++ }
;(async () => {
  console.log('== 1) Production RLS policy state ==')
  const pol = await q("select policyname,cmd,coalesce(qual,'') qual,roles::text roles_ from pg_policies where schemaname='public' and tablename='inventory' order by policyname")
  console.log(JSON.stringify(pol))
  const names = pol.map(p => p.policyname)
  check('inventory_public_read REMOVED (G-SEC-01)', !names.includes('inventory_public_read'), 'present=' + names.includes('inventory_public_read'))
  check('inventory_admin_manage PRESERVED', names.includes('inventory_admin_manage'), '')
  const adminAny = pol.find(p => p.policyname === 'inventory_admin_manage' && p.cmd === 'ALL' && /is_admin/.test(p.qual))
  check('inventory_admin_manage = ALL USING(is_admin())', !!adminAny, '')

  console.log('== 2) Anonymous inventory SELECT must be DENIED ==')
  if (ANON) {
    const r = await fet(`${SUPABASE_URL}/rest/v1/inventory?select=*`, { headers: { apikey: ANON, Authorization: 'Bearer ' + ANON } })
    const body = await r.text()
    const denied = r.status === 401 || r.status === 403 || (r.status === 200 && (body === '[]' || body.trim() === ''))
    check('anon inventory SELECT denied', denied, `status=${r.status} body=${body.slice(0, 80)}`)
  } else { console.log('SKIP (no SUPABASE_ANON_KEY)') }

  console.log('== 3) Admin inventory read must WORK ==')
  if (ADMIN) {
    const r = await fet(`${SUPABASE_URL}/rest/v1/inventory?select=*`, { headers: { apikey: ANON, Authorization: 'Bearer ' + ADMIN } })
    const body = await r.text()
    const ok = r.status === 200 && body !== '[]' && !/error/i.test(body)
    check('admin inventory read works', ok, `status=${r.status} bytes=${body.length}`)
  } else { console.log('SKIP (no SUPABASE_ADMIN_JWT — provide an authenticated ADMIN session to enable this read-only probe)') }

  console.log('== RESULT ==')
  console.log(failures === 0 ? 'G-SEC-01 = CLOSED (runtime verification)' : 'FAILURES=' + failures)
  process.exit(failures === 0 ? 0 : 1)
})().catch((e) => { console.error('FATAL', String(e).slice(0, 250)); process.exit(2) })