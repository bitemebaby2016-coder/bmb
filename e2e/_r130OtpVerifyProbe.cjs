// R130 — probe otp-verify EF หลัง deploy (0 cost · ไม่ยิง SMS)
//   ยิงด้วยโค้ดปลอม → คาดหวัง ERR_OTP_NOT_FOUND (พิสูจน์ว่า function ตอบ + สาย verify ทำงาน)
//   ถ้าได้ 404 / "Function not found" = deploy ไม่ขึ้น
'use strict'
const SB = 'https://ivkdfognyiwjcmrhcnwz.supabase.co'
const KEY = 'sb_publishable_Q7AHrjSYOrysDjxS9_ZB-g_NMmytLOH'

;(async () => {
  const res = await fetch(SB + '/functions/v1/otp-verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: 'Bearer ' + KEY },
    body: JSON.stringify({ phone: '0899999999', code: '000000', purpose: 'phone_login' }),
  })
  const text = await res.text()
  console.log('OTP_VERIFY_PROBE status=' + res.status + ' body=' + text.slice(0, 200))
  const pass = res.status === 400 && text.includes('ERR_OTP_NOT_FOUND')
  console.log('R130_OTP_VERIFY_PROBE ' + (pass ? 'PASS (function live, verify chain works)' : 'FAIL'))
  process.exit(pass ? 0 : 1)
})().catch((e) => { console.error('PROBE_FAILED ' + String(e).slice(0, 200)); process.exit(1) })