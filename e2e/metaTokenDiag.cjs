// metaTokenDiag — READ-ONLY: debug metadata ของ token ใน .env.local (ไม่พิมพ์ค่า token)
//   node e2e/metaTokenDiag.cjs            → META_USER_ACCESS_TOKEN
//   node e2e/metaTokenDiag.cjs page       → META_PAGE_ACCESS_TOKEN
// พิมพ์เฉพาะ type/app/expires_at/is_valid/scopes — ห้าม token value
'use strict'
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const h = {}
for (const l of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !l.trim().startsWith('#') && m[2]) h[m[1]] = m[2]
}
const which = process.argv[2] === 'page' ? 'META_PAGE_ACCESS_TOKEN' : 'META_USER_ACCESS_TOKEN'
const T = h[which]
if (!T) { console.error('MISSING ' + which); process.exit(1) }
;(async () => {
  const u = 'https://graph.facebook.com/v21.0/debug_token?input_token=' + encodeURIComponent(T) +
    '&access_token=' + h.META_APP_ID + '|' + h.META_APP_SECRET
  const r = await fetch(u)
  const j = await r.json().catch(() => ({}))
  const d = j && j.data ? j.data : {}
  const iso = (s) => (!s ? 'n/a' : new Date(s * 1000).toISOString())
  console.log(which, 'HTTP', r.status)
  console.log('  type=', d.type, '| is_valid=', d.is_valid, '| app_id=', d.app_id, '| app=', d.application)
  console.log('  expires_at=', d.expires_at, '(' + (d.expires_at === 0 ? 'NEVER' : iso(d.expires_at)) + ')')
  console.log('  data_access_expires_at=', d.data_access_expires_at, '(' + iso(d.data_access_expires_at) + ')')
  console.log('  scopes=', JSON.stringify(d.scopes || d.error || j.error || {}))
})().catch((e) => { console.error('DIAG_ERR', String(e.message || e).slice(0, 300)); process.exit(1) })
