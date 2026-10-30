// e70: deploy social-ai-worker (R27 — persona sync จาก web + ลิงก์ตะกร้าสรุปในคำตอบโซเชียล)
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const ROOT = path.resolve(__dirname, '..')
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')) || [])[1]
if (!AT) { console.log('NO_SUPABASE_ACCESS_TOKEN'); process.exit(1) }
const fn = 'social-ai-worker'
const r = spawnSync('npx', ['--no-install', 'supabase', 'functions', 'deploy', fn, '--project-ref', 'ivkdfognyiwjcmrhcnwz', '--no-verify-jwt'], {
  cwd: ROOT,
  env: { ...process.env, SUPABASE_ACCESS_TOKEN: AT },
  encoding: 'utf8',
  shell: true,
  timeout: 24000,
})
console.log('--- ' + fn + ' ---')
console.log(((r.stdout || '') + (r.stderr || '')).split('\n').filter((l) => /Deployed|Uploading|error|Error/.test(l)).join('\n'))
console.log('EXIT=' + r.status + (r.signal ? ' SIGNAL=' + r.signal : ''))
if (r.status !== 0) process.exit(1)
console.log('DEPLOY_SOCIAL_AI_OK')