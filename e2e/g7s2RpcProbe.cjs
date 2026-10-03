// G7-S2 safe probe — does submit_content_for_approval work under service_role?
// Non-mutating by construction: p_title='' aborts BEFORE any INSERT in both
// outcomes (ERR_NOT_AUTHENTICATED if auth blocks / ERR_MISSING_TITLE if auth passes).
const fs = require('node:fs')
const sec = fs.readFileSync('supabase/secrets.local.env', 'utf8')
const SVC = (sec.match(/^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m) || [])[1]?.trim()
if (!SVC) { console.log('NO_SERVICE_KEY'); process.exit(1) }
const BASE = 'https://ivkdfognyiwjcmrhcnwz.supabase.co'
;(async () => {
  const r = await fetch(BASE + '/rest/v1/rpc/submit_content_for_approval', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + SVC, apikey: SVC, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_content_type: 'post', p_title: '', p_body: '' }),
    signal: AbortSignal.timeout(30000),
  })
  const t = await r.text()
  console.log('RPC_STATUS ' + r.status)
  console.log('RPC_BODY ' + t.slice(0, 200))
})()