'use strict'
// find failed test identifiers in r63 vitest log
const fs = require('fs')
const path = require('path')
const lines = fs.readFileSync(path.join(process.cwd(), 'e2e', 'r63_vitest_full.log'), 'utf8').split(/\r?\n/)
const hits = []
lines.forEach((l, i) => {
  if (l.includes('FAIL ') || l.includes('FAIL\u001b') || l.includes('AssertionError') || l.includes('→ ')) {
    hits.push({ line: i + 1, text: l.replace(/\u001b\[\d+m/g, '').slice(0, 220) })
  }
})
console.log(JSON.stringify(hits.slice(-25), null, 1))