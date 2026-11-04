'use strict'
// _r67_t4_faq_fix — convert answer strings containing ${...} to template literals
// (single quotes made them literal — the FAQ would print "${d.biteDriveFlatFee}" raw)
const fs = require('fs')
const TARGET = 'src/lib/faqContent.ts'
const lines = fs.readFileSync(TARGET, 'utf8').split(/\r?\n/)
let fixed = 0
for (let i = 0; i < lines.length; i++) {
  const l = lines[i]
  const m = l.match(/^(\s*a: )'(.*)'$/)
  if (m && m[2].includes('${')) {
    lines[i] = m[1] + '`' + m[2] + '`'
    fixed++
  }
}
fs.writeFileSync(TARGET, lines.join('\n'), 'utf8')
console.log('OK fixed ' + fixed + ' answer lines to template literals')
if (fixed < 5) { console.error('FAIL expected >=5 interpolating answers, got ' + fixed); process.exit(1) }
// assert: no '${' remains inside single-quoted answer strings
const after = fs.readFileSync(TARGET, 'utf8').split(/\r?\n/)
for (const l of after) {
  const m = l.match(/^(\s*a: )'(.*)'$/)
  if (m && m[2].includes('${')) { console.error('FAIL still literal: ' + l.trim()); process.exit(1) }
}
console.log('ALL_FIXES_OK')
