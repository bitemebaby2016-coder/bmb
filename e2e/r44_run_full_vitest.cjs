// R44: spawn full vitest detached (.tool timeout 30s — ใช้ตัวนี้คืนทันที แล้วค่อยอ่านล็อกทีเดียว)
'use strict'
const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const log = fs.openSync(path.join(__dirname, 'r44_vitest_full.log'), 'w')
const p = spawn('npx', ['vitest', 'run', '--reporter=basic'], {
  shell: true,
  detached: true,
  stdio: ['ignore', log, log],
  cwd: path.resolve(__dirname, '..'),
})
p.unref()
console.log('SPAWNED_VITEST pid=' + p.pid + ' → e2e/r44_vitest_full.log')