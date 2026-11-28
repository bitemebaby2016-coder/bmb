// R131 — apply migration 234 (otp_challenges.purpose + 'phone_login') ขึ้น production
//   ยิง Management API POST /database/query ด้วย PAT จาก .env.local (pattern เดิมของรอบก่อน)
//   log ผ่าน fs เท่านั้น · ไม่พิมพ์ PAT · evidence → e2e/_r131_apply_234.log
// Usage: node e2e/_r131ApplyMigration234.cjs
'use strict'
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const REF = 'ivkdfognyiwjcmrhcnwz'
const LOG = path.join(__dirname, '_r131_apply_234.log')
fs.writeFileSync(LOG, 'APPLY_START ' + new Date().toISOString() + '\n')
const _log = console.log.bind(console)
console.log = (...a) => { try { fs.appendFileSync(LOG, a.join(' ') + '\n') } catch {} ; _log(...a) }

const lines = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)
const tokLine = lines.filter((l) => l.indexOf('SUPABASE_ACCESS_TOKEN=') === 0).pop()
const PAT = tokLine ? String(tokLine).substring(22).trim() : ''
if (!PAT) { console.log('NO_PAT'); process.exit(1) }

const sql = fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', '234_otp_purpose_phone_login.sql'), 'utf8')
console.log('SQL_BYTES ' + sql.length)

;(async () => {
  const res = await fetch('https://api.supabase.com/v1/projects/' + REF + '/database/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + PAT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const text = await res.text()
  console.log('APPLY_STATUS ' + res.status)
  console.log('APPLY_BODY ' + text.slice(0, 400))
  if (!res.ok) { console.log('R131_APPLY_FAILED'); process.exit(1) }

  // ยืนยัน definition ของ constraint หลัง apply
  const q = "select conname, pg_get_constraintdef(oid) as def from pg_constraint where conrelid = 'public.otp_challenges'::regclass and contype = 'c'"
  const v = await fetch('https://api.supabase.com/v1/projects/' + REF + '/database/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + PAT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q }),
  })
  const vj = await v.json()
  console.log('CONSTRAINT_DEF ' + JSON.stringify(vj))
  const def = Array.isArray(vj) ? String(vj[0] && vj[0].def || '') : ''
  const ok = v.ok && def.indexOf('phone_login') !== -1
  console.log(ok ? 'R131_APPLY_OK constraint รับ phone_login แล้ว' : 'R131_APPLY_VERIFY_FAILED')
  process.exit(ok ? 0 : 1)
})().catch((e) => { console.log('R131_APPLY_ERROR ' + String(e).slice(0, 300)); process.exit(1) })