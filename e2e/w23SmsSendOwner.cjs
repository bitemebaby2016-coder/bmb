'use strict'
// w23SmsSendOwner — W-2.3: ส่ง SMS ทดสอบจริงไปเบอร์ Owner (0942649269) ผ่าน sms-send EF → THSMS
//   EF resolve เบอร์ server-side จาก profiles เท่านั้น (ห้ามส่งเบอร์ใน body) →
//   จึงตั้ง profiles.phone ของบัญชีทดสอบ ae12e10b ให้เป็น 094xxxx ชั่วคราว แล้วคืนค่าเดิมเสมอ (finally)
//   ไม่พิมพ์ค่า service key / เบอร์เต็ม (mask) / ข้อความเต็ม
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const env = {}
const tokens = []
for (const l of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !l.trim().startsWith('#') && m[2]) {
    if (m[1] === 'SUPABASE_ACCESS_TOKEN') tokens.push(m[2])
    else env[m[1]] = m[2]
  }
}
let SERVICE = ''
const sp = path.join(ROOT, 'supabase', 'secrets.local.env')
if (fs.existsSync(sp)) {
  for (const l of fs.readFileSync(sp, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && m[1] === 'SUPABASE_SERVICE_ROLE_KEY') SERVICE = m[2].trim()
  }
}
const REF = 'ivkdfognyiwjcmrhcnwz'
const ADMIN = 'ae12e10b-0f1f-45ff-b0f0-6dd7a682b064'
const TARGET = '66942649269' // 0942649269 (profiles เก็บแบบ 66 + national9)
const mask = (p) => String(p || '').replace(/(\d{3})\d{3}(\d{3,4})/, '$1***$2')
async function q(sql) {
  let last = ''
  for (const tok of [...tokens].reverse()) {
    const r = await fetch('https://api.supabase.com/v1/projects/' + REF + '/database/query', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: sql }),
    })
    const j = await r.json().catch(() => ({}))
    if (r.ok) return j
    if (r.status === 401 || r.status === 403) { last = 'HTTP ' + r.status; continue }
    throw new Error(JSON.stringify(j).slice(0, 300))
  }
  throw new Error(last || 'no working token')
}
;(async () => {
  if (!SERVICE) throw new Error('SUPABASE_SERVICE_ROLE_KEY missing')
  const before = (await q(`select phone from public.profiles where id='${ADMIN}'`))[0].phone
  console.log('admin_phone_before=' + mask(before))
  let restored = false
  try {
    await q(`update public.profiles set phone='${TARGET}' where id='${ADMIN}'`)
    const now = (await q(`select phone from public.profiles where id='${ADMIN}'`))[0].phone
    console.log('admin_phone_set=' + mask(now))
    const r = await fetch(env.VITE_SUPABASE_URL + '/functions/v1/sms-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + SERVICE },
      body: JSON.stringify({ customer_id: ADMIN, message: '[W-2.3 TEST] Bite Me Baby SMS gateway probe (Owner number 2026-10-07) — safe to ignore' }),
    })
    const j = await r.json().catch(() => ({}))
    console.log('SMS_HTTP=' + r.status)
    console.log('SMS_RESULT=' + JSON.stringify({ ok: j.ok, provider_status: j.provider_status, to_masked: j.to_masked, error: j.error }))
  } finally {
    await q(`update public.profiles set phone='${before}' where id='${ADMIN}'`)
    const after = (await q(`select phone from public.profiles where id='${ADMIN}'`))[0].phone
    restored = after === before
    console.log('admin_phone_restored=' + restored + ' (' + mask(after) + ')')
  }
  process.exit(restored ? 0 : 1)
})().catch((e) => { console.error('SMS_SEND_OWNER_ERR', String(e.message || e).slice(0, 300)); process.exit(1) })
