// e60: deploy 2 EF ของ R26 (social-publish-worker + automation-worker) — token จาก .env.local
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const ROOT = path.resolve(__dirname, '..')
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')) || [])[1]
if (!AT) { console.log('NO_SUPABASE_ACCESS_TOKEN'); process.exit(1) }
for (const fn of ['social-publish-worker', 'automation-worker']) {
  const args = ['--no-install', 'supabase', 'functions', 'deploy', fn, '--project-ref', 'ivkdfognyiwjcmrhcnwz', '--no-verify-jwt']
  const r = spawnSync('npx', args, {
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
}
console.log('DEPLOY_BOTH_OK')