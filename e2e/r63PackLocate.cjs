'use strict'
// locate runtime-cap keywords in test pack (line numbers for §C4 mapping)
const fs = require('fs')
const path = require('path')
const lines = fs.readFileSync(path.join(process.cwd(), 'docs', 'BMB_PRODUCTION_TEST_PACK.md'), 'utf8').split(/\r?\n/)
const keys = ['ตรวจสลิป', 'POD', 'push', 'SMS', '§S', '## S', '## T']
const hits = []
lines.forEach((l, i) => {
  for (const k of keys) if (l.includes(k)) { hits.push({ line: i + 1, k, text: l.slice(0, 110) }); break }
})
console.log(JSON.stringify(hits, null, 1))