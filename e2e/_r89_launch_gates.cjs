// R89 GATES LAUNCHER — detach จริง (ไม่ค้าง pipe shell · ไม่ timeout) + กันยิงซ้ำถ้ามี job วิ่งอยู่
'use strict'
const fs = require('fs')
const { spawn } = require('child_process')
const LOG = 'e2e/_r88_final_gates.log'
if (fs.existsSync(LOG)) {
  const ageMin = (Date.now() - fs.statSync(LOG).mtimeMs) / 60000
  const txt = fs.readFileSync(LOG, 'utf8')
  const done = txt.includes('ALL_GATES_DONE') || txt.includes('GATE_FAILED_AT')
  if (ageMin < 15 && !done) {
    console.log('ALREADY_RUNNING age_min=' + ageMin.toFixed(1))
    process.exit(0)
  }
}
const p = spawn(process.execPath, ['e2e\\_r88_final_gates.cjs'], {
  detached: true,
  stdio: 'ignore',
  cwd: process.cwd(),
})
p.unref()
console.log('GATES_LAUNCHED pid=' + p.pid)