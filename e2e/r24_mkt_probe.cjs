// R24 marketing probe — อ่านสถานะโพสต์ตั้งเวลาจริงใน production (read-only) · ใช้แล้วลบ
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
  console.log('NOW_UTC=' + (await q("SELECT now()::text AS n")))
  console.log('POSTS=' + (await q("SELECT id, status, scheduled_for::text AS at, publish_attempts, error, updated_at::text AS upd FROM public.marketing_posts ORDER BY updated_at DESC LIMIT 6")))
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 400)))