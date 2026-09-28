'use strict'
// Deploy phone-auto-login EF via Management API (CLI blocked: no docker daemon)
const fs = require('fs')
const env = fs.readFileSync('D:/A PROJECT/Bite Me Baby/.env', 'utf8')
const tk = ((env.match(/^SUPABASE_ACCESS_TOKEN=(.*)$/m) || [])[1] || process.env.SUPABASE_ACCESS_TOKEN || '').trim()
const src = fs.readFileSync('D:/A PROJECT/Bite Me Baby/supabase/functions/phone-auto-login/index.ts', 'utf8')
const REF = 'ivkdfognyiwjcmrhcnwz'
async function main() {
  const fd = new FormData()
  fd.append('metadata', JSON.stringify({
    entrypoint_path: 'supabase/functions/phone-auto-login/index.ts',
    name: 'phone-auto-login',
    verify_jwt: false,
  }))
  fd.append('files', new Blob([src], { type: 'text/typescript' }), 'supabase/functions/phone-auto-login/index.ts')
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/functions/deploy?slug=phone-auto-login`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + tk },
    body: fd,
  })
  const body = await r.text()
  console.log('status=' + r.status)
  console.log(body.slice(0, 800))
}
main().catch((e) => { console.error('FATAL', String(e).slice(0, 400)); process.exit(1) })
