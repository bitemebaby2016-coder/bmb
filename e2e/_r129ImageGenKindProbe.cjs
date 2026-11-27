// R129 — version probe EF image-gen หลัง deploy (0 cost · ไม่เรียกโมเดล · ไม่สร้างไฟล์)
//   ตรวจสาย validation: kind → style → subject (index.ts:122-124)
//   โจทย์กลาง: {kind:'studio', style:'realistic', subject:''} →
//     EF ใหม่ (4 หมวด) = ERR_MISSING_SUBJECT · EF เก่า (3 หมวด) = ERR_INVALID_KIND
//   sanity: promo ว่าง subject = ERR_MISSING_SUBJECT (ทั้งสองรุ่น) · หมวดปลอม = ERR_INVALID_KIND (negative control)
//   evidence → e2e/_r129_imagegen_probe.json (ไม่มี secret ในไฟล์)
'use strict'
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const SB = 'https://ivkdfognyiwjcmrhcnwz.supabase.co'
const OUT = path.join(ROOT, 'e2e', '_r129_imagegen_probe.json')

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
  const out = { at: new Date().toISOString(), probes: [] }

  const login = await fetch(SB + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: E.VITE_SUPABASE_ANON_KEY },
    body: JSON.stringify({ email: S.BMB_TEST_ADMIN_EMAIL, password: S.BMB_TEST_ADMIN_PASSWORD }),
  })
  out.loginStatus = login.status
  if (!login.ok) { finish(out, false, 'login failed') }
  const { access_token } = await login.json()

  async function probe(name, body) {
    const res = await fetch(SB + '/functions/v1/image-gen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + access_token },
      body: JSON.stringify(body),
    })
    const text = await res.text()
    let parsed = null
    try { parsed = JSON.parse(text) } catch { /* */ }
    const row = { name, status: res.status, error: parsed && parsed.error || text.slice(0, 120) }
    out.probes.push(row)
    return row
  }

  // โจทย์กลาง — studio ต้องผ่าน kind แล้วโดน subject ว่าง (EF ใหม่เท่านั้น)
  const studio = await probe('studio_empty_subject', { kind: 'studio', style: 'realistic', subject: '' })
  // sanity — promo ต้องผ่าน kind ทั้งสองรุ่น
  const promo = await probe('promo_empty_subject', { kind: 'promo', style: 'poster', subject: '' })
  // negative control — หมวดปลอมต้องถูกปฏิเสธ
  const bogus = await probe('bogus_kind', { kind: '__r129_probe__', style: 'realistic', subject: 'x' })

  out.verdict = studio.error === 'ERR_MISSING_SUBJECT'
    ? 'NEW_DEPLOYED (4 kinds incl. studio)'
    : (studio.error === 'ERR_INVALID_KIND' ? 'OLD_STILL_DEPLOYED (no studio)' : 'UNEXPECTED ' + studio.error)
  out.sanityPromoOk = promo.error === 'ERR_MISSING_SUBJECT'
  out.negativeControlOk = bogus.error === 'ERR_INVALID_KIND'
  const pass = out.verdict.startsWith('NEW_DEPLOYED') && out.sanityPromoOk && out.negativeControlOk
  finish(out, pass, pass ? 'image-gen 4-kind deployed + validated' : 'probe failed — ' + out.verdict)
})().catch((e) => { console.error('PROBE_FAILED ' + String(e).slice(0, 300)); process.exit(1) })

function finish(out, pass, note) {
  out.ALL_PASS = pass
  out.note = note
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2))
  console.log('R129_PROBE ' + JSON.stringify(out.probes))
  console.log('R129_VERDICT ' + out.verdict + ' · sanityPromo=' + out.sanityPromoOk + ' · negativeControl=' + out.negativeControlOk + ' · ALL_PASS=' + pass)
  process.exit(pass ? 0 : 1)
}
