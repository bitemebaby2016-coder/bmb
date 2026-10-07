// m118StateProbe — READ-ONLY: สถานะ create_order_with_items บน prod (หลัง apply 118 ที่ล้มเหลว)
'use strict'
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const env = {}
for (const l of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^(\w+)=(.*)$/)
  if (m) env[m[1]] = m[2]
}
;(async () => {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env.SUPABASE_ACCESS_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: "select pg_get_functiondef('public.create_order_with_items'::regproc) d" }),
  })
  const j = await r.json()
  if (j.message) { console.error('PROBE_FAIL', j.message); process.exit(1) }
  const d = (j[0] || {}).d || ''
  console.log('has_ERR_BITE_DRIVE_DISABLED', d.includes('ERR_BITE_DRIVE_DISABLED'))
  console.log('has_v_radius_override', d.includes('v_radius_override'))
  console.log('has_channel_param', d.includes('p_source_channel text DEFAULT NULL'))
  console.log('has_5.00_literal', d.includes('5.00'))
  console.log('def_len', d.length)
  console.log('def_tail', JSON.stringify(d.slice(-30)))
})().catch((e) => { console.error('PROBE_ERR', String(e.message || e).slice(0, 300)); process.exit(1) })
