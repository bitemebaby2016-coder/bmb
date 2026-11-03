'use strict'
// ตรวจสิทธิ์ test admin กับ production Auth (อ่านอย่างเดียว · ไม่พิมพ์รหัสผ่าน)
const fs = require('fs')
const path = require('path')
const S = {}
for (const line of fs.readFileSync(path.join(process.cwd(), 'supabase', 'secrets.local.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && m[2]) S[m[1]] = m[2]
}
;(async () => {
  const r = await fetch('https://ivkdfognyiwjcmrhcnwz.supabase.co/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: 'sb_publishable_Q7AHrjSYOrysDjxS9_ZB-g_NMmytLOH' },
    body: JSON.stringify({ email: S.BMB_TEST_ADMIN_EMAIL, password: S.BMB_TEST_ADMIN_PASSWORD }),
  })
  const t = await r.text()
  console.log('HTTP ' + r.status)
  console.log(t.split(S.BMB_TEST_ADMIN_PASSWORD).join('***').slice(0, 300))
})().catch((e) => console.error('ERR ' + e.message))
