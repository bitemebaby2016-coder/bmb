'use strict'
// _r69b_secrets — ตั้ง EF secrets สำหรับ R69 auto-cancel (ค่าห้ามออกทาง stdout/stderr เด็ดขาด)
// AUTO_CANCEL_ADMIN_EMAIL / AUTO_CANCEL_ADMIN_PASSWORD = บัญชีแอดมินทดสอบ (ค่าเดียวกับที่
// e2e/_r69_clear_run.cjs ใช้พิสูจน์แล้วใน production ว่า cancel_order ต้องใช้ JWT แอดมินจริง)
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const ROOT = path.resolve(__dirname, '..')

function parseEnv(file) {
  const out = {}
  try {
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && m[2]) out[m[1]] = m[2]
    }
  } catch { /* missing file */ }
  return out
}

const local = parseEnv(path.join(ROOT, '.env.local'))
const sec = parseEnv(path.join(ROOT, 'supabase', 'secrets.local.env'))
const AT = (local.SUPABASE_ACCESS_TOKEN || '').replace(/^["']|["']$/g, '').trim()
const EMAIL = sec.BMB_TEST_ADMIN_EMAIL || ''
const PASS = sec.BMB_TEST_ADMIN_PASSWORD || ''
if (!AT) { console.error('MISSING: SUPABASE_ACCESS_TOKEN (.env.local)'); process.exit(2) }
if (!EMAIL || !PASS) { console.error('MISSING: BMB_TEST_ADMIN_EMAIL/PASSWORD (supabase/secrets.local.env)'); process.exit(2) }

const r = spawnSync('npx', ['supabase', 'secrets', 'set',
  'AUTO_CANCEL_ADMIN_EMAIL=' + EMAIL,
  'AUTO_CANCEL_ADMIN_PASSWORD=' + PASS,
  '--project-ref', 'ivkdfognyiwjcmrhcnwz'], {
  cwd: ROOT, shell: true, encoding: 'utf8',
  env: { ...process.env, SUPABASE_ACCESS_TOKEN: AT },
  timeout: 120000,
})
// CLI แสดงเฉพาะชื่อคีย์ (ไม่มีค่า) — แสดงได้
console.log('SECRETS_SET_EXIT=' + (r.status ?? -1))
console.log(String(r.stdout || '').slice(0, 600))
if (r.status !== 0) { console.error(String(r.stderr || '').replace(/=[^\s"]+/g, '=***').slice(0, 400)); process.exit(1) }