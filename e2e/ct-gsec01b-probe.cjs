'use strict'
// ============================================
// STEP 3A.1 / G-SEC-01b post-deploy READ-ONLY verification probe.
// Caller: run AFTER migration 053 is applied.
// Env: SUPABASE_ACCESS_TOKEN (mgmt); anon key known locally (publishable).
// Creates throwaway probe profiles ONLY (STEP-2-accepted harness); READ-ONLY on
// inventory (no INSERT/UPDATE/DELETE on inventory/orders).
// A-C: get_inventory_requirements anon / non-admin / admin.
// D-F: direct inventory table anon / non-admin / admin.
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
  const r = await fet(`${SB}/functions/v1/phone-auto-login`, { method: 'POST', headers: { apikey: ANON, 'content-type': 'application/json' }, body: JSON.stringify({ name, phone, latitude: 10.7031, longitude: 102.1444, address_detail: 'STEP3A1 probe' }) })
  const j = await r.json(); const tok = j.session?.access_token || j.access_token
  if (!tok) throw new Error('login fail ' + r.status + ' ' + JSON.stringify(j).slice(0, 120))
  return { jwt: tok, uid: (j.user?.id || j.session?.user?.id || '') }
}
;(async () => {
  let failures = 0
  const check = (name, ok, detail) => { console.log((ok ? 'PASS' : 'FAIL') + ' :: ' + name + (detail ? ' :: ' + detail : '')); if (!ok) failures++ }
  const rpcGet = async (jwt, role) => {
    const headers = { apikey: ANON, Authorization: 'Bearer ' + jwt, 'content-type': 'application/json' }
    if (role === 'anon') { headers['Authorization'] = 'Bearer ' + ANON }
    const r = await fet(`${SB}/rest/v1/rpc/get_inventory_requirements`, { method: 'POST', headers, body: JSON.stringify({ p_product_id: 'prod-1', p_quantity: 1 }) })
    return { status: r.status, body: await r.text() }
  }
  const tblGet = async (jwt, role) => {
    const headers = { apikey: ANON, Authorization: 'Bearer ' + jwt }
    if (role === 'anon') { headers['Authorization'] = 'Bearer ' + ANON }
    const r = await fet(`${SB}/rest/v1/inventory?select=*&limit=100`, { headers })
    return { status: r.status, body: await r.text() }
  }

  // Admin + customer throwaway sessions
  const adminPhone = '+6693' + String(Date.now()).slice(-8)
  const A = await phoneLogin('[STEP3A1] ADMIN', adminPhone)
  await q(`INSERT INTO public.profiles (id, phone, name, role, created_at, updated_at) VALUES ('${A.uid}','${adminPhone}','[STEP3A1] ADMIN','admin',now(),now()) ON CONFLICT (id) DO UPDATE SET role='admin', updated_at=now()`)
  const userPhone = '+6694' + String(Date.now()).slice(-8)
  const U = await phoneLogin('[STEP3A1] CUST', userPhone)
  await q(`INSERT INTO public.profiles (id, phone, name, role, created_at, updated_at) VALUES ('${U.uid}','${userPhone}','[STEP3A1] CUST','customer',now(),now()) ON CONFLICT (id) DO UPDATE SET role='customer', updated_at=now()`)
  console.log('admin_uid=', A.uid, 'cust_uid=', U.uid)

  console.log('== A) get_inventory_requirements ANON -> DENIED ==')
  const a = await rpcGet(ANON, 'anon')
  check('anon RPC denied', a.status === 400 || a.status === 401 || a.status === 403, `status=${a.status} ${a.body.slice(0, 70)}`)

  console.log('== B) get_inventory_requirements NON-ADMIN -> DENIED ==')
  const b = await rpcGet(U.jwt, 'auth')
  check('non-admin RPC denied (ERR_FORBIDDEN)', b.body.includes('ERR_FORBIDDEN') || b.status === 403 || b.status === 400, `status=${b.status} ${b.body.slice(0, 70)}`)

  console.log('== C) get_inventory_requirements ADMIN -> PASS ==')
  const c = await rpcGet(A.jwt, 'auth')
  let cok = false; try { cok = JSON.parse(c.body).ok === true } catch {}
  check('admin RPC allowed (ok:true)', c.status === 200 && cok, `status=${c.status} ${c.body.slice(0, 70)}`)

  console.log('== D-F) Direct inventory table ==')
  const d = await tblGet(ANON, 'anon'); const drows = safeLen(d.body)
  check('table ANON denied', d.status === 200 ? drows === 0 : d.status === 401 || d.status === 403, `status=${d.status} rows=${drows}`)
  const e = await tblGet(U.jwt, 'auth'); const erows = safeLen(e.body)
  check('table NON-ADMIN denied', e.status === 200 ? erows === 0 : e.status === 401 || e.status === 403, `status=${e.status} rows=${erows}`)
  const f = await tblGet(A.jwt, 'auth'); const frows = safeLen(f.body)
  check('table ADMIN read WORKS', f.status === 200 && frows >= 1, `status=${f.status} rows=${frows}`)

  console.log('== RESULT ==')
  console.log(failures === 0 ? 'G-SEC-01b = CLOSED (runtime verification)' : 'FAILURES=' + failures)
  process.exit(failures === 0 ? 0 : 1)
})().catch((e) => { console.error('FATAL', String(e).slice(0, 300)); process.exit(2) })

function safeLen(body) { try { return JSON.parse(body).length } catch { return -1 } }