'use strict'
// _r69n3_dbscan — N-3 (READ-ONLY): หา "ไบ๊" ที่เหลือในเนื้อหา DB ที่แสดงผลจริง
// (theater_daily_copy เคยพบ R53 + แก้แล้ว R54 — ตรวจอีกรอบ + ตาราง copy อื่น)
// ห้ามแตะข้อมูล — รายงานอย่างเดียว
const { api, SERVICE } = require('./wave2Lib.cjs')

const VARIANTS = ['ไบ๊', 'ไบท', 'ไบด', 'ไบช', 'บิท', 'บั๊บ', 'บัป', 'บัพ']
const TABLES = [
  'theater_daily_copy',
  'business_settings',
  'seo_settings',
  'faq_items',
  'announcements',
  'marketing_templates',
  'notification_templates',
]

function hit(json) {
  const s = JSON.stringify(json)
  return VARIANTS.filter((v) => s.includes(v))
}

;(async () => {
  const out = { at: new Date().toISOString(), tables: {} }
  for (const t of TABLES) {
    const q = await api(SERVICE, 'GET', `/rest/v1/${t}?select=*&limit=200`)
    if (q.status !== 200) {
      out.tables[t] = { error: 'http ' + q.status + ' ' + JSON.stringify(q.j).slice(0, 120) }
      continue
    }
    const rows = q.j || []
    const rowsHit = rows
      .map((r) => ({ id: r.id ?? r.key ?? null, variants: hit(r) }))
      .filter((r) => r.variants.length > 0)
    out.tables[t] = { rows: rows.length, hits: rowsHit }
    console.log(t + ': rows=' + rows.length + ' hits=' + rowsHit.length)
    for (const h of rowsHit) console.log('   ' + JSON.stringify(h))
  }
  require('fs').writeFileSync(require('path').join(__dirname, '_r69n3_dbscan.json'), JSON.stringify(out, null, 2))
  const total = Object.values(out.tables).reduce((n, t) => n + (t.hits ? t.hits.length : 0), 0)
  console.log('DBSCAN_DONE total_hits=' + total)
})().catch(e => { console.error('ERR', e); process.exit(1) })