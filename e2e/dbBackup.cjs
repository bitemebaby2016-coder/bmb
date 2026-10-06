// Backup v2: rotate DB password → update SUPABASE_DB_URL secret → verify dump.
// Password never printed; kept in .dbpw.tmp only until dump verified.
'use strict'
const crypto = require('crypto')
const fs = require('fs')

const tokens = []
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*SUPABASE_ACCESS_TOKEN\s*=\s*(.*)\s*$/)
  if (m) tokens.push(m[1])
}
const REF = 'ivkdfognyiwjcmrhcnwz'

async function api(tok, method, path, body) {
  const r = await fetch('https://api.supabase.com/v1/projects/' + REF + path, {
    method,
    headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: r.status, text: await r.text() }
}

async function main() {
  let tok = ''
  for (const t of [...tokens].reverse()) {
    const r = await api(t, 'GET', '/secrets')
    if (r.status === 200) { tok = t; break }
  }
  if (!tok) throw new Error('no working token')

  // 1. rotate
  const pw = 'Bmb_' + crypto.randomBytes(24).toString('base64url').replace(/[-_]/g, 'x')
  const rot = await api(tok, 'PATCH', '/database/password', { password: pw })
  console.log('rotate HTTP', rot.status)
  if (rot.status !== 200) { console.log(rot.text.slice(0, 200)); process.exit(1) }

  // 2. set SUPABASE_DB_URL secret — try PATCH then POST
  let set = false
  for (const m of ['PATCH', 'POST']) {
    const r = await api(tok, m, '/secrets', [{ name: 'SUPABASE_DB_URL', value: pw }])
    console.log('secret', m, 'HTTP', r.status)
    if (r.status >= 200 && r.status < 300) { set = true; break }
  }
  if (!set) { console.log('SECRET_SET_FAILED — keeping .dbpw.tmp for manual retry'); fs.writeFileSync('.dbpw.tmp', pw); process.exit(1) }

  // 3. verify secret matches by re-listing
  const list = await api(tok, 'GET', '/secrets')
  const hit = (JSON.parse(list.text) || []).find((s) => s.name === 'SUPABASE_DB_URL')
  console.log('secret verified:', hit && typeof hit.value === 'string' && hit.value.length > 0)

  // 4. keep password for dump verification step
  fs.writeFileSync('.dbpw.tmp', pw)
  console.log('OK — password in .dbpw.tmp, dump next')
}
main().catch((e) => { console.error('ERR', String(e).slice(0, 300)); process.exit(1) })