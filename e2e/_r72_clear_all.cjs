'use strict'
// _r72_clear_all — ล้างออเดอร์ค้างทุกสถานะที่ไม่จบ (Owner อนุมัติ 2026-11-05 ดึก: "ล้างออเดอร์ทั้งหมดที่ค้างอยู่ในรายการ
// แล้วเครียล์สเตจปิดเซสซั่น เริ่มทดสอบทั้งหมดที่ค้างกันใหม่")
//   · ทุกสถานะที่ไม่จบ (pending..arrived) → cancel_order RPC (canonical · audit + คืนสต็อก +
//     ปล่อยที่นั่งรอบ + ปิด assignment ผ่าน trigger ของระบบ)
//   · ไม่แตะ delivered/cancelled/failed (จบแล้ว) · ไม่แตะ payment/refund
// verify ด้วย re-read → เขียน _r72_clear_all_result.json
const { S, login, rpc, api, SERVICE } = require('./wave2Lib.cjs')

const REASON = 'R72 stage clear — Owner approved full list cleanup (2026-11-05)'

;(async () => {
  const out = { at: new Date().toISOString(), steps: [], cancelled: [], skipped: [], failed: [] }

  const admin = await login(S.BMB_TEST_ADMIN_EMAIL, S.BMB_TEST_ADMIN_PASSWORD)
  if (admin.status !== 200) throw new Error('test admin login failed: ' + admin.status)
  out.steps.push({ step: 'admin_login', status: admin.status })

  const q = await api(SERVICE, 'GET',
    '/rest/v1/orders?select=order_number,status,payment_status,payment_method,order_mode,scheduled_date,customer_name,created_at' +
    '&status=not.in.(delivered,cancelled,failed)&limit=500&order=created_at.asc')
  if (q.status !== 200) throw new Error('orders read failed: ' + q.status)
  const open = q.j || []
  console.log('open (non-terminal) orders =', open.length)
  for (const o of open) console.log(' -', o.order_number, o.status, o.payment_status, o.order_mode, o.customer_name)
  out.steps.push({ step: 'list_open', count: open.length })
  out.open_before = open

  for (const o of open) {
    const c = await rpc(admin.jwt, 'cancel_order', { p_order_number: o.order_number, p_reason: REASON })
    const ok = c.status === 200 && c.j && c.j.ok !== false
    console.log(`cancel ${o.order_number} (${o.status}) → http ${c.status} ${JSON.stringify(c.j).slice(0, 160)}`)
    ;(ok ? out.cancelled : out.failed).push({ order_number: o.order_number, from_status: o.status, http: c.status, resp: c.j })
  }

  // VERIFY: re-read ห้ามเหลือ non-terminal
  const v = await api(SERVICE, 'GET',
    '/rest/v1/orders?select=order_number,status,customer_name&status=not.in.(delivered,cancelled,failed)&limit=500')
  out.remaining_open = v.j || []
  out.verified = out.remaining_open.length === 0 && out.failed.length === 0
  console.log('remaining open =', out.remaining_open.length, '· failed =', out.failed.length, '· VERIFIED =', out.verified)

  require('fs').writeFileSync(require('path').join(__dirname, '_r72_clear_all_result.json'), JSON.stringify(out, null, 2))
  console.log('CLEAR_ALL_DONE verified=' + out.verified)
  if (!out.verified) process.exit(2)
})().catch(e => { console.error('ERR', e); process.exit(1) })