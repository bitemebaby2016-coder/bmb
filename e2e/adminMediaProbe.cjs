'use strict'
// adminMediaProbe — ทดสอบ flow เพิ่มรูปจริงด้วย session แอดมิน (login → upload → insert) แล้วล้างทิ้ง
// ไม่พิมพ์รหัส/คีย์
const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')
const ROOT = path.resolve(__dirname, '..')
function readEnv(file) {
  const h = {}
  for (const l of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !l.trim().startsWith('#') && m[2]) h[m[1]] = m[2]
  }
  return h
}
const env = readEnv(path.join(ROOT, '.env.local'))
const sec = readEnv(path.join(ROOT, 'supabase', 'secrets.local.env'))
const URL = env.VITE_SUPABASE_URL
const ANON = env.VITE_SUPABASE_ANON_KEY
const EMAIL = sec.BMB_TEST_ADMIN_EMAIL
const PW = sec.BMB_TEST_ADMIN_PASSWORD
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
;(async () => {
  const sb = createClient(URL, ANON)
  const { data: a, error: ae } = await sb.auth.signInWithPassword({ email: EMAIL, password: PW })
  if (ae) { console.log('LOGIN_ERR', ae.message); process.exit(1) }
  console.log('LOGIN ok uid=' + a.user.id)
  const p = await sb.from('profiles').select('id,role,is_platform,tenant_id').eq('id', a.user.id).single()
  console.log('PROFILE_SELECT', p.error ? ('ERR ' + p.error.message + ' code=' + p.error.code) : JSON.stringify(p.data))
  const l = await sb.from('media_assets').select('id').limit(3)
  console.log('MEDIA_SELECT', l.error ? ('ERR ' + l.error.message + ' code=' + l.error.code) : ('ok count=' + l.data.length))
  const path1 = 'uploads/probe-' + Date.now() + '.png'
  const up = await sb.storage.from('bmb-images').upload(path1, PNG, { contentType: 'image/png', upsert: false })
  console.log('STORAGE_UPLOAD', up.error ? ('ERR ' + up.error.message) : ('ok ' + path1))
  if (!up.error) { const pub = sb.storage.from('bmb-images').getPublicUrl(path1); console.log('PUBLIC_URL ok=' + !!pub.data.publicUrl) }
  const tenant = (p.data && p.data.tenant_id) || null
  const baseRow = { url: 'https://example.com/probe.png', alt: 'probe', kind: 'image', created_by: a.user.id, tenant_id: tenant }
  const ins = await sb.from('media_assets').insert({ ...baseRow, id: 'probe-' + Date.now() }).select().single()
  console.log('INSERT_no_category tenant=' + tenant, ins.error ? ('ERR ' + ins.error.message + ' code=' + ins.error.code) : 'ok')
  const ins2 = await sb.from('media_assets').insert({ ...baseRow, id: 'probe-g-' + Date.now(), category: 'global' }).select().single()
  console.log('INSERT_category_global', ins2.error ? ('ERR ' + ins2.error.message + ' code=' + ins2.error.code) : 'ok')
  const ins3 = await sb.from('media_assets').insert({ ...baseRow, id: 'probe-n-' + Date.now(), tenant_id: null }).select().single()
  console.log('INSERT_tenant_null', ins3.error ? ('ERR ' + ins3.error.message + ' code=' + ins3.error.code) : 'ok')
  if (!ins.error) await sb.from('media_assets').delete().eq('id', ins.data.id)
  if (!ins2.error) await sb.from('media_assets').delete().eq('id', ins2.data.id)
  if (!ins3.error) await sb.from('media_assets').delete().eq('id', ins3.data.id)
  if (!up.error) await sb.storage.from('bmb-images').remove([path1])
  console.log('CLEANUP done')
})().catch((e) => { console.error('PROBE_ERR', String(e.message || e).slice(0, 300)); process.exit(1) })
