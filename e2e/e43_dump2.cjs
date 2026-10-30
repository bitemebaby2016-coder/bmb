// e43: dump printService 181-341 (printHtmlInHiddenFrame) + LoginPage head + socialLogin ทั้งไฟล์
const fs = require('fs')
const path = require('path')
const ROOT = 'D:\\A PROJECT\\Bite Me Baby'
const dumpRange = (rel, a, b) => {
  const lines = fs.readFileSync(path.join(ROOT, rel), 'utf8').split(/\r?\n/)
  console.log('===== ' + rel + ' [' + a + '-' + b + '] =====')
  for (let i = a - 1; i < b && i < lines.length; i++) console.log(String(i + 1).padStart(4) + ' | ' + lines[i])
}
dumpRange('src/lib/printService.ts', 181, 341)
dumpRange('src/pages/login/LoginPage.tsx', 1, 130)
dumpRange('src/lib/socialLogin.ts', 1, 123)