'use strict'
// debug: ดู body จริงของ audit_logs insert ที่โดน 400
const { S, api, SERVICE } = require('./wave2Lib.cjs')
;(async () => {
  const a = await api(SERVICE, 'POST', '/rest/v1/audit_logs?resolution=merge-duplicates', {
    id: 'alog-r69-fail-PO-20261105-931',
    action: 'test_data_cleanup',
    entity_type: 'order',
    entity_id: 'PO-20261105-931',
    description: 'R69 test-data cleanup: unpaid PRE_ORDER past cancel-cutoff → failed (Owner decision 2026-11-05)',
    metadata: { category: 'test_data', batch: 'R69' },
  })
  console.log('http', a.status)
  console.log(JSON.stringify(a.j).slice(0, 1500))
  // ดูโครงสร้างแถว audit จริงเพื่อเทียบคอลัมน์
  const g = await api(SERVICE, 'GET', '/rest/v1/audit_logs?select=*&entity_id=eq.PO-20261105-931&limit=3')
  console.log('existing rows http', g.status)
  console.log(JSON.stringify(g.j).slice(0, 2000))
})().catch(e => { console.error('ERR', e); process.exit(1) })