'use strict'
// _r69_clear_run — ปิดออเดอร์ทดสอบ @bmb.test ที่ค้างใน production (R69 · N-10)
// ตามคำสั่ง Owner (2026-11-05): ปิดแบบจบทรัพยากรตาม N-10
//   · pending/unpaid  → cancel_order RPC (canonical · audit + capacity release)
//   · paid + ready_for_dispatch (BMB-20261104-995) → transition_order_status → delivered
//     (ไม่แตะ payment_status / ไม่แตะเงิน — ไม่มี refund)
// ทุกขั้น verify ด้วย re-read แล้วเขียน _r69_clear_result.json
const { S, login, rpc, api, SERVICE } = require('./wave2Lib.cjs')

const REASON = 'R69 test-data cleanup (Owner N-10 · 2026-11-05)'

;(async () => {
  const out = { at: new Date().toISOString(), steps: [], cancelled: [], delivered: [], skipped: [], failed: [] }

  // 0) login test admin (is_admin() ต้องใช้ JWT แอดมินจริง — service key ใช้ไม่ได้)
  const admin = await login(S.BMB_TEST_ADMIN_EMAIL, S.BMB_TEST_ADMIN_PASSWORD)
  if (admin.status !== 200) throw new Error('test admin login failed: ' + admin.status)
  out.steps.push({ step: 'admin_login', status: admin.status })

  // 1) ดึงออเดอร์ที่ยังไม่จบ แล้วกรองเฉพาะลูกค้า @bmb.test
  const q = await api(SERVICE, 'GET',
    '/rest/v1/orders?select=order_number,status,payment_status,payment_method,delivery_method,customer_name,order_mode,created_at' +
    '&status=not.in.(delivered,cancelled)&limit=500')
  if (q.status !== 200) throw new Error('orders read failed: ' + q.status)
  const open = (q.j || []).filter(o => String(o.customer_name || '').toLowerCase().includes('@bmb.test'))
  console.log('open bmb.test orders =', open.length)
  out.steps.push({ step: 'list_open', count: open.length })
  out.open_before = open

  // 2) ปิดทีละตัวตามสภาพ
  for (const o of open) {
    if (o.status === 'pending') {
      const c = await rpc(admin.jwt, 'cancel_order', { p_order_number: o.order_number, p_reason: REASON })
      const ok = c.status === 200 && c.j && c.j.ok !== false
      console.log(`cancel ${o.order_number} → http ${c.status} ${JSON.stringify(c.j).slice(0, 160)}`)
      ;(ok ? out.cancelled : out.failed).push({ order_number: o.order_number, http: c.status, resp: c.j })
    } else if (o.payment_status === 'paid' && o.status === 'ready_for_dispatch') {
      // N-10: ออเดอร์จบทรัพยากร = เลื่อนถึง delivered (127 อนุญาต ready_for_dispatch → delivered)
      const t = await rpc(admin.jwt, 'transition_order_status', { p_order_number: o.order_number, p_new_status: 'delivered' })
      const ok = t.status === 200
      console.log(`deliver ${o.order_number} → http ${t.status} ${JSON.stringify(t.j).slice(0, 200)}`)
      ;(ok ? out.delivered : out.failed).push({ order_number: o.order_number, http: t.status, resp: t.j })
    } else {
      console.log(`SKIP ${o.order_number} status=${o.status}/${o.payment_status} — ไม่อยู่ในเกณฑ์ ต้องตรวจมือ`)
      out.skipped.push(o)
    }
  }

  // 3) VERIFY: re-read ห้ามมี bmb.test ค้างนอก delivered/cancelled
  const v = await api(SERVICE, 'GET',
    '/rest/v1/orders?select=order_number,status,payment_status,customer_name' +
    '&status=not.in.(delivered,cancelled)&limit=500')
  const still = ((v.j || []).filter(o => String(o.customer_name || '').toLowerCase().includes('@bmb.test')))
  out.remaining_open = still
  out.verified = still.length === 0 && out.failed.length === 0
  console.log('remaining open bmb.test =', still.length, '· failed =', out.failed.length, '· VERIFIED =', out.verified)

  require('fs').writeFileSync(require('path').join(__dirname, '_r69_clear_result.json'), JSON.stringify(out, null, 2))
  console.log('CLEAR_DONE verified=' + out.verified)
  if (!out.verified) process.exit(2)
})().catch(e => { console.error('ERR', e); process.exit(1) })