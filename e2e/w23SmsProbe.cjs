'use strict'
// W-2.3 SMS runtime probe (2026-10-07) — ยิง sms-send EF จริง 3 เคส:
//   1) unauth → 401   2) token ผิด → 401   3) service-role + customer_id=admin → ส่งจริงผ่าน THSMS
// ไม่พิมพ์ service key / ข้อความเต็ม / เบอร์เต็ม (mask มาจาก EF เอง)
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const h = {}
for (const l of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !l.trim().startsWith('#') && m[2]) h[m[1]] = m[2]
}
let SERVICE = ''
const sp = path.join(ROOT, 'supabase', 'secrets.local.env')
if (fs.existsSync(sp)) {
  for (const l of fs.readFileSync(sp, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && m[1] === 'SUPABASE_SERVICE_ROLE_KEY') SERVICE = m[2].trim()
  }
}
const FN = (h.VITE_SUPABASE_URL || '') + '/functions/v1/sms-send'
const ADMIN = 'ae12e10b-0f1f-45ff-b0f0-6dd7a682b064'
let pass = 0, fail = 0
function t(name, ok, detail) {
  if (ok) { pass++; console.log('PASS ' + name) }
  else { fail++; console.log('FAIL ' + name + ' :: ' + String(detail).slice(0, 300)) }
}
async function post(body, auth) {
  const headers = { 'Content-Type': 'application/json' }
  if (auth) headers.Authorization = auth
  const r = await fetch(FN, { method: 'POST', headers, body: JSON.stringify(body) })
  const j = await r.json().catch(() => ({}))
  return { status: r.status, j }
}
;(async () => {
  if (!SERVICE) throw new Error('SUPABASE_SERVICE_ROLE_KEY missing (supabase/secrets.local.env)')
  const r1 = await post({ customer_id: ADMIN, message: 'x' }, null)
  t('unauth_401', r1.status === 401, r1.status + ' ' + JSON.stringify(r1.j))
  const r2 = await post({ customer_id: ADMIN, message: 'x' }, 'Bearer wrong-token')
  t('bad_token_401', r2.status === 401, r2.status + ' ' + JSON.stringify(r2.j))
  const r3 = await post({ customer_id: ADMIN, message: '[W-2.3 TEST] Bite Me Baby SMS gateway probe 2026-10-07 (safe to ignore)' }, 'Bearer ' + SERVICE)
  t('service_send_200', r3.status === 200 && r3.j.ok === true && r3.j.provider_status === 200, r3.status + ' ' + JSON.stringify(r3.j))
  console.log('W23_SMS_PROBE:', pass + '/' + (pass + fail), fail ? 'HAS FAIL' : 'ALL PASS', '| to_masked=' + (r3.j.to_masked || 'n/a'), '| provider=' + (r3.j.provider || 'n/a'))
  process.exit(fail ? 1 : 0)
})().catch((e) => { console.error('W23_PROBE_ERR', String(e.message || e).slice(0, 300)); process.exit(1) })
