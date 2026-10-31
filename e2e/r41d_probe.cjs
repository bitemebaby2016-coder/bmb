// R41d — รายละเอียด reply ของคอมเม้น/ข้อความล่าสุด (ส่งแล้วหรือค้าง review?)
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
  console.log('EVENTS=' + await q("SELECT event_type, left(coalesce(content,'-'),50) AS msg, status, reply_status, action_type, ai_guardrail_flags->>'review_status' AS rstat, ai_validated, left(coalesce(last_error,'-'),150) AS err, created_at::text FROM public.social_events ORDER BY created_at DESC LIMIT 8"))
  console.log('POLICY=' + await q("SELECT tablename, policyname FROM pg_policies WHERE schemaname='public' AND tablename='social_events' LIMIT 6"))
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 400)))