// TT buckets probe (ครั้งเดียว): รายชื่อ storage bucket จริงตอนนี้ — เทียบกับ bmb-images
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
if (!TOKENS.length) { console.log('NO_TOKEN'); process.exit(1) }
;(async () => {
  for (const tok of TOKENS) {
    const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/storage/buckets', {
      headers: { apikey: tok, Authorization: 'Bearer ' + tok },
    })
    if (r.status !== 200) continue
    const rows = await r.json()
    for (const b of rows) console.log('BUCKET id=' + b.id + ' name=' + b.name + ' public=' + b.public + ' created=' + String(b.created_at || '').slice(0, 10))
    const hit = rows.find((b) => /bmb|image|asset/i.test(b.name || b.id || ''))
    console.log('BMB_IMAGES_MATCH ' + JSON.stringify(hit ? { id: hit.id, name: hit.name } : null))
    console.log('TT_BUCKETS_DONE')
    return
  }
  console.log('ALL_TOKENS_REJECTED')
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })