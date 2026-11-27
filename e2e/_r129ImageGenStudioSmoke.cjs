// R129 — end-to-end smoke: เจนภาพจริงด้วย kind='studio' ผ่าน production EF (หลัง deploy)
//   พิสูจน์โซ่ครบ: JWT admin → validation → OpenRouter (โมเดลจริง) → อัปโหลด bmb-images/ai-generated/studio/
//   แล้วลบไฟล์ทดสอบทิ้งทันที (cleanup ด้วย service key — ไม่ทิ้งซากในอัลบั้ม)
//   evidence → e2e/_r129_studio_smoke.json (ไม่มี secret ในไฟล์ · ตัด base64)
'use strict'
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const SB = 'https://ivkdfognyiwjcmrhcnwz.supabase.co'
const OUT = path.join(ROOT, 'e2e', '_r129_studio_smoke.json')

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
  const E = readEnv(path.join(ROOT, '.env.local'))
  const out = { at: new Date().toISOString() }

  const login = await fetch(SB + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: E.VITE_SUPABASE_ANON_KEY },
    body: JSON.stringify({ email: S.BMB_TEST_ADMIN_EMAIL, password: S.BMB_TEST_ADMIN_PASSWORD }),
  })
  out.loginStatus = login.status
  if (!login.ok) { finish(out, false, 'login failed') }
  const { access_token } = await login.json()

  const res = await fetch(SB + '/functions/v1/image-gen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + access_token },
    body: JSON.stringify({ kind: 'studio', style: 'realistic', subject: 'ทดสอบระบบ R129 — ลบทันทีหลังยืนยัน', note: '' }),
  })
  out.status = res.status
  const text = await res.text()
  out.body = text.length > 1200 ? text.slice(0, 600) + '…[truncated]…' + text.slice(-400) : text
  let parsed = null
  try { parsed = JSON.parse(text) } catch { /* */ }
  out.model = parsed && (parsed.model || parsed.usedModel) || null
  out.attempts = parsed && parsed.attempts || null
  out.url = parsed && parsed.url || null
  out.folder = parsed && parsed.folder || null
  const okGen = res.ok && parsed && parsed.ok && typeof parsed.url === 'string' && parsed.url.includes('/ai-generated/studio/')
  out.generated = okGen
  if (!okGen) { finish(out, false, 'generation failed — ' + ((parsed && parsed.error) || text.slice(0, 120))) }

  // cleanup — ลบไฟล์ทดสอบทิ้งทันที (service key จาก secrets.local.env)
  const objectPath = String(parsed.url).split('/storage/v1/object/public/bmb-images/')[1] || ''
  out.cleanupPath = objectPath
  if (!objectPath) { finish(out, false, 'generated but url not parseable for cleanup') }
  const del = await fetch(SB + '/storage/v1/object/bmb-images/' + objectPath, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + S.SUPABASE_SERVICE_ROLE_KEY },
  })
  out.cleanupStatus = del.status
  const recheck = await fetch(parsed.url, { method: 'HEAD' })
  out.cleanupVerified = recheck.status === 400 || recheck.status === 404
  const pass = okGen && del.status === 200 && out.cleanupVerified
  finish(out, pass, pass
    ? 'STUDIO E2E OK (model=' + out.model + ') + test file deleted'
    : 'cleanup issue — gen=' + okGen + ' del=' + del.status + ' recheck=' + recheck.status)
})().catch((e) => { console.error('SMOKE_FAILED ' + String(e).slice(0, 300)); process.exit(1) })

function finish(out, pass, note) {
  out.ALL_PASS = pass
  out.note = note
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2))
  console.log('R129_STUDIO_SMOKE status=' + out.status + ' model=' + out.model + ' folder=' + out.folder + ' cleanup=' + (out.cleanupVerified === true ? 'DELETED' : 'check') + ' ALL_PASS=' + pass)
  process.exit(pass ? 0 : 1)
}
