// R74-OMNI s3 — gates wrap: รัน vitest + build เต็ม เขียน log ผ่าน fs (บทเรียน cmd redirect ตัดที่ช่องว่าง)
'use strict'
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
const LOG = path.join(__dirname, '_r74_gates2.log')
const out = (s) => { try { fs.appendFileSync(LOG, s + '\n') } catch {} ; console.log(s) }

fs.writeFileSync(LOG, 'GATES_START ' + new Date().toISOString() + '\n')

for (const [label, cmd] of [['VITEST', 'npm run -s test'], ['BUILD', 'npm run -s build']]) {
  out('== ' + label + ' ==')
  const r = spawnSync(process.env.ComSpec || 'cmd.exe', ['/c', cmd], { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
  if (r.error) out('  SPAWN_ERROR ' + String(r.error))
  const text = (r.stdout || '') + (r.stderr || '')
  // log เฉพาะบรรทัดสรุป/FAIL — log เต็มอยู่ใน vitest output ที่ตัดทิ้งได้
  for (const line of text.split(/\r?\n/)) {
    if (/Test Files|Tests |FAIL|✓ vitest|built in|error TS|✗|failed/i.test(line)) out('  ' + line.trim())
  }
  out('== ' + label + ' exit=' + r.status)
}
out('GATES_DONE ' + new Date().toISOString())
