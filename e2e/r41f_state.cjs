// R41f — เช็คสถานะหลัง apply (idempotent ไหม · ถึงขั้นไหนแล้ว) — read-only เร็ว
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
  console.log('EXT=' + await q("SELECT extname FROM pg_extension WHERE extname IN ('pg_cron','pg_net')"))
  console.log('CRON=' + await q("SELECT jobname, schedule, active FROM cron.job ORDER BY jobname"))
  console.log('FN=' + await q("SELECT proname FROM pg_proc WHERE proname IN ('bmb_tick_http','marketing_publish_due')"))
  console.log('POSTS=' + await q("SELECT id, status, scheduled_for::text AS sched, publish_attempts AS att, provider_post_id IS NOT NULL AS prov, updated_at::text AS upd FROM public.marketing_posts ORDER BY created_at DESC LIMIT 5"))
  console.log('QUEUE=' + await q("SELECT job_type, status, created_at::text FROM public.automation_queue ORDER BY created_at DESC LIMIT 5"))
  console.log('POLL=' + await q("SELECT id, created_at::text FROM public.audit_logs WHERE id LIKE 'g26-poll%' ORDER BY created_at DESC LIMIT 3"))
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 400)))