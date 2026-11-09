// R88 — รัน vitest ชุดเต็มแบบ detached (tool timeout 30s · เขียน log เอง ไม่พึ่ง stdout ของ .cmd)
// usage: node e2e\_r88_run_tests.cjs → แล้วรอ e2e\_r88_vitest.log + VITEST_EXIT=...
'use strict'
const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

const logPath = path.join('e2e', '_r88_vitest.log')
const out = fs.openSync(logPath, 'w')
const child = spawn('npm', ['test'], {
  cwd: process.cwd(),
  stdio: ['ignore', out, out],
  detached: true,
  shell: true, // Node 24/Windows: spawn npm.cmd ต้องผ่าน shell (กัน EINVAL)
})
child.on('error', (e) => {
  fs.writeSync(out, '\nLAUNCH_ERROR ' + String(e) + '\n')
})
child.unref()
console.log('LAUNCHED pid=' + child.pid + ' log=' + logPath)
