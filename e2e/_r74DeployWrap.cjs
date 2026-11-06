// R74-OMNI session 2 — deploy wrapper: รัน _r74DeployFns.cjs แล้วเขียน log ผ่าน fs
// (บทเรียน R74: shell redirect เสียหายได้/console หายได้ — เขียนไฟล์ด้วย Node เท่านั้น)
// Usage (detached): node e2e/_r74Launch.cjs e2e/_r74DeployRun.cmd  →  log: e2e/_r74_deploy.log
'use strict'
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const ROOT = path.resolve(__dirname, '..')
const LOG = path.join(__dirname, '_r74_deploy.log')
const t0 = Date.now()
const r = spawnSync(process.execPath, [path.join(__dirname, '_r74DeployFns.cjs')], {
  cwd: ROOT,
  encoding: 'utf8',
  timeout: 420000,
  shell: false,
})
const out = [
  'WRAP_START ' + new Date().toISOString(),
  '--- STDOUT ---',
  (r.stdout || '').trim(),
  '--- STDERR ---',
  (r.stderr || '').trim(),
  '--- RESULT --- exit=' + r.status + ' signal=' + r.signal + ' elapsed_ms=' + (Date.now() - t0) +
    (r.error ? ' ERR=' + String(r.error).slice(0, 200) : ''),
  'WRAP_DONE ' + new Date().toISOString(),
].join('\n')
fs.writeFileSync(LOG, out)
console.log('WRAP_DONE exit=' + r.status)
