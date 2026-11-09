// TT invoke (ครั้งเดียว): ยิง image-gen จริง — ดู error จริงจาก EF (auth / gen / upload)
'use strict'
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
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
const ANON = env.VITE_SUPABASE_ANON_KEY
const SB_URL = env.VITE_SUPABASE_URL || ''
if (!SB_URL) { console.log('NO_SB_URL'); process.exit(1) }
;(async () => {
  // 1) ไม่มี token = ต้องได้ 401 (function boot ปกติ)
  let r = await fetch(SB_URL + '/functions/v1/image-gen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: 'menu', style: 'realistic', subject: 'probe' }),
  })
  let t = await r.text()
  console.log('NO_AUTH http=' + r.status + ' body=' + t.slice(0, 200))
  // 2) PAT
  for (const tok of TOKENS) {
    r = await fetch(SB_URL + '/functions/v1/image-gen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok, apikey: ANON || '' },
      body: JSON.stringify({ kind: 'menu', style: 'realistic', subject: 'probe ' + new Date().toISOString() }),
    })
    t = await r.text()
    console.log('PAT http=' + r.status + ' body=' + t.slice(0, 500))
    if (r.status === 200 || r.status === 502 || r.status === 503) break
  }
  console.log('TT_INVOKE_DONE')
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })