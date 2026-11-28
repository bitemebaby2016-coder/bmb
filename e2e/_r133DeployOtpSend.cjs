// R133 — deploy EF otp-send (ข้อความ OTP ย่อเป็น 1 ท่อน ≤70 ตัว)
//   pattern เดียวกับ _r130DeployOtpFns.cjs — token .env.local · log ผ่าน fs · ไม่พิ่ม secret
// Usage: node e2e/_r133DeployOtpSend.cjs   (log: e2e/_r133_deploy_otpsend.log)
'use strict'
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
const ENV_LINES = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)
const LOG = path.join(__dirname, '_r133_deploy_otpsend.log')
fs.writeFileSync(LOG, 'DEPLOY_START ' + new Date().toISOString() + '\n')
const _log = console.log.bind(console)
console.log = (...a) => { try { fs.appendFileSync(LOG, a.join(' ') + '\n') } catch {} ; _log(...a) }
const pick = (n) => [...ENV_LINES.map((l) => l.match(new RegExp('^' + n + '=(.*)$'))).filter(Boolean).map((m) => m[1].trim())].reverse()
const TOKENS = [...pick('bmb_PAT_SUPABASE_ACCESS_TOKEN'), ...pick('SUPABASE_ACCESS_TOKEN')]
if (!TOKENS.length) { console.log('NO_SUPABASE_ACCESS_TOKEN'); process.exit(1) }

const REF = 'ivkdfognyiwjcmrhcnwz'
let ok = false
for (const AT of TOKENS) {
  const r = spawnSync('npx', ['--no-install', 'supabase', 'functions', 'deploy', 'otp-send', '--project-ref', REF], {
    cwd: ROOT, encoding: 'utf8', shell: true,
    env: Object.assign({}, process.env, { SUPABASE_ACCESS_TOKEN: AT }),
    timeout: 180000,
  })
  console.log('== otp-send exit=' + r.status)
  console.log(String(r.stdout || '').slice(-400))
  if (r.stderr) console.log(String(r.stderr).slice(-300))
  if (r.status === 0) { ok = true; break }
}
console.log(ok ? 'R133_DEPLOY_OK otp-send' : 'R133_DEPLOY_FAILED')
process.exit(ok ? 0 : 1)