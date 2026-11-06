// R74 — deploy  EF ที่แตะโค้ดรอบนี้ (channel-webhook + social-ai-worker · ทั้งคู่ bundle _shared/socialOrderIntake)
// Usage: node e2e/_r74DeployFns.cjs   (log: e2e/_r74_deploy.log)
'use strict'
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const ROOT = path.resolve(__dirname, '..')
// handoff rule 10: .env.local มีหลาย SUPABASE_ACCESS_TOKEN — ใช้แถวล่าสุดก่อน (reverse)
const TOKENS = [...fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
  .split(/\r?\n/)
  .map((l) => l.match(/^SUPABASE_ACCESS_TOKEN=(.*)$/))
  .filter(Boolean)
  .map((m) => m[1].trim())].reverse()
if (TOKENS.length === 0) { console.log('NO_SUPABASE_ACCESS_TOKEN'); process.exit(1) }
for (const NAME of (process.argv[2] ? [process.argv[2]] : ['channel-webhook', 'social-ai-worker'])) {
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