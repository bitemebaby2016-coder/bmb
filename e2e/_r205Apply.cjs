'use strict'
// _r205_apply — apply migration 205 (R96/R97 closure) เข้า production
// ผ่าน Supabase Management API (pattern เดียวกับ _r68_apply186)
// Owner อนุญาต 2026-11-15: "implementation เพิ่มแล้วทดสอบผ่านทั้งหมดจริง
// อนุญาติอัพเดทลงเอกสารและคอมมิท deploy ตามกฏ"
// อ่าน token จาก .env.local (คีย์ bmb_PAT_SUPABASE_ACCESS_TOKEN ก่อน —
// ค่า sbp_ เดิมของ SUPABASE_ACCESS_TOKEN ถูกยกเลิก · ไม่พิมพ์ค่าใด ๆ ลง log)
const fs = require('fs')

const PROJECT_REF = 'ivkdfognyiwjcmrhcnwz'
const SQL_FILE = 'supabase/migrations/205_social_order_actions.sql'
const OUT = 'e2e/_r205_apply.json'

function readToken() {
  for (const f of ['.env.local', '.env']) {
    if (!fs.existsSync(f)) continue
    const txt = fs.readFileSync(f, 'utf8')
    const m2 = txt.match(/^\s*bmb_PAT_SUPABASE_ACCESS_TOKEN\s*=\s*(.+)\s*$/m)
    if (m2) return m2[1].replace(/^["']|["']$/g, '').trim()
    const m1 = txt.match(/^\s*SUPABASE_ACCESS_TOKEN\s*=\s*(.+)\s*$/m)
    if (m1) return m1[1].replace(/^["']|["']$/g, '').trim()
  }
  return null
}

;(async () => {
  const token = readToken()
  const out = { at: new Date().toISOString(), file: SQL_FILE, project: PROJECT_REF }
  if (!token) { out.ok = false; out.error = 'access token not found'; console.log(JSON.stringify(out)); fs.writeFileSync(OUT, JSON.stringify(out, null, 2)); process.exit(1) }
  const sql = fs.readFileSync(SQL_FILE, 'utf8')
  out.sql_bytes = Buffer.byteLength(sql)
  out.sql_has_begin = /^\s*BEGIN;/m.test(sql)

  const r = await fetch('https://api.supabase.com/v1/projects/' + PROJECT_REF + '/database/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, 'User-Agent': 'bmb-apply-205' },
    body: JSON.stringify({ query: sql }),
  })
  out.http = r.status
  const text = await r.text()
  out.response = text.slice(0, 1500)
  out.ok = r.status === 200 || r.status === 201

  // verify จริง: ทั้งสองฟังก์ชันต้องอยู่ + grants ถูกต้อง
  if (out.ok) {
    const vq = `SELECT
      to_regproc('public.cancel_order_as_customer') IS NOT NULL AS has_cancel_wrapper,
      to_regproc('public.social_timeline_for_web') IS NOT NULL AS has_web_timeline,
      (SELECT count(*) FROM information_schema.routine_privileges
        WHERE specific_name='cancel_order_as_customer' AND grantee='service_role') AS wrapper_service_grants,
      (SELECT count(*) FROM information_schema.routine_privileges
        WHERE specific_name='social_timeline_for_web' AND grantee='authenticated') AS timeline_auth_grants;`
    const rv = await fetch('https://api.supabase.com/v1/projects/' + PROJECT_REF + '/database/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, 'User-Agent': 'bmb-verify-205' },
      body: JSON.stringify({ query: vq }),
    })
    out.verify_http = rv.status
    out.verify = await rv.json().catch(() => null)
    const row = Array.isArray(out.verify) && out.verify[0]
    out.verify_ok = !!row && row.has_cancel_wrapper === true && row.has_web_timeline === true
      && Number(row.wrapper_service_grants) === 1 && Number(row.timeline_auth_grants) === 1
  }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2))
  console.log('http=' + out.http + ' ok=' + out.ok + ' verify_ok=' + (out.verify_ok === true))
  if (!out.ok) console.log(out.response)
})().catch((e) => { console.error(String(e).slice(0, 400)); process.exit(1) })
