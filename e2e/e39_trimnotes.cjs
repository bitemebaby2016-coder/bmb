// e39: ตัด block หมายเหตุท้ายการ์ดตั้งค่า (ย้ายเข้า details แล้ว) — marker-based กันพลาด CRLF/ยูนิโคด
const fs = require('fs')
const path = require('path')
const p = path.resolve(__dirname, '..', 'src', 'pages', 'admin', 'AdminPrintSettings.tsx')
let s = fs.readFileSync(p, 'utf8')
const before = s.length
const re = /[ \t]*<div className="text-xs text-brand-muted space-y-1">\r?\n[\s\S]*?\r?\n[ \t]*<\/div>\r?\n/
if (!re.test(s)) { console.log('NO_MATCH'); process.exit(1) }
s = s.replace(re, '')
fs.writeFileSync(p, s)
console.log('TRIMMED ' + (before - s.length) + ' chars')
