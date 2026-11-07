// R76 — deploy EF ที่แตะโค้ดรอบนี้ (social-ai-worker — private reply แจ้งเตือนลูกค้า)
// + ต่อด้วย live verification (deployed worker ต้องมาก่อน)
'use strict'
const path = require('path')
const fs = require('fs')
const { spawnSync } = require('child_process')
const ROOT = path.resolve(__dirname, '..')

for (const NAME of ['social-ai-worker']) {
  const r = spawnSync(process.execPath, [path.join(__dirname, '_r74DeployFns.cjs'), NAME], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 300000,
  })
  console.log('== ' + NAME + ' exit=' + r.status)
}
// คัดลอก log รอบนี้เป็น _r76_deploy.log
try {
  fs.copyFileSync(path.join(__dirname, '_r74_deploy.log'), path.join(__dirname, '_r76_deploy.log'))
} catch {}
console.log('R76_DEPLOY_DONE')

const live = spawnSync(process.execPath, [path.join(__dirname, '_r76ReplyLive.cjs')], {
  cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 300000,
})
console.log('== R76ReplyLive exit=' + live.status)
console.log((live.stdout || '').slice(-1500))
console.log('R76_ALL_DONE')