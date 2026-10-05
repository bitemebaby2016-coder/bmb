// fcAudit2 — สรุปชื่อ function ที่อ่าน delivery_policy / bite_drive_radius / bare radius_km / business_settings
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const env = {}
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^(\w+)=(.*)$/)
  if (m) env[m[1]] = m[2]
}
async function run(t, sql) {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const j = await r.json()
  if (j.message) { console.log(t + ' ERR ' + j.message); return }
  console.log(t + ' = ' + j.map((x) => x.proname).join(', '))
}
async function main() {
  await run('DELIVERY_POLICY_FN',
    `select distinct p.proname from pg_proc p where p.pronamespace='public'::regnamespace
       and pg_get_functiondef(p.oid) like '%delivery_policy%'`)
  await run('BITE_DRIVE_FN',
    `select distinct p.proname from pg_proc p where p.pronamespace='public'::regnamespace
       and pg_get_functiondef(p.oid) like '%bite_drive_radius_km%'`)
  await run('BARE_RADIUS_FN (legacy)',
    `select distinct p.proname from pg_proc p where p.pronamespace='public'::regnamespace
       and pg_get_functiondef(p.oid) ~ '[^_]radius_km' and pg_get_functiondef(p.oid) !~ 'bite_drive_radius_km'`)
  await run('SETTINGS_FN',
    `select distinct p.proname from pg_proc p where p.pronamespace='public'::regnamespace
       and pg_get_functiondef(p.oid) like '%business_settings%'`)
  await run('INTERVAL_2H_FN (cutoff ชม. ใน function)',
    `select distinct p.proname from pg_proc p where p.pronamespace='public'::regnamespace
       and pg_get_functiondef(p.oid) ~ 'interval ''2 hours'''`)
}
main().catch((e) => { console.error('ERROR ' + e.message); process.exit(1) })