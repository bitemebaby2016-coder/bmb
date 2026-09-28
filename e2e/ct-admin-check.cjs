'use strict'
// Read-only: replicate stripe-refund's admin check path. No values printed.
const SB = 'https://ivkdfognyiwjcmrhcnwz.supabase.co'
const ANON = 'sb_publishable_Q7AHrjSYOrysDjxS9_ZB-g_NMmytLOH'
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || ''
const REF = 'ivkdfognyiwjcmrhcnwz'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fet = async (u, i) => { let last; for (let a = 0; a < 5; a++) { try { return await fetch(u, i) } catch (e) { last = e; if (a === 4) break; await sleep(1200 * (a + 1)) } } throw last }
async function q(sql) {
  const r = await fet(`https://api.supabase.com/v1/projects/${REF}/database/query`, { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: sql }) })
  const b = await r.text(); if (!r.ok) throw new Error('MGMT ' + r.status + ' ' + b.slice(0, 200)); return JSON.parse(b)
}
async function phoneLogin(name, phone) {
  const r = await fet(`${SB}/functions/v1/phone-auto-login`, { method: 'POST', headers: { apikey: ANON, 'content-type': 'application/json' }, body: JSON.stringify({ name, phone, latitude: 10.7031, longitude: 102.1444, address_detail: 'x' }) })
  const j = await r.json(); const tok = j.session?.access_token || j.access_token
  if (!tok) throw new Error('login fail ' + r.status)
  return { jwt: tok, uid: (j.user?.id || j.session?.user?.id || '') }
}
async function promoteAdmin(uid, phone, name) {
  await q(`INSERT INTO public.profiles (id, phone, name, role, created_at, updated_at) VALUES ('${uid}','${phone}','${name}','admin',now(),now()) ON CONFLICT (id) DO UPDATE SET role='admin', updated_at=now()`)
}
;(async () => {
  const phone = '+669' + String(Date.now()).slice(-8)
  const S = await phoneLogin('[STEP2-CT] ADMINPROBE', phone)
  await promoteAdmin(S.uid, phone, '[STEP2-CT] ADMINPROBE')
  console.log('promoted uid=', S.uid)
  try { console.log('profiles_columns=', JSON.stringify((await q("select column_name from information_schema.columns where table_schema='public' and table_name='profiles' order by ordinal_position")).map(r => r.column_name))) } catch (e) { console.log('schema_err=', String(e).slice(0, 150)) }
  try { console.log('svc_row=', JSON.stringify((await q(`select id,role,is_active from public.profiles where id='${S.uid}'`)))) } catch (e) { console.log('svc_row_err=', String(e).slice(0, 200)) }
  const r = await fet(`${SB}/rest/v1/profiles?select=role,is_active&id=eq.${encodeURIComponent(S.uid)}`, { headers: { apikey: ANON, Authorization: 'Bearer ' + S.jwt } })
  console.log('user_select_status=', r.status, 'body=', (await r.text()).slice(0, 200))
  try { const r2 = await fet(`${SB}/rest/v1/rpc/is_admin`, { method: 'POST', headers: { apikey: ANON, Authorization: 'Bearer ' + S.jwt, 'content-type': 'application/json' }, body: '{}' }); console.log('is_admin_status=', r2.status, 'body=', (await r2.text()).slice(0, 120)) } catch (e) { console.log('is_admin_err=', String(e).slice(0, 120)) }
})().catch((e) => { console.error('ERR', String(e).slice(0, 300)); process.exit(1) })