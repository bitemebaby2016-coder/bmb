// R72 — probe: notification duplicates + stuck delivery round + rider accept
'use strict'
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
  return await r.text()
}
const scrub = (s) => String(s).replace(/([0-9a-f]{8})[0-9a-f-]{28}/gi, '$1…')
;(async () => {
  const out = {}
  // A) promotions rows — ทำไม HALLOWEEN10 ไม่ขึ้น dropdown (เช็กวันที่/is_active/typeof)
  out.promos = scrub(await q("SELECT code, is_active, start_date, end_date, pg_typeof(start_date) AS sd_type, pg_typeof(end_date) AS ed_type, discount_type, discount_value, applies_to FROM public.promotions ORDER BY created_at DESC LIMIT 10"))
  // B) PO-20261106-336 — history + แจ้งเตือนทั้งหมดที่ผูก
  out.po336hist = scrub(await q("SELECT to_status, changed_at FROM public.order_status_history WHERE order_number = 'PO-20261106-336' ORDER BY changed_at DESC LIMIT 12"))
  out.po336notifs = scrub(await q("SELECT id, title, notification_type, is_read, created_at FROM public.notifications WHERE message LIKE '%20261106-336%' OR title LIKE '%20261106-336%' ORDER BY created_at DESC LIMIT 15"))
  // C) errors ล่าสุดของระบบ (accept ของไรเดอร์)
  out.syserr = scrub(await q("SELECT left(message,90) AS msg, source, level, created_at FROM public.system_errors ORDER BY created_at DESC LIMIT 8"))
  console.log(JSON.stringify(out, null, 1))
})().catch((e) => { console.error('PROBE_FAIL', String(e).slice(0, 300)); process.exit(1) })