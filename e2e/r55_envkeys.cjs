// e2e/r55_envkeys.cjs — แสดงเฉพาะ "ชื่อ" key ใน .env / secrets.local.env (ไม่โชว์ค่า)
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')
for (const f of ['.env', 'supabase/secrets.local.env']) {
  const p = path.join(ROOT, f)
  if (!fs.existsSync(p)) {
    console.log(`${f}: MISSING`)
    continue
  }
  const names = fs
    .readFileSync(p, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.split('=')[0].trim())
    .filter((n) => n && !n.startsWith('#'))
  console.log(`${f}: ${names.join(' | ')}`)
}
