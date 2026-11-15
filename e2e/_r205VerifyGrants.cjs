'use strict'
// _r205VerifyGrants — ตรวจ grants จริงของ migration 205 (specific_name มี signature ต่อท้าย)
const fs = require('fs')

const PROJECT_REF = 'ivkdfognyiwjcmrhcnwz'
const OUT = 'e2e/_r205_verify_grants.json'

function readToken() {
  for (const f of ['.env.local', '.env']) {
    if (!fs.existsSync(f)) continue
    const txt = fs.readFileSync(f, 'utf8')
    const m2 = txt.match(/^\s*bmb_PAT_SUPABASE_ACCESS_TOKEN\s*=\s*(.+)\s*$/m)
    if (m2) return m2[1].replace(/^["']|["']$/g, '').trim()
    const m1 = txt.match(/^\s*SUPABASE_ACCESS_TOKEN\s*=\s*(.+)\s*$/m)
    if (m1) return m1[1].replace(/^["']|["']$/g, '').trim()
  }
  return null
}

;(async () => {
  const token = readToken()
  const q = [
    'SELECT grantee, privilege_type, specific_name',
    'FROM information_schema.routine_privileges',
    "WHERE specific_name LIKE 'cancel_order_as_customer%'",
    "   OR specific_name LIKE 'social_timeline_for_web%'",
    'ORDER BY specific_name, grantee;',
  ].join('\n')
  const r = await fetch('https://api.supabase.com/v1/projects/' + PROJECT_REF + '/database/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, 'User-Agent': 'bmb-verify-205-grants' },
    body: JSON.stringify({ query: q }),
  })
  const rows = await r.json().catch(() => null)
  const out = { at: new Date().toISOString(), http: r.status, rows }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2))
  console.log(JSON.stringify(rows, null, 1))
})().catch((e) => { console.error(String(e).slice(0, 300)); process.exit(1) })
