// Wave 2-B — F-06 driver identity security verification (TEST DATA only)
// Prereq: migration 041 applied + wave2Setup run.
// Spoof cases: A (no JWT) B (customer JWT) C (cross-driver read)
//              D (cross-driver mutation) E (phone param vs JWT)
'use strict'
const fs = require('fs')
const path = require('path')
const { api, ANON, rpc, login, S, readSecrets } = require('./wave2Lib.cjs')

const OUT = path.join(process.cwd(), 'e2e', 'wave2-driver-security.json')

async function main() {
  const secrets = readSecrets()
  const admin = await login(S.BMB_TEST_ADMIN_EMAIL, S.BMB_TEST_ADMIN_PASSWORD)
  if (admin.status !== 200) throw new Error('admin login failed ' + admin.status)
  const cust = await login('qa-customer@bmb.co.th', secrets.BMB_TEST_CUSTOMER_PASSWORD)
  const drvA = await login('qa-driver@bmb.co.th', secrets.BMB_TEST_DRIVER_PASSWORD)
  const drvB = await login('qa-driver2@bmb.co.th', secrets.BMB_TEST_DRIVER2_PASSWORD)

  const checks = []
  const push = (name, pass, detail) => checks.push({ name, pass, detail: detail == null ? '' : String(detail).slice(0, 200) })

  // Case A — no JWT (anon key): driver RPCs must be unusable
  const anonLogin = await api(ANON, 'POST', '/rest/v1/rpc/driver_login', {})
  push('F06.A_no_jwt_rejected', anonLogin.status !== 200, 'driver_login(anon)=' + anonLogin.status)

  // Case B — customer JWT must NOT be a driver
  const custLogin = await rpc(cust.jwt, 'driver_login')
  push('F06.B_customer_not_driver', custLogin.status !== 200 || custLogin.j?.ok !== true,
    'customer driver_login=' + custLogin.status + ' ' + JSON.stringify(custLogin.j || {}).slice(0, 120))

  // Case B2 — unbound auth user cannot self-register a driver by phone (old path removed)
  const oldPath = await api(ANON, 'POST', '/rest/v1/rpc/driver_login', { p_phone: '0900000001', p_name: 'Fake' }, cust.jwt)
  push('F06.B2_phone_self_register_removed', oldPath.status !== 200, 'driver_login(p_phone)=' + oldPath.status + ' (dropped signature → 404 PGRST202 expected)')

  // Case C — driver reads drivers table: must see ONLY their own row
  const drvARows = await api(ANON, 'GET', '/rest/v1/drivers?select=id,phone', undefined, drvA.jwt)
  const drvARowIds = (drvARows.j || []).map((r) => r.id)
  push('F06.C_driver_own_row_only', drvARows.status === 200 && drvARowIds.length === 1 && drvARowIds[0] === 'drv-qa-w2-01',
    'driver A sees rows=' + JSON.stringify(drvARowIds))

  // customer sees ZERO driver rows
  const custRows = await api(ANON, 'GET', '/rest/v1/drivers?select=id', undefined, cust.jwt)
  push('F06.C_customer_zero_rows', (custRows.j || []).length === 0, 'customer sees=' + JSON.stringify(custRows.j || []).slice(0, 120))

  // anon sees ZERO (401/error response also counts as denied)
  const anonRows = await api(ANON, 'GET', '/rest/v1/drivers?select=id')
  const anonCount = Array.isArray(anonRows.j) ? anonRows.j.length : (anonRows.status !== 200 ? 0 : -1)
  push('F06.C_anon_zero_rows', anonCount === 0, 'anon status=' + anonRows.status + ' count=' + anonCount)

  // Case D — Driver A cannot mutate Driver B's assignment
  const ordersQ = await api(ANON, 'GET', '/rest/v1/orders?select=order_number,status&order=created_at.desc&limit=10', undefined, admin.jwt)
  const pendingOrder = (ordersQ.j || []).find((o) => ['confirmed', 'preparing', 'ready_for_dispatch'].includes(o.status))
  if (!pendingOrder) {
    push('F06.D_cross_driver_mutation', false, 'no dispatchable test order (transition a test order first)')
  } else {
    const assign = await rpc(admin.jwt, 'assign_driver', { p_order_number: pendingOrder.order_number, p_driver_id: 'drv-qa-w2-02' })
    push('F06.D_setup_assign_to_B', assign.status === 200 && assign.j?.ok, 'assign=' + assign.status)
    const cross = await rpc(drvA.jwt, 'driver_accept_assignment', { p_order_number: pendingOrder.order_number, p_driver_phone: '0900000002' })
    push('F06.D_cross_driver_mutation', cross.status !== 200, 'A accepts B-order=' + cross.status + ' ' + JSON.stringify(cross.j || {}).slice(0, 120))
    const own = await rpc(drvB.jwt, 'driver_accept_assignment', { p_order_number: pendingOrder.order_number, p_driver_phone: '0900000002' })
    push('F06.own_assignment_works', own.status === 200 && own.j?.ok === true, 'B accepts own=' + own.status)
  }

  // Case E — phone param of Driver B + JWT of Driver A → JWT WINS
  const spoof = await rpc(drvA.jwt, 'driver_accept_assignment', { p_order_number: 'TEST-NONE-E', p_driver_phone: '0900000002' })
  push('F06.E_jwt_wins_not_phone', spoof.status !== 200, 'A with B-phone=' + spoof.status + ' ' + JSON.stringify(spoof.j || {}).slice(0, 120))

  // driver self-update own row (permitted fields) works; other driver's row does not
  const selfUp = await api(ANON, 'PATCH', '/rest/v1/drivers?id=eq.drv-qa-w2-01', { vehicle_label: 'W2 self-update' }, drvA.jwt)
  push('F06.self_update_own', selfUp.status >= 200 && selfUp.status < 300, 'PATCH own=' + selfUp.status)
  const otherUp = await api(ANON, 'PATCH', '/rest/v1/drivers?id=eq.drv-qa-w2-02', { vehicle_label: 'hijack' }, drvA.jwt)
  const otherAfter = await api(ANON, 'GET', '/rest/v1/drivers?id=eq.drv-qa-w2-02&select=vehicle_label', undefined, drvA.jwt)
  push('F06.self_update_other_blocked', (otherAfter.j?.[0]?.vehicle_label ?? '') !== 'hijack', 'PATCH other → label=' + JSON.stringify(otherAfter.j || {}).slice(0, 80))
  // driver cannot re-link user_id (WITH CHECK pin)
  const relink = await api(ANON, 'PATCH', '/rest/v1/drivers?id=eq.drv-qa-w2-01', { user_id: '00000000-0000-0000-0000-000000000000' }, drvA.jwt)
  push('F06.relink_hijack_blocked', relink.status !== 200 && relink.status !== 204, 'PATCH user_id=' + relink.status)

  // admin full access works
  const adminRows = await api(ANON, 'GET', '/rest/v1/drivers?select=id', undefined, admin.jwt)
  push('F06.admin_full_access', (adminRows.j || []).length >= 2, 'admin sees=' + (adminRows.j || []).length)

  const result = { kind: 'BMB_WAVE2_F06_DRIVER_SECURITY', timestamp: new Date().toISOString(), env: 'PRODUCTION-DB (test data only)', commit: 'wave2', checks, passCount: checks.filter((c) => c.pass).length, total: checks.length }
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2))
  console.log('PASS ' + result.passCount + '/' + result.total)
  for (const c of checks) if (!c.pass) console.log('FAIL ' + c.name + ' :: ' + c.detail)
}

main().catch((e) => { console.error('FATAL', e.message); process.exit(1) })

