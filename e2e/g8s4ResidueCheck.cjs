// G8-S4 — residue check (read-only)
const fs = require('fs')
const SERVICE = (/^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m.exec(fs.readFileSync('supabase/secrets.local.env', 'utf8')) || [])[1]
;(async () => {
  for (const pat of ['g8s4-synth-*', 'g8s2-selftest-*']) {
    const r = await fetch('https://ivkdfognyiwjcmrhcnwz.supabase.co/rest/v1/automation_queue?select=id&id=like.' + pat, { headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE } })
    const j = await r.json()
    console.log('RESIDUE ' + pat + ' = ' + j.length + (j.length ? ' [' + j.map(x => x.id).join(',') + ']' : ''))
  }
})()