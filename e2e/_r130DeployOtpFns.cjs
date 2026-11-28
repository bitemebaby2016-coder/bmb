// R130 — deploy EF otp-send (เพิ่ม purpose phone_login) + otp-verify (ใหม่)
//   pattern เดียวกับ _r129DeployImageGen.cjs — token .env.local · log ผ่าน fs · ไม่พิ่ม secret ใด ๆ
// Usage: node e2e/_r130DeployOtpFns.cjs   (log: e2e/_r130_deploy_otp.log)
'use strict'
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
const ENV_LINES = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)
const DEPLOY_LOG = path.join(__dirname, '_r130_deploy_otp.log')
fs.writeFileSync(DEPLOY_LOG, 'DEPLOY_START ' + new Date().toISOString() + '\n')
const _log = console.log.bind(console)
console.log = (...a) => { try { fs.appendFileSync(DEPLOY_LOG, a.join(' ') + '\n') } catch {} ; _log(...a) }
const pick = (name) => [...ENV_LINES.map((l) => l.match(new RegExp('^' + name + '=(.*)$'))).filter(Boolean).map((m) => m[1].trim())].reverse()
const TOKENS = [...pick('bmb_PAT_SUPABASE_ACCESS_TOKEN'), ...pick('SUPABASE_ACCESS_TOKEN')]
if (TOKENS.length === 0) { console.log('NO_SUPABASE_ACCESS_TOKEN'); process.exit(1) }

const REF = 'ivkdfognyiwjcmrhcnwz'
const FNS = ['otp-send', 'otp-verify']
let allOk = true
for (const fn of FNS) {
  let deployed = false
  for (const AT of TOKENS) {
    const r = spawnSync('npx', ['--no-install', 'supabase', 'functions', 'deploy', fn, '--project-ref', REF], {
      cwd: ROOT,
      encoding: 'utf8',
      shell: true,
      env: { ...process.env, SUPABASE_ACCESS_TOKEN: AT },
      timeout: 180000,
    })
    console.log('== ' + fn + ' exit=' + r.status + (r.error ? ' err=' + String(r.error).slice(0, 120) : ''))
    console.log((r.stdout || '').slice(-400))
    if (r.stderr) console.log((r.stderr || '').slice(-300))
    if (r.status === 0) { deployed = true; break }
  }
  if (!deployed) { console.log('DEPLOY_FAILED:' + fn); allOk = false }
}
console.log(allOk ? 'R130_DEPLOY_OK ' + FNS.join(',') : 'R130_DEPLOY_FAILED')
process.exit(allOk ? 0 : 1)