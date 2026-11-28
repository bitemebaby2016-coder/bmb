// R134 — เปลี่ยน secret SMS_MESSAGE_TYPE = superfast (กันปัญหา standard โดน DND/ไม่ถึง)
//   + ยิง OTP ทดสอบจริงถึงเบอร์ล่าสุดใน otp_challenges เพื่อยืนยัน
//   log ผ่าน fs · ไม่พิมพ์ PAT/คีย์ · evidence → e2e/_r134_superfast.log
// Usage: node e2e/_r134SetSmsSuperfast.cjs
'use strict'
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const REF = 'ivkdfognyiwjcmrhcnwz'
const LOG = path.join(__dirname, '_r134_superfast.log')
fs.writeFileSync(LOG, 'START ' + new Date().toISOString() + '\n')
const _log = console.log.bind(console)
console.log = (...a) => { try { fs.appendFileSync(LOG, a.join(' ') + '\n') } catch {} ; _log(...a) }

const envLines = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)
const tok = envLines.filter((l) => l.indexOf('SUPABASE_ACCESS_TOKEN=') === 0).pop()
const PAT = tok ? String(tok).substring(22).trim() : ''
if (!PAT) { console.log('NO_PAT'); process.exit(1) }

const secretsLines = fs.readFileSync(path.join(ROOT, 'supabase', 'secrets.local.env'), 'utf8').split(/\r?\n/)
const svc = secretsLines.filter((l) => l.indexOf('SUPABASE_SERVICE_ROLE_KEY=') === 0).pop()
const SVC = svc ? String(svc).substring(26).trim() : ''

;(async () => {
  // 1) ตั้ง secret (POST = สร้าง/อัปเดต · body เป็น array ตาม pattern w23SetSmsSecrets)
  const res = await fetch('https://api.supabase.com/v1/projects/' + REF + '/secrets', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + PAT, 'Content-Type': 'application/json' },
    body: JSON.stringify([{ name: 'SMS_MESSAGE_TYPE', value: 'superfast' }]),
  })
  console.log('PATCH_STATUS ' + res.status)
  console.log('PATCH_BODY ' + (await res.text()).slice(0, 200))
  if (!res.ok) { console.log('R134_SET_FAILED'); process.exit(1) }

  // 2) ยืนยันค่าใน secrets (คืนเป็น hash — เทียบก่อน/หลังได้)
  const list = await fetch('https://api.supabase.com/v1/projects/' + REF + '/secrets', {
    headers: { Authorization: 'Bearer ' + PAT },
  })
  const arr = await list.json()
  const row = arr.filter((x) => x.name === 'SMS_MESSAGE_TYPE').pop()
  console.log('SECRET_NOW ' + (row ? String(row.value).slice(0, 12) : 'MISSING'))

  // 3) ยิง OTP จริงถึงเบอร์ล่าสุด
  const q = 'https://' + REF + '.supabase.co/rest/v1/otp_challenges?select=phone_digits&purpose=eq.phone_login&order=created_at.desc&limit=1'
  const r1 = await fetch(q, { headers: { apikey: SVC, Authorization: 'Bearer ' + SVC } })
  const rows = await r1.json()
  const phone = String(rows[0].phone_digits)
  console.log('TARGET ' + phone.slice(0, 3) + '***' + phone.slice(-3))

  const PUB = 'sb_publishable_Q7AHrjSYOrysDjxS9_ZB-g_NMmytLOH'
  const send = await fetch('https://' + REF + '.supabase.co/functions/v1/otp-send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: PUB, Authorization: 'Bearer ' + PUB },
    body: JSON.stringify({ phone, purpose: 'phone_login' }),
  })
  console.log('OTP_SEND ' + send.status + ' ' + (await send.text()).slice(0, 250))

  // 4) เช็คเครดิตหลังส่ง (ควรเหลือลด 3)
  const cred = await fetch('https://api.thsms.org/v1/credits', {
    headers: { 'X-API-Key': (envLines.filter((l) => l.indexOf('THSMS_API_KEY=') === 0).pop() || '').substring(13).trim() },
  })
  console.log('CREDITS ' + cred.status + ' ' + (await cred.text()).slice(0, 200))
  console.log('R134_DONE')
})().catch((e) => { console.log('R134_ERROR ' + String(e).slice(0, 300)); process.exit(1) })