// e2e/r55_deploy_imagegen.cjs — R55: ตั้ง secret IMAGE_GEN_MODELS (ค่า env เก่า override default!)
//                              + deploy EF image-gen (โค้ดใหม่: โมเดลคำสั่ง Owner + อัลบั้มตามหมวด)
// evidence → e2e/r55_deploy_imagegen.log
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const ROOT = path.join(__dirname, '..')
const LOG = path.join(__dirname, 'r55_deploy_imagegen.log')
const REF = 'ivkdfognyiwjcmrhcnwz'
const MODELS = 'bytedance-seed/seedream-5-0-flash,qwen/qwen-image-2.1-pro'

function log(s) {
  fs.appendFileSync(LOG, s + '\n')
  console.log(s)
}
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')) || [])[1]
if (!AT) { log('FAIL no SUPABASE_ACCESS_TOKEN'); process.exit(1) }

try {
  fs.writeFileSync(LOG, `R55 image-gen deploy ${new Date().toISOString()}\n`)
  log('== secrets set IMAGE_GEN_MODELS ==')
  const s = execSync(`npx supabase secrets set IMAGE_GEN_MODELS=${MODELS} --project-ref ${REF}`, {
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: AT },
    encoding: 'utf8',
    cwd: ROOT,
  })
  log(s.trim())
  log('== secrets list (ยืนยันค่า) ==')
  const l = execSync(`npx supabase secrets list --project-ref ${REF}`, {
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: AT },
    encoding: 'utf8',
    cwd: ROOT,
  })
  log(l.split(/\r?\n/).filter((x) => /IMAGE_GEN|OPENROUTER/.test(x)).join('\n'))
  log('== deploy image-gen ==')
  const d = execSync(`npx supabase functions deploy image-gen --project-ref ${REF}`, {
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: AT },
    encoding: 'utf8',
    cwd: ROOT,
  })
  log(d.trim())
  log('DEPLOY_OK')
} catch (e) {
  log('FAIL ' + String(e.stdout || '') + ' ' + String(e.stderr || e.message || e).slice(0, 500))
  process.exit(1)
}
