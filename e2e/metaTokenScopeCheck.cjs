// metaTokenScopeCheck — READ-ONLY: identity ของ META_PAGE_ACCESS_TOKEN เทียบ META_PAGE_ID + scopes
// ไม่พิมพ์ค่า token ใด ๆ
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
async function g(u) {
  const r = await fetch(u)
  const t = await r.text()
  return { status: r.status, body: t.slice(0, 500) }
}
;(async () => {
  const T = h.META_PAGE_ACCESS_TOKEN
  const PAGE = h.META_PAGE_ID
  if (!T || !PAGE) throw new Error('META_PAGE_ACCESS_TOKEN/META_PAGE_ID missing')
  const me = await g(GRAPH + '/me?fields=id,name&access_token=' + T)
  console.log('TOKEN_ME:', me.status, me.body)
  const bmb = await g(GRAPH + '/' + PAGE + '?fields=id,name&access_token=' + T)
  console.log('BMB_PAGE:', bmb.status, bmb.body)
  const dbg = await g(GRAPH + '/debug_token?input_token=' + T + '&access_token=' + h.META_APP_ID + '|' + h.META_APP_SECRET)
  console.log('DEBUG:', dbg.status, dbg.body)
})().catch((e) => { console.error('ERR', String(e.message || e).slice(0, 300)); process.exit(1) })
