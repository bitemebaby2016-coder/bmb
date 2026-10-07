// metaPageTokenExtend — ลองขยาย PAGE token ผ่าน grant_type=fb_exchange_token (เอกสาร Meta)
// ผลลัพธ์: ถ้าได้ token ใหม่ → verify (PAGE/scope/expiry) ก่อน, ถ้าผ่านค่อยใช้; ไม่พิมพ์ค่า token
//   node e2e/metaPageTokenExtend.cjs
'use strict'
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const h = {}
for (const l of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !l.trim().startsWith('#') && m[2]) h[m[1]] = m[2]
}
const GRAPH = 'https://graph.facebook.com/v21.0'
async function dbg(tok) {
  const r = await fetch(GRAPH + '/debug_token?input_token=' + encodeURIComponent(tok) +
    '&access_token=' + h.META_APP_ID + '|' + h.META_APP_SECRET)
  const j = await r.json().catch(() => ({}))
  return j.data || {}
}
;(async () => {
  const pageTok = h.META_PAGE_ACCESS_TOKEN
  if (!pageTok) throw new Error('META_PAGE_ACCESS_TOKEN missing')
  const u = new URL(GRAPH + '/oauth/access_token')
  u.searchParams.set('grant_type', 'fb_exchange_token')
  u.searchParams.set('client_id', h.META_APP_ID)
  u.searchParams.set('client_secret', h.META_APP_SECRET)
  u.searchParams.set('fb_exchange_token', pageTok)
  const r = await fetch(u)
  const j = await r.json().catch(() => ({}))
  if (!r.ok || !j.access_token) {
    console.log('EXTEND_FAIL HTTP', r.status, JSON.stringify(j).slice(0, 240))
    console.log('RESULT=NOT_EXTENDED')
    process.exit(2)
  }
  console.log('EXTEND_HTTP', r.status, 'new_len', String(j.access_token).length)
  const d = await dbg(j.access_token)
  const iso = (s) => (!s ? 'n/a' : new Date(s * 1000).toISOString())
  console.log('NEW type=', d.type, '| is_valid=', d.is_valid, '| app=', d.application, '| profile=', d.profile_id)
  console.log('NEW expires_at=', d.expires_at, '(' + (d.expires_at === 0 ? 'NEVER' : iso(d.expires_at)) + ')')
  console.log('NEW scopes=', JSON.stringify(d.scopes || {}))
  if (d.type !== 'PAGE' || d.is_valid !== true || !(d.scopes || []).includes('pages_messaging')) {
    console.log('RESULT=REJECTED (new token not a valid PAGE token with pages_messaging)')
    process.exit(3)
  }
  // persist
  const file = path.join(ROOT, '.env.local')
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
  const idx = lines.findIndex((l) => /^META_PAGE_ACCESS_TOKEN=/i.test(l))
  if (idx >= 0) lines[idx] = 'META_PAGE_ACCESS_TOKEN=' + j.access_token
  else lines.push('META_PAGE_ACCESS_TOKEN=' + j.access_token)
  fs.writeFileSync(file, lines.join('\n'))
  console.log('RESULT=EXTENDED_AND_SAVED (value not printed)')
})().catch((e) => { console.error('EXTEND_ERR', String(e.message || e).slice(0, 300)); process.exit(1) })
