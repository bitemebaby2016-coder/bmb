// N2 scan — หา source copy ที่ยังมี "ไบ๊" ใน src/ + supabase/ (ไม่รวม __tests__ กับ backups)
// รัน: node e2e/r53_n2_scan.cjs (single-run · exit 0 เสมอ · evidence = stdout)
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')
const SKIP_DIR = new Set(['__tests__', 'node_modules', 'dist', 'backups', 'backup'])
const hits = []
function walk(dir) {
  let entries
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
  for (const e of entries) {
    const fp = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (!SKIP_DIR.has(e.name)) walk(fp)
      continue
    }
    if (!/\.(ts|tsx|js|cjs|sql|css|html|json)$/.test(e.name)) continue
    const rel = path.relative(ROOT, fp).replace(/\\/g, '/')
    if (rel.includes('/backups/') || rel.includes('/archive/')) continue
    // brandName = ตัว map เอง (REPLACEMENTS ต้องคงคำไทยไว้) — ข้ามเฉพาะไฟล์ map
    const text = fs.readFileSync(fp, 'utf8')
    text.split(/\r?\n/).forEach((line, i) => {
      if (line.includes('ไบ๊')) hits.push(`${rel}:${i + 1}: ${line.trim().slice(0, 160)}`)
    })
  }
}
walk(path.join(ROOT, 'src'))
walk(path.join(ROOT, 'supabase'))
console.log(hits.length ? hits.join('\n') : 'NO_HITS')
console.log(`TOTAL ${hits.length}`)