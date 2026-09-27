// Wave 2-C — F-18 Production RLS verification matrix (expected vs actual)
// Personas: anon / customer / driver / admin — TEST DATA only, no destructive ops.
'use strict'
const fs = require('fs')
const path = require('path')
const { api, ANON, rpc, login, S, readSecrets } = require('./wave2Lib.cjs')

const OUT = path.join(process.cwd(), 'e2e', 'wave2-rls.json')

async function main() {
  const secrets = readSecrets()
  const admin = await login(S.BMB_TEST_ADMIN_EMAIL, S.BMB_TEST_ADMIN_PASSWORD)
  const cust = await login('qa-customer@bmb.co.th', secrets.BMB_TEST_CUSTOMER_PASSWORD)
  const drv = await login('qa-driver@bmb.co.th', secrets.BMB_TEST_DRIVER_PASSWORD)
  const personas = { anon: { jwt: null }, customer: cust, driver: drv, admin }
  const matrix = []
  const check = (table, persona, action, expect, actual, pass, note) =>
    matrix.push({ table, persona, action, expect, actual, PASS: !!pass, note: note || '' })

  async function sel(jwt, table) {
    const r = await api(ANON, 'GET', '/rest/v1/' + table + '?select=id&limit=50', undefined, jwt)
    return { status: r.status, count: Array.isArray(r.j) ? r.j.length : null, body: r.j }
  }
  async function ins(jwt, table, body) {
    const r = await api(ANON, 'POST', '/rest/v1/' + table, body, jwt)
    return { status: r.status, body: r.j }
  }

  // ================= drivers =================
  // anon: DENY (0 rows)
  let a = await sel(null, 'drivers')
  check('drivers', 'anon', 'SELECT', '0 rows (deny)', a.status + '/' + a.count, a.count === 0)
  // customer: DENY (0 rows)
  a = await sel(cust.jwt, 'drivers')
  check('drivers', 'customer', 'SELECT', '0 rows (deny)', a.status + '/' + a.count, a.count === 0)
  // driver: OWN row only (1 row)
  a = await sel(drv.jwt, 'drivers')
  check('drivers', 'driver', 'SELECT', 'own row only (1)', a.status + '/' + a.count, a.count === 1)
  // admin: ALL (>=2 with test drivers)
  a = await sel(admin.jwt, 'drivers')
  check('drivers', 'admin', 'SELECT', 'all rows (>=2)', a.status + '/' + a.count, a.count >= 2)
  // customer INSERT: DENY
  a = await ins(cust.jwt, 'drivers', { id: 'drv-fake', name: 'fake', phone: '0987654321' })
  check('drivers', 'customer', 'INSERT', 'denied', String(a.status), a.status !== 200 && a.status !== 201)
  // driver self UPDATE: own row allowed (permitted fields)
  a = await api(ANON, 'PATCH', '/rest/v1/drivers?id=eq.drv-qa-w2-01', { vehicle_label: 'rls-probe' }, drv.jwt)
  check('drivers', 'driver', 'UPDATE own (vehicle_label)', 'allowed', String(a.status), a.status >= 200 && a.status < 300)
  // driver UPDATE other: DENY (no rows updated)
  a = await api(ANON, 'PATCH', '/rest/v1/drivers?id=eq.drv-qa-w2-02', { vehicle_label: 'hijack-rls' }, drv.jwt)
  const after = await api(ANON, 'GET', '/rest/v1/drivers?id=eq.drv-qa-w2-02&select=vehicle_label', undefined, admin.jwt)
  check('drivers', 'driver', 'UPDATE other', 'denied (no effect)', String(a.status) + '/' + JSON.stringify(after.j || {}).slice(0, 60),
    (after.j?.[0]?.vehicle_label ?? '') !== 'hijack-rls')
  // driver re-link user_id: DENY (WITH CHECK pin)
  a = await api(ANON, 'PATCH', '/rest/v1/drivers?id=eq.drv-qa-w2-01', { user_id: '00000000-0000-0000-0000-000000000001' }, drv.jwt)
  check('drivers', 'driver', 'UPDATE own user_id', 'denied (WITH CHECK pin)', String(a.status), a.status !== 200 && a.status !== 204)

  // ================= recipes =================
  // anon: DENY (0 rows) — Owner intent: no intended public policy
  a = await sel(null, 'recipes')
  check('recipes', 'anon', 'SELECT', '0 rows (deny)', a.status + '/' + a.count, a.count === 0)
  // customer/driver/admin: READ allowed (authenticated read)
  for (const [name, p] of [['customer', cust], ['driver', drv], ['admin', admin]]) {
    a = await sel(p.jwt, 'recipes')
    check('recipes', name, 'SELECT', 'read allowed (authenticated)', a.status + '/' + a.count, a.status === 200 && a.count > 0)
  }
  // customer/driver WRITE: DENY
  for (const [name, p] of [['customer', cust], ['driver', drv]]) {
    a = await ins(p.jwt, 'recipes', { id: 'rcp-fake-w2', product_id: 'p-fake', ingredient_id: 'i-fake', quantity_per_unit: 1 })
    check('recipes', name, 'INSERT', 'denied', String(a.status), a.status !== 200 && a.status !== 201)
  }
  // admin WRITE: allowed (INSERT temp row + DELETE = test data cleanup)
  a = await ins(admin.jwt, 'recipes', { id: 'rcp-w2-temp-probe', product_id: 'p-w2-temp', ingredient_id: 'i-w2-temp', quantity_per_unit: 1 })
  const insOk = a.status === 200 || a.status === 201
  let del = null
  if (insOk) del = await api(ANON, 'DELETE', '/rest/v1/recipes?id=eq.rcp-w2-temp-probe', undefined, admin.jwt)
  check('recipes', 'admin', 'INSERT+DELETE (temp probe row)', 'allowed + cleaned', String(a.status) + '/' + (del ? del.status : 'n/a'), insOk && (!del || del.status === 200 || del.status === 204))

  const result = {
    kind: 'BMB_WAVE2_F18_RLS_MATRIX',
    timestamp: new Date().toISOString(),
    env: 'PRODUCTION-DB (test data only)',
    commit: 'wave2',
    ownerIntent: {
      drivers: 'Driver Scoped / Admin Only (own profile + own jobs; customer/other-auth: none)',
      recipes: 'Authenticated Read / Admin Write (anon deny; master-recipe granularity = OWNER DECISION pending — no visibility column exists)',
    },
    matrix,
    passCount: matrix.filter((m) => m.PASS).length,
    total: matrix.length,
  }
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2))
  console.log('PASS ' + result.passCount + '/' + result.total)
  for (const m of matrix) if (!m.PASS) console.log('FAIL ' + m.table + '/' + m.persona + '/' + m.action + ' expect=' + m.expect + ' actual=' + m.actual)
}

main().catch((e) => { console.error('FATAL', e.message); process.exit(1) })
