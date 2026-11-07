// R75 — deploy EF ที่แตะโค้ดรอบนี้ (social-ai-worker · social-post-worker · social-publish-worker)
// รัน detached ได้ + คัดลอก log ของ _r74DeployFns.cjs เก็บเป็น _r75_deploy.log (ไม่ทับ evidence เดิม)
'use strict'
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const ROOT = path.resolve(__dirname, '..')

// สำรอง log ของรอบก่อนก่อนเริ่ม (กัน _r74DeployFns ทับ evidence เดิม)
try {
  const prev = path.join(__dirname, '_r74_deploy.log')
  if (fs.existsSync(prev)) fs.copyFileSync(prev, path.join(__dirname, '_r74_deploy_prev.log'))
} catch {}

for (const NAME of ['social-ai-worker', 'social-post-worker', 'social-publish-worker']) {
  const r = spawnSync(process.execPath, [path.join(__dirname, '_r74DeployFns.cjs'), NAME], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 300000,
  })
  console.log('== ' + NAME + ' exit=' + r.status)
}
// คัดลอก log รอบนี้เป็น _r75_deploy.log
try {
  fs.copyFileSync(path.join(__dirname, '_r74_deploy.log'), path.join(__dirname, '_r75_deploy.log'))
} catch {}
console.log('R75_DEPLOY_DONE')

// ต่อด้วย live verification (deployed worker ต้องมาก่อน)
const live = spawnSync(process.execPath, [path.join(__dirname, '_r75ReplyLive.cjs')], {
  cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 300000,
})
console.log('== R75ReplyLive exit=' + live.status)
console.log((live.stdout || '').slice(-1500))
console.log('R75_ALL_DONE')