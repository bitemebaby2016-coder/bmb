// R82 — gates wrap: รัน tsc + lint + vitest เต็ม + build เขียน log ผ่าน fs
// (pattern จาก _r81GatesWrap.cjs — รันผ่าน _r82GatesRun.cmd detached เพราะเกิน 30s)
'use strict'
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
const LOG = path.join(__dirname, '_r82_gates.log')
const out = (s) => { try { fs.appendFileSync(LOG, s + '\n') } catch {} ; console.log(s) }

fs.writeFileSync(LOG, 'GATES_START ' + new Date().toISOString() + '\n')

for (const [label, cmd] of [['TSC', 'npx tsc --noEmit'], ['LINT', 'npm run -s lint'], ['VITEST', 'npm run -s test'], ['BUILD', 'npm run -s build']]) {
  out('== ' + label + ' ==')
  const r = spawnSync(process.env.ComSpec || 'cmd.exe', ['/c', cmd], { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
  if (r.error) out('  SPAWN_ERROR ' + String(r.error))
  const text = (r.stdout || '') + (r.stderr || '')
  for (const line of text.split(/\r?\n/)) {
    if (/Test Files|Tests |FAIL|✓ vitest|built in|error TS|✗|failed|problems?|EXIT/i.test(line)) out('  ' + line.trim())
  }
  out('== ' + label + ' exit=' + r.status)
}
out('GATES_DONE ' + new Date().toISOString())