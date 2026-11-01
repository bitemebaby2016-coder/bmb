// ============================================
// R44 — T6 probe (read-only): ลิงก์ตะกร้าในคำตอบ FB ตัวจริง = เต็ม /shop?cart=... ไหม?
//   (Owner: กดตามลิงก์ไปยังไม่มีสินค้าในตะกร้า — ดูข้อความตอบล่าสุดจริงจาก social_events)
// ใช้: node e2e/r44_cartlink_probe.cjs
// ============================================
'use strict'
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')) || [])[1]
async function q(query) {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + AT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const t = await r.text()
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + t.slice(0, 400))
  return JSON.parse(t)
}
;(async () => {
  const out = { ran_at: new Date().toISOString() }
  // 1) ดูคอลัมน์จริงของ social_events (SELECT * ล่าสุด 3 แถว)
  out.recent_events = await q(`SELECT * FROM public.social_events ORDER BY created_at DESC LIMIT 3`)
  // 2) คำตอบที่ส่งแล้ว — หาคอลัมน์ที่มีข้อความตอบ (try ชื่อที่เป็นไปได้)
  out.reply_probe = await q(`
    SELECT id, event_type, platform, created_at::text,
           left(content, 300) AS content,
           reply_status,
           left(coalesce(reply_text, reply_content, reply_message, ''), 600) AS reply_body
    FROM public.social_events
    ORDER BY created_at DESC LIMIT 5`)
    .catch(async () => await q(`
      SELECT id, event_type, platform, created_at::text, left(content, 300) AS content, reply_status
      FROM public.social_events ORDER BY created_at DESC LIMIT 5`))
  // 3) audit publish ล่าสุด (footer R44 ขึ้นหรือยัง)
  out.latest_publish = await q(`
    SELECT id, created_at::text, left(description, 300) AS descr
    FROM public.audit_logs WHERE action = 'social.publish'
    ORDER BY created_at DESC LIMIT 3`)
  const file = path.join(__dirname, 'r44_cartlink_probe.json')
  fs.writeFileSync(file, JSON.stringify(out, null, 2))
  console.log('WROTE ' + file)
  const rows = (out.reply_probe && out.reply_probe[0] && out.reply_probe[0].rows) || out.reply_probe || []
  console.log('REPLY_ROWS=' + (Array.isArray(rows) ? rows.length : '?'))
})().catch((e) => { console.log('FATAL ' + String(e).slice(0, 400)); process.exitCode = 1 })