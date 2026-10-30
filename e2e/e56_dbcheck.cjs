// e56: เช็ค DB ก่อน poll — page binding (ไม่มี = UNBOUND_PAGE) + brands + social_events + โพสที่ publish แล้ว
const fs = require('fs')
const path = require('path')
const ROOT = 'D:\\A PROJECT\\Bite Me Baby'
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')) || [])[1]
const q = async (query) => {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST', headers: { Authorization: 'Bearer ' + AT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  return r.text()
}
;(async () => {
  console.log('BINDINGS=' + (await q('SELECT platform, page_id, tenant_id, is_active FROM public.channel_page_bindings')))
  console.log('BRANDS=' + (await q("SELECT id, tenant_id, is_default FROM public.brands WHERE tenant_id = 'tenant-bmb-001'")))
  console.log('SOCIAL_EVENTS=' + (await q('SELECT status, count(*)::int AS n FROM public.social_events GROUP BY status ORDER BY status')))
  console.log('PUBLISHED=' + (await q("SELECT count(*)::int AS n FROM public.marketing_posts WHERE status = 'published' AND provider_post_id IS NOT NULL")))
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 300)))