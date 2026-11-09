// R88 — รัน vitest ชุดเต็มแบบ detached (บทเรียน R74: .cmd stdout redirect ไม่เขียน log →
// ต้องให้ script "เขียนไฟล์เอง" ด้วย fs · watcher = process ที่อยู่รอดหลังเครื่องมือจบ)
// usage: node e2e\_r88_vitest_bg.cjs → poll e2e\_r88_vitest.log หา VITEST_EXIT=
'use strict'
const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

if (process.argv[2] === '--watch') {
  const log = fs.createWriteStream(path.join('e2e', '_r88_vitest.log'), { flags: 'w' })
  const p = spawn('npm', ['test'], { shell: true })
  p.stdout.pipe(log, { end: false })
  p.stderr.pipe(log, { end: false })
  p.on('error', (e) => { log.write('\nSPAWN_ERROR ' + String(e) + '\n'); log.end(() => process.exit(1)) })
  p.on('close', (code) => {
    log.write('\nVITEST_EXIT=' + code + '\n')
    log.end(() => process.exit(code === 0 ? 0 : 1))
  })
} else {
  const child = spawn(process.execPath, [__filename, '--watch'], {
    detached: true,
    stdio: 'ignore',
    cwd: process.cwd(),
  })
  child.unref()
  console.log('WATCHER pid=' + child.pid + ' -> e2e\\_r88_vitest.log')
}