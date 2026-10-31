// R38 anon RLS probe — marketing_posts อ่านจาก anon ได้ไหม (read-only)
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const env = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
const k = (/^VITE_SUPABASE_ANON_KEY=(.*)$/m.exec(env) || [])[1]
const url = (/^VITE_SUPABASE_URL=(.*)$/m.exec(env) || [])[1]
;(async () => {
  if (!k || !url) { console.log('NO_ENV url=' + !!url + ' key=' + !!k); return }
  const r = await fetch(url + '/rest/v1/marketing_posts?select=id,status,title,published_at&order=published_at.desc&limit=5', {
    headers: { apikey: k, Authorization: 'Bearer ' + k },
  })
  console.log('ANON_HTTP=' + r.status)
  console.log('ANON_BODY=' + (await r.text()).slice(0, 600))
})().catch((e) => console.log('ERR ' + String(e).slice(0, 300)))