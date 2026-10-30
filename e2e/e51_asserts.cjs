// e51: dump บริบท assert ที่จะแก้ตาม copy ใหม่ (4 ไฟล์)
const fs = require('fs')
const path = require('path')
const ROOT = 'D:\\A PROJECT\\Bite Me Baby'
const linesOf = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8').split('\n').map((s) => s.replace(/\r$/, ''))
const dump = (rel, a, b) => {
  const L = linesOf(rel)
  console.log('===== ' + rel + ' [' + a + '-' + b + '/' + L.length + '] =====')
  for (let i = a - 1; i < b && i < L.length; i++) console.log(String(i + 1).padStart(4) + ' | ' + L[i])
}
dump('src/__tests__/r12LandingUi.test.ts', 8, 26)
dump('src/__tests__/r13RiderLoopClose.test.ts', 1, 52)
dump('src/__tests__/storeStatusCopy.test.ts', 72, 122)
dump('src/__tests__/storeStatusWindow.test.ts', 24, 76)