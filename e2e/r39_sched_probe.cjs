// R39 probe — scheduled publish + queue + print value (read-only) · evidence → stdout
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
  console.log('POSTS=' + await q("SELECT id, status, scheduled_for::text AS sched, error, publish_attempts AS att, approval_id IS NOT NULL AS has_ap, provider_post_id IS NOT NULL AS has_prov, updated_at::text AS upd FROM public.marketing_posts ORDER BY created_at DESC LIMIT 8"))
  console.log('QUEUE_COLS=' + await q("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='automation_queue' ORDER BY ordinal_position"))
  console.log('QUEUE_MKT=' + await q("SELECT * FROM public.automation_queue WHERE (job_type::text ILIKE '%marketing%' OR job::text ILIKE '%marketing%') ORDER BY created_at DESC LIMIT 6"))
  console.log('QUEUE_RECENT=' + await q("SELECT job_type, status, attempts, last_error, created_at::text, updated_at::text FROM public.automation_queue ORDER BY created_at DESC LIMIT 8"))
  console.log('PRINT=' + await q("SELECT value FROM public.business_settings WHERE key='print_settings'"))
  console.log('SECRETS_FN=' + await q("SELECT 1")) // placeholder ให้ chain ไม่ขาด
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 400)))