// R138 — end-to-end smoke: เจนภาพ kind='studio' ผ่าน production EF (หลัง deploy R138)
//   พิสูจน์โซ่ครบ: JWT admin → รับ JSON payload ใหม่ (menu_name/category/container_type/texture_keywords)
//   → OpenRouter → อัปโหลด bmb-images/ai-generated/studio/ → คืน bg_removed/fallback
//   แล้วลบไฟล์ทดสอบทิ้งทันที (cleanup ด้วย service key — ไม่ทิ้งซากในอัลบั้ม)
//   evidence → e2e/_r138_studio_smoke.json (ไม่มี secret ในไฟล์)
'use strict'
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const SB = 'https://ivkdfognyiwjcmrhcnwz.supabase.co'
const OUT = path.join(ROOT, 'e2e', '_r138_studio_smoke.json')

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
    body: JSON.stringify({
      kind: 'studio', style: 'realistic',
      subject: 'ไก่ทอดกรอบ',
      note: 'ทดสอบระบบ R138 — ลบทันทีหลังยืนยัน',
      menu_name: 'ไก่ทอดกรอบ',
      category: 'ของทอด',
      container_type: 'ตะกร้าสแตนเลส',
      texture_keywords: ['crispy golden crust', 'crunchy texture'],
    }),
  })
  out.status = res.status
  const text = await res.text()
  out.body = text.length > 1200 ? text.slice(0, 600) + '…[truncated]…' + text.slice(-400) : text
  let parsed = null
  try { parsed = JSON.parse(text) } catch { /* */ }
  out.model = (parsed && (parsed.model || parsed.usedModel)) || null
  out.attempts = (parsed && parsed.attempts) || null
  out.url = (parsed && parsed.url) || null
  out.folder = (parsed && parsed.folder) || null
  out.bg_removed = parsed ? parsed.bg_removed : undefined
  out.fallback = parsed ? parsed.fallback : undefined

  const okGen = res.ok && parsed && parsed.ok && typeof parsed.url === 'string' && parsed.url.includes('/ai-generated/studio/')
  out.generated = okGen
  // R138: ต้องมี field bg_removed (boolean) + fallback ('manual' เมื่อ BEN2 ไม่พร้อม) — พิสูจน์โค้ดใหม่
  const hasNewFields = parsed && typeof parsed.bg_removed === 'boolean' && typeof parsed.fallback === 'string'
  out.hasNewFields = hasNewFields
  if (!okGen) { finish(out, false, 'generation failed — ' + ((parsed && parsed.error) || text.slice(0, 120))) }
  if (!hasNewFields) { finish(out, false, 'missing R138 fields (bg_removed/fallback) — EF ไม่ใช่รุ่นใหม่') }

  // cleanup — ลบไฟล์ทดสอบทิ้งทันที
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
  const pass = okGen && hasNewFields && del.status === 200 && out.cleanupVerified
  finish(out, pass, pass
    ? 'R138 STUDIO E2E OK (model=' + out.model + ' bg_removed=' + out.bg_removed + ' fallback=' + out.fallback + ') + test file deleted'
    : 'issue — gen=' + okGen + ' newFields=' + hasNewFields + ' del=' + del.status + ' recheck=' + recheck.status)
})().catch((e) => { console.error('SMOKE_FAILED ' + String(e).slice(0, 300)); process.exit(1) })

function finish(out, pass, note) {
  out.ALL_PASS = pass
  out.note = note
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2))
  console.log('R138_STUDIO_SMOKE status=' + out.status + ' model=' + out.model + ' bg_removed=' + out.bg_removed + ' fallback=' + out.fallback + ' newFields=' + out.hasNewFields + ' cleanup=' + (out.cleanupVerified === true ? 'DELETED' : 'check') + ' ALL_PASS=' + pass)
  process.exit(pass ? 0 : 1)
}