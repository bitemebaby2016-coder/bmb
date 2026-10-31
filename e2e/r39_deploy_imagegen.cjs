// R39 deploy image-gen (โค้ดใหม่: reference_image_url + attempts) — evidence → e2e/r39_deploy_imagegen.log
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const ROOT = path.resolve(__dirname, '..')
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')) || [])[1]
try {
  const out = execSync('npx supabase functions deploy image-gen --project-ref ivkdfognyiwjcmrhcnwz', {
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: AT },
    encoding: 'utf8',
    cwd: ROOT,
    maxBuffer: 1024 * 1024 * 8,
  })
  fs.writeFileSync(path.join(__dirname, 'r39_deploy_imagegen.log'), out)
  console.log('DEPLOY_OK')
} catch (e) {
  const out = String(e.stdout || '') + String(e.stderr || '')
  try { fs.writeFileSync(path.join(__dirname, 'r39_deploy_imagegen.log'), out) } catch { /* noop */ }
  console.log('DEPLOY_FAIL ' + out.slice(0, 600))
  process.exit(1)
}