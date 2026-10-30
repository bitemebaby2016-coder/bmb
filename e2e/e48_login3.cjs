// e48: dump LoginPage 470-641 (ปุ่มโซเชียล/passkey) + route /shop ใน App.tsx
const fs = require('fs')
const path = require('path')
const ROOT = 'D:\\A PROJECT\\Bite Me Baby'
const lines = fs.readFileSync(path.join(ROOT, 'src/pages/login/LoginPage.tsx'), 'utf8').split(/\r?\n/)
for (let i = 469; i < lines.length; i++) console.log(String(i + 1).padStart(4) + ' | ' + lines[i])
console.log('===== App.tsx routes =====')
const app = fs.readFileSync(path.join(ROOT, 'src/App.tsx'), 'utf8').split(/\r?\n/)
app.forEach((ln, i) => { if (/path=|Navigate|\/shop|\/login/.test(ln)) console.log(String(i + 1).padStart(4) + ' | ' + ln.trim().slice(0, 150)) })