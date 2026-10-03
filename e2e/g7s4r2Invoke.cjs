// G7-S4-R2-E — valid synthetic production invocation (temp runner for S4-R2; token never printed)
const fs = require('fs')
const path = require('path')
const ref = process.argv[2] || ''
if (!ref) { console.log('USAGE node e2e/g7s4r2Invoke.cjs <draft_ref>'); process.exit(1) }
if (!/^g7-s4r2-\d{8}T\d{6}Z-[a-z0-9]{6}$/.test(ref)) { console.log('BAD_REF'); process.exit(1) }
const env = fs.readFileSync('supabase/secrets.local.env', 'utf8')
const tok = ((env.match(/^AUTOMATION_TOKEN=(.*)$/m) || [])[1] || '').trim()
if (!tok) { console.log('NO_AUTOMATION_TOKEN'); process.exit(1) }
const URL = 'https://ivkdfognyiwjcmrhcnwz.supabase.co/functions/v1/social-post-worker'
const PUBLISHABLE = 'sb_publishable_Q7AHrjSYOrysDjxS9_ZB-g_NMmytLOH'
const body = {
  request_key: ref,
  brief: 'G7-S4R2 synthetic runtime verification post (internal test — NOT customer content). พสตทักทายสั้น ๆ แนะนำร้านของไหมแบบเปนทางการ ภาษาไทย',
  source_text: 'synthetic source text for G7 S4-R2 runtime probe — internal test fixture only',
}
;(async () => {
  const r = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: PUBLISHABLE, Authorization: 'Bearer ' + PUBLISHABLE, 'x-automation-token': tok },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000),
  })
  const t = await r.text()
  let j; try { j = JSON.parse(t) } catch { j = t.slice(0, 300) }
  const s = JSON.stringify(j)
  if (s.includes(tok)) { console.log('SECURITY_FAIL_TOKEN_IN_RESPONSE'); process.exit(1) }
  fs.writeFileSync(path.join('e2e', 'g7s4-invoke-' + ref + '.json'), JSON.stringify({ timestamp: new Date().toISOString(), status: r.status, response: j }, null, 2), 'utf8')
  console.log('STATUS ' + r.status)
  console.log('RESP ' + s.slice(0, 700))
})().catch((e) => { console.error('FATAL ' + String(e).slice(0, 300)); process.exit(1) })