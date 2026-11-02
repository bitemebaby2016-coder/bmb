// ============================================
// R58 — probe (read-only): อัลบั้มภาพ AI จริงอยู่ที่ไหน + anon list ได้ไหม?
//   Owner: "อัลบั้มภาพที่ AI สร้าง (bmb-images/ai-generated/<หมวด>/) รู้ที่จริงอยู่ที่ไหนบอกด้วย"
// ใช้: node e2e/r58_album_probe.cjs → e2e/r58_album_probe.json
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
  // 1) นับไฟล์จริงตามโฟลเดอร์ (2 ชั้นแรกของ path)
  out.folders = await q(`
    SELECT split_part(name, '/', 1) || '/' || nullif(split_part(name, '/', 2), '') AS folder,
           count(*)::int AS files,
           max(created_at)::text AS latest
    FROM storage.objects
    WHERE bucket_id = 'bmb-images' AND name LIKE 'ai-generated/%'
    GROUP BY 1 ORDER BY 1`)
  // 2) ตัวอย่างไฟล์ 12 ล่าสุด (พาธเต็ม)
  out.samples = await q(`
    SELECT name, created_at::text, (metadata->>'size')::bigint AS bytes
    FROM storage.objects
    WHERE bucket_id = 'bmb-images' AND name LIKE 'ai-generated/%'
    ORDER BY created_at DESC LIMIT 12`)
  // 3) นโยบาย storage ของ bucket — anon list ได้ไหม (หน้าแรกจะ auto-เลือกรูปโปรโมตได้ไหม)
  out.policies = await q(`
    SELECT policyname, cmd, roles::text[] AS roles, qual
    FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (qual ILIKE '%bmb-images%' OR with_check ILIKE '%bmb-images%' OR policyname ILIKE '%bmb%')`)
  fs.writeFileSync(path.join(ROOT, 'e2e/r58_album_probe.json'), JSON.stringify(out, null, 2))
  console.log('FOLDERS=' + out.folders.length + ' SAMPLES=' + out.samples.length + ' POLICIES=' + out.policies.length)
  console.log('WROTE e2e/r58_album_probe.json')
})().catch((e) => { console.error('PROBE_FAIL ' + e.message); process.exit(1) })