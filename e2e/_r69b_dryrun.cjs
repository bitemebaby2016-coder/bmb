'use strict'
// _r69b_dryrun — R69 Phase B DRY RUN (READ-ONLY · ไม่แตะข้อมูลใด ๆ)
// รายชื่อออเดอร์ที่จะเข้าเกณฑ์ auto-cancel: pending + unpaid + non-COD + created_at < now-12h
// ใช้ประกอบการตัดสินใจก่อน deploy/เปิดใช้งานจริงเท่านั้น
const { S, api, SERVICE } = require('./wave2Lib.cjs')

;(async () => {
  const cutoff = new Date(Date.now() - 720 * 60_000).toISOString()
  const q = await api(SERVICE, 'GET',
    '/rest/v1/orders?select=order_number,status,payment_status,payment_method,order_mode,created_at,customer_name' +
    '&status=eq.pending&payment_status=eq.pending&payment_method=neq.cash_on_delivery' +
    '&created_at=lt.' + encodeURIComponent(cutoff) + '&limit=100')
  if (q.status !== 200) throw new Error('query failed: ' + q.status + ' ' + JSON.stringify(q.j))
  const rows = q.j || []
  const out = {
    at: new Date().toISOString(),
    cutoff,
    criteria: 'status=pending & payment_status=pending & payment_method!=cash_on_delivery & created_at<' + cutoff,
    count: rows.length,
    rows,
  }
  require('fs').writeFileSync(require('path').join(__dirname, '_r69b_dryrun.json'), JSON.stringify(out, null, 2))
  for (const r of rows) {
    console.log([r.order_number, r.order_mode, r.payment_method, r.created_at, r.customer_name].join(' | '))
  }
  console.log('DRYRUN count=' + rows.length)
})().catch(e => { console.error('ERR', e); process.exit(1) })