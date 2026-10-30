// r22_runner — ปล่อย r22 deploy แบบ detached (เขียน e2e/r22_out.log) แล้วคืนทันที
// (shell cap 30s — deploy จริง 15-40s → อ่าน log ทีหลังจนเจอ WRANGLER_EXIT)
const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const out = fs.openSync(path.join(ROOT, 'e2e', 'r22_out.log'), 'w')
const child = spawn(process.execPath, [path.join(__dirname, 'r22_deploy_worker.cjs')], {
  cwd: ROOT,
  detached: true,
  stdio: ['ignore', out, out],
})
child.unref()
console.log('R22_STARTED pid=' + child.pid)
