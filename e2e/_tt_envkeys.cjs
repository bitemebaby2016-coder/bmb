// แสดงเฉพาะ "ชื่อ" ตัวแปรใน .env/.env.local (ไม่โชว์ค่า — กัน secret รั่ว)
'use strict'
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
for (const f of ['.env.local', '.env']) {
  try {
    const lines = fs.readFileSync(path.join(ROOT, f), 'utf8').split(/\r?\n/)
    const names = lines
      .map((l) => (l.match(/^([A-Za-z0-9_]+)=/) || [])[1])
      .filter(Boolean)
    console.log(f + ' => ' + names.join(' , '))
  } catch (e) {
    console.log(f + ' => ERR ' + e.message)
  }
}