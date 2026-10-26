// temp: extract real vitest failure summary from gates log (DELETE at session end)
const fs = require('fs')
const s = fs.readFileSync('D:/A PROJECT/Bite Me Baby/e2e/gates_ui2026-10-26.log', 'utf8')
const lines = s.split(/\r?\n/)
// 1) final summary block
for (let i = lines.length - 1; i >= 0 && i > lines.length - 120; i--) {
  if (/Test Files|Tests\s+\d|Duration/.test(lines[i])) console.log('SUMMARY: ' + lines[i].replace(/\[[0-9;]*m/g, ''))
}
// 2) FAIL markers with context
let found = 0
for (let i = 0; i < lines.length; i++) {
  const clean = lines[i].replace(/\[[0-9;]*m/g, '')
  if (/^\s*(FAIL|❯.*failed|×)|AssertionError|Error: expected|toMatchObject|toEqual/i.test(clean) && /test|expect|FAIL|×|Assertion/i.test(clean)) {
    console.log(`${i + 1}: ${clean}`)
    found++
  }
}
if (!found) console.log('no FAIL markers — dumping last 60 cleaned lines:')
if (!found) for (const l of lines.slice(-60)) console.log(l.replace(/\[[0-9;]*m/g, ''))
