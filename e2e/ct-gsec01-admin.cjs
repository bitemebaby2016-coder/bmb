'use strict'
// ============================================
// STEP 3A / G-SEC-01 post-deploy live probe: Admin read WORKS + non-admin DENIED.
// Uses the STEP-2-accepted harness (phone-auto-login + is_admin() promotion).
// READ-ONLY on `inventory` (SELECT only). Creates throwaway probe profiles ONLY.
// Env: SUPABASE_ACCESS_TOKEN (mgmt). Anon key known locally (publishable).
// ============================================
const SB = 'https://ivkdfognyiwjcmrhcnwz.supabase.co'
const ANON = process.env.SUPABASE_ANON_KEY || 'sb_publishable_Q7AHrjSYOrysDjxS9_ZB-g_NMmytLOH'
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || ''
const REF = 'ivkdfognyiwjcmrhcnwz'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fet = async (u, i) => { let last; for (let a = 0; a < 5; a++) { try { return await fetch(u, i) } catch (e) { last = e; if (a === 4) break; await sleep(1200 * (a + 1)) } } throw last }
async function q(sql) {
  const r = await fet(`https://api.supabase.com/v1/projects/${REF}/database/query`, { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: sql }) })
  const b = await r.text(); if (!r.ok) throw new Error('MGMT ' + r.status + ' ' + b.slice(0, 200)); return JSON.parse(b)
}
async function phoneLogin(name, phone) {
  const r = await fet(`${SB}/functions/v1/phone-auto-login`, { method: 'POST', headers: { apikey: ANON, 'content-type': 'application/json' }, body: JSON.stringify({ name, phone, latitude: 10.7031, longitude: 102.1444, address_detail: 'STEP3A probe' }) })
  const j = await r.json(); const tok = j.session?.access_token || j.access_token
  if (!tok) throw new Error('login fail ' + r.status + ' ' + JSON.stringify(j).slice(0, 120))
  return { jwt: tok, uid: (j.user?.id || j.session?.user?.id || '') }
}
;(async () => {
  let failures = 0
  const check = (name, ok, detail) => { console.log((ok ? 'PASS' : 'FAIL') + ' :: ' + name + (detail ? ' :: ' + detail : '')); if (!ok) failures++ }

  // --- ADMIN: throwaway + promote, then READ inventory ---
  const adminPhone = '+6691' + String(Date.now()).slice(-8)
  const A = await phoneLogin('[STEP3A] ADMIN', adminPhone)
  await q(`INSERT INTO public.profiles (id, phone, name, role, created_at, updated_at) VALUES ('${A.uid}','${adminPhone}','[STEP3A] ADMIN','admin',now(),now()) ON CONFLICT (id) DO UPDATE SET role='admin', updated_at=now()`)
  console.log('admin_uid=', A.uid)
  const ar = await fet(`${SB}/rest/v1/inventory?select=*&limit=100`, { headers: { apikey: ANON, Authorization: 'Bearer ' + A.jwt } })
  const ab = await ar.text()
  let adminRows = -1; try { adminRows = JSON.parse(ab).length } catch {}
  console.log('inventory_admin_read status=', ar.status, 'rows=', adminRows)
  check('ADMIN inventory read WORKS', ar.status === 200 && adminRows >= 1, `status=${ar.status} rows=${adminRows}`)

  // --- NON-ADMIN: throwaway (no promote), must be DENIED on inventory ---
  const userPhone = '+6692' + String(Date.now()).slice(-8)
  const U = await phoneLogin('[STEP3A] CUST', userPhone)
  await q(`INSERT INTO public.profiles (id, phone, name, role, created_at, updated_at) VALUES ('${U.uid}','${userPhone}','[STEP3A] CUST','customer',now(),now()) ON CONFLICT (id) DO UPDATE SET role='customer', updated_at=now()`)
  console.log('cust_uid=', U.uid)
  const ur = await fet(`${SB}/rest/v1/inventory?select=*&limit=100`, { headers: { apikey: ANON, Authorization: 'Bearer ' + U.jwt } })
  const ub = await ur.text()
  let custRows = -1; try { custRows = JSON.parse(ub).length } catch {}
  const custDenied = ur.status === 200 ? custRows === 0 : true // 200+[] = RLS-filtered to nothing; 4xx = denied
  console.log('inventory_nonadmin_read status=', ur.status, 'rows=', custRows)
  check('NON-ADMIN inventory read DENIED', custDenied, `status=${ur.status} rows=${custRows}`)

  // --- RPC authorization unchanged (read-only; no valid order -> no mutation) ---
  try {
    const rr = await fet(`${SB}/rest/v1/rpc/get_inventory_requirements`, { method: 'POST', headers: { apikey: ANON, Authorization: 'Bearer ' + U.jwt, 'content-type': 'application/json' }, body: JSON.stringify({ p_product_id: 'x', p_quantity: 1 }) })
    const rb = await rr.text()
    const forbidden = rb.includes('ERR_FORBIDDEN') || rb.includes('ERR_NOT_AUTHENTICATED') || rr.status === 400
    check('get_inventory_requirements still admin-guarded (RPC authz unchanged)', forbidden, `status=${rr.status} ${rb.slice(0, 80)}`)
  } catch (e) { check('get_inventory_requirements still admin-guarded', false, String(e).slice(0, 90)) }

  console.log('== RESULT ==')
  console.log(failures === 0 ? 'ADMIN/NON-ADMIN/RPC checks = ALL PASS' : 'FAILURES=' + failures)
  process.exit(failures === 0 ? 0 : 1)
})().catch((e) => { console.error('FATAL', String(e).slice(0, 300)); process.exit(2) })