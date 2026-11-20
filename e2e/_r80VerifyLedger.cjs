'use strict'
// _r80VerifyLedger — READ-ONLY ยืนยัน ledger 6 เวอร์ชัน (ตาม pattern r42_verify177178)
const fs = require('fs')
const PROJECT_REF = 'ivkdfognyiwjcmrhcnwz'
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
const SQL = "SELECT version, name FROM supabase_migrations.schema_migrations WHERE version IN ('186','205','206','207','208','209') ORDER BY version;"
;(async () => {
  const token = readToken()
  const r = await fetch('https://api.supabase.com/v1/projects/' + PROJECT_REF + '/database/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, 'User-Agent': 'bmb-verify-r80' },
    body: JSON.stringify({ query: SQL }),
  })
  const body = await r.json().catch(() => null)
  const rows = Array.isArray(body) ? body : []
  const out = { at: new Date().toISOString(), http: r.status, rows, count: rows.length }
  out.ok = rows.length === 6
  fs.writeFileSync('e2e/_r80_verify_ledger.json', JSON.stringify(out, null, 2))
  console.log(JSON.stringify({ ok: out.ok, count: rows.length, versions: rows.map((x) => x.version).join(',') }))
  process.exit(out.ok ? 0 : 1)
})().catch((e) => { console.log('ERR ' + String(e && e.message || e)); process.exit(1) })