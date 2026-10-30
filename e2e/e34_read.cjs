// e34: ยืนยัน idempotency (dedupe) + ดูค่า field ของแถว marketing queue (ใช้เตรียมรีเซ็ตเป็น pending)
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')) || [])[1]
const q = async (query) => {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST', headers: { Authorization: 'Bearer ' + AT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  return r.text()
}
;(async () => {
  console.log('NOW=' + (await q('SELECT now()::text AS n')))
  console.log('MKROWS=' + (await q("SELECT id, status, attempt_count AS a, available_at::text AS av, claimed_at::text AS cl, lease_until::text AS lease, started_at::text AS st, completed_at::text AS done, next_retry_at::text AS nxt, last_error FROM public.automation_queue WHERE job_type = 'marketing_publish' ORDER BY created_at DESC LIMIT 4")))
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 300)))