// R41 probe — scheduled ค้าง? · worker queue · social AI (comments) · EF versions (read-only)
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
  console.log('POSTS=' + await q("SELECT id, status, scheduled_for::text AS sched, left(coalesce(error,'-'),120) AS err, publish_attempts AS att, provider_post_id IS NOT NULL AS prov, updated_at::text AS upd FROM public.marketing_posts ORDER BY created_at DESC LIMIT 8"))
  console.log('QUEUE_MKT=' + await q("SELECT job_type, status, attempt_count, left(coalesce(last_error,'-'),120) AS last_err, created_at::text AS c, updated_at::text AS u FROM public.automation_queue WHERE job_type='marketing_publish' ORDER BY created_at DESC LIMIT 8"))
  console.log('QUEUE_RECENT=' + await q("SELECT job_type, status, attempt_count, created_at::text FROM public.automation_queue ORDER BY created_at DESC LIMIT 8"))
  // social AI: ตารางที่เกี่ยวกับคอมเม้น/บทสนทนา (เจอชื่อก่อน — คิวรอบ)
  console.log('SOCIAL_TABLES=' + await q("SELECT tablename FROM pg_tables WHERE schemaname='public' AND (tablename LIKE '%comment%' OR tablename LIKE '%social%' OR tablename LIKE '%conversation%' OR tablename LIKE '%message%') ORDER BY 1"))
  console.log('QUEUE_SOCIAL=' + await q("SELECT job_type, status, attempt_count, left(coalesce(last_error,'-'),120) AS last_err, created_at::text AS c FROM public.automation_queue WHERE job_type ILIKE '%comment%' OR job_type ILIKE '%social%' OR job_type ILIKE '%ai%' ORDER BY created_at DESC LIMIT 8"))
  console.log('FN_LIST=' + await q("SELECT DISTINCT (regexp_replace(filename, '-[0-9]{10,}-[a-z0-9]+\\.ts$', '')) AS name FROM storage.objects WHERE bucket_id='_supabase_functions_entries' LIMIT 30"))
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 400)))