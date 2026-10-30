// R25 print probe — อ่าน print_jobs + print_settings + ตาราง queue จริง (read-only) · ใช้แล้วลบ
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')) || [])[1]
const q = async (query) => {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + AT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  return r.text()
}
;(async () => {
  console.log('JOB_STATS=' + (await q('SELECT job_type, status, count(*) AS n FROM public.print_jobs GROUP BY 1,2 ORDER BY 2,1')))
  console.log('RECENT_JOBS=' + (await q("SELECT order_number, job_type, status, printer_id, requested_at::text AS req, updated_at::text AS upd FROM public.print_jobs ORDER BY requested_at DESC LIMIT 8")))
  console.log('PRINT_SETTINGS=' + (await q("SELECT * FROM public.business_settings WHERE key='print_settings'")))
  console.log('QUEUE_TABLES=' + (await q("SELECT tablename FROM pg_tables WHERE schemaname='public' AND (tablename LIKE '%queue%' OR tablename LIKE '%job%') ORDER BY 1")))
  console.log('QUEUE_ROWS=' + (await q('SELECT * FROM public.automation_queue LIMIT 12')))
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 400)))