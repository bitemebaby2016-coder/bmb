// G7-S4-C guard — list production Edge Functions (READ-ONLY) to confirm deploy scopeconst fs = require('fs')
const T = fs.readFileSync('.env.local', 'utf8').match(/^SUPABASE_ACCESS_TOKEN=(.*)$/m)[1].trim();(async () => {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/functions', {
    headers: { Authorization: 'Bearer ' + T },
    signal: AbortSignal.timeout(30000),
  })

  const list = await r.json()

  for (const f of list) console.log('FN ' + f.slug + ' verify_jwt=' + f.verify_jwt + ' version=' + f.version + ' status=' + (f.status || '?'))

})().catch((e) => { console.error('FATAL ' + String(e).slice(0, 200)); process.exit(1) })
// deploy executed via Management API multipart deploy endpoint (see g7s4Deploy.cjs) — slug scoped to social-post-worker only