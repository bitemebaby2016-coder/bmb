// fcFixSync — apply corrected admin_sync_legacy_pre_order (orders ไม่มี cancelled_at)
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const env = {}
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^(\w+)=(.*)$/)
  if (m) env[m[1]] = m[2]
}
async function main() {
  // ดึง def ปัจจุุย แล้วแทนที่เฉพาะส่วนที่ผิด (anchor-guarded)
  const one = async (sql) => {
    const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: sql }),
    })
    const j = await r.json()
    if (j.message) throw new Error(j.message)
    return j
  }
  let def = (await one(`select pg_get_functiondef('public.admin_sync_legacy_pre_order'::regproc) d`))[0].d.replace(/\r\n/g, '\n')
  const rep = (a, b) => {
    const n = def.split(a).length - 1
    if (n !== 1) throw new Error(`anchor x${n}: ${a.slice(0, 60)}`)
    def = def.replace(a, b)
  }
  rep(`  v_cancel  timestamptz;\n`, ``)
  rep(`  SELECT o.status, o.cancelled_at INTO v_status, v_cancel\n    FROM public.orders o WHERE o.id = v_legacy.migrated_order_id;`,
      `  SELECT o.status INTO v_status\n    FROM public.orders o WHERE o.id = v_legacy.migrated_order_id;`)
  rep(`COALESCE(v_legacy.cancelled_at, v_cancel, now())`, `COALESCE(v_legacy.cancelled_at, now())`)
  const res = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `BEGIN;\n${def};\nCOMMIT;` }),
  })
  const j = await res.json()
  if (!res.ok || j.message) { console.error('FIXSYNC_FAIL: ' + JSON.stringify(j).slice(0, 600)); process.exit(1) }
  console.log('FIXSYNC_OK')
}
main().catch((e) => { console.error('FIXSYNC_FAIL: ' + e.message); process.exit(1) })