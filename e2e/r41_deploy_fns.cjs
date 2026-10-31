// R41 deploy EFs — image-gen (โมเดลใหม่+images API) + cron-tick (ใหม่) → evidence ต่อหัว stdout
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const ROOT = path.resolve(__dirname, '..')
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')) || [])[1]
const fns = process.argv[2] ? [process.argv[2]] : ['image-gen', 'cron-tick']
let ok = true
for (const slug of fns) {
  try {
    const out = execSync(`npx supabase functions deploy ${slug} --project-ref ivkdfognyiwjcmrhcnwz`, {
      env: { ...process.env, SUPABASE_ACCESS_TOKEN: AT }, encoding: 'utf8', cwd: ROOT, maxBuffer: 8 * 1024 * 1024,
    })
    fs.appendFileSync(path.join(__dirname, 'r41_deploy_fns.log'), `== ${slug} ==\n${out}\n`)
    console.log(`DEPLOY_OK ${slug}`)
  } catch (e) {
    ok = false
    console.log(`DEPLOY_FAIL ${slug} ` + String(e.stdout || e.message).slice(0, 400))
  }
}
process.exit(ok ? 0 : 1)