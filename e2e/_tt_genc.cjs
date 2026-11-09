// TT gencheck (ครั้งเดียว): ชื่อ secrets ที่ image-gen ใช้ + สถานะ EF image-gen (deploy เมื่อไร)
'use strict'
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const REF = 'ivkdfognyiwjcmrhcnwz'
const env = {}
for (const f of ['.env.local', '.env']) {
  try {
    for (const l of fs.readFileSync(path.join(ROOT, f), 'utf8').split(/\r?\n/)) {
      const m = l.match(/^([A-Za-z0-9_]+)=(.*)$/)
      if (m && !(m[1] in env)) env[m[1]] = m[2].trim()
    }
  } catch { /* skip */ }
}
const TOKENS = [env.SUPABASE_ACCESS_TOKEN, env.bmb_PAT_SUPABASE_ACCESS_TOKEN].filter(Boolean)
if (!TOKENS.length) { console.log('NO_TOKEN'); process.exit(1) }
;(async () => {
  for (const tok of TOKENS) {
    // 1) ชื่อ secrets
    const s = await fetch('https://api.supabase.com/v1/projects/' + REF + '/secrets', {
      headers: { apikey: tok, Authorization: 'Bearer ' + tok },
    })
    if (s.status === 200) {
      const rows = await s.json()
      const names = rows.map((r) => r.name)
      console.log('SECRETS_COUNT ' + names.length)
      for (const n of ['BMB_OPENROUTER_API_KEY', 'OPENROUTER_API_KEY', 'IMAGE_GEN_MODELS', 'IMAGE_GEN_MODEL']) {
        console.log('SECRET ' + n + '=' + (names.includes(n) ? 'EXISTS' : 'MISSING'))
      }
      // ดูค่าเฉพาะ IMAGE_GEN_MODELS (ลำดับโมเดล — ไม่ใช่ key ลับ) ว่าใส่อะไรอยู่
      const im = rows.find((r) => r.name === 'IMAGE_GEN_MODELS')
      if (im) console.log('IMAGE_GEN_MODELS_VALUE=' + String(im.value || '').slice(0, 300))
      const im2 = rows.find((r) => r.name === 'IMAGE_GEN_MODEL')
      if (im2) console.log('IMAGE_GEN_MODEL_VALUE=' + String(im2.value || '').slice(0, 300))
    } else console.log('SECRETS_HTTP ' + s.status)
    // 2) functions list
    const f = await fetch('https://api.supabase.com/v1/projects/' + REF + '/functions', {
      headers: { apikey: tok, Authorization: 'Bearer ' + tok },
    })
    if (f.status === 200) {
      const rows = await f.json()
      for (const fn of rows) {
        if (/image-gen|ai-proxy|social-ai/.test(fn.name || '')) {
          console.log('FN ' + fn.name + ' updated=' + String(fn.updated_at || '').slice(0, 19))
        }
      }
    } else console.log('FUNCTIONS_HTTP ' + f.status)
    console.log('TT_GENCHECK_DONE')
    return
  }
  console.log('ALL_TOKENS_REJECTED')
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })