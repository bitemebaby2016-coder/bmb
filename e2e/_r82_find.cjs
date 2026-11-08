// R82 helper: grep แบบ ASCII-safe สำหรับ cmd (findstr/Select-String พังกับ Thai/multiword)
// Usage: node e2e\_r82_find.cjs <regexPattern> [subdir ใต้ repo] [fileGlobExt]
// ตัวอย่าง: node e2e\_r82_find.cjs "pre_order_cutoff" supabase/migrations .sql
'use strict'
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const pattern = process.argv[2]
if (!pattern) { console.error('usage: node _r82_find.cjs <regex> [subdir] [ext]'); process.exit(1) }
const sub = process.argv[3] || ''
const ext = process.argv[4] || ''
const re = new RegExp(pattern, 'i')
const start = path.join(ROOT, sub)
let hits = 0

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === 'dist') continue
    const full = path.join(dir, name)
    const st = fs.statSync(full)
    if (st.isDirectory()) { walk(full); continue }
    if (ext && !name.toLowerCase().endsWith(ext)) continue
    if (st.size > 2_000_000) continue // กันไฟล์ใหญ่
    let text
    try { text = fs.readFileSync(full, 'utf8') } catch { continue }
    const lines = text.split(/\r?\n/)
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i])) {
        hits++
        const rel = path.relative(ROOT, full)
        console.log(`${rel}:${i + 1}: ${lines[i].trim().slice(0, 220)}`)
        if (hits >= 200) { console.log('... (hit cap 200)'); return }
      }
    }
  }
}
walk(start)
console.log('FIND_DONE hits=' + hits)