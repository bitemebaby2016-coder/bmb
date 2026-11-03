// ============================================
// BMB R63 — cart_sessions 401 console error probe (TEST DATA ONLY)
// Purpose: พิสูจน์ต้นทาง 401 `?on_conflict=id` ใน console หน้า /shop
//   (Owner report 2026-11-03 — "Failed to load ... on_conflict=id 401")
// Hypothesis: m180 RLS ไม่มี policy ให้ anon INSERT → guest upsert = 401
//             (authenticated/admin = ต้องผ่าน policy cart_sessions_insert_own/admin_all)
// Steps: 1) anon upsert (จำลอง browser ที่ไม่ล็อกอิน) → คาด 401
//        2) admin login → upsert (จำลอง Owner ที่ล็อกอินแล้ว) → คาด 2xx
//        3) service SELECT สรุปแถวจริงใน production
//        4) cleanup แถว probe ทั้งหมด
// Evidence: e2e/r63Cart401-result.json
// ============================================
'use strict'
const fs = require('fs')
const path = require('path')
const { SB, ANON, SERVICE, S, api, login } = require('./wave2Lib.cjs')

const T_Anon = 'r63-probe-anon-' + Date.now()
const T_Admin = 'r63-probe-admin-' + Date.now()

;(async () => {
  const out = { date: new Date().toISOString(), target: SB + '/rest/v1/cart_sessions', tests: [] }
  const t = (name, pass, detail) => out.tests.push({ name, pass, detail })

  // 1) ANON upsert — same shape as browser (apikey+Bearer anon, on_conflict=id)
  const anonRow = { id: T_Anon, customer_id: null, items_count: 1, total_amount: 9.99, status: 'active', updated_at: new Date().toISOString() }
  const a = await api(ANON, 'POST', '/rest/v1/cart_sessions?on_conflict=id', anonRow)
  t('anon-upsert-401-reproduced', a.status === 401, 'status=' + a.status + ' body=' + JSON.stringify(a.j).slice(0, 160))

  // 2) ADMIN upsert — Owner logged-in path
  let adminStatus = 'login-failed'
  const l = await login(S.BMB_TEST_ADMIN_EMAIL, S.BMB_TEST_ADMIN_PASSWORD)
  if (l.status === 200 && l.jwt) {
    const adminRow = { id: T_Admin, customer_id: null, items_count: 2, total_amount: 19.98, status: 'active', updated_at: new Date().toISOString() }
    const b = await api(ANON, 'POST', '/rest/v1/cart_sessions?on_conflict=id', adminRow, l.jwt)
    adminStatus = String(b.status)
    t('admin-upsert-allowed', b.status === 201 || b.status === 200, 'status=' + b.status + ' body=' + JSON.stringify(b.j).slice(0, 160))
  } else {
    t('admin-upsert-allowed', false, 'admin login failed status=' + l.status + ' err=' + l.error)
  }

  // 3) production rows summary (service)
  const g = await api(SERVICE, 'GET', '/rest/v1/cart_sessions?select=id,status,customer_id,updated_at&order=updated_at.desc&limit=10')
  out.productionSample = { status: g.status, rows: g.j }
  const byStatus = {}
  for (const r of Array.isArray(g.j) ? g.j : []) byStatus[r.status] = (byStatus[r.status] || 0) + 1
  out.recentByStatus = byStatus

  // 4) cleanup probe rows (service)
  for (const id of [T_Anon, T_Admin]) {
    await api(SERVICE, 'DELETE', '/rest/v1/cart_sessions?id=eq.' + encodeURIComponent(id))
  }
  const chk = await api(SERVICE, 'GET', '/rest/v1/cart_sessions?id=in.("' + T_Anon + '","' + T_Admin + '")&select=id')
  out.cleanup = { remaining: Array.isArray(chk.j) ? chk.j.length : 'unknown', adminUpsertStatus: adminStatus }

  out.allPass = out.tests.every((x) => x.pass)
  fs.writeFileSync(path.join(__dirname, 'r63Cart401-result.json'), JSON.stringify(out, null, 2))
  console.log(JSON.stringify({ allPass: out.allPass, tests: out.tests, recentByStatus: out.recentByStatus, cleanup: out.cleanup }, null, 2))
})().catch((e) => { console.error('PROBE FAIL:', e); process.exit(1) })