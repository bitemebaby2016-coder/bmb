'use strict'
// thsmsOrgProbe — ยิง THSMS.ORG (api.thsms.org/v1) ตรง ๆ เพื่อดู RAW response + credit — ไม่พิมพ์ค่า key
//   ต่างจาก thsmsDirectProbe (thsms.com): auth = header 'X-API-Key' + body { sender_name, recipient, message, message_type }
//   node e2e/thsmsOrgProbe.cjs 0826378546
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const h = {}
for (const l of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !l.trim().startsWith('#') && m[2]) h[m[1]] = m[2]
}
const KEY = h.SMS_API_KEY || h.THSMS_API_KEY || ''
const SENDER = h.SMS_SENDER_NAME || h.THSMS_SENDER_NAME || 'BiteMeBaby'
const MTYPE = h.SMS_MESSAGE_TYPE || h.THSMS_MESSAGE_TYPE || 'superfast'
const BASE = (h.THSMS_ORG_BASE || 'https://api.thsms.org/v1').replace(/\/$/, '')
const raw = (process.argv[2] || '0826378546').replace(/\D/g, '')
const mask = (p) => String(p || '').replace(/(\d{3})\d{3}(\d{3,4})/, '$1***$2')
const MSG = '[W-2.3 TEST] Bite Me Baby SMS - safe to ignore'
if (MSG.length > 70) throw new Error('test message > 70 chars: ' + MSG.length)
;(async () => {
  if (!KEY) throw new Error('SMS_API_KEY / THSMS_API_KEY missing in .env.local')
  // credits
  const cred = await fetch(BASE + '/credits', { headers: { 'X-API-Key': KEY } })
  console.log('CREDITS HTTP', cred.status, (await cred.text()).slice(0, 300))
  // send (msisdn นำหน้าด้วย 0 ตามตัวอย่างทางการ)
  const body = { sender_name: SENDER, recipient: raw, message: MSG, message_type: MTYPE }
  const r = await fetch(BASE + '/sms/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': KEY },
    body: JSON.stringify(body),
  })
  const t = await r.text()
  console.log('SEND to=' + mask(raw) + ' sender=' + SENDER + ' type=' + MTYPE + ' HTTP ' + r.status + ' BODY ' + t.slice(0, 400))
})().catch((e) => { console.error('THSMS_ORG_PROBE_ERR', String(e.message || e).slice(0, 300)); process.exit(1) })
