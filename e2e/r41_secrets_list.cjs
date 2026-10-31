// R41e — รายชื่อ secrets บน production (เฉพาะชื่อ+อัปเดตล่าสุด ไม่เอาค่า)
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const ROOT = path.resolve(__dirname, '..')
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')) || [])[1]
try {
  const out = execSync('npx supabase secrets list --project-ref ivkdfognyiwjcmrhcnwz', {
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: AT }, encoding: 'utf8', cwd: ROOT, maxBuffer: 4 * 1024 * 1024,
  })
  console.log(out)
} catch (e) {
  console.log('FAIL ' + String(e.stdout || e.message).slice(0, 800))
}