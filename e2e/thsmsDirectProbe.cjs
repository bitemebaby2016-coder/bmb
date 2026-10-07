'use strict'
// thsmsDirectProbe — ยิง THSMS ตรง ๆ (ไม่ผ่าน EF) เพื่อดู RAW response + credit — ไม่พิมพ์ค่า key
//   node e2e/thsmsDirectProbe.cjs 0826378546
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const h = {}
for (const l of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !l.trim().startsWith('#') && m[2]) h[m[1]] = m[2]
}
const KEY = h.THSMS_API_KEY
const SENDER = h.THSMS_SENDER_NAME || 'BiteMeBaby'
const URL = 'https://thsms.com/api/send-sms'
const raw = (process.argv[2] || '0826378546').replace(/\D/g, '')
const mask = (p) => String(p || '').replace(/(\d{3})\d{3}(\d{3,4})/, '$1***$2')
const MSG = '[W-2.3 TEST] Bite Me Baby SMS - safe to ignore'
if (MSG.length > 70) throw new Error('test message > 70 chars: ' + MSG.length)
;(async () => {
  if (!KEY) throw new Error('THSMS_API_KEY missing')
  // credit
  const me = await fetch('https://thsms.com/api/me', { headers: { Authorization: 'Bearer ' + KEY } })
  console.log('CREDIT HTTP', me.status, (await me.text()).slice(0, 200))
  // ตาม docs ทางการ: msisdn นำหน้าด้วย 0 → ส่งรูปแบบเดียว (leading-0)
  const candidates = [raw]
  for (const msisdn of candidates) {
    const body = { msisdn: [msisdn], message: MSG, sender: SENDER }
    const r = await fetch(URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY }, body: JSON.stringify(body) })
    const t = await r.text()
    console.log('SEND msisdn=' + mask(msisdn) + ' HTTP ' + r.status + ' BODY ' + t.slice(0, 400))
  }
})().catch((e) => { console.error('THSMS_PROBE_ERR', String(e.message || e).slice(0, 300)); process.exit(1) })
