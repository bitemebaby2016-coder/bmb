// R89 STAT — ดู log age/size/tail (แยก "วิ่งอยู่" vs "ค้าง") · จบแล้วลบทิ้ง
'use strict'
const fs = require('fs')
const f = 'e2e/_r88_final_gates.log'
if (!fs.existsSync(f)) { console.log('NO_LOG'); process.exit(0) }
const st = fs.statSync(f)
const s = fs.readFileSync(f, 'utf8')
console.log('size=' + st.size + ' age_sec=' + Math.round((Date.now() - st.mtimeMs) / 1000))
console.log('tail: ' + s.slice(-400).replace(/\s+/g, ' '))