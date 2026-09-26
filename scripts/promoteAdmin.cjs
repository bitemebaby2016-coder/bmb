// One-off: promote owner account to full-access admin on PRODUCTION
// via Management API SQL endpoint (migration 014 function).
// Usage: node scripts/promoteAdmin.cjs <email>
'use strict'
const REF = process.env.SUPABASE_PROJECT_REF || 'ivkdfognyiwjcmrhcnwz'
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN
if (!TOKEN) { console.log('XMARK no SUPABASE_ACCESS_TOKEN'); process.exit(2) }
const email = process.argv[2] || 'bitemebaby2016@gmail.com'

async function q(sql) {
  const r = await fetch('https://api.supabase.com/v1/projects/' + REF + '/database/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const body = await r.text()
  return { status: r.status, body: body.slice(0, 800) }
}
;(async () => {
  const res = await q("select public.promote_to_full_admin('" + email + "');")
  console.log('promote http', res.status, res.body)
  const chk = await q("select id, email, role, is_owner, is_active from public.profiles where lower(email)='" + email + "';")
  console.log('verify http', chk.status, chk.body)
})().catch((e) => { console.log('XMARK', String(e).slice(0, 300)); process.exit(1) })
