'use strict'
// _r67_t5_e2e_b2 — retry B: provider-option -> fulfillment-delivery (short needle)
const fs = require('fs')
const file = 'e2e/runE2E.cjs'
const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
let done = 0
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('provider-option') && lines[i].includes('waitForSelector')) {
    console.log('BEFORE ' + (i + 1) + ': ' + lines[i])
    lines[i] = lines[i].split('provider-option').join('fulfillment-delivery')
    console.log('AFTER  ' + (i + 1) + ': ' + lines[i])
    done++
  }
}
fs.writeFileSync(file, lines.join('\n'), 'utf8')
console.log('OK provider lines updated=' + done)
if (done !== 1) { console.error('FAIL expected exactly 1 provider line, got ' + done); process.exit(1) }
console.log('B2_OK')
