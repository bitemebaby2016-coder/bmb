// e47: dump LoginPage 280-470 (โซนปุ่ม FB/passkey ที่จะเพิ่ม Google/LINE)
const fs = require('fs')
const path = require('path')
const ROOT = 'D:\\A PROJECT\\Bite Me Baby'
const lines = fs.readFileSync(path.join(ROOT, 'src/pages/login/LoginPage.tsx'), 'utf8').split(/\r?\n/)
for (let i = 279; i < 470 && i < lines.length; i++) console.log(String(i + 1).padStart(4) + ' | ' + lines[i])