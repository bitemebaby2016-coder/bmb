// ============================================
// R61 — §T-2 (Owner อนุมัติ 2026-11-03): "รีเซ็ทหมด สร้างใหม่ — จากเมลจริงของเว็บ (ฟุตเตอร์คอนแทค)"
//   EMAIL = admin@biteme-baby.com (SHOP_CONTACT.email ใน src/components/layout/Footer.tsx)
//   ① สร้าง/รีเซ็ตรหัสผ่านผู้ใช้ผ่าน GoTrue admin API (service role)
//   ② promote_to_full_admin(email) = role='admin' + is_owner (helper 014 · postgres เท่านั้น)
//   ③ บันทึกลง supabase/secrets.local.env (BMB_TEST_ADMIN_*) — gitignored · ไม่พิมพ์รหัสผ่าน
//   ④ verify = password grant 200 + profiles.role=admin
// evidence → e2e/r61AdminReset-result.json (ไม่มีรหัสผ่านในไฟล์)
// ============================================
'use strict'
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const ROOT = path.resolve(__dirname, '..')
const SB = 'https://ivkdfognyiwjcmrhcnwz.supabase.co'
const REF = 'ivkdfognyiwjcmrhcnwz'
const EMAIL = 'admin@biteme-baby.com' // ฟุตเตอร์คอนแทค (Owner สั่งใช้เมลจริงของเว็บ)
const OUT = path.join(ROOT, 'e2e', 'r61AdminReset-result.json')

function readEnv(file) {
  const out = {}
  try {
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && m[2] && !line.trim().startsWith('#')) out[m[1]] = m[2]
    }
  } catch { /* optional */ }
  return out
}

function saveSecret(file, key, value) {
  let raw = fs.readFileSync(file, 'utf8')
  if (new RegExp('^' + key + '=', 'm').test(raw)) {
    raw = raw.replace(new RegExp('^' + key + '=.*$', 'm'), key + '=' + value)
  } else {
    raw = raw.replace(/\s*$/, '\n') + key + '=' + value + '\n'
  }
  fs.writeFileSync(file, raw)
}

function fail(out) {
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2))
  console.log('XMARK ' + String(out.error || 'step failed').slice(0, 300))
  process.exit(1)
}

;(async () => {
  const secretsFile = path.join(ROOT, 'supabase', 'secrets.local.env')
  const local = readEnv(path.join(ROOT, '.env.local'))
  const secrets = readEnv(secretsFile)
  const SERVICE = secrets.SUPABASE_SERVICE_ROLE_KEY || local.SUPABASE_SERVICE_ROLE_KEY
  const AT = local.SUPABASE_ACCESS_TOKEN
  if (!SERVICE) { console.log('XMARK NO_SERVICE_ROLE_KEY'); process.exit(2) }
  if (!AT) { console.log('XMARK NO_SUPABASE_ACCESS_TOKEN'); process.exit(2) }

  const PASSWORD = 'Bmb-' + crypto.randomBytes(12).toString('base64url') + '!7x'
  const out = { at: new Date().toISOString(), email: EMAIL, steps: [] }

  // ① หาผู้ใช้ (admin list) — มี = รีเซ็ตรหัส · ไม่มี = สร้างใหม่
  const listRes = await fetch(SB + '/auth/v1/admin/users?filter=' + encodeURIComponent(EMAIL), {
    headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE },
  })
  const listBody = await listRes.json().catch(() => ({}))
  const found = (listBody.users || []).find((u) => String(u.email || '').toLowerCase() === EMAIL)
  let uid = found ? found.id : null

  if (uid) {
    const put = await fetch(SB + '/auth/v1/admin/users/' + uid, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', apikey: SERVICE, Authorization: 'Bearer ' + SERVICE },
      body: JSON.stringify({ password: PASSWORD, email_confirm: true }),
    })
    out.steps.push({ step: 'reset_password', status: put.status, uid })
    if (!put.ok) { out.error = (await put.text()).slice(0, 300); fail(out) }
    out.action = 'reset_existing'
  } else {
    const post = await fetch(SB + '/auth/v1/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SERVICE, Authorization: 'Bearer ' + SERVICE },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD, email_confirm: true, user_metadata: { full_name: 'ADMIN_BMB' } }),
    })
    const created = await post.json().catch(() => ({}))
    out.steps.push({ step: 'create_user', status: post.status, detail: String(created.id || created.msg || created.message || '').slice(0, 200) })
    if (!post.ok) { out.error = JSON.stringify(created).slice(0, 300); fail(out) }
    uid = created.id
    out.action = 'created_new'
  }
  out.uid = uid

  // ② promote → role='admin' + is_owner + is_active (helper 014 · postgres only)
  const q = await fetch('https://api.supabase.com/v1/projects/' + REF + '/database/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + AT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: "SELECT public.promote_to_full_admin('" + EMAIL + "') AS r" }),
  })
  const qBody = await q.text()
  out.steps.push({ step: 'promote_to_full_admin', status: q.status, detail: qBody.slice(0, 300) })
  // Management API คืน JSON minified ("ok":true) — จับทั้งแบบมี/ไม่มี space
  if (!q.ok || !/"ok"\s*:\s*true/.test(qBody)) { out.error = 'promote failed: ' + qBody.slice(0, 300); fail(out) }

  // ③ เก็บ credentials (gitignored) — ไม่พิมพ์รหัสผ่านออกนอกไฟล์
  saveSecret(secretsFile, 'BMB_TEST_ADMIN_EMAIL', EMAIL)
  saveSecret(secretsFile, 'BMB_TEST_ADMIN_PASSWORD', PASSWORD)
  out.steps.push({ step: 'saved_secrets', file: 'supabase/secrets.local.env', keys: ['BMB_TEST_ADMIN_EMAIL', 'BMB_TEST_ADMIN_PASSWORD'] })

  // ④ verify: password grant + profile role
  const login = await fetch(SB + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: 'sb_publishable_Q7AHrjSYOrysDjxS9_ZB-g_NMmytLOH' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  out.verify = { loginStatus: login.status }
  if (login.ok) {
    await login.json() // consume (token ไม่ถูกเก็บ/ไม่พิมพ์)
    const prof = await fetch(SB + '/rest/v1/profiles?select=role,is_owner,is_active&email=eq.' + encodeURIComponent(EMAIL), {
      headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE },
    })
    out.verify.profile = (await prof.json()).slice(0, 1)
  }
  out.ALL_PASS = out.verify.loginStatus === 200 &&
    !!(out.verify.profile && out.verify.profile[0] && out.verify.profile[0].role === 'admin')
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2))
  const role = out.verify.profile && out.verify.profile[0] && out.verify.profile[0].role
  console.log('R61_ADMIN_RESET action=' + out.action + ' login=' + out.verify.loginStatus + ' role=' + role + ' ALL_PASS=' + out.ALL_PASS)
  process.exit(out.ALL_PASS ? 0 : 1)
})().catch((e) => { console.error('RESET_FAILED ' + String(e).slice(0, 300)); process.exit(1) })

