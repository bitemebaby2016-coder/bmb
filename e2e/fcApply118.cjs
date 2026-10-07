// fcApply118 — สมัคร migration 118 (Owner APPROVED 2026-10-07) — ไฟล์เดียว = transaction เดียว BEGIN...COMMIT
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const env = {}
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^(\w+)=(.*)$/)
  if (m) env[m[1]] = m[2]
}
async function main() {
  const sql = fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', '118_restore_fc_gates_after_117.sql'), 'utf8')
  const res = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const json = await res.json()
  if (!res.ok || json.message) {
    console.error('APPLY118_FAIL: ' + JSON.stringify(json).slice(0, 2000))
    process.exit(1)
  }
  console.log('APPLY118_OK')
}
main().catch((e) => { console.error('APPLY118_FAIL: ' + e.message); process.exit(1) })
