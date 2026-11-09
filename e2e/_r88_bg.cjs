// R88 — รัน `npm run <script>` แบบ detached (watcher เขียน log เอง · อยู่รอดหลังเครื่องมือจบ)
// usage: node e2e\_r88_bg.cjs <npm-script> [logname] → poll หา EXIT=
'use strict'
const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

if (process.argv[2] === '--watch') {
  const npmScript = process.argv[3] || 'test'
  const logName = process.argv[4] || '_r88_vitest.log'
  const log = fs.createWriteStream(path.join('e2e', logName), { flags: 'w' })
  const p = spawn('npm', ['run', npmScript], { shell: true })
  p.stdout.pipe(log, { end: false })
  p.stderr.pipe(log, { end: false })
  p.on('error', (e) => { log.write('\nSPAWN_ERROR ' + String(e) + '\n'); log.end(() => process.exit(1)) })
  p.on('close', (code) => {
    log.write('\nEXIT=' + code + '\n')
    log.end(() => process.exit(code === 0 ? 0 : 1))
  })
} else {
  const npmScript = process.argv[2] || 'test'
  const logName = process.argv[3] || '_r88_vitest.log'
  const child = spawn(process.execPath, [__filename, '--watch', npmScript, logName], {
    detached: true,
    stdio: 'ignore',
    cwd: process.cwd(),
  })
  child.unref()
  console.log('WATCHER pid=' + child.pid + ' script=' + npmScript + ' -> e2e\\' + logName)
}