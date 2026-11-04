'use strict'
// _r67_bskeys — list business_settings keys (is the shop phone stored server-side?)
const fs = require('fs')
const path = require('path')
const envPath = path.join(__dirname, '..', 'supabase', 'secrets.local.env')
const env = {}
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
const SVC = env.SUPABASE_SERVICE_ROLE_KEY || ''
const URL = env.SUPABASE_URL || 'https://ivkdfognyiwjcmrhcnwz.supabase.co'
;(async () => {
  const r = await fetch(URL + '/rest/v1/business_settings?select=key,value&limit=200', { headers: { apikey: SVC, Authorization: 'Bearer ' + SVC } })
  const rows = await r.json()
  if (!r.ok) { console.log('ERR ' + r.status + ' ' + JSON.stringify(rows).slice(0, 200)); process.exit(1) }
  const out = {}
  for (const row of rows) {
    const v = typeof row.value === 'string' ? row.value : JSON.stringify(row.value)
    out[row.key] = String(v).slice(0, 1500)
    if (/094|6096995|phone|tel/i.test(String(row.key) + String(v))) console.log('PHONEHIT key=' + row.key + ' value=' + String(v).slice(0, 300))
  }
  fs.writeFileSync(path.join(__dirname, '_r67_bskeys.json'), JSON.stringify(out, null, 2), 'utf8')
  console.log('keys=' + Object.keys(out).join(','))
  process.exit(0)
})().catch((e) => { console.log('FATAL ' + String(e).slice(0, 200)); process.exit(1) })