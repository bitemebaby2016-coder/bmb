// e71_deploy_fn.cjs <functionName> — deploy EF ตัวเดียว (pattern เดียวกับ e70 ที่เคยสำเร็จจริง)
// token = .env.local SUPABASE_ACCESS_TOKEN · CLI npx supabase (ไม่ต้อง docker สำหรับ deploy)
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const NAME = process.argv[2] || ''
if (!NAME) { console.error('usage: node e2e/e71_deploy_fn.cjs <functionName>'); process.exit(2) }
const ROOT = path.resolve(__dirname, '..')
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')) || [])[1]
if (!AT) { console.log('NO_SUPABASE_ACCESS_TOKEN'); process.exit(1) }
const r = spawnSync('npx', ['--no-install', 'supabase', 'functions', 'deploy', NAME, '--project-ref', 'ivkdfognyiwjcmrhcnwz'], {
  cwd: ROOT,
  env: { ...process.env, SUPABASE_ACCESS_TOKEN: AT },
  encoding: 'utf8',
  shell: true,
  timeout: 24000,
})
console.log(`--- ${NAME} ---`)
console.log(((r.stdout || '') + (r.stderr || '')).split('\n').filter((l) => /Deployed|Uploading|error|Error|message/.test(l)).join('\n'))
console.log('EXIT=' + r.status + (r.signal ? ' SIGNAL=' + r.signal : ''))
if (r.status !== 0) process.exit(1)
console.log(`DEPLOY_${NAME}_OK`)

