// R43 — เทียบ query due ตัวเดียวกับ automation-worker (READ-ONLY 1 GET)
// ถ้า 3 แถว B3 ไม่โผล่ = root cause อยู่ที่ filter · ถ้าโผล่ = ไปดู chain tick→worker
'use strict'
const { S } = require('./wave2Lib.cjs')
const KEY = S.SUPABASE_SERVICE_ROLE_KEY
const nowIso = new Date().toISOString()
const path =
  '/rest/v1/marketing_posts?select=id,status,approval_id,publish_attempts,provider_post_id' +
  '&or=(status.eq.scheduled,and(status.eq.published,provider_post_id.is.null))' +
  '&scheduled_for=lte.' + encodeURIComponent(nowIso) +
  '&order=scheduled_for.asc&limit=10'
;(async () => {
  const r = await fetch('https://ivkdfognyiwjcmrhcnwz.supabase.co/rest/v1/marketing_posts?' + path.split('?')[1], {
    headers: { apikey: KEY, Authorization: 'Bearer ' + KEY },
  })
  const t = await r.text()
  console.log('HTTP ' + r.status)
  console.log(t.slice(0, 2000))
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 300)))