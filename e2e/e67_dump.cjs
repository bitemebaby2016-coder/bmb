// e67: dump/grep ไฟล์ BMB แบบเชื่อถือได้ (read tool ติด marker) — ใช้เสร็จลบ
// usage: node e67_dump.cjs <relpath> --lines <a> <b>
//        node e67_dump.cjs <relpath> --grep <regex> [limit]
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const [, , rel, mode, a, b] = process.argv
const file = path.isAbsolute(rel) ? rel : path.join(ROOT, rel)
const text = fs.readFileSync(file, 'utf8')
const lines = text.split('\n')
if (mode === '--lines') {
  const from = Math.max(1, parseInt(a || '1', 10))
  const to = Math.min(lines.length, parseInt(b || String(lines.length), 10))
  console.log('FILE=' + rel + ' total=' + lines.length + ' show=' + from + '-' + to)
  for (let i = from - 1; i < to; i++) console.log(String(i + 1).padStart(4) + ' | ' + lines[i])
} else if (mode === '--grep') {
  const re = new RegExp(a || '.')
  const limit = parseInt(b || '80', 10)
  console.log('FILE=' + rel + ' grep=' + a + ' total=' + lines.length)
  let n = 0
  lines.forEach((l, i) => {
    if (n >= limit) return
    if (re.test(l)) { console.log(String(i + 1).padStart(4) + ' | ' + l); n++ }
  })
  console.log('HITS_SHOWN=' + n)
} else {
  console.log('bad args')
  process.exit(1)
}