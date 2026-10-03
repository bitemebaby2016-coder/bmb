// G7-S4-R2-H — approval boundary via canonical review_content() (existing qa-admin fixture; creds/JWT never printed)
const fs = require('fs')
const sec = fs.readFileSync('supabase/secrets.local.env', 'utf8')
const SVC = ((sec.match(/^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m) || [])[1] || '').trim()
const EMAIL = ((sec.match(/^BMB_TEST_ADMIN_EMAIL=(.*)$/m) || [])[1] || '').trim()
const PASS = ((sec.match(/^BMB_TEST_ADMIN_PASSWORD=(.*)$/m) || [])[1] || '').trim()
const ANON = fs.readFileSync('.env', 'utf8').match(/^VITE_SUPABASE_ANON_KEY=(.*)$/m)[1].trim()
const SB = 'https://ivkdfognyiwjcmrhcnwz.supabase.co'
const capId = process.argv[2] || ''
if (!capId) { console.log('USAGE node e2e/g7s4r2Review.cjs <g7cap_id>'); process.exit(1) }
const rpc = (apiKey, jwt, id) => fetch(SB + '/rest/v1/rpc/review_content', {
  method: 'POST',
  headers: { apikey: apiKey, Authorization: 'Bearer ' + jwt, 'Content-Type': 'application/json' },
  body: JSON.stringify({ p_approval_id: id, p_decision: 'approved', p_note: 'G7-S4-R2 boundary verification' }),
  signal: AbortSignal.timeout(30000),
}).then(async (r) => ({ status: r.status, body: (await r.text()).slice(0, 140) }))
;(async () => {
  // 1) authority negative — service_role is NOT is_admin(); nonexistent id → guard fires before any row touched
  const neg = await rpc(SVC, SVC, 'g7cap-g7-s4r2-nonexistent-negative-probe')
  console.log('NEG_SERVICE_ROLE STATUS=' + neg.status + ' BODY=' + neg.body)
  if (EMAIL === '' || PASS === '') { console.log('NO_ADMIN_FIXTURE'); process.exit(1) }
  // 2) existing fixture admin sign-in (canonical authority)
  const lr = await fetch(SB + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
    signal: AbortSignal.timeout(30000),
  })
  if (!lr.ok) { console.log('ADMIN_LOGIN_FAIL ' + lr.status); process.exit(1) }
  const lj = await lr.json()
  console.log('ADMIN_LOGIN OK (jwt withheld)')
  // 3) canonical human review — the ONLY path to approved
  const rev = await rpc(ANON, lj.access_token, capId)
  console.log('REVIEW STATUS=' + rev.status + ' BODY=' + rev.body)
})().catch((e) => { console.error('FATAL ' + String(e).slice(0, 200)); process.exit(1) })