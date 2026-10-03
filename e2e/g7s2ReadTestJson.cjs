const fs = require('fs')
const path = require('path')
const file = process.argv[2] || 'g7s2.json'
let raw = fs.readFileSync(path.join(process.env.TEMP, file), 'utf16le').replace(/^﻿/, '')
raw = raw.replace(/\u0000/g, '').replace(/^[^{]*/, '')
const j = JSON.parse(raw)
console.log('passed=' + j.numPassedTests + ' failed=' + j.numFailedTests)
for (const tr of j.testResults) {
  for (const a of tr.assertionResults) {
    if (a.status !== 'passed') console.log('FAIL: ' + a.fullName + ' :: ' + String(a.failureMessages[0] || '').slice(0, 200))
  }
}