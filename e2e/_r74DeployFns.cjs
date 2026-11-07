// R74 — deploy  EF ที่แตะโค้ดรอบนี้ (channel-webhook + social-ai-worker · ทั้งคู่ bundle _shared/socialOrderIntake)
// Usage: node e2e/_r74DeployFns.cjs   (log: e2e/_r74_deploy.log)
'use strict'
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const ROOT = path.resolve(__dirname, '..')
// handoff rule 10: .env.local มีหลาย SUPABASE_ACCESS_TOKEN — ใช้แถวล่าสุดก่อน (reverse)
// R74-OMNI s2 (Owner 2026-11-06 ดึก): คีย์ใหม่ = PAT ชื่อในแดชบอร์ด "bmb_PAT_SUPABASE_ACCESS_TOKEN"
//   รองรับทั้งแถว bmb_PAT_SUPABASE_ACCESS_TOKEN= และ SUPABASE_ACCESS_TOKEN= (ค่าถูกแทนที่ด้วย PAT ใหม่แล้ว — ค่า sbp_ เดิมที่ยกเลิกไม่อยู่ในไฟล์แล้ว)
const ENV_LINES = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)
// R74-OMNI s7: เขียน log ผ่าน fs ด้วย (รัน detached ได้ — บทเรียน cmd redirect ตัดที่ช่องว่าง)
const DEPLOY_LOG = path.join(__dirname, '_r74_deploy.log')
fs.writeFileSync(DEPLOY_LOG, 'DEPLOY_START ' + new Date().toISOString() + '\n')
const _log = console.log.bind(console)
console.log = (...a) => { try { fs.appendFileSync(DEPLOY_LOG, a.join(' ') + '\n') } catch {} ; _log(...a) }
const pick = (name) => [...ENV_LINES.map((l) => l.match(new RegExp('^' + name + '=(.*)$'))).filter(Boolean).map((m) => m[1].trim())].reverse()
const TOKENS = [...pick('bmb_PAT_SUPABASE_ACCESS_TOKEN'), ...pick('SUPABASE_ACCESS_TOKEN')]
if (TOKENS.length === 0) { console.log('NO_SUPABASE_ACCESS_TOKEN'); process.exit(1) }
for (const NAME of (process.argv[2] ? [process.argv[2]] : ['channel-webhook', 'social-ai-worker', 'social-post-worker'])) {
  let deployed = false
  for (const AT of TOKENS) {
    const r = spawnSync('npx', ['--no-install', 'supabase', 'functions', 'deploy', NAME, '--project-ref', 'ivkdfognyiwjcmrhcnwz'], {
      cwd: ROOT,
      encoding: 'utf8',
      shell: true,
      env: { ...process.env, SUPABASE_ACCESS_TOKEN: AT },
      timeout: 150000,
    })
    console.log('== ' + NAME + ' exit=' + r.status + (r.error ? ' err=' + String(r.error).slice(0, 120) : ''))
    console.log((r.stdout || '').slice(-300))
    if (r.status === 0) { deployed = true; break }
    console.log((r.stderr || '').slice(-200))
  }
  if (!deployed) console.log('DEPLOY_FAILED:' + NAME)
}
console.log('R74_DEPLOY_DONE')