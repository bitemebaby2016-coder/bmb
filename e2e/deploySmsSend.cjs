'use strict'
// Deploy sms-send EF ผ่าน Supabase CLI (Management API multipart 400 — ไฟล์ไม่เข้าตอนยิง 2 ไฟล์;
// CLI bundle ../_shared/sms.ts ให้เอง — ลอง 2026-10-07 ได้ผล)
const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const tokens = []
for (const l of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && m[1] === 'SUPABASE_ACCESS_TOKEN' && m[2]) tokens.push(m[2])
}
let r = null
// token ตัวสุดท้ายอาจหมดอายุ → ไล่จากตัวท้ายไปหัว, ใช้ตัวแรกที่ deploy สำเร็จ
for (const t of [...tokens].reverse()) {
  r = spawnSync('npx', ['supabase', 'functions', 'deploy', 'sms-send', '--project-ref', 'ivkdfognyiwjcmrhcnwz'], {
    cwd: ROOT,
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: t },
    encoding: 'utf8',
    shell: true,
  })
  process.stdout.write((r.stdout || '').split('\n').slice(-8).join('\n') + '\n')
  if (r.status === 0) break
  process.stderr.write((r.stderr || '').split('\n').slice(-6).join('\n') + '\n')
}
console.log('CLI_DEPLOY_EXIT=' + r.status)
process.exit(r.status || 0)
