// R38 print fix — production write: stickerFaceHPx 670 (ค่าผิด · หน้าสั้นกว่าดวงจริง 39px
// → หน้าถัดไปเริ่มก่อนขอบดวง = ขอบบนหาย/ช่วงขาวแปลก · หลักฐานอ่านจาก print_settings จริง)
// → 709 (40×60mm @300dpi = ดวงจริงที่ Owner ยืนยันแล้ว T40x60) · offset คง 0 · read-back ยืนยัน
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
  const before = await q("SELECT value->>'stickerFaceHPx' AS face, value->>'stickerOffsetYPx' AS off, updated_at::text AS upd FROM public.business_settings WHERE key='print_settings'")
  console.log('BEFORE=' + before)
  const up = await q("UPDATE public.business_settings SET value = jsonb_set(value, '{stickerFaceHPx}', '709'::jsonb), updated_at = NOW() WHERE key = 'print_settings' AND value->>'stickerFaceHPx' IS DISTINCT FROM '709' RETURNING value->>'stickerFaceHPx' AS face")
  console.log('UPDATE=' + up)
  const after = await q("SELECT value->>'stickerFaceHPx' AS face, value->>'stickerOffsetYPx' AS off, updated_at::text AS upd FROM public.business_settings WHERE key='print_settings'")
  console.log('AFTER=' + after)
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 400)))