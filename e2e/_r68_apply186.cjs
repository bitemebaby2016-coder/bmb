'use strict'
// _r68_apply186 — apply migration 186 เข้า production ผ่าน Supabase Management API
// Owner สั่งตรง: "migration ใหม่ + apply production ด้วย" (2026-11-05)
// อ่าน token จาก .env.local (ไม่พิมพ์ค่าใด ๆ ลง log)
const fs = require('fs')

const PROJECT_REF = 'ivkdfognyiwjcmrhcnwz'
const SQL_FILE = 'supabase/migrations/186_promotion_date_bkk.sql'
const OUT = 'e2e/_r68_apply186.json'

function readToken() {
  for (const f of ['.env.local', '.env']) {
    if (!fs.existsSync(f)) continue
    const m = fs.readFileSync(f, 'utf8').match(/^\s*SUPABASE_ACCESS_TOKEN\s*=\s*(.+)\s*$/m)
    if (m) return m[1].replace(/^["']|["']$/g, '').trim()
  }
  return null
}

;(async () => {
  const token = readToken()
  const out = { at: new Date().toISOString(), file: SQL_FILE, project: PROJECT_REF }
  if (!token) { out.ok = false; out.error = 'SUPABASE_ACCESS_TOKEN not found'; console.log(JSON.stringify(out)); fs.writeFileSync(OUT, JSON.stringify(out, null, 2)); process.exit(1) }
  const sql = fs.readFileSync(SQL_FILE, 'utf8')
  out.sql_bytes = Buffer.byteLength(sql)
  out.sql_has_begin = /^\s*BEGIN;/m.test(sql)

  const r = await fetch('https://api.supabase.com/v1/projects/' + PROJECT_REF + '/database/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, 'User-Agent': 'bmb-apply-186' },
    body: JSON.stringify({ query: sql }),
  })
  out.http = r.status
  const text = await r.text()
  out.response = text.slice(0, 1500)
  out.ok = r.status === 200 || r.status === 201
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2))
  console.log('http=' + out.http + ' ok=' + out.ok)
  console.log(out.response)
})().catch((e) => { console.error(String(e).slice(0, 400)); process.exit(1) })