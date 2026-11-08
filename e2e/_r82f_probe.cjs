// ============================================
// BMB R82f — READ-ONLY: menu_schedule ครอบคลุมแค่เมนูพรีออเดอร์ หรือทั้งหมด?
//   (ถ้าทุกเมนูมีแถว → assessProductWindows จะเข้าใจเมนูเซมเดย์ผิด — ต้องรู้ก่อน deploy)
//   evidence: e2e/_r82f_evidence.json
// ============================================
'use strict'
process.chdir(require('path').join(__dirname, '..'))
const fs = require('fs')
const path = require('path')
const { SB, SERVICE } = require('./wave2Lib.cjs')

async function get(p) {
  const r = await fetch(SB + p, { headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE } })
  const t = await r.text()
  try { return JSON.parse(t) } catch { return { error: r.status, raw: t.slice(0, 200) } }
}

async function main() {
  const out = { tool: 'r82f-schedule-scope', ts: new Date().toISOString(), mode: 'READ_ONLY' }
  const sched = await get('/rest/v1/menu_schedule?select=product_id,scheduled_date,is_published&limit=1000')
  const prods = await get('/rest/v1/products?select=id,name,is_available&archived=eq.false&limit=300')
  const rows = Array.isArray(sched) ? sched : []
  const ids = [...new Set(rows.map((r) => r.product_id))]
  const pubIds = [...new Set(rows.filter((r) => r.is_published).map((r) => r.product_id))]
  const prodList = Array.isArray(prods) ? prods : []
  out.summary = {
    schedule_rows: rows.length,
    schedule_products_distinct: ids.length,
    schedule_products_published: pubIds.length,
    products_total: prodList.length,
    products_with_schedule: prodList.filter((p) => ids.includes(p.id)).map((p) => p.name),
    products_without_schedule: prodList.filter((p) => !ids.includes(p.id)).map((p) => p.name).slice(0, 25),
    sample_rows: rows.slice(0, 12),
  }
  fs.writeFileSync(path.join(__dirname, '_r82f_evidence.json'), JSON.stringify(out, null, 2))
  console.log('R82F sched_rows=' + out.summary.schedule_rows + ' distinct_sched=' + out.summary.schedule_products_distinct + ' products=' + out.summary.products_total)
  console.log('R82F with_sched=' + JSON.stringify(out.summary.products_with_schedule))
  console.log('R82F without_sched(first)=' + JSON.stringify(out.summary.products_without_schedule.slice(0, 8)))
}

main().catch((e) => { console.error('R82F_FAIL', String(e).slice(0, 300)); process.exit(1) })