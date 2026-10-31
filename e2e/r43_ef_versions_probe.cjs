// R43 — ผล marketing_publish จริงใน audit metadata + เวอร์ชัน EF production (READ-ONLY)
// ถ้า scanned=0 → query ใน worker ตัวจริงบน production ไม่ match แถว published (สมมติฐาน deploy เก่า)
'use strict'
const fs = require('fs')
const path = require('path')
const { S } = require('./wave2Lib.cjs')
const ROOT = path.resolve(__dirname, '..')
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')) || [])[1]
async function q(query) {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + AT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const t = await r.text()
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + t.slice(0, 400))
  return JSON.parse(t)
}
;(async () => {
  const out = { ran_at: new Date().toISOString() }
  out.tick_exec_meta = await q(`
    SELECT id, metadata, created_at::text FROM public.audit_logs
    WHERE id LIKE 'auto-exec-tick-mk-%'
    ORDER BY created_at DESC LIMIT 3`)
  // เวอร์ชัน EF ที่ deploy จริง (management API)
  const fr = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/functions', {
    headers: { Authorization: 'Bearer ' + AT },
  })
  const fj = await fr.json()
  out.functions = (Array.isArray(fj) ? fj : [])
    .filter((f) => ['automation-worker', 'cron-tick', 'social-publish-worker', 'social-ai-worker'].includes(f.name))
    .map((f) => ({ name: f.name, version: f.version, updated_at: f.updated_at, status: f.status }))
  fs.writeFileSync(path.join(__dirname, 'r43_ef_versions_probe.json'), JSON.stringify(out, null, 2))
  console.log(JSON.stringify(out, null, 1))
})().catch((e) => { console.log('FATAL ' + String(e).slice(0, 400)); process.exitCode = 1 })