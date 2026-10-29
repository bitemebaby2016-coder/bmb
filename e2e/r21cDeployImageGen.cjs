// Deploy EF `image-gen` (R21 Phase 4 CORS fix) — token อ่านจาก .env.local
// (bat for/f ตัด token ที่มี '=' ในค่า → ใช้ node แทนเพื่ออ่านค่าเต็ม)
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const ROOT = path.resolve(__dirname, '..')
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')) || [])[1]
if (!AT) { console.log('FATAL: no SUPABASE_ACCESS_TOKEN in .env.local'); process.exit(1) }
const target = process.argv[2] || 'image-gen'
const r = spawnSync(
  'npx',
  ['supabase', 'functions', 'deploy', target, '--project-ref', 'ivkdfognyiwjcmrhcnwz'],
  { cwd: ROOT, env: { ...process.env, SUPABASE_ACCESS_TOKEN: AT }, stdio: 'inherit', shell: true },
)
console.log('DEPLOY_EXIT=' + r.status)
process.exit(r.status || 0)
