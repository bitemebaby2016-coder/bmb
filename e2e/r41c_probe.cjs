// R41c — pg_cron + comment poll history + GH starvation evidence (read-only)
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
  console.log('CRON_JOB=' + await q("SELECT jobname, schedule, active FROM cron.job"))
  console.log('CRON_EXT=' + await q("SELECT extname FROM pg_extension WHERE extname IN ('pg_cron','pg_net')"))
  console.log('POLL_LOGS=' + await q("SELECT id, left(coalesce(description,'-'),200) AS descr, created_at::text FROM public.audit_logs WHERE id LIKE 'g26-poll%' ORDER BY created_at DESC LIMIT 6"))
  console.log('SOCIAL_EVENTS=' + await q("SELECT * FROM public.social_events ORDER BY created_at DESC LIMIT 4"))
  console.log('AI_CONV=' + await q("SELECT id, created_at::text FROM public.ai_conversations ORDER BY created_at DESC LIMIT 5"))
  console.log('EXTENSIONS=' + await q("SELECT extname FROM pg_extension WHERE extname LIKE '%vault%' OR extname LIKE '%net%'"))
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 400)))