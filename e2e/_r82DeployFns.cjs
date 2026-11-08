// R82 — deploy EF ที่แก้รอบนี้: social-ai-worker (A eq./notify + B orderWindow) + social-publish-worker
//   + channel-webhook/social-post-worker (bundle _shared/socialOrderIntake + shopContext ตัวเดียวกัน)
//   (pattern จาก _r81DeployFns.cjs — รันผ่าน _r82DeployRun.cmd detached เพราะเกิน 30s)
// Usage: node e2e/_r82DeployFns.cjs   (log: e2e/_r82_deploy.log)
'use strict'
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
const ENV_LINES = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)
const DEPLOY_LOG = path.join(__dirname, '_r82_deploy.log')
fs.writeFileSync(DEPLOY_LOG, 'DEPLOY_START ' + new Date().toISOString() + '\n')
const _log = console.log.bind(console)
console.log = (...a) => { try { fs.appendFileSync(DEPLOY_LOG, a.join(' ') + '\n') } catch {} ; _log(...a) }
const pick = (name) => [...ENV_LINES.map((l) => l.match(new RegExp('^' + name + '=(.*)$'))).filter(Boolean).map((m) => m[1].trim())].reverse()
const TOKENS = [...pick('bmb_PAT_SUPABASE_ACCESS_TOKEN'), ...pick('SUPABASE_ACCESS_TOKEN')]
if (TOKENS.length === 0) { console.log('NO_SUPABASE_ACCESS_TOKEN'); process.exit(1) }

for (const NAME of ['social-ai-worker', 'social-publish-worker', 'channel-webhook', 'social-post-worker']) {
  let deployed = false
  for (const AT of TOKENS) {
    const r = spawnSync('npx', ['--no-install', 'supabase', 'functions', 'deploy', NAME, '--project-ref', 'ivkdfognyiwjcmrhcnwz'], {
      cwd: ROOT,
      encoding: 'utf8',
      shell: true,
      env: { ...process.env, SUPABASE_ACCESS_TOKEN: AT },
      timeout: 120000,
    })
    console.log('== ' + NAME + ' exit=' + r.status + (r.error ? ' err=' + String(r.error).slice(0, 120) : ''))
    console.log((r.stdout || '').slice(-300))
    if (r.status === 0) { deployed = true; break }
    console.log((r.stderr || '').slice(-300))
  }
  if (!deployed) console.log('DEPLOY_FAILED:' + NAME)
}
console.log('R82_DEPLOY_DONE ' + new Date().toISOString())