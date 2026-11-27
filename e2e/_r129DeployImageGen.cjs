// R129 — deploy EF image-gen หลังเพิ่ม kind 'studio' (commit ee660ea 2026-11-27)
//   ต้นตอ production = frontend ใหม่ส่ง kind:'studio' → EF เก่า (3 หมวด) ตอบ 400 ERR_INVALID_KIND
//   → deploy รุ่นปัจจุบัน (4 หมวด) — ห้ามแตะ secret ใด ๆ (IMAGE_GEN_MODELS คงลำดับ R61 = qwen ก่อน)
//   (pattern จาก _r74DeployFns.cjs / _ttDeployFns.cjs — token .env.local · log ผ่าน fs เท่านั้น)
// Usage: node e2e/_r129DeployImageGen.cjs   (log: e2e/_r129_deploy_imagegen.log)
'use strict'
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
const ENV_LINES = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)
const DEPLOY_LOG = path.join(__dirname, '_r129_deploy_imagegen.log')
fs.writeFileSync(DEPLOY_LOG, 'DEPLOY_START ' + new Date().toISOString() + '\n')
const _log = console.log.bind(console)
console.log = (...a) => { try { fs.appendFileSync(DEPLOY_LOG, a.join(' ') + '\n') } catch {} ; _log(...a) }
const pick = (name) => [...ENV_LINES.map((l) => l.match(new RegExp('^' + name + '=(.*)$'))).filter(Boolean).map((m) => m[1].trim())].reverse()
const TOKENS = [...pick('bmb_PAT_SUPABASE_ACCESS_TOKEN'), ...pick('SUPABASE_ACCESS_TOKEN')]
if (TOKENS.length === 0) { console.log('NO_SUPABASE_ACCESS_TOKEN'); process.exit(1) }

const REF = 'ivkdfognyiwjcmrhcnwz'
let deployed = false
for (const AT of TOKENS) {
  const r = spawnSync('npx', ['--no-install', 'supabase', 'functions', 'deploy', 'image-gen', '--project-ref', REF], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: true,
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: AT },
    timeout: 180000,
  })
  console.log('== image-gen exit=' + r.status + (r.error ? ' err=' + String(r.error).slice(0, 120) : ''))
  console.log((r.stdout || '').slice(-400))
  if (r.stderr) console.log((r.stderr || '').slice(-300))
  if (r.status === 0) { deployed = true; break }
}
if (!deployed) { console.log('DEPLOY_FAILED:image-gen'); process.exit(1) }

// verify (read-only) — ยืนยัน secret IMAGE_GEN_MODELS ยังเป็นลำดับ R61 (qwen ก่อน) หลัง deploy
// (log เฉพาะค่ารายชื่อโมเดลซึ่งไม่ใช่ความลับ — ห้าม log ค่า secret อื่น)
;(async () => {
  try {
    const AT = TOKENS[0]
    const res = await fetch('https://api.supabase.com/v1/projects/' + REF + '/secrets', {
      headers: { Authorization: 'Bearer ' + AT },
    })
    const j = await res.json()
    const names = (Array.isArray(j) ? j : []).map((s) => s.name).sort()
    console.log('SECRETS_NAMES ' + names.join(','))
    const im = (Array.isArray(j) ? j : []).find((s) => s.name === 'IMAGE_GEN_MODELS')
    console.log('IMAGE_GEN_MODELS_VALUE ' + (im ? String(im.value) : '(absent — EF ใช้ default ในโค้ด)'))
  } catch (e) {
    console.log('SECRETS_CHECK_SKIPPED ' + String(e).slice(0, 200))
  }
  console.log('R129_DEPLOY_DONE ' + new Date().toISOString())
})()
