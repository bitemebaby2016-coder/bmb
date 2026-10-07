'use strict'
// thsmsMe — READ-ONLY: ข้อมูลบัญชี THSMS (/api/me) เต็ม — ไม่พิมพ์ค่า key
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const h = {}
for (const l of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !l.trim().startsWith('#') && m[2]) h[m[1]] = m[2]
}
;(async () => {
  const r = await fetch('https://thsms.com/api/me', { headers: { Authorization: 'Bearer ' + h.THSMS_API_KEY } })
  console.log('HTTP', r.status)
  console.log(await r.text())
})().catch((e) => { console.error('ERR', String(e.message || e).slice(0, 300)); process.exit(1) })
