// e2e/r61ModelSwap.cjs — R61 (Owner 2026-11-03): สลับโมเดลหลัก/รอง image-gen
//   secret IMAGE_GEN_MODELS = qwen ใช้ก่อน seedream (ค่า env override default → ต้องตั้งด้วย)
//   + deploy EF image-gen (default ในโค้ดก็สลับแล้ว)
// Usage: node e2e/r61ModelSwap.cjs set|list|deploy   (แยกคำสั่ง = ไม่ชนเพดาน 30s ของเทอร์มินัล)
// evidence → e2e/r61ModelSwap.log
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const ROOT = path.join(__dirname, '..')
const LOG = path.join(__dirname, 'r61ModelSwap.log')
const REF = 'ivkdfognyiwjcmrhcnwz'
// R61: qwen หลัก (ใช้ก่อน) · seedream รอง
const MODELS = 'qwen/qwen-image-2.1-pro,bytedance-seed/seedream-5-0-flash'
const MODE = process.argv[2] || 'set'

function log(s) {
  fs.appendFileSync(LOG, s + '\n')
  console.log(s)
}
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')) || [])[1]
if (!AT) { log('FAIL no SUPABASE_ACCESS_TOKEN'); process.exit(1) }

const CMDS = {
  set: `npx supabase secrets set IMAGE_GEN_MODELS=${MODELS} --project-ref ${REF}`,
  // R61: คีย์เก่า IMAGE_GEN_MODEL (singular) เคย override — ปรับให้ตรงแนวทาง qwen-first กันตกยุค
  setsingle: `npx supabase secrets set IMAGE_GEN_MODEL=qwen/qwen-image-2.1-pro --project-ref ${REF}`,
  list: `npx supabase secrets list --project-ref ${REF}`,
  deploy: `npx supabase functions deploy image-gen --project-ref ${REF}`,
}
if (!CMDS[MODE]) { log('unknown mode ' + MODE); process.exit(2) }

try {
  log('== ' + MODE + ' ==')
  const out = execSync(CMDS[MODE], {
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: AT },
    encoding: 'utf8',
    cwd: ROOT,
  })
  log(MODE === 'list'
    ? out.split(/\r?\n/).filter((x) => /IMAGE_GEN|OPENROUTER/.test(x)).join('\n')
    : out.trim())
  log(MODE === 'set' || MODE === 'setsingle' ? 'SET_OK' : (MODE === 'deploy' ? 'DEPLOY_OK' : 'LIST_OK'))
} catch (e) {
  log('FAIL ' + String(e.stdout || '') + ' ' + String(e.stderr || e.message || e).slice(0, 500))
  process.exit(1)
}
