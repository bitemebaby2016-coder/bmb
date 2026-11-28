// R135 — คืน SMS_MESSAGE_TYPE = standard (ประหยัด 1 เครดิต) + ยิงทดสอบที่ 082-637-8546
//   ต้นตอ: เปลี่ยนเบอร์แล้วข้อความถึง = ปัญหาที่เบอร์ 081 (ลงทะเบียน 2 ยูซเซอร์) ไม่ใช่โค้ด/ข้อความ
//   log ผ่าน fs · ไม่พิมพ์ PAT/คีย์ · evidence → e2e/_r135_standard_082.log
// Usage: node e2e/_r135RevertStandardAndTest082.cjs
'use strict'
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const REF = 'ivkdfognyiwjcmrhcnwz'
const LOG = path.join(__dirname, '_r135_standard_082.log')
fs.writeFileSync(LOG, 'START ' + new Date().toISOString() + '\n')
const _log = console.log.bind(console)
console.log = (...a) => { try { fs.appendFileSync(LOG, a.join(' ') + '\n') } catch {} ; _log(...a) }

const envLines = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)
const tok = envLines.filter((l) => l.indexOf('SUPABASE_ACCESS_TOKEN=') === 0).pop()
const PAT = tok ? String(tok).substring(22).trim() : ''
const svc = fs.readFileSync(path.join(ROOT, 'supabase', 'secrets.local.env'), 'utf8').split(/\r?\n/)
  .filter((l) => l.indexOf('SUPABASE_SERVICE_ROLE_KEY=') === 0).pop()
const SVC = svc ? String(svc).substring(26).trim() : ''
if (!PAT || !SVC) { console.log('MISSING_TOKEN'); process.exit(1) }

const TARGET = '0826378546' // เบอร์ที่เคยยืนยันว่าได้รับ SMS จริง (2026-10-07)
const MSG = '[Bite Me Baby] รหัสยืนยัน 123456 หมดอายุ 5 นาที ห้ามแชร์'

;(async () => {
  // 1) คืน secret เป็น standard (ประหยัด 1 เครดิต/ข้อความ)
  const res = await fetch('https://api.supabase.com/v1/projects/' + REF + '/secrets', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + PAT, 'Content-Type': 'application/json' },
    body: JSON.stringify([{ name: 'SMS_MESSAGE_TYPE', value: 'standard' }]),
  })
  console.log('SET_STANDARD_STATUS ' + res.status)
  if (!res.ok) { console.log('R135_SET_FAILED'); process.exit(1) }

  const list = await fetch('https://api.supabase.com/v1/projects/' + REF + '/secrets', { headers: { Authorization: 'Bearer ' + PAT } })
  const row = (await list.json()).filter((x) => x.name === 'SMS_MESSAGE_TYPE').pop()
  console.log('SECRET_NOW ' + (row ? String(row.value).slice(0, 12) : 'MISSING'))

  // 2) ยิงทดสอบที่ 082 (ผ่าน EF sms-send จริง = เส้นทางเดียวกับระบบ)
  const send = await fetch('https://' + REF + '.supabase.co/functions/v1/sms-send', {
    method: 'POST',
    headers: { apikey: SVC, Authorization: 'Bearer ' + SVC, 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: TARGET, message: MSG }),
  })
  console.log('SMS_SEND_082 ' + send.status + ' ' + (await send.text()).slice(0, 350))
  console.log('MSG_LEN ' + MSG.length)
  console.log('R135_DONE')
})().catch((e) => { console.log('R135_ERROR ' + String(e).slice(0, 300)); process.exit(1) })