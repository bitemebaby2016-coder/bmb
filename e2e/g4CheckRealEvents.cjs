// ============================================
// BMB G4 — REAL Facebook event checker (READ-ONLY)
// Env: merged via wave2Lib.readSecrets() → .env.local + supabase/secrets.local.env + process.env
// Checks:
//   1. social_events rows (since arg timestamp or last 24h)
//   2. App roles via GET /{app}/roles (app token = APP_ID|APP_SECRET)
//   3. Latest page post comments via page token (optional)
// Usage: node e2e/g4CheckRealEvents.cjs [sinceIsoTimestamp]
// Secrets are never printed in full.
// ============================================
'use strict'
const { S, SERVICE, api } = require('./wave2Lib.cjs')

const APP_ID = S.META_APP_ID
const APP_SECRET = S.META_APP_SECRET || S.CHANNEL_WEBHOOK_APP_SECRET
const PAGE_TOKEN = S.META_PAGE_ACCESS_TOKEN
const PAGE_ID = S.META_PAGE_ID
const SINCE = process.argv[2] || new Date(Date.now() - 24 * 3600 * 1000).toISOString()

;(async () => {
  // 1. social_events since timestamp
  const ev = await api(SERVICE, 'GET', `/rest/v1/social_events?received_at=gte.${encodeURIComponent(SINCE)}&order=received_at.desc&limit=10&select=id,platform,event_id,event_type,sender_id,content,status,received_at`)
  console.log('SOCIAL_EVENTS since ' + SINCE + ':', JSON.stringify(ev.j, null, 2))

  // 2. App roles (Development-mode webhook filter reads this)
  if (APP_ID && APP_SECRET) {
    const roles = await fetch(`https://graph.facebook.com/v23.0/${APP_ID}/roles?access_token=${APP_ID}|${APP_SECRET}`).then(r => r.json())
    const data = (roles && roles.data) || []
    const testers = data.filter((d) => d.role === 'testers').map((d) => d.user)
    console.log('APP ROLES:', JSON.stringify(data, null, 2))
    console.log('TESTERS present: ' + (testers.length > 0 ? 'YES → OK' : 'NO → add Pual as Tester on app-roles/'))
  } else {
    console.log('APP ROLES: SKIP — META_APP_ID/META_APP_SECRET not set in any env source')
  }

  // 3. Latest page post comments (optional)
  if (PAGE_TOKEN && PAGE_ID) {
    const posts = await fetch(`https://graph.facebook.com/v23.0/${PAGE_ID}/posts?limit=1&fields=id&access_token=${PAGE_TOKEN}`).then(r => r.json())
    const post = posts && posts.data && posts.data[0]
    if (!post) { console.log('LATEST COMMENTS: no posts found'); return }
    const c = await fetch(`https://graph.facebook.com/v23.0/${post.id}/comments?fields=id,message,created_time&limit=5&access_token=${PAGE_TOKEN}`).then(r => r.json())
    console.log(`LATEST COMMENTS (${post.id}):`, JSON.stringify((c.data || []).map((x) => ({ id: x.id, msg: x.message, t: x.created_time })), null, 2))
  } else {
    console.log('LATEST COMMENTS: SKIP — META_PAGE_ACCESS_TOKEN/META_PAGE_ID not set (optional)')
  }
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })
