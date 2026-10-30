// e45: dump LoginPage ส่วนที่เหลือ (111-280) + imports (1-35) — ทีละก้อน
const fs = require('fs')
const path = require('path')
const ROOT = 'D:\\A PROJECT\\Bite Me Baby'
const lines = fs.readFileSync(path.join(ROOT, 'src/pages/login/LoginPage.tsx'), 'utf8').split(/\r?\n/)
console.log('TOTAL=' + lines.length)
for (let i = 0; i < 35; i++) console.log(String(i + 1).padStart(4) + ' | ' + lines[i])
console.log('--- 111+ ---')
for (let i = 110; i < 280 && i < lines.length; i++) console.log(String(i + 1).padStart(4) + ' | ' + lines[i])