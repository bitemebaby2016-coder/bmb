// e52: dump 2 ช่วงที่ขาด (r13 asserts + storeStatusCopy ก่อน line 82)
const fs = require('fs')
const path = require('path')
const ROOT = 'D:\\A PROJECT\\Bite Me Baby'
const linesOf = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8').split('\n').map((s) => s.replace(/\r$/, ''))
const dump = (rel, a, b) => {
  const L = linesOf(rel)
  console.log('===== ' + rel + ' [' + a + '-' + b + '/' + L.length + '] =====')
  for (let i = a - 1; i < b && i < L.length; i++) console.log(String(i + 1).padStart(4) + ' | ' + L[i])
}
dump('src/__tests__/r13RiderLoopClose.test.ts', 41, 56)
dump('src/__tests__/storeStatusCopy.test.ts', 72, 106)