// R61 — image-gen smoke บน production หลังสลับโมเดล (qwen ใช้ก่อน)
// login ด้วย admin ใหม่ (secrets.local.env) → เรียก EF image-gen → บันทึกโมเดลที่ใช้จริง
// evidence → e2e/r61ImageGenSmoke-result.json (ไม่มี secret ในไฟล์)
'use strict'
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const SB = 'https://ivkdfognyiwjcmrhcnwz.supabase.co'
const OUT = path.join(ROOT, 'e2e', 'r61ImageGenSmoke-result.json')

function readEnv(file) {
  const out = {}
  try {
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && m[2] && !line.trim().startsWith('#')) out[m[1]] = m[2]
    }
  } catch { /* */ }
  return out
}

;(async () => {
  const S = readEnv(path.join(ROOT, 'supabase', 'secrets.local.env'))
  const out = { at: new Date().toISOString(), email: S.BMB_TEST_ADMIN_EMAIL }

  const login = await fetch(SB + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: 'sb_publishable_Q7AHrjSYOrysDjxS9_ZB-g_NMmytLOH' },
    body: JSON.stringify({ email: S.BMB_TEST_ADMIN_EMAIL, password: S.BMB_TEST_ADMIN_PASSWORD }),
  })
  out.loginStatus = login.status
  if (!login.ok) { finish(out, false, 'login failed') }
  const { access_token } = await login.json()

  const res = await fetch(SB + '/functions/v1/image-gen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + access_token },
    body: JSON.stringify({ kind: 'promo', style: 'poster', subject: 'ทดสอบระบบ R61', note: 'สลับโมเดล qwen ใช้ก่อน' }),
  })
  out.status = res.status
  const text = await res.text()
  // กัน base64 ยาว ๆ ทะลุไฟล์ evidence
  out.body = text.length > 1200 ? text.slice(0, 600) + '…[truncated]…' + text.slice(-400) : text
  let parsed = null
  try { parsed = JSON.parse(text) } catch { /* */ }
  out.model = parsed && (parsed.model || parsed.usedModel) || null
  out.attempts = parsed && parsed.attempts || null
  out.hasImage = !!(parsed && (parsed.url || parsed.image_url)) || /data:image\//.test(text)
  const pass = res.ok && out.hasImage
  finish(out, pass, pass ? 'image-gen OK' : 'image-gen failed')
})().catch((e) => { console.error('SMOKE_FAILED ' + String(e).slice(0, 300)); process.exit(1) })

function finish(out, pass, note) {
  out.ALL_PASS = pass
  out.note = note
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2))
  console.log('R61_IMAGEGEN status=' + out.status + ' model=' + out.model + ' hasImage=' + out.hasImage + ' ALL_PASS=' + pass)
  process.exit(pass ? 0 : 1)
}
