// TT reset models (ครั้งเดียว): รีเซ็ต secret IMAGE_GEN_MODELS = default ที่ r55 probe ผ่านแล้ว
//   (env override ถ้าค่าผิด/โมเดลตาย = เจนไม่ได้ทั้งฟีเจอร์ — ค่าเดิมถ้าดีอยู่ = default เดียวกัน ไม่เสียอะไร)
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
const DEFAULT_MODELS = 'qwen/qwen-image-2.1-pro,bytedance-seed/seedream-5-0-flash'
;(async () => {
  for (const tok of TOKENS) {
    const r = await fetch('https://api.supabase.com/v1/projects/' + REF + '/secrets', {
      method: 'POST',
      headers: { apikey: tok, Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
      body: JSON.stringify([{ name: 'IMAGE_GEN_MODELS', value: DEFAULT_MODELS }]),
    })
    const t = await r.text()
    console.log('PUT_IMAGE_GEN_MODELS http=' + r.status + ' body=' + t.slice(0, 200))
    if (r.status === 200 || r.status === 204) { console.log('RESET_OK'); return }
  }
  console.log('RESET_FAILED')
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })