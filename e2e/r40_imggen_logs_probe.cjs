// R40 — ดึง log จริงของ image-gen จาก Supabase platform (ไม่ต้องมี admin JWT) · evidence → stdout
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')) || [])[1]
const REF = 'ivkdfognyiwjcmrhcnwz'
;(async () => {
  // 1) edge function logs (platform logs query API — ถ้า 404 แปลว่า endpoint เปลี่ยน = รายงานตามจริง)
  const since = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
  const body = {
    sql: "select id, function_edge_logs.message, event_message, created_at from function_edge_logs where id.name = 'image-gen' and created_at > '" + since + "' order by created_at desc limit 40",
  }
  const r = await fetch('https://api.supabase.com/v1/projects/' + REF + '/logs/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + AT, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  console.log('LOGS_HTTP=' + r.status)
  console.log('LOGS_BODY=' + (await r.text()).slice(0, 3500))
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 400)))