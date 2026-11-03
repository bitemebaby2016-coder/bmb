'use strict'
// รวม e2e/tProdProbe_results_<slice>.json ทุกช่วงเป็นไฟล์เดียว (dedupe ตาม id)
const fs = require('fs')
const path = require('path')
const dir = __dirname
const files = fs.readdirSync(dir).filter((f) => /^tProdProbe_results_.+\.json$/.test(f)).sort()
const items = []
const seen = new Set()
const used = []
for (const f of files) {
  let j
  try { j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) } catch { continue }
  used.push(f + '=' + (j.items || []).length)
  for (const it of j.items || []) {
    const k = it.id
    if (seen.has(k)) continue
    seen.add(k)
    items.push({ ...it, source: f })
  }
}
const out = {
  mergedAt: new Date().toISOString(),
  base: 'https://biteme-baby.com',
  note: 'รวมทุกสไลซ์ (สไลซ์ = รันแยกเพราะข้อจำกัดคำสั่ง 30s/ครั้งของ agent terminal) · fresh context ทุกช่วง = hard-refresh equivalent',
  sources: used,
  items,
}
const outPath = path.join(dir, 'tProdProbe_results_all.json')
fs.writeFileSync(outPath, JSON.stringify(out, null, 2))
const tally = {}
for (const it of items) tally[it.status] = (tally[it.status] || 0) + 1
console.log('MERGED ' + items.length + ' items from [' + used.join(', ') + ']')
console.log('TALLY ' + JSON.stringify(tally))
console.log('WROTE ' + outPath)
