// R78 — lint wrap: รัน `npm run lint` (eslint + brandNameGuard) เขียน log ผ่าน fs
// (pattern จาก _r77GatesWrap.cjs · รันผ่าน _r78LintRun.cmd detached เพราะเกิน 30s command timeout)
'use strict'
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
const LOG = path.join(__dirname, '_r78_lint.log')

fs.writeFileSync(LOG, 'LINT_START ' + new Date().toISOString() + '\n')
const r = spawnSync(process.env.ComSpec || 'cmd.exe', ['/c', 'npm run -s lint'], {
  cwd: ROOT,
  encoding: 'utf8',
  maxBuffer: 32 * 1024 * 1024,
})
if (r.error) fs.appendFileSync(LOG, 'SPAWN_ERROR ' + String(r.error) + '\n')
fs.appendFileSync(LOG, (r.stdout || '') + (r.stderr || ''))
fs.appendFileSync(LOG, '\nLINT_EXIT=' + r.status + ' ' + new Date().toISOString() + '\n')