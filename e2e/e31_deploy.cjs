// e31: deploy social-publish-worker (แก้ ERR_NOT_A_POST → รับ 4 marketing types) · token จาก .env.local · ไม่พิมพ์ค่า secret
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const ROOT = path.resolve(__dirname, '..')
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')) || [])[1]
if (!AT) { console.log('NO_SUPABASE_ACCESS_TOKEN'); process.exit(1) }
const args = ['--no-install', 'supabase', 'functions', 'deploy', 'social-publish-worker', '--project-ref', 'ivkdfognyiwjcmrhcnwz', '--no-verify-jwt']
const r = spawnSync('npx', args, {
  cwd: ROOT,
  env: { ...process.env, SUPABASE_ACCESS_TOKEN: AT },
  encoding: 'utf8',
  shell: true,
  timeout: 25000,
})
console.log((r.stdout || '') + (r.stderr || ''))
console.log('DEPLOY_EXIT=' + r.status + (r.signal ? ' SIGNAL=' + r.signal : ''))
process.exit(r.status === 0 ? 0 : 1)