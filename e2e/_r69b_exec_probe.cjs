'use strict'
// _r69b_exec_probe — อ่าน execution record ของ auto-cancel run (READ-ONLY)
// แถว audit id = 'auto-exec-' + event_id (รูปแบบเดียวกับ backup evidence ก่อนหน้า)
const { S, api, SERVICE } = require('./wave2Lib.cjs')

;(async () => {
  const id = process.argv[2] || 'auto-exec-manual-r69b-verify-1'
  const q = await api(SERVICE, 'GET',
    '/rest/v1/audit_logs?select=id,action,entity_id,description,metadata,created_at' +
    '&entity_id=eq.orders_stale_pending&order=created_at.desc&limit=3')
  if (q.status !== 200) throw new Error('audit read failed: ' + q.status + ' ' + JSON.stringify(q.j))
  const rows = q.j || []
  require('fs').writeFileSync(require('path').join(__dirname, '_r69b_exec_probe.json'), JSON.stringify(rows, null, 2))
  for (const r of rows) {
    console.log('id=' + r.id + ' action=' + r.action + ' at=' + r.created_at)
    console.log('description=' + r.description)
    console.log('metadata=' + JSON.stringify(r.metadata))
  }
  console.log('EXEC_ROWS=' + rows.length)
})().catch(e => { console.error('ERR', e); process.exit(1) })